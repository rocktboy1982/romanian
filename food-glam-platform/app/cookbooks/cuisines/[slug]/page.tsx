import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

interface Post {
  id: string
  title: string
  slug: string
  summary: string | null
  hero_image_url: string | null
  diet_tags: string[]
  food_tags: string[]
  is_tested: boolean
  quality_score: number | null
}

export default async function CuisinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const countryName = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const supabase = await createServerSupabaseClient()

  // Fetch recipes by slug prefix — matches our seeding convention: {country}-{recipe}
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, title, slug, summary, hero_image_url, diet_tags, food_tags, is_tested, quality_score')
    .eq('type', 'recipe')
    .eq('status', 'active')
    .like('slug', `${slug}-%`)
    .order('created_at', { ascending: false })
    .limit(60)

  // If no recipes found at all for this country slug, 404
  if ((error || !posts || posts.length === 0) && error) {
    notFound()
  }

  const recipes: Post[] = posts ?? []

  return (
    <main className="min-h-screen pb-24" style={{ background: '#dde3ee', color: '#111' }}>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground mb-6 flex items-center gap-2">
          <Link href="/cookbooks" className="hover:text-foreground transition-colors">Global Cookbooks</Link>
          <span>›</span>
          <span className="text-foreground font-medium">{countryName}</span>
        </nav>

        <h1 className="text-3xl font-bold tracking-tight mb-1">{countryName} Cuisine</h1>
        <p className="text-muted-foreground mb-8">
          {recipes.length} authentic {countryName} recipes
        </p>

        {recipes.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-4xl mb-4">🍽️</p>
            <p className="font-medium mb-2">No recipes found for {countryName}</p>
            <Link href="/search" className="text-sm text-amber-600 hover:underline">
              Browse all recipes →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {recipes.map((recipe) => (
              <Link
                key={recipe.id}
                href={`/recipes/${recipe.slug}`}
                className="group rounded-xl overflow-hidden border border-border bg-card hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="aspect-[4/3] bg-stone-100 overflow-hidden relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={recipe.hero_image_url || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80'}
                    alt={recipe.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {recipe.is_tested && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-green-500 text-white">
                      Tested ✓
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-base line-clamp-1 mb-1">{recipe.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{recipe.summary}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {recipe.quality_score && (
                      <span className="text-xs font-semibold text-amber-600">
                        ★ {recipe.quality_score.toFixed(1)}
                      </span>
                    )}
                    {(recipe.diet_tags ?? []).slice(0, 2).map((tag: string) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 text-[10px] rounded bg-blue-100 text-blue-700 font-medium capitalize"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
