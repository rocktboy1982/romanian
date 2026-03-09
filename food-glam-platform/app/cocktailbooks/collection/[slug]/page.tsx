import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceSupabaseClient } from '@/lib/supabase-server'
import { COCKTAIL_COLLECTIONS } from '@/lib/cocktail-collections'

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

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const collection = COCKTAIL_COLLECTIONS.find((c) => c.slug === slug)

  if (!collection) {
    return {
      title: 'Colecție nu găsită | MareChef.ro',
    }
  }

  return {
    title: `${collection.title} | MareChef.ro`,
    description: collection.desc,
    openGraph: {
      title: `${collection.title} | MareChef.ro`,
      description: collection.desc,
      url: `https://marechef.ro/cocktailbooks/collection/${slug}`,
      type: 'website',
      locale: 'ro_RO',
      siteName: 'MareChef.ro',
    },
    twitter: {
      card: 'summary',
      title: `${collection.title} | MareChef.ro`,
      description: collection.desc,
    },
    alternates: {
      canonical: `https://marechef.ro/cocktailbooks/collection/${slug}`,
    },
  }
}

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

export default async function CollectionPage({ params }: PageProps) {
  const { slug } = await params
  const collection = COCKTAIL_COLLECTIONS.find((c) => c.slug === slug)

  if (!collection) {
    notFound()
  }

  const supabase = createServiceSupabaseClient()

  // Fetch all cocktails in this collection
  const { data: cocktails } = await supabase
    .from('posts')
    .select('id, slug, title, summary, hero_image_url, recipe_json, created_at')
    .eq('type', 'cocktail')
    .eq('status', 'active')
    .in('slug', collection.slugs)
    .order('created_at', { ascending: false })

  const cocktailList: Cocktail[] = cocktails || []

  return (
    <main
      className="min-h-screen"
      style={{ background: '#dde3ee', color: '#111', fontFamily: "'Inter', sans-serif" }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@400;500;600&display=swap');.ff{font-family:'Syne',sans-serif;}`}</style>

      {/* ── BREADCRUMB ── */}
      <div className="px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 text-sm" style={{ color: '#666' }}>
          <Link href="/cocktailbooks" className="hover:underline" style={{ color: '#7c3aed' }}>
            Biblioteca de Cocktailuri
          </Link>
          <span>/</span>
          <span style={{ color: '#111' }}>{collection.title}</span>
        </div>
      </div>

      {/* ── HERO SECTION ── */}
      <div className="relative w-full overflow-hidden" style={{ height: '280px' }}>
        <Image
          src={collection.img}
          alt={collection.title}
          fill
          className="absolute object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.50)' }} />

        <div className="relative h-full flex flex-col justify-end px-8 py-8 max-w-7xl mx-auto w-full">
          <div>
            <h1 className="ff text-5xl font-extrabold tracking-tight mb-3 leading-tight text-white">
              <span className="mr-3">{collection.emoji}</span>
              {collection.title}
            </h1>
            <p className="text-lg mb-4" style={{ color: '#ddd' }}>
              {collection.desc}
            </p>
            <p className="text-sm font-semibold px-3 py-1.5 rounded-full inline-block" style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa' }}>
              {cocktailList.length} cocktail-uri
            </p>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="px-6 py-12 max-w-7xl mx-auto">
        {cocktailList.length === 0 ? (
          <div className="text-center py-12">
            <p style={{ color: '#888' }} className="text-lg">
              Nu au fost găsite cocktail-uri în această colecție. Încearcă mai târziu!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {cocktailList.map((cocktail) => {
              const recipeJson = cocktail.recipe_json || {}
              const difficulty = recipeJson.difficulty || 'easy'
              const category = recipeJson.category || 'non-alcoholic'
              const serves = recipeJson.serves || 1

              return (
                <Link
                  key={cocktail.id}
                  href={`/cocktails/${cocktail.slug}`}
                  className="rounded-2xl overflow-hidden flex flex-col transition-all duration-300 hover:shadow-lg"
                  style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)' }}
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
                        style={{ background: 'rgba(0,0,0,0.05)' }}
                      >
                        🍹
                      </div>
                    )}
                    <div
                      className="absolute inset-0"
                      style={{ background: 'linear-gradient(to top, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.2) 60%, transparent 100%)' }}
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
                      <h3 className="ff font-bold text-sm leading-snug line-clamp-2" style={{ color: '#111' }}>
                        {cocktail.title}
                      </h3>
                    </div>
                  </div>

                  {/* Info section */}
                  <div className="flex-1 flex flex-col justify-between p-3.5">
                    {/* Summary */}
                    {cocktail.summary && (
                      <p className="text-xs leading-relaxed line-clamp-2 mb-3" style={{ color: '#666' }}>
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
        )}
      </div>

      {/* Bottom padding */}
      <div className="h-16" />
    </main>
  )
}
