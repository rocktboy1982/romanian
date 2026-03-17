import type { Metadata } from 'next'
import Link from 'next/link'
import FallbackImage from '@/components/FallbackImage'
import { createServiceSupabaseClient } from '@/lib/supabase-server'

export const metadata: Metadata = {
  title: 'Rețete Tradiționale Românești | MareChef.ro',
  description: 'Rețete tradiționale românești autentice: ciorbă de pui, sarmale, mici de casă, mămăligă, ciorbă de burtă și alte preparate clasice. Gătite ca la mama acasă.',
  keywords: [
    'rețete tradiționale românești',
    'retete romanesti de casa',
    'ciorba de pui reteta',
    'sarmale reteta traditionala',
    'mici de casa reteta',
    'mamaliaga cu branza',
    'ciorba de burta reteta',
    'mancare romaneasca traditionala',
    'retete ca la mama acasa',
    'bucatarie romaneasca',
  ],
  alternates: { canonical: 'https://marechef.ro/retete/traditionale' },
  openGraph: {
    type: 'website',
    locale: 'ro_RO',
    url: 'https://marechef.ro/retete/traditionale',
    siteName: 'MareChef.ro',
    title: 'Rețete Tradiționale Românești | MareChef.ro',
    description: 'Rețete tradiționale românești autentice: ciorbă de pui, sarmale, mici, mămăligă și alte preparate clasice.',
    images: [{ url: 'https://marechef.ro/og-image.jpg', width: 1200, height: 630, alt: 'Rețete Tradiționale Românești' }],
  },
}

interface Post {
  id: string
  slug: string
  title: string
  summary: string | null
  hero_image_url: string | null
}

export default async function ReteteTraditionalePage() {
  const supabase = createServiceSupabaseClient()

  // Fetch Romanian/traditional recipes — region tag or tags contain romanian indicators
  const { data: posts } = await supabase
    .from('posts')
    .select('id, slug, title, summary, hero_image_url')
    .eq('type', 'recipe')
    .or("region.ilike.%roman%,region.ilike.%moldov%,region.ilike.%transilvan%,region.ilike.%dobroge%,region.ilike.%munteni%,region.ilike.%olteni%,tags.cs.{românesc},tags.cs.{traditional},tags.cs.{traditionala}")
    .order('votes', { ascending: false })
    .limit(60)

  // Fallback: if no regional results, fetch top-voted Romanian keyword recipes
  let recipes: Post[] = posts ?? []
  if (recipes.length < 12) {
    const { data: fallback } = await supabase
      .from('posts')
      .select('id, slug, title, summary, hero_image_url')
      .eq('type', 'recipe')
      .or("title.ilike.%ciorb%,title.ilike.%sarmale%,title.ilike.%mici%,title.ilike.%mămălig%,title.ilike.%cozonac%,title.ilike.%plăcint%,title.ilike.%tocăniț%,title.ilike.%papanaș%,title.ilike.%zacusc%")
      .order('votes', { ascending: false })
      .limit(60)
    recipes = fallback ?? []
  }

  return (
    <main className="min-h-screen pb-24 md:pb-8" style={{ background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
      {/* Hero intro — Google context block (200+ cuvinte) */}
      <section
        className="w-full py-12 px-4"
        style={{ background: 'linear-gradient(135deg, rgba(255,77,109,0.08), rgba(255,149,0,0.06))' }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 text-sm mb-3" style={{ color: 'hsl(var(--muted-foreground))' }}>
            <Link href="/" className="hover:underline">Acasă</Link>
            <span>/</span>
            <span>Rețete tradiționale</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4" style={{ fontFamily: "'Syne',sans-serif" }}>
            Rețete Tradiționale Românești
          </h1>
          <p className="text-lg leading-relaxed max-w-2xl" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Bucătăria românească este una dintre cele mai bogate și variate din Europa de Est.
            De la <strong>ciorbă de pui</strong> fiartă la foc mic până la <strong>sarmale</strong>
            {' '}învelite în foi de varză murată, preparatele noastre tradiționale poartă istoria și
            sufletul fiecărei regiuni — Moldova, Transilvania, Muntenia, Oltenia și Dobrogea.
          </p>
          <p className="mt-3 text-sm leading-relaxed max-w-2xl" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Fiecare rețetă din această colecție este pregătită <strong>ca la mama acasă</strong>:
            cu ingrediente simple, tehnici clare și respectul pentru tradițiile culinare românești.
            Găsești rețete pentru <strong>mici de casă</strong>, <strong>ciorbă de burtă</strong>,
            {' '}<strong>mămăligă cu brânză și smântână</strong>, <strong>cozonac pufos</strong>,
            plăcinte și multe altele.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <span className="px-4 py-2 rounded-full text-sm font-semibold" style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff' }}>
              🇷🇴 Bucătărie românească
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
