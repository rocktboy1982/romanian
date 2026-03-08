import { NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'

async function requireAdmin(req: Request) {
  const supabase = createServiceSupabaseClient()
  const user = await getRequestUser(req, supabase)
  if (!user) return null
  const { data: roles } = await supabase.from('app_roles').select('role').eq('user_id', user.id).in('role', ['admin', 'moderator']).limit(1)
  if (roles && roles.length > 0) return user
  const { data: profile } = await supabase.from('profiles').select('is_moderator').eq('id', user.id).single()
  if (profile?.is_moderator) return user
  return null
}

export async function GET(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const supabase = createServiceSupabaseClient()
  const now = new Date().toISOString()

  // Fetch active sanctions (not expired)
  const { data, error } = await supabase
    .from('user_sanctions')
    .select('id, user_id, type, reason, created_at, expires_at, created_by')
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get profile names for sanctioned users
  const userIds = [...new Set((data || []).map(s => s.user_id))]
  let profileMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', userIds)
    for (const p of profiles || []) {
      profileMap[p.id] = p.display_name || 'Necunoscut'
    }
  }

  const sanctions = (data || []).map(s => ({
    id: s.id,
    user_id: s.user_id,
    user_name: profileMap[s.user_id] || 'Necunoscut',
    type: s.type,
    reason: s.reason || '',
    created_at: s.created_at,
    expires_at: s.expires_at,
  }))

  return NextResponse.json({ sanctions })
}

export async function POST(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const supabase = createServiceSupabaseClient()
  const body = await req.json() as { user_id: string; type: string; reason?: string; expires_at?: string }

  const validTypes = ['warn', 'cooldown', 'suspend', 'ban']
  if (!validTypes.includes(body.type)) {
    return NextResponse.json({ error: 'Invalid sanction type' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('user_sanctions')
    .insert({
      user_id: body.user_id,
      type: body.type,
      reason: body.reason || null,
      created_by: admin.id,
      expires_at: body.expires_at || null,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id }, { status: 201 })
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const supabase = createServiceSupabaseClient()
  const body = await req.json() as { id: string }

  const { error } = await supabase
    .from('user_sanctions')
    .delete()
    .eq('id', body.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
