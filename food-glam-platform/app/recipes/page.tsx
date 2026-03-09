import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { createServiceSupabaseClient } from '@/lib/supabase-server'

export const metadata: Metadata = {
  title: 'Rețete | MareChef.ro',
  description: 'Descoperă mii de rețete delicioase din întreaga lume. Caută după țară, dificultate și ingrediente pe MareChef.ro.',
  openGraph: {
    title: 'Rețete | MareChef.ro',
    description: 'Descoperă mii de rețete delicioase din întreaga lume.',
    url: 'https://marechef.ro/recipes',
    type: 'website',
    locale: 'ro_RO',
    siteName: 'MareChef.ro',
  },
  twitter: {
    card: 'summary',
    title: 'Rețete | MareChef.ro',
    description: 'Descoperă mii de rețete delicioase din întreaga lume.',
  },
  alternates: {
    canonical: 'https://marechef.ro/recipes',
  },
}

interface Recipe {
  id: string
  slug: string
  title: string
  summary: string | null
  hero_image_url: string | null
  recipe_json: {
    difficulty_level?: string
    cook_time_minutes?: number
    prep_time_minutes?: number
  } | null
  created_at: string
}

export default async function RecipesPage() {
  const supabase = createServiceSupabaseClient()

  // Fetch all active recipes
  const { data: recipes, error } = await supabase
    .from('posts')
    .select('id, title, slug, summary, hero_image_url, recipe_json, created_at')
    .eq('type', 'recipe')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  const recipeList: Recipe[] = recipes || []

  // Extract country from slug (e.g., "ro-ciorbă-de-burtă" → "ro")
  const getCountryFromSlug = (slug: string): string => {
    const parts = slug.split('-')
    return parts[0] || 'international'
  }

  // Group recipes by country
  const groupedByCountry = recipeList.reduce((acc, recipe) => {
    const country = getCountryFromSlug(recipe.slug)
    if (!acc[country]) {
      acc[country] = []
    }
    acc[country].push(recipe)
    return acc
  }, {} as Record<string, Recipe[]>)

  // Sort countries alphabetically
  const sortedCountries = Object.keys(groupedByCountry).sort()

  return (
    <main
      className="min-h-screen"
      style={{ background: '#0a0a0a', color: '#f0f0f0', fontFamily: "'Inter', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@400;500;600&display=swap');
        .ff-display { font-family: 'Syne', sans-serif; }
        .ff-body { font-family: 'Inter', sans-serif; }
        
        .recipe-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .recipe-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 40px rgba(255, 77, 109, 0.2);
        }
      `}</style>

      {/* ── HERO SECTION ── */}
      <div className="relative w-full overflow-hidden" style={{ height: '320px' }}>
        <Image
          src="https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=1600&q=80"
          alt="Rețete"
          fill
          className="absolute object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.65)' }} />

        <div className="relative h-full flex flex-col justify-between px-6 md:px-8 py-8 max-w-7xl mx-auto w-full">
          <div className="self-start">
            <p
              className="text-xs font-bold px-2.5 py-1 rounded-full inline-block"
              style={{ background: 'rgba(255, 77, 109, 0.2)', color: '#ff9500' }}
            >
              {recipeList.length} rețete active
            </p>
          </div>

          <div>
            <h1 className="ff-display text-5xl md:text-6xl font-extrabold tracking-tight mb-3 leading-tight text-white">
              Toate Rețetele
            </h1>
            <p className="text-lg mb-6" style={{ color: '#ccc' }}>
              Descoperă mii de rețete delicioase din întreaga lume
            </p>
            <Link
              href="/submit/recipe"
              className="inline-flex items-center gap-2 font-semibold px-5 py-2.5 rounded-full text-sm transition-all duration-200"
              style={{ background: 'linear-gradient(135deg, #ff4d6d, #ff9500)', color: '#fff' }}
            >
              ✍️ Adaugă o Rețetă
            </Link>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="px-6 md:px-8 py-12 max-w-7xl mx-auto space-y-12">
        {sortedCountries.length === 0 ? (
          <div className="text-center py-12">
            <p style={{ color: '#888' }} className="text-lg">
              Nu au fost găsite rețete. Încearcă mai târziu!
            </p>
          </div>
        ) : (
          sortedCountries.map((country) => (
            <section key={country}>
              {/* Country header */}
              <div className="mb-6">
                <h2 className="ff-display text-2xl font-bold mb-1" style={{ color: '#fff' }}>
                  {country.toUpperCase()}
                </h2>
                <p style={{ color: '#888' }} className="text-sm">
                  {groupedByCountry[country].length} rețete
                </p>
              </div>

              {/* Recipe grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {groupedByCountry[country].map((recipe) => {
                  const recipeJson = recipe.recipe_json || {}
                  const difficulty = recipeJson.difficulty_level || 'ușor'
                  const cookTime = recipeJson.cook_time_minutes || 0
                  const prepTime = recipeJson.prep_time_minutes || 0
                  const totalTime = cookTime + prepTime

                  return (
                    <Link
                      key={recipe.id}
                      href={`/recipes/${recipe.slug}`}
                      className="recipe-card rounded-2xl overflow-hidden flex flex-col"
                      style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      {/* Image */}
                      <div className="relative w-full" style={{ height: '240px' }}>
                        {recipe.hero_image_url ? (
                          <Image
                            src={recipe.hero_image_url}
                            alt={recipe.title}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center text-4xl"
                            style={{ background: 'rgba(255,255,255,0.05)' }}
                          >
                            🍽️
                          </div>
                        )}
                        <div
                          className="absolute inset-0"
                          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)' }}
                        />

                        {/* Difficulty badge */}
                        <div className="absolute top-3 left-3">
                          <span
                            className="px-2.5 py-1 rounded-full text-xs font-bold"
                            style={{
                              background:
                                difficulty === 'ușor'
                                  ? 'rgba(0, 200, 150, 0.9)'
                                  : difficulty === 'mediu'
                                    ? 'rgba(255, 149, 0, 0.9)'
                                    : 'rgba(255, 77, 109, 0.9)',
                              color: '#fff',
                            }}
                          >
                            {difficulty === 'ușor' ? '✨' : difficulty === 'mediu' ? '⭐' : '🔥'} {difficulty}
                          </span>
                        </div>

                        {/* Title overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-3.5">
                          <h3 className="ff-display font-bold text-sm leading-snug line-clamp-2" style={{ color: '#fff' }}>
                            {recipe.title}
                          </h3>
                        </div>
                      </div>

                      {/* Info section */}
                      <div className="flex-1 flex flex-col justify-between p-3.5">
                        {/* Summary */}
                        {recipe.summary && (
                          <p className="text-xs leading-relaxed line-clamp-2 mb-3" style={{ color: '#aaa' }}>
                            {recipe.summary}
                          </p>
                        )}

                        {/* Time info */}
                        {totalTime > 0 && (
                          <div className="flex items-center gap-2 text-xs" style={{ color: '#888' }}>
                            <span>⏱️</span>
                            <span>{totalTime} min</span>
                          </div>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          ))
        )}
      </div>

      {/* Bottom padding */}
      <div className="h-16" />
    </main>
  )
}
