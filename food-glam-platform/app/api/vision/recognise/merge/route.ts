import { NextResponse } from 'next/server'
import { recogniseIngredientsFromPhoto } from '@/lib/ai-provider'
import type { RecognisedIngredient } from '@/lib/ai-provider'
import { SESSION_STORE } from '@/app/api/vision/recognise/route'

/** POST /api/vision/recognise/merge
 *
 *  Accepts two body formats:
 *
 *  1. multipart/form-data { image: File, session_id: string, context?: string }
 *     — Re-scans a new image and merges results into the existing session.
 *
 *  2. application/json { session_id: string, merge_ingredients: RecognisedIngredient[] }
 *     — Merges pre-extracted ingredients into the existing session (no image needed).
 *     Used by the client after it already obtained a fresh scan result.
 *
 *  Returns: updated RecognitionResult
 */
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') ?? ''

    // ── JSON path: client sends pre-extracted ingredients ──────────────────────
    if (contentType.includes('application/json')) {
      const body = await req.json() as { session_id: string; merge_ingredients: RecognisedIngredient[] }
      const { session_id: sessionId, merge_ingredients: newIngredients } = body

      if (!sessionId || !Array.isArray(newIngredients)) {
        return NextResponse.json(
          { error: 'session_id and merge_ingredients are required' },
          { status: 400 },
        )
      }

      const session = SESSION_STORE.get(sessionId)
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }

      const merged = new Map<string, RecognisedIngredient>()
      for (const ing of session.ingredients) merged.set(ing.canonical_name, ing)
      for (const ing of newIngredients) {
        const existing = merged.get(ing.canonical_name)
        if (!existing || ing.confidence > existing.confidence) {
          merged.set(ing.canonical_name, ing)
        }
      }

      const mergedIngredients = Array.from(merged.values())
      const overall = mergedIngredients.length > 0
        ? mergedIngredients.reduce((s, i) => s + i.confidence, 0) / mergedIngredients.length
        : 0

      session.ingredients = mergedIngredients
      session.scans_count += 1

      return NextResponse.json({
        session_id: sessionId,
        context: '',
        ingredients: mergedIngredients,
        confidence_overall: Math.round(overall * 100) / 100,
        processing_time_ms: 0,
        scans_count: session.scans_count,
      })
    }

    // ── FormData path: client sends a new image to re-scan ────────────────────
    const formData = await req.formData()
    const imageFile = formData.get('image') as File | null
    const sessionId = formData.get('session_id') as string | null
    const contextHint = (formData.get('context') as string | null) ?? ''

    if (!imageFile || !sessionId) {
      return NextResponse.json({ error: 'image and session_id required' }, { status: 400 })
    }

    const session = SESSION_STORE.get(sessionId)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const arrayBuffer = await imageFile.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = imageFile.type || 'image/jpeg'

    const newResult = await recogniseIngredientsFromPhoto(base64, mimeType, contextHint, sessionId)

    // Merge: existing + new, deduplicate by canonical_name (keep highest confidence)
    const merged = new Map<string, RecognisedIngredient>()
    for (const ing of session.ingredients) merged.set(ing.canonical_name, ing)
    for (const ing of newResult.ingredients) {
      const existing = merged.get(ing.canonical_name)
      if (!existing || ing.confidence > existing.confidence) {
        merged.set(ing.canonical_name, { ...ing, source_context: contextHint || existing?.source_context })
      }
    }

    const mergedIngredients = Array.from(merged.values())
    const overall = mergedIngredients.length > 0
      ? mergedIngredients.reduce((s, i) => s + i.confidence, 0) / mergedIngredients.length
      : 0

    // Update session
    session.ingredients = mergedIngredients
    session.scans_count += 1

    return NextResponse.json({
      session_id: sessionId,
      context: newResult.context,
      ingredients: mergedIngredients,
      confidence_overall: Math.round(overall * 100) / 100,
      processing_time_ms: newResult.processing_time_ms,
      scans_count: session.scans_count,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
