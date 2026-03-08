import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { REGION_META } from '@/lib/recipe-taxonomy'
import { resolveCountrySlug } from '@/lib/country-slug-map'

/**
 * GET /api/recipes/by-region?region=southeast-asia&limit=60&offset=0
 * GET /api/recipes/by-region?region=southeast-asia&country=cambodian&limit=60
 *
 * Returns recipes for all countries in a region (or one specific country).
 * Resolves taxonomy IDs to DB slug prefixes via country-slug-map.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const region = searchParams.get('region')?.toLowerCase().trim()
  const country = searchParams.get('country')?.toLowerCase().trim() // optional country filter
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '60'), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  if (!region) {
    return NextResponse.json({ error: 'region param required' }, { status: 400 })
  }

  const meta = REGION_META[region]
  if (!meta) {
    return NextResponse.json({ error: `Unknown region: ${region}` }, { status: 404 })
  }

  // Resolve taxonomy IDs → DB slug prefixes
  const rawIds: string[] = country
    ? [country]
    : meta.countries.map(c => c.id)

  const slugPrefixes = rawIds
    .map(id => resolveCountrySlug(id))
    .filter(s => s.length > 0) // skip fusion categories with empty slugs

  if (slugPrefixes.length === 0) {
    return NextResponse.json({ recipes: [], total: 0 })
  }

  try {
    const supabase = await createServerSupabaseClient()

    // Build OR filter: slug.like.cambodia-%,slug.like.thailand-%, ...
    const orFilter = slugPrefixes.map(slug => `slug.like.${slug}-%`).join(',')

    const { data: posts, error, count } = await supabase
      .from('posts')
      .select(`
        id, title, slug, summary, hero_image_url,
        diet_tags, food_tags, is_tested, quality_score, source_url,
        created_by:profiles(id, display_name, handle, avatar_url),
        approaches(id, name, slug)
      `, { count: 'exact' })
      .eq('type', 'recipe')
      .eq('status', 'active')
      .or(orFilter)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('by-region query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const recipes = (posts ?? []).map(post => ({
      id: post.id,
      slug: post.slug,
      title: post.title,
      summary: post.summary,
      hero_image_url: post.hero_image_url || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
      dietTags: post.diet_tags || [],
      foodTags: post.food_tags || [],
      is_tested: post.is_tested,
      quality_score: post.quality_score,
      source_url: post.source_url || null,
      votes: 0,
      comments: 0,
      created_by: Array.isArray(post.created_by) ? post.created_by[0] : post.created_by,
      approach: Array.isArray(post.approaches) ? post.approaches[0] : post.approaches,
    }))

    return NextResponse.json({ recipes, total: count ?? recipes.length }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (err) {
    console.error('by-region error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
