import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'

/** GET /api/shopping-lists/[id]/items - Fetch all items for a list */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const { data, error } = await supabase
      .from('shopping_list_items')
      .select('*')
      .eq('shopping_list_id', id)
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** POST /api/shopping-lists/[id]/items - Add item to list */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { name, amount, unit, notes } = body as {
      name: string
      amount?: number
      unit?: string
      notes?: string
    }

    if (!name) return NextResponse.json({ error: 'Item name is required' }, { status: 400 })

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

    const insert: Record<string, unknown> = {
      shopping_list_id: id,
      name,
      checked: false,
    }
    if (amount !== undefined) insert.amount = amount
    if (unit) insert.unit = unit
    if (notes) insert.notes = notes

    const { data, error } = await supabase
      .from('shopping_list_items')
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

/** PATCH /api/shopping-lists/[id]/items - Update an item */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { item_id, name, amount, unit, notes, checked } = body as {
      item_id: string
      name?: string
      amount?: number
      unit?: string
      notes?: string
      checked?: boolean
    }

    if (!item_id) return NextResponse.json({ error: 'item_id is required' }, { status: 400 })

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

    const update: Record<string, unknown> = {}
    if (name !== undefined) update.name = name
    if (amount !== undefined) update.amount = amount
    if (unit !== undefined) update.unit = unit
    if (notes !== undefined) update.notes = notes
    if (checked !== undefined) update.checked = checked

    const { data, error } = await supabase
      .from('shopping_list_items')
      .update(update)
      .eq('id', item_id)
      .eq('shopping_list_id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** DELETE /api/shopping-lists/[id]/items - Delete an item */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { item_id } = await req.json()

    if (!item_id) return NextResponse.json({ error: 'item_id is required' }, { status: 400 })

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

    const { error } = await supabase
      .from('shopping_list_items')
      .delete()
      .eq('id', item_id)
      .eq('shopping_list_id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
