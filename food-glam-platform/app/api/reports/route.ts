import { NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'
import { isEntityType, isReportCategory } from '@/lib/type-guards'

/* ── GET: Fetch reports (moderator) ──────────────────────── */
export async function GET(req: Request) {
  try {
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, supabase)
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'open'

    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ reports: data || [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/* ── POST: Create a report ───────────────────────────────── */
export async function POST(req: Request) {
  try {
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, supabase)
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const body = await req.json()
    const { entity_type, entity_id, category, details } = body

    if (!isEntityType(entity_type)) {
      return NextResponse.json({ error: 'Invalid entity_type' }, { status: 400 })
    }
    if (!entity_id || typeof entity_id !== 'string') {
      return NextResponse.json({ error: 'entity_id is required' }, { status: 400 })
    }
     if (!isReportCategory(category)) {
       return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
     }

    const { data, error } = await supabase
      .from('reports')
      .insert({
        entity_type,
        entity_id,
        reporter_id: user.id,
        category,
        details: details || null,
        status: 'open',
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, id: data.id }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/* ── PATCH: Update report status (moderator) ─────────────── */
export async function PATCH(req: Request) {
  try {
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, supabase)
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const body = await req.json()
    const { id, status } = body

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Report id is required' }, { status: 400 })
    }
    const validStatuses = ['open', 'reviewing', 'closed'] as const
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const { error } = await supabase
      .from('reports')
      .update({ status })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, id })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
