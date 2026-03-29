import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'

export async function GET(req: Request) {
  try {
    const authClient = createServerSupabaseClient()

    // Auth + moderator check
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const supabase = createServiceSupabaseClient()
    const { data: roles } = await supabase.from('app_roles').select('role').eq('user_id', user.id).in('role', ['moderator', 'admin']).limit(1)
    if (!roles || roles.length === 0) return NextResponse.json({ error: 'Moderator access required' }, { status: 403 })

    // Fetch pending_review posts (the main queue)
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('id, title, type, created_by, hero_image_url, created_at')
      .eq('status', 'pending_review')
      .order('created_at', { ascending: false })
      .limit(100)

    if (postsError) {
      console.error('Moderation pending DB error:', postsError.message)
      return NextResponse.json({ error: 'Failed to fetch pending items' }, { status: 500 })
    }

    // Also fetch pending submissions (legacy table)
    const { data: submissions } = await supabase
      .from('submissions')
      .select('id, title, type, url, content, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(100)

    return NextResponse.json({
      ok: true,
      posts: posts || [],
      submissions: submissions || [],
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
