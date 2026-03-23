import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'

/** GET /api/grocery/orders — list user's grocery orders */
export async function GET(req: Request) {
  try {
    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { data, error } = await supabase
      .from('grocery_orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** POST /api/grocery/orders — create a grocery order record
 *  Body: { shopping_list_id?, vendor_id, items, total_estimated_price?, currency?, vendor_order_id?, handoff_url?, status? }
 */
export async function POST(req: Request) {
  try {
    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await req.json() as {
      shopping_list_id?: string
      vendor_id: string
      items: unknown[]
      total_estimated_price?: number
      currency?: string
      vendor_order_id?: string
      handoff_url?: string
      status?: string
    }

    if (!body.vendor_id || !body.items) {
      return NextResponse.json({ error: 'vendor_id and items required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('grocery_orders')
      .insert({
        user_id: user.id,
        shopping_list_id: body.shopping_list_id ?? null,
        vendor_id: body.vendor_id,
        items: body.items,
        total_estimated_price: body.total_estimated_price ?? null,
        currency: body.currency ?? 'RON',
        vendor_order_id: body.vendor_order_id ?? null,
        handoff_url: body.handoff_url ?? null,
        status: body.status ?? 'sent',
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
