import { NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'

async function requireAdmin(req: Request) {
  const supabase = createServiceSupabaseClient()
  const user = await getRequestUser(req, supabase)
  if (!user) return null
  
  // Check app_roles for admin/moderator
  const { data: roles } = await supabase
    .from('app_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['admin', 'moderator'])
    .limit(1)
  
  if (roles && roles.length > 0) return user
  
  // Fallback: check is_moderator flag
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_moderator')
    .eq('id', user.id)
    .single()
  
  if (profile?.is_moderator) return user
  return null
}

type ContentStatus = 'active' | 'pending_review' | 'rejected' | 'deleted'

export async function GET(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const supabase = createServiceSupabaseClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const q = searchParams.get('q')?.toLowerCase()
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')

  // Build query
  let query = supabase
    .from('posts')
    .select(`
      id,
      slug,
      title,
      type,
      status,
      hero_image_url,
      is_tested,
      quality_score,
      diet_tags,
      food_tags,
      created_at,
      created_by,
      profiles!created_by(id, display_name, handle, avatar_url)
    `, { count: 'exact' })
    .eq('type', 'recipe')

  // Filter by status
  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  // Search by title or creator
  if (q) {
    query = query.or(`title.ilike.%${q}%,profiles.display_name.ilike.%${q}%`)
  }

  // Pagination
  query = query.range(offset, offset + limit - 1)

  const { data: posts, count, error } = await query

  if (error) {
    console.error('Error fetching posts:', error)
    return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 })
  }

  // Get vote and comment counts for each post
  const items = await Promise.all((posts || []).map(async (post: any) => {
    const { count: voteCount } = await supabase
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', post.id)

    const { count: commentCount } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('id', post.id)
      .neq('type', 'recipe')

    const profile = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles

    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      type: post.type,
      status: post.status as ContentStatus,
      hero_image_url: post.hero_image_url,
      votes: voteCount || 0,
      comments: commentCount || 0,
      is_tested: post.is_tested || false,
      quality_score: post.quality_score,
      dietTags: post.diet_tags || [],
      region: post.food_tags?.[0] || '',
      created_at: post.created_at,
      created_by: {
        id: post.created_by,
        display_name: profile?.display_name || 'Unknown',
        handle: profile?.handle || '',
        avatar_url: profile?.avatar_url || null,
      },
    }
  }))

  return NextResponse.json({ items, total: count || 0 })
}

export async function PUT(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const supabase = createServiceSupabaseClient()
  const body = await req.json() as { id: string | string[]; status: ContentStatus }
  const ids = Array.isArray(body.id) ? body.id : [body.id]

  // Update posts status
  const { error } = await supabase
    .from('posts')
    .update({ status: body.status })
    .in('id', ids)

  if (error) {
    console.error('Error updating posts:', error)
    return NextResponse.json({ error: 'Failed to update content' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, updated: ids })
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const supabase = createServiceSupabaseClient()
  const body = await req.json() as { id: string | string[] }
  const ids = Array.isArray(body.id) ? body.id : [body.id]

  // Soft delete by setting status to 'deleted'
  const { error } = await supabase
    .from('posts')
    .update({ status: 'deleted' })
    .in('id', ids)

  if (error) {
    console.error('Error deleting posts:', error)
    return NextResponse.json({ error: 'Failed to delete content' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, removed: ids })
}
