import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'
import { v4 as uuidv4 } from 'uuid'

/** POST /api/shopping-lists/share - Generate share token */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { id, can_edit, expires_at } = body as {
      id: string
      can_edit?: boolean
      expires_at?: string
    }
    if (!id || typeof id !== 'string') return NextResponse.json({ error: 'Missing shopping list id' }, { status: 400 })

    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // Verify ownership
    const { data: list } = await supabase
      .from('shopping_lists')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!list) return NextResponse.json({ error: 'List not found' }, { status: 404 })

    const token = uuidv4()
    const insert: Record<string, unknown> = {
      shopping_list_id: id,
      token,
    }
    if (can_edit !== undefined) insert.can_edit = can_edit
    if (expires_at) insert.expires_at = expires_at

    const { data, error } = await supabase
      .from('shopping_list_shares')
      .insert(insert)
      .select('token, can_edit, expires_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const site = process.env.NEXT_PUBLIC_SITE_URL || ''
    const url = site ? `${site.replace(/\/$/, '')}/shared/shopping-list/${data.token}` : `/shared/shopping-list/${data.token}`
    return NextResponse.json({ ok: true, token: data.token, url, can_edit: data.can_edit })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** GET /api/shopping-lists/share?token=xxx - Get share info with list & items */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

    const supabase = createServiceSupabaseClient()
    const { data: share } = await supabase
      .from('shopping_list_shares')
      .select('shopping_list_id, token, can_edit, expires_at')
      .eq('token', token)
      .maybeSingle()

    if (!share) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Check expiry
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Share link has expired' }, { status: 410 })
    }

    // Fetch list metadata
    const { data: list } = await supabase
      .from('shopping_lists')
      .select('id, name, created_at')
      .eq('id', share.shopping_list_id)
      .single()

    // Fetch items
    const { data: items } = await supabase
      .from('shopping_list_items')
      .select('*')
      .eq('shopping_list_id', share.shopping_list_id)
      .order('created_at', { ascending: true })

    return NextResponse.json({
      ok: true,
      list: list || null,
      items: items || [],
      can_edit: share.can_edit || false,
      shopping_list_id: share.shopping_list_id,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** DELETE /api/shopping-lists/share - Revoke a share token */
export async function DELETE(req: Request) {
  try {
    const { token, shopping_list_id } = await req.json()
    if (!token && !shopping_list_id) {
      return NextResponse.json({ error: 'Provide token or shopping_list_id' }, { status: 400 })
    }

    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (token) {
      // Find the share to verify ownership
      const { data: share } = await supabase
        .from('shopping_list_shares')
        .select('shopping_list_id')
        .eq('token', token)
        .maybeSingle()

      if (!share) return NextResponse.json({ error: 'Share not found' }, { status: 404 })

      const { data: listCheck } = await supabase
        .from('shopping_lists')
        .select('id')
        .eq('id', share.shopping_list_id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!listCheck) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

      const { error } = await supabase
        .from('shopping_list_shares')
        .delete()
        .eq('token', token)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      // Revoke all shares for a list
      const { data: listCheck } = await supabase
        .from('shopping_lists')
        .select('id')
        .eq('id', shopping_list_id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!listCheck) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

      const { error } = await supabase
        .from('shopping_list_shares')
        .delete()
        .eq('shopping_list_id', shopping_list_id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
