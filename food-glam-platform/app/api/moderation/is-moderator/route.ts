import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'

export async function GET(req: Request) {
  try {
    const authClient = createServerSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ isModerator: false })

    const supabase = createServiceSupabaseClient()
    const { data: roles } = await supabase.from('app_roles').select('role').eq('user_id', user.id).in('role', ['moderator', 'admin']).limit(1)
    const isModerator = (roles && roles.length > 0 && ['moderator', 'admin'].includes(roles[0].role))
    return NextResponse.json({ isModerator })
  } catch {
    return NextResponse.json({ isModerator: false })
  }
}
