import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params
    const authClient = createServerSupabaseClient()

    const url = new URL(req.url)
    const type = url.searchParams.get('type') || 'recipe'
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50)
    const offset = parseInt(url.searchParams.get('offset') || '0', 10)

    const supabase = createServiceSupabaseClient()

    // Resolve handle → profile id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('handle', handle)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Get current user for saved state
    const user = await getRequestUser(req, authClient)

    // Fetch posts by this creator
    const { data: posts, error: postsError, count } = await supabase
      .from('posts')
      .select(`
        id,
        title,
        slug,
        summary,
        hero_image_url,
        created_by,
        approach_id,
        is_tested,
        quality_score,
        diet_tags,
        food_tags,
        type,
        status,
        created_at,
        created_by:profiles(id, display_name, handle, avatar_url),
        approaches:approaches(id, name, slug)
      `, { count: 'exact' })
      .eq('created_by', profile.id)
      .eq('type', type)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (postsError) {
      console.error('Posts query error:', postsError)
      return NextResponse.json({ error: postsError.message }, { status: 500 })
    }

    // Gather vote counts
    const postIds = posts?.map(p => p.id) || []
    const voteMap = new Map<string, number>()

    if (postIds.length > 0) {
      const { data: voteCounts } = await supabase
        .from('votes')
        .select('post_id, value')
        .in('post_id', postIds)

      voteCounts?.forEach(vote => {
        const current = voteMap.get(vote.post_id) || 0
        voteMap.set(vote.post_id, current + (vote.value || 0))
      })
    }

    // Saved posts for current user
    let savedPostIds: Set<string> = new Set()
    if (user && postIds.length > 0) {
      const { data: collections } = await supabase
        .from('collection_items')
        .select('post_id')
        .eq('user_id', user.id)
        .in('post_id', postIds)

      if (collections) {
        savedPostIds = new Set(collections.map(c => c.post_id))
      }
    }

    const formattedPosts = posts?.map(post => {
      const netVotes = voteMap.get(post.id) || 0
      let tag = 'New'
      if (netVotes > 50) tag = 'Trending'
      else if (netVotes > 20) tag = 'Popular'
      else if (post.is_tested) tag = 'Tested'

      const badges: string[] = []
      if (post.is_tested) badges.push('Tested')
      if (netVotes > 30) badges.push('Popular')

      return {
        id: post.id,
        slug: post.slug,
        title: post.title,
        summary: post.summary,
        hero_image_url: post.hero_image_url || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
        region: (post.approaches as unknown as Record<string, unknown>)?.name as string || 'International',
        votes: netVotes,
        comments: 0,
        tag,
        badges: badges.length > 0 ? badges : undefined,
        dietTags: post.diet_tags || [],
        foodTags: post.food_tags || [],
        is_tested: post.is_tested,
        quality_score: post.quality_score,
        type: post.type,
        created_at: post.created_at,
        created_by: {
          id: (post.created_by as Record<string, unknown>)?.id,
          display_name: (post.created_by as Record<string, unknown>)?.display_name,
          handle: (post.created_by as Record<string, unknown>)?.handle,
          avatar_url: (post.created_by as Record<string, unknown>)?.avatar_url,
        },
        is_saved: user ? savedPostIds.has(post.id) : false,
      }
    }) || []

    return NextResponse.json({
      posts: formattedPosts,
      total: count ?? 0,
      has_more: (count ?? 0) > offset + limit,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Profile posts API error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
