import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'
import { resolveIngredientName } from '@/lib/ingredient-aliases'
import { isAlcoholicIngredient } from '@/lib/normalize-for-search'

interface BulkItem {
  name: string
  quantity?: number | string
  unit?: string
  category?: 'pantry' | 'bar'
  expiration_date?: string
  source?: string
}

/**
 * POST /api/pantry/bulk
 * Bulk add items from scan or shopping list.
 * Auto-detects category (pantry vs bar) if not specified.
 * Body: { items: BulkItem[] }
 */
export async function POST(req: NextRequest) {
  try {
    const { items } = await req.json() as { items: BulkItem[] }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items array is required' }, { status: 400 })
    }

    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const rows = items.map(item => {
      const canonical = resolveIngredientName(item.name.trim().toLowerCase())
      const autoCategory = item.category || (isAlcoholicIngredient(item.name) ? 'bar' : 'pantry')
      return {
        user_id: user.id,
        item_name: item.name.trim(),
        canonical_name: canonical,
        quantity: item.quantity != null ? String(item.quantity) : null,
        qty_numeric: item.quantity != null ? Number(item.quantity) : null,
        unit: item.unit || null,
        category: autoCategory,
        expiration_date: item.expiration_date || null,
        source: item.source || 'scan',
        updated_at: new Date().toISOString(),
      }
    })

    const { data, error } = await supabase
      .from('pantry')
      .upsert(rows, { onConflict: 'user_id,canonical_name,category', ignoreDuplicates: false })
      .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      added: data?.length || 0,
      items: data,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
