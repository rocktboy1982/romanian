import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { REGION_META } from '@/lib/recipe-taxonomy'
import { resolveCountrySlug, COUNTRY_SLUG_MAP } from '@/lib/country-slug-map'

// Build reverse map: taxonomy id → display country name
const ID_TO_DISPLAY: Record<string, string> = {}
for (const [adj, slug] of Object.entries(COUNTRY_SLUG_MAP)) {
  if (!slug) continue
  const display = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  ID_TO_DISPLAY[adj] = display
  ID_TO_DISPLAY[slug] = display
}
// Manual overrides for known mismatches
Object.assign(ID_TO_DISPLAY, {
  'chinese': 'China', 'japanese': 'Japan', 'korean': 'South Korea',
  'thai': 'Thailand', 'vietnamese': 'Vietnam', 'cambodian': 'Cambodia',
  'lao': 'Laos', 'burmese': 'Myanmar', 'indonesian': 'Indonesia',
  'malaysian': 'Malaysia', 'singaporean': 'Singapore', 'filipino': 'Philippines',
  'indian': 'India', 'pakistani': 'Pakistan', 'bangladeshi': 'Bangladesh',
  'srilankan': 'Sri Lanka', 'nepali': 'Nepal', 'afghan': 'Afghanistan',
  'lebanese': 'Lebanon', 'syrian': 'Syria', 'turkish': 'Turkey',
  'iranian': 'Iran', 'iraqi': 'Iraq', 'egyptian': 'Egypt',
  'moroccan': 'Morocco', 'ethiopian': 'Ethiopia', 'nigerian': 'Nigeria',
  'ghanaian': 'Ghana', 'kenyan': 'Kenya', 'italian': 'Italy',
  'french': 'France', 'spanish': 'Spain', 'german': 'Germany',
  'greek': 'Greece', 'portuguese': 'Portugal', 'british': 'UK',
  'irish': 'Ireland', 'swedish': 'Sweden', 'dutch': 'Netherlands',
  'polish': 'Poland', 'hungarian': 'Hungary', 'czech': 'Czech Republic',
  'russian': 'Russia', 'ukrainian': 'Ukraine', 'romanian': 'Romania',
  'mexican': 'Mexico', 'cuban': 'Cuba', 'jamaican': 'Jamaica',
  'peruvian': 'Peru', 'brazilian': 'Brazil', 'colombian': 'Colombia',
  'argentinian': 'Argentina', 'chilean': 'Chile', 'australian': 'Australia',
  'american-south': 'United States', 'canadian': 'Canada',
})

/**
 * GET /api/recipes/by-region?region=southeast-asia&limit=60&offset=0
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const region = searchParams.get('region')?.toLowerCase().trim()
  const countryFilter = searchParams.get('country')?.toLowerCase().trim()
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '60'), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  if (!region) {
    return NextResponse.json({ error: 'region param required' }, { status: 400 })
  }

  const meta = REGION_META[region]
  if (!meta) {
    return NextResponse.json({ error: `Unknown region: ${region}` }, { status: 404 })
  }

  const rawIds: string[] = countryFilter
    ? [countryFilter]
    : meta.countries.map(c => c.id)

  // Build two sets: slug prefixes AND country display names
  const slugPrefixes = rawIds.map(id => resolveCountrySlug(id)).filter(s => s.length > 0)
  const countryNames = rawIds.map(id => ID_TO_DISPLAY[id]).filter(Boolean)

  // Deduplicate
  const uniqueNames = [...new Set(countryNames)]

  if (slugPrefixes.length === 0 && uniqueNames.length === 0) {
    return NextResponse.json({ recipes: [], total: 0 })
  }

  try {
    const supabase = await createServerSupabaseClient()

    // Build OR filter combining slug prefix match AND country column match
    const filters: string[] = []
    for (const slug of slugPrefixes) {
      filters.push(`slug.like.${slug}-%`)
    }
    for (const name of uniqueNames) {
      filters.push(`country.eq.${name}`)
    }
    const orFilter = filters.join(',')

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
      .or(orFilter)
      .order('quality_score', { ascending: false, nullsFirst: false })
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
    console.error('by-region error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
