import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase-server'

/**
 * GET /api/search/cocktails
 *
 * Dedicated beverage search — only returns cocktail/drink entries from Supabase.
 * No food recipes are ever returned here.
 *
 * Query params:
 *   q          - text search (title + summary)
 *   category   - 'alcoholic' | 'non-alcoholic' | '' (all)
 *   spirit     - spirit slug filter: whisky | gin | rum | tequila | vodka | brandy | liqueur | wine | none
 *   difficulty - easy | medium | hard
 *   sort       - trending (quality_score desc) | newest (created_at desc) | relevance (quality_score desc)
 *   page       - page number (default 1)
 *   per_page   - results per page (default 12, max 48)
 */
export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl
    const q = url.searchParams.get('q')?.trim().toLowerCase() || ''
    const category = url.searchParams.get('category')?.trim() || ''
    const spirit = url.searchParams.get('spirit')?.trim() || ''
    const difficulty = url.searchParams.get('difficulty')?.trim() || ''
    const sort = url.searchParams.get('sort')?.trim() || 'trending'
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
    const perPage = Math.min(48, Math.max(1, parseInt(url.searchParams.get('per_page') || '12', 10) || 12))

    const supabase = createServiceSupabaseClient()

    // Build query: start with base filter for cocktails
    let query = supabase
      .from('posts')
      .select('*')
      .eq('type', 'cocktail')
      .eq('status', 'active')

    // --- Category filter: alcoholic | non-alcoholic ---
    if (category === 'alcoholic' || category === 'non-alcoholic') {
      query = query.eq('recipe_json->>category', category)
    }

    // --- Spirit filter ---
    if (spirit) {
      query = query.eq('recipe_json->>spirit', spirit)
    }

    // --- Difficulty filter ---
    if (difficulty) {
      query = query.eq('recipe_json->>difficulty', difficulty)
    }

    // --- Text search: title + summary ---
    if (q) {
      query = query.or(`title.ilike.%${q}%,summary.ilike.%${q}%`)
    }

    // --- Sort ---
    if (sort === 'newest') {
      query = query.order('created_at', { ascending: false })
    } else {
      // trending and relevance both use quality_score desc
      query = query.order('quality_score', { ascending: false })
    }

    // Execute query without pagination first to get total
    const { data: allResults, error } = await query

    if (error) {
      console.error('Supabase query error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch cocktails' },
        { status: 500 }
      )
    }

    const results = allResults || []
    const total = results.length

    // Apply pagination
    const paginated = results.slice((page - 1) * perPage, page * perPage)

    // Map results to match expected response shape
    const cocktails = paginated.map((post: any) => {
      const recipeJson = post.recipe_json || {}
      return {
        id: post.id,
        slug: post.slug,
        title: post.title,
        summary: post.summary,
        hero_image_url: post.hero_image_url,
        category: recipeJson.category || 'non-alcoholic',
        spirit: recipeJson.spirit || 'none',
        spiritLabel: recipeJson.spiritLabel || 'Mocktail',
        abv: recipeJson.abv ?? null,
        difficulty: recipeJson.difficulty || 'easy',
        serves: recipeJson.serves || 1,
        tags: post.food_tags || [],
        votes: 0, // votes column doesn't exist, use 0
        quality_score: post.quality_score || 0,
        is_tested: post.is_tested || false,
        created_by: {
          id: post.created_by || 'unknown',
          display_name: post.created_by || 'Unknown',
          handle: '@unknown',
          avatar_url: null,
        },
      }
    })

    return NextResponse.json({
      cocktails,
      total,
      page,
      per_page: perPage,
      has_more: page * perPage < total,
      filters: { q, category, spirit, difficulty, sort },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (err: unknown) {
    console.error('Cocktail search error:', err)
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    )
  }
}
