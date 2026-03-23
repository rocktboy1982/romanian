import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'

/** GET /api/grocery/vendors/my — user's active vendor configs */
export async function GET(req: Request) {
  try {
    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { data, error } = await supabase
      .from('user_vendor_configs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Map DB snake_case to the format the client expects
    const configs = (data ?? []).map(row => ({
      vendor_id: row.vendor_id,
      is_default: row.is_default,
      preferred_store: row.preferred_store,
      preferred_city: row.preferred_city,
    }))

    return NextResponse.json(configs)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** POST /api/grocery/vendors/my
 *  Body: { vendor_id, is_default?, preferred_store?, preferred_city? }
 */
export async function POST(req: Request) {
  try {
    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await req.json() as {
      vendor_id: string
      is_default?: boolean
      preferred_store?: string
      preferred_city?: string
    }

    if (!body.vendor_id) {
      return NextResponse.json({ error: 'vendor_id required' }, { status: 400 })
    }

    // If setting as default, clear existing defaults
    if (body.is_default) {
      await supabase
        .from('user_vendor_configs')
        .update({ is_default: false })
        .eq('user_id', user.id)
    }

    const { data, error } = await supabase
      .from('user_vendor_configs')
      .upsert({
        user_id: user.id,
        vendor_id: body.vendor_id,
        is_default: body.is_default ?? false,
        preferred_store: body.preferred_store ?? null,
        preferred_city: body.preferred_city ?? 'bucharest',
      }, { onConflict: 'user_id,vendor_id' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      vendor_id: data.vendor_id,
      is_default: data.is_default,
      preferred_store: data.preferred_store,
      preferred_city: data.preferred_city,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** DELETE /api/grocery/vendors/my
 *  Body: { vendor_id }
 */
export async function DELETE(req: Request) {
  try {
    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { vendor_id } = await req.json() as { vendor_id: string }

    if (!vendor_id) {
      return NextResponse.json({ error: 'vendor_id required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('user_vendor_configs')
      .delete()
      .eq('user_id', user.id)
      .eq('vendor_id', vendor_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
