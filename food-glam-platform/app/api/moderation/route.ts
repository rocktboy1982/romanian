import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'

export async function GET(req: Request) {
  const authClient = createServerSupabaseClient()
  const user = await getRequestUser(req, authClient)
  if (!user) return NextResponse.json([], { status: 200 })

  const supabase = createServiceSupabaseClient()

  // Moderator role check — verify actual role value
  const { data: roles } = await supabase.from('app_roles').select('role').eq('user_id', user.id).in('role', ['moderator', 'admin']).limit(1)
  const isModerator = (roles && roles.length > 0)
  if (!isModerator) return NextResponse.json([], { status: 200 })

  // Include content and url for preview in moderation UI
  const { data, error } = await supabase.from('posts').select('id,title,type,created_by,content,url,created_at').eq('status', 'pending_review').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: Request) {
  const body = await req.json()
  // Allow single or bulk ids
  const ids: string[] = Array.isArray(body.id) ? body.id : [body.id]
  const status: string = body.status
  const authClient = createServerSupabaseClient()
  const user = await getRequestUser(req, authClient)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const supabase = createServiceSupabaseClient()

  const { data: putRoles } = await supabase.from('app_roles').select('role').eq('user_id', user.id).in('role', ['moderator', 'admin']).limit(1)
  if (!putRoles || putRoles.length === 0) return NextResponse.json({ error: 'Moderator access required' }, { status: 403 })

  const { data, error } = await supabase.from('posts').update({ status }).in('id', ids).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ updated: data })
}
