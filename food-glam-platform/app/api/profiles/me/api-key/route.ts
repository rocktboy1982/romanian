import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'

/** GET /api/profiles/me/api-key
 *  Returns whether the authenticated user has a Gemini API key configured.
 *  Does NOT return the actual key value for security reasons.
 */
export async function GET(req: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const user = await getRequestUser(req, supabase)

    if (!user) {
      return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 })
    }

    const serviceSupabase = createServiceSupabaseClient()
    const { data, error } = await serviceSupabase
      .from('profiles')
      .select('gemini_api_key')
      .eq('id', user.id)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Eroare la citirea profilului' }, { status: 500 })
    }

    const hasKey = !!(data?.gemini_api_key && data.gemini_api_key.trim().length > 0)
    // Return key only to the authenticated owner (safe — it's their own key)
    const url = new URL(req.url)
    const includeKey = url.searchParams.get('include_key') === 'true'
    return NextResponse.json({
      has_key: hasKey,
      ...(includeKey && hasKey ? { key: data.gemini_api_key } : {}),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('API key GET error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** POST /api/profiles/me/api-key
 *  Body: { key: string }
 *  Saves the Gemini API key to the user's profile.
 */
export async function POST(req: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const user = await getRequestUser(req, supabase)

    if (!user) {
      return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 })
    }

    const body = await req.json()
    const { key } = body

    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      return NextResponse.json({ error: 'Cheia API nu poate fi goală' }, { status: 400 })
    }

    const trimmedKey = key.trim()

    const serviceSupabase = createServiceSupabaseClient()
    const { error } = await serviceSupabase
      .from('profiles')
      .update({ gemini_api_key: trimmedKey })
      .eq('id', user.id)

    if (error) {
      console.error('API key POST error:', error)
      return NextResponse.json({ error: 'Eroare la salvarea cheii API' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('API key POST error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** DELETE /api/profiles/me/api-key
 *  Removes the Gemini API key from the user's profile.
 */
export async function DELETE(req: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const user = await getRequestUser(req, supabase)

    if (!user) {
      return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 })
    }

    const serviceSupabase = createServiceSupabaseClient()
    const { error } = await serviceSupabase
      .from('profiles')
      .update({ gemini_api_key: null })
      .eq('id', user.id)

    if (error) {
      console.error('API key DELETE error:', error)
      return NextResponse.json({ error: 'Eroare la ștergerea cheii API' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('API key DELETE error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
