import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'

/** GET /api/collections?type=cookbook|watchlist|series&owner_id=xxx */
export async function GET(req: Request) {
  try {
    const authClient = createServerSupabaseClient()
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const ownerId = searchParams.get('owner_id')

    const user = await getRequestUser(req, authClient)

    const supabase = createServiceSupabaseClient()

    let query = supabase
      .from('collections')
      .select('*')
      .order('created_at', { ascending: false })

    if (ownerId) {
      query = query.eq('user_id', ownerId)
    } else if (user) {
      query = query.eq('user_id', user.id)
    } else {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (type === 'cookbook') {
      query = query.or('title.eq.Cookbook,title.ilike.cookbook:%')
    } else if (type === 'watchlist') {
      query = query.or('title.eq.Watchlist,title.ilike.watchlist:%')
    } else if (type === 'series') {
      query = query.ilike('title', 'series:%')
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** POST /api/collections - Create collection */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { title, type, visibility, slug } = body
    const authClient = createServerSupabaseClient()
    const user = await getRequestUser(req, authClient)

    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

    let storedTitle = title
    if (type === 'series' && !title.startsWith('series:')) {
      storedTitle = `series:${title}`
    }

    const metadata: Record<string, unknown> = {}
    if (visibility) metadata.visibility = visibility
    if (slug) metadata.slug = slug
    if (type) metadata.type = type

    const supabase = createServiceSupabaseClient()
    const { data, error } = await supabase
      .from('collections')
      .insert({
        user_id: user.id,
        title: storedTitle,
        items: Object.keys(metadata).length > 0 ? [JSON.stringify(metadata)] : []
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** PATCH /api/collections - Update collection metadata */
export async function PATCH(req: Request) {
  try {
    const { id, title, items } = await req.json()
    const authClient = createServerSupabaseClient()
    const user = await getRequestUser(req, authClient)

    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!id) return NextResponse.json({ error: 'Collection id is required' }, { status: 400 })

    const update: Record<string, unknown> = {}
    if (title !== undefined) update.title = title
    if (items !== undefined) update.items = items

    const supabase = createServiceSupabaseClient()
    const { data, error } = await supabase
      .from('collections')
      .update(update)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** PUT /api/collections - Legacy update (backwards compat) */
export async function PUT(req: Request) {
  try {
    const { id, title, items } = await req.json()
    const authClient = createServerSupabaseClient()
    const user = await getRequestUser(req, authClient)

    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const supabase = createServiceSupabaseClient()
    const { data, error } = await supabase
      .from('collections')
      .update({ title, items })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** DELETE /api/collections */
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json()
    const authClient = createServerSupabaseClient()
    const user = await getRequestUser(req, authClient)

    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const supabase = createServiceSupabaseClient()
    const { error } = await supabase
      .from('collections')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
