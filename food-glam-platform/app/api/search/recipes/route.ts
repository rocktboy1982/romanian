import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { cacheGet, cacheSet } from '@/lib/cache'

/**
 * GET /api/search/recipes
 *
 * Query params:
 *   q          - search text (title + summary full-text / ilike)
 *   approach   - approach slug filter (e.g. "asian")
 *   diet_tags  - comma-separated diet tags (e.g. "vegan,gluten-free")
 *   type       - post type filter (recipe | short | video | image)
 *   sort       - relevance (default) | trending | newest
 *   page       - page number (default 1)
 *   per_page   - results per page (default 12, max 48)
 */
export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl
    const q = url.searchParams.get('q')?.trim() || ''
    const approach = url.searchParams.get('approach')?.trim() || ''
    const dietTagsRaw = url.searchParams.get('diet_tags')?.trim() || ''
    const foodTagsRaw = url.searchParams.get('food_tags')?.trim() || ''
    const type = url.searchParams.get('type')?.trim() || ''
    const sort = url.searchParams.get('sort')?.trim() || 'relevance'
    const cuisine_id = url.searchParams.get('cuisine_id')?.trim() || ''
    const food_style_id = url.searchParams.get('food_style_id')?.trim() || ''
    const cookbook_id = url.searchParams.get('cookbook_id')?.trim() || ''
    const chapter_id = url.searchParams.get('chapter_id')?.trim() || ''
    const is_tested = url.searchParams.get('is_tested') === 'true'
    const tag_filter = url.searchParams.get('tag')?.trim() || ''
    const quality_min = parseFloat(url.searchParams.get('quality_min') || '0') || 0
    const cal_max = parseInt(url.searchParams.get('cal_max') || '0') || 0
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
    const perPage = Math.min(48, Math.max(1, parseInt(url.searchParams.get('per_page') || '12', 10) || 12))
    const foodTags = foodTagsRaw ? foodTagsRaw.split(',').map(t => t.trim()).filter(Boolean) : []
    const dietTags = dietTagsRaw ? dietTagsRaw.split(',').map(t => t.trim()).filter(Boolean) : []

    // ── Shared mock filter helper ──────────────────────────────────────────────
    type MockRecipe = typeof import('@/lib/mock-data').MOCK_RECIPES[number]
    const applyMockFilters = (recipes: MockRecipe[]): MockRecipe[] => {
      let filtered = [...recipes]
      if (q) {
        const lowerQ = q.toLowerCase()
        filtered = filtered.filter(r =>
          r.title.toLowerCase().includes(lowerQ) ||
          r.summary?.toLowerCase().includes(lowerQ)
        )
      }
      if (approach) {
        filtered = filtered.filter(r => r.region?.toLowerCase().replace(/\s+/g, '-') === approach.toLowerCase())
      }
      if (dietTags.length > 0) {
        filtered = filtered.filter(r => dietTags.some(tag => r.dietTags?.includes(tag)))
      }
      if (foodTags.length > 0) {
        filtered = filtered.filter(r => foodTags.some(tag => r.foodTags?.includes(tag)))
      }
      if (is_tested) {
        filtered = filtered.filter(r => r.is_tested)
      }
      if (tag_filter) {
        filtered = filtered.filter(r => r.tag?.toLowerCase() === tag_filter.toLowerCase())
      }
      if (quality_min > 0) {
        filtered = filtered.filter(r => (r.quality_score ?? 0) >= quality_min)
      }
      if (cal_max > 0) {
        filtered = filtered.filter(r => (r.nutrition_per_serving?.calories ?? Infinity) <= cal_max)
      }
      // Sort
      if (sort === 'trending') {
        filtered.sort((a, b) => b.votes - a.votes)
      } else if (sort !== 'newest') {
        filtered.sort((a, b) => (b.quality_score ?? 0) - (a.quality_score ?? 0))
      }
      return filtered
    }
    // Check if local Supabase is running
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const isLocalSupabase = supabaseUrl?.includes('127.0.0.1') || supabaseUrl?.includes('localhost')
    if (isLocalSupabase) {
      try {
        const healthCheck = await fetch(`${supabaseUrl}/rest/v1/`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '' }, signal: AbortSignal.timeout(2000) })
        if (!healthCheck.ok) {
          console.log('Local Supabase not responding, using mock search results')
          const { MOCK_RECIPES } = await import('@/lib/mock-data')
          const filtered = applyMockFilters(MOCK_RECIPES)
          const paginated = filtered.slice((page - 1) * perPage, page * perPage)
          return NextResponse.json({
            recipes: paginated,
            total: filtered.length,
            page,
            per_page: perPage,
            has_more: page * perPage < filtered.length,
            filters: { q, approach, diet_tags: dietTags, food_tags: foodTags, type: type || 'recipe', sort, cuisine_id, food_style_id, cookbook_id, chapter_id, is_tested, tag: tag_filter, quality_min },
            _note: 'Using mock data - Local Supabase not running'
          })
        }
      } catch {
        console.log('Local Supabase health check failed, using mock search results')
        const { MOCK_RECIPES } = await import('@/lib/mock-data')
        const filtered = applyMockFilters(MOCK_RECIPES)
        const paginated = filtered.slice((page - 1) * perPage, page * perPage)
        return NextResponse.json({
          recipes: paginated,
          total: filtered.length,
          page,
          per_page: perPage,
          has_more: page * perPage < filtered.length,
          filters: { q, approach, diet_tags: dietTags, food_tags: foodTags, type: type || 'recipe', sort, cuisine_id, food_style_id, cookbook_id, chapter_id, is_tested, tag: tag_filter, quality_min },
          _note: 'Using mock data - Local Supabase not running'
        })
      }
    }

    // Cache key
    const cacheKey = `search:recipes:${q}:${approach}:${dietTags.join(',')}:${type}:${sort}:${cuisine_id}:${food_style_id}:${cookbook_id}:${chapter_id}:${page}:${perPage}:${cal_max}`
    const cached = cacheGet(cacheKey)
    if (cached) return NextResponse.json(cached)

    const supabase = await createServerSupabaseClient()

    // Build the base query on posts table
    let query = supabase
      .from('posts')
      .select(`
        id,
        title,
        slug,
        summary,
        hero_image_url,
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
      .eq('status', 'active')

    // Type filter - default to recipe if not specified
    if (type && ['recipe', 'short', 'video', 'image'].includes(type)) {
      query = query.eq('type', type)
    } else {
      query = query.eq('type', 'recipe')
    }

    // Text search: try Postgres FTS via search_recipes RPC, fallback to ilike
    if (q) {
      try {
        const { data: ftsIds, error: ftsErr } = await supabase
          .rpc('search_recipes', { query_text: q, limit_count: perPage * page + perPage })
        if (!ftsErr && ftsIds && ftsIds.length > 0) {
          query = query.in('id', (ftsIds as { id: string }[]).map((r) => r.id))
        } else {
          const safeQ = q.replace(/[%_]/g, '')
          query = query.or(`title.ilike.%${safeQ}%,summary.ilike.%${safeQ}%`)
        }
      } catch {
        const safeQ = q.replace(/[%_]/g, '')
        query = query.or(`title.ilike.%${safeQ}%,summary.ilike.%${safeQ}%`)
      }
    }

    // Approach filter - filter by approach slug via the join
    if (approach) {
      // We need the approach_id, so look it up
      const { data: approachRow } = await supabase
        .from('approaches')
        .select('id')
        .eq('slug', approach)
        .single()

      if (approachRow) {
        query = query.eq('approach_id', approachRow.id)
      }
    }

    // Diet tags filter - posts.diet_tags contains all specified tags
    if (dietTags.length > 0) {
      query = query.contains('diet_tags', dietTags)
    }

    // Cookbook hierarchy filters: recipes table has cuisine_id/food_style_id/cookbook_id/chapter_id
    // We look up matching post_ids from the recipes table and filter posts by those ids
    const hierarchyFilters = [
      cuisine_id ? ['cuisine_id', cuisine_id] : null,
      food_style_id ? ['food_style_id', food_style_id] : null,
      cookbook_id ? ['cookbook_id', cookbook_id] : null,
      chapter_id ? ['chapter_id', chapter_id] : null,
    ].filter(Boolean) as [string, string][]

    if (hierarchyFilters.length > 0) {
      let recipesQuery = supabase.from('recipes').select('post_id')
      for (const [col, val] of hierarchyFilters) {
        recipesQuery = recipesQuery.eq(col, val)
      }
      const { data: matchingRecipes } = await recipesQuery
      const matchedPostIds = (matchingRecipes || []).map((r: { post_id: string }) => r.post_id).filter(Boolean)
      if (matchedPostIds.length === 0) {
        // No recipes match — return empty immediately
        const result = {
          recipes: [],
          total: 0,
          page,
          per_page: perPage,
          has_more: false,
          filters: { q, approach, diet_tags: dietTags, type: type || 'recipe', sort, cuisine_id, food_style_id, cookbook_id, chapter_id }
        }
        cacheSet(cacheKey, result, 15)
        return NextResponse.json(result)
      }
      query = query.in('id', matchedPostIds)
    }

    // Sorting
    if (sort === 'newest') {
      query = query.order('created_at', { ascending: false })
    } else if (sort === 'trending') {
      // For trending, we'll sort by created_at desc as a proxy,
      // then re-sort by trending score after fetching votes
      query = query.order('created_at', { ascending: false })
    } else {
      // relevance - if there's a query, the order from ilike is fine;
      // otherwise sort by quality_score desc, then created_at desc
      if (!q) {
        query = query.order('quality_score', { ascending: false, nullsFirst: false })
      }
      query = query.order('created_at', { ascending: false })
    }

    // For trending sort, we need more results to re-sort
    const fetchLimit = sort === 'trending' ? Math.min(200, perPage * 5) : perPage
    const fetchOffset = sort === 'trending' ? 0 : (page - 1) * perPage

    query = query.range(fetchOffset, fetchOffset + fetchLimit - 1)

    const { data: posts, error: postsError, count } = await query

    if (postsError) {
      console.error('Search query error:', postsError)
      return NextResponse.json({ error: postsError.message }, { status: 500 })
    }

    if (!posts || posts.length === 0) {
      const result = {
        recipes: [],
        total: 0,
        page,
        per_page: perPage,
        has_more: false,
        filters: { q, approach, diet_tags: dietTags, type: type || 'recipe', sort, cuisine_id, food_style_id, cookbook_id, chapter_id }
      }
      cacheSet(cacheKey, result, 15)
      return NextResponse.json(result)
    }

    // Fetch vote counts for these posts
    const postIds = posts.map(p => p.id)
    const { data: voteCounts } = await supabase
      .from('votes')
      .select('post_id, value, created_at')
      .in('post_id', postIds)

    // Compute net votes + trending votes (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const voteMap = new Map<string, { net: number; trending: number }>()

    voteCounts?.forEach(vote => {
      const current = voteMap.get(vote.post_id) || { net: 0, trending: 0 }
      const val = vote.value || 0
      current.net += val
      if (vote.created_at && vote.created_at >= sevenDaysAgo) {
        current.trending += val
      }
      voteMap.set(vote.post_id, current)
    })

    // Format recipes
    let formattedRecipes = posts.map(post => {
      const votes = voteMap.get(post.id) || { net: 0, trending: 0 }

      let tag = 'New'
      if (votes.net > 50) tag = 'Trending'
      else if (votes.net > 20) tag = 'Popular'
      else if (post.is_tested) tag = 'Tested'

      const badges: string[] = []
      if (post.is_tested) badges.push('Tested')
      if (votes.net > 30) badges.push('Popular')

      // Supabase join returns objects; cast via `any` to access nested props safely
      const approachData = post.approaches as any
      const creatorData = post.created_by as any

      return {
        id: post.id,
        slug: post.slug,
        title: post.title,
        summary: post.summary,
        hero_image_url: post.hero_image_url || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
        region: approachData?.name as string || 'International',
        approach_slug: approachData?.slug as string || '',
        votes: votes.net,
        trending_votes: votes.trending,
        comments: 0,
        tag,
        badges: badges.length > 0 ? badges : undefined,
        dietTags: post.diet_tags || [],
        foodTags: post.food_tags || [],
        is_tested: post.is_tested,
        quality_score: post.quality_score,
        created_at: post.created_at,
        created_by: {
          id: creatorData?.id as string || '',
          display_name: creatorData?.display_name as string || 'Unknown',
          handle: creatorData?.handle as string || '',
          avatar_url: (creatorData?.avatar_url as string | null) || null
        },
        is_saved: false
      }
    })

    // Apply trending sort if needed (re-sort by trending votes in last 7 days)
    if (sort === 'trending') {
      formattedRecipes.sort((a, b) => b.trending_votes - a.trending_votes || b.votes - a.votes)
      // Paginate after sorting
      const start = (page - 1) * perPage
      formattedRecipes = formattedRecipes.slice(start, start + perPage)
    }

    const totalCount = count ?? 0

    const result = {
      recipes: formattedRecipes,
      total: totalCount,
      page,
      per_page: perPage,
      has_more: page * perPage < totalCount,
      filters: { q, approach, diet_tags: dietTags, type: type || 'recipe', sort, cuisine_id, food_style_id, cookbook_id, chapter_id }
    }

    cacheSet(cacheKey, result, 15)
    return NextResponse.json(result)
  } catch (err: unknown) {
    console.error('Search recipes API error:', err)
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    )
  }
}
