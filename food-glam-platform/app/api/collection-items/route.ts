import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'
import { isLocalSupabase } from '@/lib/supabase-utils'

// ── In-memory fallback store (dev only, resets on restart) ───────────────────
interface MemItem { collection_id: string; post_id: string; user_id: string; created_at: string }
const DEV_ITEMS: MemItem[] = []
const DEV_COOKBOOK_ID = 'dev-cookbook-001'

// ── GET /api/collection-items ────────────────────────────────────────────────
// Returns all saved items for the current user's cookbook, joined with post data.
export async function GET(req: Request) {
  try {
    if (isLocalSupabase()) {
      // Dev fallback: return in-memory items with stub post data
      const items = DEV_ITEMS.map(item => ({
        ...item,
        posts: null, // No real post data in dev without Supabase
      }))
      return NextResponse.json(items)
    }

    const authClient = createServerSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json([], { status: 200 }) // unauthenticated → empty

    const supabase = createServiceSupabaseClient()

    // Find or lazily create the user's cookbook collection
    let { data: cookbook } = await supabase
      .from('collections')
      .select('id')
      .eq('user_id', user.id)
      .or('title.eq.Cookbook,title.ilike.cookbook:%')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (!cookbook) {
      const { data: created } = await supabase
        .from('collections')
        .insert({ user_id: user.id, title: 'Cookbook', items: [] })
        .select('id')
        .single()
      cookbook = created
    }
    if (!cookbook) return NextResponse.json([])

    // Fetch items joined with post data
    const { data, error } = await supabase
      .from('collection_items')
      .select(`
        collection_id,
        post_id,
        user_id,
        created_at,
        posts:post_id (
          id,
          title,
          slug,
          type,
          hero_image_url,
          diet_tags,
          food_tags,
          video_url,
          created_at,
          approach_id
        )
      `)
      .eq('collection_id', cookbook.id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 })
  }
}

// ── POST /api/collection-items ───────────────────────────────────────────────
// Saves a post to the current user's cookbook. Idempotent (409 if already saved).
export async function POST(req: Request) {
  try {
    const { post_id, collection_id } = await req.json()
    if (!post_id) return NextResponse.json({ error: 'post_id is required' }, { status: 400 })

    if (isLocalSupabase()) {
      // Dev fallback
      const existing = DEV_ITEMS.find(i => i.post_id === post_id)
      if (existing) return NextResponse.json({ ok: true, already_saved: true }, { status: 409 })
      DEV_ITEMS.push({
        collection_id: collection_id || DEV_COOKBOOK_ID,
        post_id,
        user_id: 'dev-user',
        created_at: new Date().toISOString(),
      })
      return NextResponse.json({ ok: true }, { status: 201 })
    }

    const authClient = createServerSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const supabase = createServiceSupabaseClient()

    // Find or create cookbook collection
    let cookbookId = collection_id
    if (!cookbookId) {
      let { data: cookbook } = await supabase
        .from('collections')
        .select('id')
        .eq('user_id', user.id)
        .or('title.eq.Cookbook,title.ilike.cookbook:%')
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      if (!cookbook) {
        const { data: created } = await supabase
          .from('collections')
          .insert({ user_id: user.id, title: 'Cookbook', items: [] })
          .select('id')
          .single()
        cookbook = created
      }
      cookbookId = cookbook?.id
    }
    if (!cookbookId) return NextResponse.json({ error: 'Could not find or create cookbook' }, { status: 500 })

    // Check duplicate
    const { data: existing } = await supabase
      .from('collection_items')
      .select('post_id')
      .eq('collection_id', cookbookId)
      .eq('post_id', post_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) return NextResponse.json({ ok: true, already_saved: true }, { status: 409 })

    const { error } = await supabase
      .from('collection_items')
      .insert({ collection_id: cookbookId, post_id, user_id: user.id })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 })
  }
}

// ── DELETE /api/collection-items ─────────────────────────────────────────────
// Removes a post from the current user's cookbook.
export async function DELETE(req: Request) {
  try {
    const { post_id } = await req.json()
    if (!post_id) return NextResponse.json({ error: 'post_id is required' }, { status: 400 })

    if (isLocalSupabase()) {
      const idx = DEV_ITEMS.findIndex(i => i.post_id === post_id)
      if (idx !== -1) DEV_ITEMS.splice(idx, 1)
      return NextResponse.json({ ok: true })
    }

    const authClient = createServerSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const supabase = createServiceSupabaseClient()

    const { error } = await supabase
      .from('collection_items')
      .delete()
      .eq('post_id', post_id)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 })
  }
}
