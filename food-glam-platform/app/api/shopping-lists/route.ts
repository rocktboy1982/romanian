import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'

/** GET /api/shopping-lists - List user's shopping lists with item counts */
export async function GET(req: NextRequest) {
  try {
    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { data, error } = await supabase
      .from('shopping_lists')
      .select('*, shopping_list_items(count)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** POST /api/shopping-lists - Create a shopping list */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, source_type, source_ref, period_from, period_to } = body as {
      name: string
      source_type?: 'manual' | 'meal_plan'
      source_ref?: string
      period_from?: string
      period_to?: string
    }

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const insert: Record<string, unknown> = {
      user_id: user.id,
      name,
    }
    if (source_type) insert.source_type = source_type
    if (source_ref) insert.source_ref = source_ref
    if (period_from) insert.period_from = period_from
    if (period_to) insert.period_to = period_to

    const { data, error } = await supabase
      .from('shopping_lists')
      .insert(insert)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** PATCH /api/shopping-lists - Update list metadata */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, name } = body as { id: string; name?: string }

    if (!id) return NextResponse.json({ error: 'List id is required' }, { status: 400 })

    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const update: Record<string, unknown> = {}
    if (name !== undefined) update.name = name

    const { data, error } = await supabase
      .from('shopping_lists')
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

/** DELETE /api/shopping-lists - Delete a shopping list */
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'List id is required' }, { status: 400 })

    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // Delete items first, then the list
    await supabase
      .from('shopping_list_items')
      .delete()
      .eq('shopping_list_id', id)

    const { error } = await supabase
      .from('shopping_lists')
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
