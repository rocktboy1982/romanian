import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(req: Request) {
  // Check if local Supabase is running
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const isLocalSupabase = supabaseUrl?.includes('127.0.0.1') || supabaseUrl?.includes('localhost')
  
  if (isLocalSupabase) {
    try {
      const healthCheck = await fetch(`${supabaseUrl}/rest/v1/`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '' }, signal: AbortSignal.timeout(2000) })
      if (!healthCheck.ok) {
        console.log('Local Supabase not responding, using mock data')
        const { MOCK_TRENDING } = await import('@/lib/mock-data')
        return NextResponse.json({
          recipes: MOCK_TRENDING,
          _note: 'Using mock data - Local Supabase not running'
        })
      }
    } catch (err) {
      console.log('Local Supabase health check failed, using mock data')
      const { MOCK_TRENDING } = await import('@/lib/mock-data')
      return NextResponse.json({
        recipes: MOCK_TRENDING,
        _note: 'Using mock data - Local Supabase not running'
      })
    }
  }

  try {
    const supabase = await createServerSupabaseClient()

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select(`
        id,
        title,
        slug,
        type,
        status
      `)
      .eq('type', 'recipe')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(50)

    if (postsError) {
      console.error('Posts query error:', postsError)
      return NextResponse.json({ error: postsError.message }, { status: 500 })
    }

    const postIds = posts?.map(p => p.id) || []
    
    const { data: recentVotes, error: voteError } = await supabase
      .from('votes')
      .select('post_id, value')
      .in('post_id', postIds)
      .gte('created_at', sevenDaysAgo.toISOString())

    if (voteError) {
      console.error('Votes query error:', voteError)
    }

    const voteMap = new Map<string, number>()
    recentVotes?.forEach(vote => {
      const current = voteMap.get(vote.post_id) || 0
      voteMap.set(vote.post_id, current + (vote.value || 0))
    })

    const trendingRecipes = posts
      ?.map(post => ({
        id: post.id,
        title: post.title,
        slug: post.slug,
        votes: voteMap.get(post.id) || 0,
        tag: 'Trending'
      }))
      .filter(r => r.votes > 0)
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 10) || []

    return NextResponse.json({ recipes: trendingRecipes })
  } catch (err: any) {
    console.error('Trending API error:', err)
    console.log('Falling back to mock data (Supabase not available)')
    
    // Fallback to mock data when Supabase is unavailable
    const { MOCK_TRENDING } = await import('@/lib/mock-data')
    return NextResponse.json({
      recipes: MOCK_TRENDING,
      _note: 'Using mock data - Supabase not available'
    })
  }
}
