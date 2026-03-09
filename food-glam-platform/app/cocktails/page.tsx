import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { createServiceSupabaseClient } from '@/lib/supabase-server'

export const metadata: Metadata = {
  title: 'Cocktailuri | MareChef.ro',
  description: 'Descoperă rețete de cocktailuri din întreaga lume. Whisky, Gin, Rum, Tequila, Vodka și mocktail-uri pe MareChef.ro.',
  openGraph: {
    title: 'Cocktailuri | MareChef.ro',
    description: 'Descoperă rețete de cocktailuri din întreaga lume.',
    url: 'https://marechef.ro/cocktails',
    type: 'website',
    locale: 'ro_RO',
    siteName: 'MareChef.ro',
  },
  twitter: {
    card: 'summary',
    title: 'Cocktailuri | MareChef.ro',
    description: 'Descoperă rețete de cocktailuri din întreaga lume.',
  },
  alternates: {
    canonical: 'https://marechef.ro/cocktails',
  },
}

interface Cocktail {
  id: string
  slug: string
  title: string
  summary: string | null
  hero_image_url: string | null
  recipe_json: {
    difficulty?: string
    category?: string
    spirit?: string
    serves?: number
  } | null
  created_at: string
}

export default async function CocktailsPage() {
  const supabase = createServiceSupabaseClient()

  // Fetch all active cocktails
  const { data: cocktails, error } = await supabase
    .from('posts')
    .select('id, title, slug, summary, hero_image_url, recipe_json, created_at')
    .eq('type', 'cocktail')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  const cocktailList: Cocktail[] = cocktails || []

  // Group cocktails by spirit
  const groupedBySpirit = cocktailList.reduce((acc, cocktail) => {
    const recipeJson = cocktail.recipe_json || {}
    const spirit = recipeJson.spirit || 'mocktail'
    const spiritLabel =
      spirit === 'whisky'
        ? 'Whisky & Bourbon'
        : spirit === 'gin'
          ? 'Gin'
          : spirit === 'rum'
            ? 'Rum'
            : spirit === 'tequila'
              ? 'Tequila & Mezcal'
              : spirit === 'vodka'
                ? 'Vodka'
                : spirit === 'brandy'
                  ? 'Brandy & Cognac'
                  : spirit === 'liqueur'
                    ? 'Lichioruri'
                    : spirit === 'wine'
                      ? 'Vin & Șampanie'
                      : 'Mocktail-uri'

    if (!acc[spiritLabel]) {
      acc[spiritLabel] = []
    }
    acc[spiritLabel].push(cocktail)
    return acc
  }, {} as Record<string, Cocktail[]>)

  // Sort spirits in a logical order
  const spiritOrder = [
    'Whisky & Bourbon',
    'Gin',
    'Rum',
    'Tequila & Mezcal',
    'Vodka',
    'Brandy & Cognac',
    'Lichioruri',
    'Vin & Șampanie',
    'Mocktail-uri',
  ]
  const sortedSpirits = spiritOrder.filter((s) => groupedBySpirit[s])

  const getDifficultyColor = (difficulty?: string) => {
    if (difficulty === 'easy') return '#6ee7b7'
    if (difficulty === 'medium') return '#fbbf24'
    return '#f87171'
  }

  const getDifficultyEmoji = (difficulty?: string) => {
    if (difficulty === 'easy') return '✨'
    if (difficulty === 'medium') return '⭐'
    return '🔥'
  }

  return (
    <main
      className="min-h-screen"
      style={{ background: '#0a0a0a', color: '#f0f0f0', fontFamily: "'Inter', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@400;500;600&display=swap');
        .ff-display { font-family: 'Syne', sans-serif; }
        .ff-body { font-family: 'Inter', sans-serif; }
        
        .cocktail-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .cocktail-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 40px rgba(167, 139, 250, 0.2);
        }
      `}</style>

      {/* ── HERO SECTION ── */}
      <div className="relative w-full overflow-hidden" style={{ height: '320px' }}>
        <Image
          src="https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=1600&q=80"
          alt="Cocktailuri"
          fill
          className="absolute object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.65)' }} />

        <div className="relative h-full flex flex-col justify-between px-6 md:px-8 py-8 max-w-7xl mx-auto w-full">
          <div className="self-start">
            <p
              className="text-xs font-bold px-2.5 py-1 rounded-full inline-block"
              style={{ background: 'rgba(167, 139, 250, 0.2)', color: '#a78bfa' }}
            >
              {cocktailList.length} cocktail-uri active
            </p>
          </div>

          <div>
            <h1 className="ff-display text-5xl md:text-6xl font-extrabold tracking-tight mb-3 leading-tight text-white">
              Toate Cocktailurile
            </h1>
            <p className="text-lg mb-6" style={{ color: '#ccc' }}>
              Descoperă rețete de cocktailuri din întreaga lume
            </p>
            <Link
              href="/submit/cocktail"
              className="inline-flex items-center gap-2 font-semibold px-5 py-2.5 rounded-full text-sm transition-all duration-200"
              style={{ background: '#7c3aed', color: '#fff' }}
            >
              🍹 Adaugă un Cocktail
            </Link>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="px-6 md:px-8 py-12 max-w-7xl mx-auto space-y-12">
        {sortedSpirits.length === 0 ? (
          <div className="text-center py-12">
            <p style={{ color: '#888' }} className="text-lg">
              Nu au fost găsite cocktail-uri. Încearcă mai târziu!
            </p>
          </div>
        ) : (
          sortedSpirits.map((spirit) => (
            <section key={spirit}>
              {/* Spirit header */}
              <div className="mb-6">
                <h2 className="ff-display text-2xl font-bold mb-1" style={{ color: '#fff' }}>
                  {spirit}
                </h2>
                <p style={{ color: '#888' }} className="text-sm">
                  {groupedBySpirit[spirit].length} cocktail-uri
                </p>
              </div>

              {/* Cocktail grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {groupedBySpirit[spirit].map((cocktail) => {
                  const recipeJson = cocktail.recipe_json || {}
                  const difficulty = recipeJson.difficulty || 'easy'
                  const category = recipeJson.category || 'non-alcoholic'
                  const serves = recipeJson.serves || 1

                  return (
                    <Link
                      key={cocktail.id}
                      href={`/cocktails/${cocktail.slug}`}
                      className="cocktail-card rounded-2xl overflow-hidden flex flex-col"
                      style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      {/* Image */}
                      <div className="relative w-full" style={{ height: '240px' }}>
                        {cocktail.hero_image_url ? (
                          <Image
                            src={cocktail.hero_image_url}
                            alt={cocktail.title}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center text-4xl"
                            style={{ background: 'rgba(255,255,255,0.05)' }}
                          >
                            🍹
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
                              background: `${getDifficultyColor(difficulty)}40`,
                              color: getDifficultyColor(difficulty),
                              border: `1px solid ${getDifficultyColor(difficulty)}60`,
                            }}
                          >
                            {getDifficultyEmoji(difficulty)} {difficulty}
                          </span>
                        </div>

                        {/* Category badge */}
                        <div className="absolute top-3 right-3">
                          <span
                            className="px-2.5 py-1 rounded-full text-xs font-bold"
                            style={{
                              background:
                                category === 'alcoholic'
                                  ? 'rgba(167, 139, 250, 0.9)'
                                  : 'rgba(5, 150, 105, 0.9)',
                              color: '#fff',
                            }}
                          >
                            {category === 'alcoholic' ? '🥃' : '🍃'} {category === 'alcoholic' ? 'Alcoolic' : 'Fără alcool'}
                          </span>
                        </div>

                        {/* Title overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-3.5">
                          <h3 className="ff-display font-bold text-sm leading-snug line-clamp-2" style={{ color: '#fff' }}>
                            {cocktail.title}
                          </h3>
                        </div>
                      </div>

                      {/* Info section */}
                      <div className="flex-1 flex flex-col justify-between p-3.5">
                        {/* Summary */}
                        {cocktail.summary && (
                          <p className="text-xs leading-relaxed line-clamp-2 mb-3" style={{ color: '#aaa' }}>
                            {cocktail.summary}
                          </p>
                        )}

                        {/* Serves info */}
                        {serves > 0 && (
                          <div className="flex items-center gap-2 text-xs" style={{ color: '#888' }}>
                            <span>🥂</span>
                            <span>{serves} porție{serves !== 1 ? 'i' : ''}</span>
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
