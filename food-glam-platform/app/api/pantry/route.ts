import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'
import { resolveIngredientName } from '@/lib/ingredient-aliases'

/**
 * GET /api/pantry?category=pantry|bar
 * List user's pantry or bar items
 */
export async function GET(req: NextRequest) {
  try {
    // Use server client (reads cookies) for auth, service client for data
    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const category = req.nextUrl.searchParams.get('category') || 'pantry'

    const { data, error } = await supabase
      .from('pantry')
      .select('*')
      .eq('user_id', user.id)
      .eq('category', category)
      .order('item_name')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/pantry
 * Add or upsert an item. Body: { name, quantity?, unit?, category?, expiration_date?, source? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, quantity, unit, category = 'pantry', expiration_date, source = 'manual' } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const canonical = resolveIngredientName(name.trim().toLowerCase())
    const qtyNum = quantity != null ? Number(quantity) : null

    const { data, error } = await supabase
      .from('pantry')
      .upsert(
        {
          user_id: user.id,
          item_name: name.trim(),
          canonical_name: canonical,
          quantity: quantity != null ? String(quantity) : null,
          qty_numeric: qtyNum,
          unit: unit || null,
          category,
          expiration_date: expiration_date || null,
          source,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,canonical_name,category', ignoreDuplicates: false }
      )
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * DELETE /api/pantry
 * Remove an item. Body: { id }
 */
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { error } = await supabase
      .from('pantry')
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

/**
 * PATCH /api/pantry
 * Update item fields. Body: { id, quantity?, unit?, expiration_date?, name? }
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...updates } = body

    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (updates.name != null) {
      patch.item_name = updates.name
      patch.canonical_name = resolveIngredientName(updates.name.trim().toLowerCase())
    }
    if (updates.quantity != null) {
      patch.quantity = String(updates.quantity)
      patch.qty_numeric = Number(updates.quantity)
    }
    if (updates.unit !== undefined) patch.unit = updates.unit
    if (updates.expiration_date !== undefined) patch.expiration_date = updates.expiration_date || null

    const { data, error } = await supabase
      .from('pantry')
      .update(patch)
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
