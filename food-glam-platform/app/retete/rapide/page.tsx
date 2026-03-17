import type { Metadata } from 'next'
import Link from 'next/link'
import FallbackImage from '@/components/FallbackImage'
import { createServiceSupabaseClient } from '@/lib/supabase-server'

export const metadata: Metadata = {
  title: 'Rețete Rapide — Gata în 30 de Minute | MareChef.ro',
  description: 'Colecție de rețete rapide gata în 30 de minute sau mai puțin. Idei simple pentru cina de seară, prânz rapid sau mic dejun ușor. Rețete pas cu pas cu ingrediente comune.',
  keywords: [
    'rețete rapide',
    'retete gata in 30 de minute',
    'cina rapida in 15 minute',
    'retete simple si rapide',
    'ce gătesc azi rapid',
    'retete rapide cu pui',
    'mancare rapida de seara',
    'retete usoare pentru incepatori',
  ],
  alternates: { canonical: 'https://marechef.ro/retete/rapide' },
  openGraph: {
    type: 'website',
    locale: 'ro_RO',
    url: 'https://marechef.ro/retete/rapide',
    siteName: 'MareChef.ro',
    title: 'Rețete Rapide — Gata în 30 de Minute | MareChef.ro',
    description: 'Colecție de rețete rapide gata în 30 de minute sau mai puțin.',
    images: [{ url: 'https://marechef.ro/og-image.jpg', width: 1200, height: 630, alt: 'Rețete Rapide MareChef.ro' }],
  },
}

interface Post {
  id: string
  slug: string
  title: string
  summary: string | null
  hero_image_url: string | null
  recipe_json: { prep_time_minutes?: number; cook_time_minutes?: number; total_time?: string } | null
}

export default async function ReteteRapidePage() {
  const supabase = createServiceSupabaseClient()

  // Fetch recipes with total cook time ≤ 30 minutes
  const { data: posts } = await supabase
    .from('posts')
    .select('id, slug, title, summary, hero_image_url, recipe_json')
    .eq('type', 'recipe')
    .or(
      'recipe_json->>prep_time_minutes.lte.30,recipe_json->>cook_time_minutes.lte.30'
    )
    .order('votes', { ascending: false })
    .limit(60)

  const recipes: Post[] = posts ?? []

  return (
    <main className="min-h-screen pb-24 md:pb-8" style={{ background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
      {/* Hero intro — Google needs this 200-word context block */}
      <section
        className="w-full py-12 px-4"
        style={{ background: 'linear-gradient(135deg, rgba(255,77,109,0.08), rgba(255,149,0,0.06))' }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 text-sm mb-3" style={{ color: 'hsl(var(--muted-foreground))' }}>
            <Link href="/" className="hover:underline">Acasă</Link>
            <span>/</span>
            <span>Rețete rapide</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4" style={{ fontFamily: "'Syne',sans-serif" }}>
            Rețete Rapide
          </h1>
          <p className="text-lg leading-relaxed max-w-2xl" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Ai ajuns acasă obosit și nu știi ce să gătești? Această colecție conține rețete
            gata în <strong>30 de minute sau mai puțin</strong> — de la paste rapide și ochiuri
            pe pâine prăjită până la pui la tigaie sau salate consistente. Toate rețetele sunt
            testate, cu ingrediente pe care le găsești la orice supermarket.
          </p>
          <p className="mt-3 text-sm leading-relaxed max-w-2xl" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Secretul unei mese rapide nu este să renunți la gust — ci să alegi tehnici simple:
            tigaie la foc mare, condimente bune și ingrediente de calitate. Găsești aici rețete
            pentru cină de seară, prânz rapid la birou sau mic dejun ușor.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <span className="px-4 py-2 rounded-full text-sm font-semibold" style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff' }}>
              ⏱️ Sub 30 de minute
            </span>
            <span className="px-4 py-2 rounded-full text-sm font-semibold border" style={{ borderColor: 'hsl(var(--border))' }}>
              {recipes.length}+ rețete
            </span>
          </div>
        </div>
      </section>

      {/* Recipe grid */}
      <section className="max-w-6xl mx-auto px-4 py-8">
        {recipes.length === 0 ? (
          <p className="text-center py-12" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Se încarcă rețetele...
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {recipes.map((recipe) => (
              <Link
                key={recipe.id}
                href={`/recipes/${recipe.slug}`}
                className="group rounded-xl overflow-hidden border transition-all hover:shadow-md"
                style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--card))' }}
              >
                <div className="relative aspect-video overflow-hidden bg-muted">
                  {recipe.hero_image_url ? (
                    <FallbackImage
                      src={recipe.hero_image_url}
                      alt={recipe.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 768px) 50vw, 25vw"
                      fallbackEmoji="🍽️"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl" style={{ background: 'rgba(255,77,109,0.06)' }}>
                      🍽️
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h2 className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                    {recipe.title}
                  </h2>
                  {recipe.summary && (
                    <p className="text-xs mt-1 line-clamp-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
                      {recipe.summary}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
