import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveCountrySlug, COUNTRY_SLUG_MAP } from '@/lib/country-slug-map'

// Reverse map: slug prefix → display name (e.g., 'japan' → 'Japan')
const SLUG_TO_DISPLAY: Record<string, string> = {}
for (const [adj, slug] of Object.entries(COUNTRY_SLUG_MAP)) {
  if (slug && !SLUG_TO_DISPLAY[slug]) {
    SLUG_TO_DISPLAY[slug] = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }
}

/**
 * GET /api/recipes/by-country?country=cambodian&limit=60&offset=0
 *
 * Searches by BOTH slug prefix AND country column for maximum coverage.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const rawCountry = searchParams.get('country')?.toLowerCase().trim()
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '60'), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  if (!rawCountry) {
    return NextResponse.json({ error: 'country param required' }, { status: 400 })
  }

  const slugPrefix = resolveCountrySlug(rawCountry)
  // Derive display name for country column match
  const displayName = SLUG_TO_DISPLAY[slugPrefix] || slugPrefix.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

  try {
    const supabase = await createServerSupabaseClient()

    // Query by BOTH slug prefix OR country column
    const { data: posts, error, count } = await supabase
      .from('posts')
      .select(`
        id, title, slug, summary, hero_image_url, country,
        diet_tags, food_tags, is_tested, quality_score, source_url,
        created_by:profiles(id, display_name, handle, avatar_url),
        approaches(id, name, slug)
      `, { count: 'exact' })
      .eq('type', 'recipe')
      .eq('status', 'active')
      .or(`slug.like.${slugPrefix}-%,country.ilike.${displayName}`)
      .order('quality_score', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('by-country query error:', error)
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
      country: post.country,
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
    console.error('by-country error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
