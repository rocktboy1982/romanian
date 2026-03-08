import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isLocalSupabase } from '@/lib/supabase-utils'
import { slugify } from '@/lib/slug'
import { validateContent } from '@/lib/profanity-filter'

const ALLOWED_TYPES = ['recipe', 'short', 'image', 'video'] as const
const ALLOWED_STATUSES = ['draft', 'active'] as const
const MAX_POSTS_PER_DAY = 1

// In-memory fallback store for local dev (resets on server restart)
const DEV_POSTS: Record<string, unknown>[] = []
const DEV_USER_ID = 'dev-user-001'

/** Check if user has already posted today (local dev fallback) */
function hasPostedTodayDev(userId: string): boolean {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  return DEV_POSTS.some(
    (p) => p.created_by === userId && typeof p.created_at === 'string' && p.created_at > oneDayAgo
  )
}
/* ── POST: Create a new post ──────────────────────────────── */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { title, type, slug, hero_image_url, approach_id, diet_tags, food_tags, recipe_json, status } = body
    // Validation
    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Invalid content type' }, { status: 400 })
    }
    const postStatus = ALLOWED_STATUSES.includes(status) ? status : 'draft'

    // Profanity check
    const titleCheck = validateContent(title)
    if (titleCheck) return NextResponse.json({ error: titleCheck }, { status: 400 })

    // ── Local dev fallback (no real Supabase) ──────────────────────
    if (isLocalSupabase()) {
      // Rate limit: 1 post per day per user
      if (hasPostedTodayDev(DEV_USER_ID)) {
        return NextResponse.json(
          { error: 'You can only publish 1 post per day. Try again tomorrow.' },
          { status: 429 }
        )
      }

      const baseSlug = slugify(slug || title.trim())
      const finalSlug = `${baseSlug}-${Date.now().toString(36)}`
      const id = `dev-post-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const post = {
        id, title: title.trim(), type, slug: finalSlug,
        hero_image_url: hero_image_url || null,
        approach_id: approach_id || null,
        diet_tags: Array.isArray(diet_tags) ? diet_tags : null,
        food_tags: Array.isArray(food_tags) ? food_tags : null,
        recipe_json: recipe_json || null,
        status: postStatus,
        created_by: DEV_USER_ID,
        created_at: new Date().toISOString(),
      }
      DEV_POSTS.push(post)
      console.log(`[submit] Dev fallback: saved post "${title}" (id=${id})`)
      return NextResponse.json({ ok: true, id }, { status: 201 })
    }

    // ── Real Supabase ───────────────────────────────────────────────
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Rate limit: 1 post per day per user
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: recentCount } = await supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', user.id)
      .gte('created_at', oneDayAgo)
    if (recentCount !== null && recentCount >= MAX_POSTS_PER_DAY) {
      return NextResponse.json(
        { error: 'You can only publish 1 post per day. Try again tomorrow.' },
        { status: 429 }
      )
    }
    // Build slug (ensure unique by appending random suffix)
    const baseSlug = slugify(slug || title.trim())
    const finalSlug = `${baseSlug}-${Date.now().toString(36)}`
    const insert: Record<string, unknown> = {
      title: title.trim(),
      type,
      slug: finalSlug,
      hero_image_url: hero_image_url || null,
      approach_id: approach_id || null,
      diet_tags: Array.isArray(diet_tags) ? diet_tags : null,
      food_tags: Array.isArray(food_tags) ? food_tags : null,
      recipe_json: recipe_json || null,
      status: postStatus,
      created_by: user.id,
    }
    const { data, error } = await supabase.from('posts').insert(insert).select('id').single()
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, id: data.id })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/* ── PATCH: Update an existing post ───────────────────────── */
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { id, title, hero_image_url, approach_id, diet_tags, recipe_json, status } = body

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Post id is required' }, { status: 400 })
    }

    // Auth
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('posts')
      .select('id, created_by')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }
    if (existing.created_by !== user.id) {
      return NextResponse.json({ error: 'Not authorized to edit this post' }, { status: 403 })
    }

    const update: Record<string, unknown> = {}
    if (title !== undefined) update.title = String(title).trim()
    if (hero_image_url !== undefined) update.hero_image_url = hero_image_url || null
    if (approach_id !== undefined) update.approach_id = approach_id || null
    if (diet_tags !== undefined) update.diet_tags = Array.isArray(diet_tags) ? diet_tags : null
    if (recipe_json !== undefined) update.recipe_json = recipe_json
    if (status !== undefined && ALLOWED_STATUSES.includes(status)) update.status = status

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { error } = await supabase.from('posts').update(update).eq('id', id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, id })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/* ── DELETE: Archive a post (soft delete) ─────────────────── */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Post id is required' }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('posts')
      .select('id, created_by')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }
    if (existing.created_by !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const { error } = await supabase.from('posts').update({ status: 'archived' }).eq('id', id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
