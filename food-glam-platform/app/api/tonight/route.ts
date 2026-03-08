import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  rankRecommendations,
  fallbackTrending,
  type RecommendationCandidate,
} from '@/lib/recommendations'
import { getVotesByPostIds, getRecentVotes } from '@/lib/data-access/votes'

export async function GET() {
  // Check if local Supabase is running
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const isLocalSupabase = supabaseUrl?.includes('127.0.0.1') || supabaseUrl?.includes('localhost')
  
  if (isLocalSupabase) {
    try {
      const healthCheck = await fetch(`${supabaseUrl}/rest/v1/`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '' }, signal: AbortSignal.timeout(2000) })
      if (!healthCheck.ok) throw new Error('not ok')
    } catch {
      const { MOCK_RECIPES } = await import('@/lib/mock-data')
      const COOK_TIMES: Record<string, number> = {
        'classic-margherita-pizza': 45, 'pad-thai-noodles': 30, 'moroccan-tagine': 150,
        'california-roll': 40, 'vegan-buddha-bowl': 40, 'french-croissants': 120,
        'tacos-al-pastor': 35, 'greek-moussaka': 90, 'indian-butter-chicken': 60,
        'new-york-cheesecake': 75, 'korean-bibimbap': 45, 'spanish-paella': 55,
      }
      const SERVINGS: Record<string, number> = {
        'classic-margherita-pizza': 4, 'pad-thai-noodles': 2, 'moroccan-tagine': 6,
        'california-roll': 2, 'vegan-buddha-bowl': 2, 'french-croissants': 8,
        'tacos-al-pastor': 4, 'greek-moussaka': 6, 'indian-butter-chicken': 4,
        'new-york-cheesecake': 10, 'korean-bibimbap': 2, 'spanish-paella': 4,
      }
      const reasons = ['Trending', 'Trending', 'Popular in your region', 'Similar to your saves', 'Trending'] as const
      const recommendations = MOCK_RECIPES.slice(0, 5).map((r, i) => ({
        id: r.id,
        title: r.title,
        slug: r.slug,
        summary: r.summary,
        hero_image_url: r.hero_image_url,
        approach_name: r.region,
        cook_time_minutes: COOK_TIMES[r.slug] ?? 40,
        servings: SERVINGS[r.slug] ?? 4,
        net_votes: r.votes,
        reason: reasons[i] ?? 'Trending',
        score: r.votes,
      }))
      return NextResponse.json({ recommendations, has_user: false, _note: 'mock data' })
    }
  }

  try {
    const supabase = await createServerSupabaseClient()

    // 1. Get current user (optional — unauthenticated users get trending-only)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // 2. Fetch active recipes with approach info
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select(
        `
        id,
        title,
        slug,
        summary,
        hero_image_url,
        approach_id,
        recipe_json,
        type,
        status,
        approaches:approaches(id, name)
      `
      )
      .eq('type', 'recipe')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(100)

    if (postsError) {
      console.error('Tonight: posts query error:', postsError)
      return NextResponse.json({ error: postsError.message }, { status: 500 })
    }

    if (!posts || posts.length === 0) {
      return NextResponse.json({ recommendations: [], has_user: !!user })
    }

    const postIds = posts.map((p) => p.id)

    // 3. Fetch all-time vote counts (single aggregation query)
    const allVoteMap = await getVotesByPostIds(supabase, postIds)

    // 4. Fetch recent votes (last 7 days) for trending (single aggregation query)
    const recentVoteStatsMap = await getRecentVotes(supabase, postIds, 7)
    
    // Extract trending votes
    const recentVoteMap: Record<string, number> = {}
    Object.entries(recentVoteStatsMap).forEach(([postId, stats]) => {
      recentVoteMap[postId] = stats.trending
    })

    // 5. Fetch user's saved items (if authenticated)
    let savedPostIds = new Set<string>()
    let savedApproachIds = new Set<string>()

    if (user) {
      const { data: savedItems } = await supabase
        .from('collection_items')
        .select('post_id')
        .eq('user_id', user.id)

      if (savedItems) {
        savedPostIds = new Set(savedItems.map((s) => s.post_id))

        // Derive approach affinity from saved items
        posts.forEach((p) => {
          if (savedPostIds.has(p.id) && p.approach_id) {
            savedApproachIds.add(p.approach_id)
          }
        })
      }
    }

    // 6. Build candidates
    const candidates: RecommendationCandidate[] = posts.map((p) => {
      const rj = (p.recipe_json || {}) as Record<string, unknown>
      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        summary: p.summary,
        hero_image_url: p.hero_image_url,
        approach_name: (p.approaches as any)?.name || null,
        approach_id: p.approach_id,
        cook_time_minutes: (rj.cook_time_minutes as number) ?? (rj.cookTime as number) ?? null,
        servings: (rj.servings as number) ?? null,
        net_votes: allVoteMap[p.id] || 0,
        recent_votes: recentVoteMap[p.id] || 0,
        is_saved: savedPostIds.has(p.id),
      }
    })

    // 7. Rank
    let recommendations = rankRecommendations(
      candidates,
      savedApproachIds,
      5
    )

    // 8. Fallback to trending if no scored results
    if (recommendations.length === 0) {
      recommendations = fallbackTrending(candidates, 5)
    }

    return NextResponse.json({
      recommendations,
      has_user: !!user,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Tonight API error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
