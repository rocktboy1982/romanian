import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'

// Dev-only helper: upsert `app_roles` for the current user as 'moderator'.
export async function POST(req: Request) {
  if (process.env.NODE_ENV !== 'development') return NextResponse.json({ error: 'Not available' }, { status: 403 })
  const authClient = createServerSupabaseClient()
  const user = await getRequestUser(req, authClient)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const supabase = createServiceSupabaseClient()
  const role = 'moderator'
  const { error } = await supabase.from('app_roles').upsert({ user_id: user.id, role })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
