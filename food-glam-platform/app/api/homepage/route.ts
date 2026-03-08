import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getVotesByPostIds } from '@/lib/data-access/votes'

export async function GET(req: Request) {
  // Check if Supabase is available
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const isLocalSupabase = supabaseUrl?.includes('127.0.0.1') || supabaseUrl?.includes('localhost')
  
  // If local Supabase is configured, check if it's actually running
  if (isLocalSupabase) {
    try {
      const healthCheck = await fetch(`${supabaseUrl}/rest/v1/`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '' }, signal: AbortSignal.timeout(2000) })
      if (!healthCheck.ok) {
        console.log('Local Supabase not responding, using mock data')
        const { MOCK_RECIPES } = await import('@/lib/mock-data')
        return NextResponse.json({
          recipes: MOCK_RECIPES.slice(0, 12),
          has_user: false,
          _note: 'Using mock data - Local Supabase not running (Start with: npx supabase start)'
        })
      }
    } catch (err) {
      console.log('Local Supabase health check failed, using mock data')
      const { MOCK_RECIPES } = await import('@/lib/mock-data')
      return NextResponse.json({
        recipes: MOCK_RECIPES.slice(0, 12),
        has_user: false,
        _note: 'Using mock data - Local Supabase not running (Start with: npx supabase start)'
      })
    }
  }

  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()

    const { data: posts, error: postsError } = await supabase
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
      `)
      .eq('type', 'recipe')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(12)

    if (postsError) {
      console.error('Posts query error:', postsError)
      return NextResponse.json({ error: postsError.message }, { status: 500 })
    }

    const postIds = posts?.map(p => p.id) || []
    const voteMap = await getVotesByPostIds(supabase, postIds)

    let savedPostIds: Set<string> = new Set()
    if (user) {
      const { data: collections, error: collectionsError } = await supabase
        .from('collection_items')
        .select('post_id')
        .eq('user_id', user.id)

      if (!collectionsError && collections) {
        savedPostIds = new Set(collections.map(c => c.post_id))
      }
    }

    const formattedRecipes = posts?.map(post => {
      const netVotes = voteMap[post.id] || 0

      let tag = 'New'
      if (netVotes > 50) tag = 'Trending'
      else if (netVotes > 20) tag = 'Popular'
      else if (post.is_tested) tag = 'Tested'

      const badges = []
      if (post.is_tested) badges.push('Tested')
      if (netVotes > 30) badges.push('Popular')

      return {
        id: post.id,
        slug: post.slug,
        title: post.title,
        summary: post.summary,
        hero_image_url: post.hero_image_url || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
        region: (post.approaches as any)?.name || 'International',
        votes: netVotes,
        comments: 0,
        tag,
        badges: badges.length > 0 ? badges : undefined,
        dietTags: post.diet_tags || [],
        foodTags: post.food_tags || [],
        is_tested: post.is_tested,
        quality_score: post.quality_score,
        created_by: {
          id: post.created_by?.id,
          display_name: post.created_by?.display_name,
          handle: post.created_by?.handle,
          avatar_url: post.created_by?.avatar_url
        },
        is_saved: user ? savedPostIds.has(post.id) : false
      }
    }) || []

    return NextResponse.json({
      recipes: formattedRecipes,
      has_user: !!user
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      },
    })
  } catch (err: any) {
    console.error('Homepage API error:', err)
    console.log('Falling back to mock data (Supabase not available)')
    
    // Always return mock data if Supabase fails
    try {
      const { MOCK_RECIPES } = await import('@/lib/mock-data')
      return NextResponse.json({
        recipes: MOCK_RECIPES.slice(0, 12),
        has_user: false,
        _note: 'Using mock data - Supabase not available'
      })
    } catch (mockErr) {
      console.error('Failed to load mock data:', mockErr)
      return NextResponse.json({
        recipes: [],
        has_user: false,
        error: 'Failed to load data'
      })
    }
  }
}
