import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveCountrySlug } from '@/lib/country-slug-map'

/**
 * GET /api/recipes/by-country?country=cambodian&limit=60&offset=0
 *
 * Accepts both taxonomy IDs ("cambodian") and DB prefixes ("cambodia").
 * Resolves to the DB slug prefix via country-slug-map.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const rawCountry = searchParams.get('country')?.toLowerCase().trim()
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '60'), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  if (!rawCountry) {
    return NextResponse.json({ error: 'country param required' }, { status: 400 })
  }

  const country = resolveCountrySlug(rawCountry)
  if (!country) {
    return NextResponse.json({ recipes: [], total: 0 })
  }

  try {
    const supabase = await createServerSupabaseClient()

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
      .like('slug', `${country}-%`)
      .order('created_at', { ascending: false })
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
