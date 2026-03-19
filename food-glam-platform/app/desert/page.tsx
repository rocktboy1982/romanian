import { Suspense } from 'react'
import type { Metadata } from 'next'
import { createServiceSupabaseClient } from '@/lib/supabase-server'
import MealTypePage from '@/components/pages/meal-type-page'

const MEAL_TYPE = 'dessert'
const TITLE = 'Rețete de Desert'
const SUBTITLE = 'Satisface-ți pofta de dulce! Cheesecake-uri cremoase, prăjituri de ciocolată, înghețate artizanale și deserturi tradiționale românești.'
const EMOJI = '🍰'
const SLUG = 'desert'

export const metadata: Metadata = {
  title: `${TITLE} | MareChef.ro`,
  description: `${SUBTITLE} Peste 100 de rețete de desert pe MareChef.ro.`,
  openGraph: {
    title: `${TITLE} | MareChef.ro`,
    description: SUBTITLE,
    url: `https://marechef.ro/${SLUG}`,
    type: 'website',
    locale: 'ro_RO',
    siteName: 'MareChef.ro',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${TITLE} | MareChef.ro`,
    description: SUBTITLE,
  },
  alternates: {
    canonical: `https://marechef.ro/${SLUG}`,
  },
}

async function fetchRecipes() {
  const supabase = createServiceSupabaseClient()

  const { data: posts, count } = await supabase
    .from('posts')
    .select(`
      id,
      title,
      slug,
      summary,
      hero_image_url,
      is_tested,
      quality_score,
      diet_tags,
      food_tags,
      meal_type,
      recipe_json,
      created_at,
      created_by:profiles(id, display_name, handle, avatar_url),
      approaches:approaches(id, name, slug)
    `, { count: 'exact' })
    .eq('status', 'active')
    .eq('type', 'recipe')
    .eq('meal_type', MEAL_TYPE)
    .order('quality_score', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(0, 23)

  if (!posts) return { recipes: [], total: 0 }

  const recipes = posts.map((post) => {
    const approachData = post.approaches as unknown as Record<string, unknown> | null
    const creatorData = post.created_by as unknown as Record<string, unknown> | null
    const recipeJson = (post.recipe_json || {}) as Record<string, unknown>
    const nutrition = recipeJson.nutrition_per_serving as { calories: number; protein: number; carbs: number; fat: number } | null | undefined
    const cookTime = recipeJson.cook_time_minutes as number | null | undefined
    const servings = recipeJson.servings as number | null | undefined

    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      summary: post.summary,
      hero_image_url: post.hero_image_url || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
      region: (approachData?.name as string) || 'International',
      votes: 0,
      comments: 0,
      tag: post.is_tested ? 'Testat' : 'Nou',
      badges: post.is_tested ? ['Tested'] : undefined,
      dietTags: post.diet_tags || [],
      foodTags: post.food_tags || [],
      is_tested: post.is_tested,
      quality_score: post.quality_score,
      nutrition_per_serving: nutrition || null,
      cook_time_minutes: cookTime || null,
      servings: servings || null,
      created_by: {
        id: (creatorData?.id as string) || '',
        display_name: (creatorData?.display_name as string) || 'Anonim',
        handle: (creatorData?.handle as string) || '',
        avatar_url: (creatorData?.avatar_url as string | null) || null,
      },
    }
  })

  return { recipes, total: count ?? 0 }
}

export default async function DesertPage() {
  const { recipes, total } = await fetchRecipes()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: TITLE,
    description: SUBTITLE,
    url: `https://marechef.ro/${SLUG}`,
    isPartOf: {
      '@type': 'WebSite',
      name: 'MareChef.ro',
      url: 'https://marechef.ro',
    },
    about: {
      '@type': 'Thing',
      name: 'Desert',
    },
    numberOfItems: total,
    inLanguage: 'ro',
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center" style={{ background: 'hsl(var(--background))' }}>
            <div className="animate-spin w-8 h-8 border-2 border-stone-300 border-t-stone-800 rounded-full" />
          </div>
        }
      >
        <MealTypePage
          mealType={MEAL_TYPE}
          title={TITLE}
          subtitle={SUBTITLE}
          emoji={EMOJI}
          slug={SLUG}
          initialRecipes={recipes}
          totalCount={total}
        />
      </Suspense>
    </>
  )
}
