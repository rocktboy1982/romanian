import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Cărți de Cocktailuri | MareChef.ro',
  description: 'Descoperă rețete de cocktailuri din întreaga lume. Whisky, Gin, Rum, Tequila, Vodka și multe altele pe MareChef.ro.',
  openGraph: {
    title: 'Cărți de Cocktailuri | MareChef.ro',
    description: 'Descoperă rețete de cocktailuri din întreaga lume.',
    url: 'https://marechef.ro/cocktailbooks',
    type: 'website',
    locale: 'ro_RO',
    siteName: 'MareChef.ro',
  },
  twitter: {
    card: 'summary',
    title: 'Cărți de Cocktailuri | MareChef.ro',
    description: 'Descoperă rețete de cocktailuri din întreaga lume.',
  },
  alternates: {
    canonical: 'https://marechef.ro/cocktailbooks',
  },
}

/* ─── spirit families ───────────────────────────────────────────────────── */
const SPIRIT_GROUPS = [
  {
    family: 'Whisky & Bourbon',
    slug: 'whisky',
    emoji: '🥃',
    desc: 'Whisky-uri scoțiene, irlandeze, japoneze și bourbon-uri îmbătrânite în butoaie',
    img: 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=600&q=80',
  },
  {
    family: 'Gin',
    slug: 'gin',
    emoji: '🌿',
    desc: 'London Dry, gin-uri botanice contemporane și florale',
    img: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=600&q=80',
  },
  {
    family: 'Rum',
    slug: 'rum',
    emoji: '🍹',
    desc: 'Rum-uri albe, negre, îmbătrânite și condimentate din Caraibe',
    img: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=600&q=80',
  },
  {
    family: 'Tequila & Mezcal',
    slug: 'tequila',
    emoji: '🌵',
    desc: 'Tequila Blanco, Reposado, Añejo și expresii mezcal cu fum',
    img: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=600&q=80',
  },
  {
    family: 'Vodka',
    slug: 'vodka',
    emoji: '🧊',
    desc: 'Vodkă clasică și cu aromă din întreaga lume',
    img: 'https://images.unsplash.com/photo-1612528443702-f6741f70a049?w=600&q=80',
  },
  {
    family: 'Brandy & Cognac',
    slug: 'brandy',
    emoji: '🍇',
    desc: 'Cognacuri VS, VSOP, XO și Armagnac, calvados, pisco',
    img: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
  },
  {
    family: 'Liqueurs & Aperitifs',
    slug: 'liqueur',
    emoji: '🍊',
    desc: 'Lichioruri amare, dulci și cu plante aromă — Campari, Aperol, Amaro',
    img: 'https://images.unsplash.com/photo-1560508180-03f285f67ded?w=600&q=80',
  },
  {
    family: 'Wine & Champagne',
    slug: 'wine',
    emoji: '🍾',
    desc: 'Cocktail-uri spumante, spritz-uri pe bază de vin și sangria',
    img: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&q=80',
  },
  {
    family: 'Non-Alcoholic',
    slug: 'mocktail',
    emoji: '🍃',
    desc: 'Mocktail-uri artizanale fără alcool și sofisticate',
    img: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=600&q=80',
  },
]

/* ─── featured cocktail collections ─────────────────────────────────────── */
const COCKTAIL_COLLECTIONS = [
  {
    title: 'Cocktailuri Clasice',
    desc: 'Rețete clasice desăvârșite',
    emoji: '🍸',
    count: 32,
    img: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=600&q=80',
  },
  {
    title: 'Răcoritoare de Vară',
    desc: 'Ușoare, răcoritoare și fructate',
    emoji: '☀️',
    count: 18,
    img: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=600&q=80',
  },
  {
    title: 'Încălzitoare de Iarnă',
    desc: 'Condimentate, calde și reconfortante',
    emoji: '🔥',
    count: 14,
    img: 'https://images.unsplash.com/photo-1578897367052-e0e6b5b0b2b0?w=600&q=80',
  },
  {
    title: 'Băuturi Ușoare',
    desc: 'Savoare fără exces',
    emoji: '🌱',
    count: 21,
    img: 'https://images.unsplash.com/photo-1497534446932-c925b458314e?w=600&q=80',
  },
  {
    title: 'Cocktailuri de Brunch',
    desc: 'Mimosa, Bloody Mary și altele',
    emoji: '🥂',
    count: 16,
    img: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&q=80',
  },
  {
    title: 'Tiki & Tropicale',
    desc: 'Evadare cu rom intens',
    emoji: '🏝️',
    count: 12,
    img: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=600&q=80',
  },
]

export default function CocktailBooksPage() {
  return (
    <main
      className="min-h-screen"
      style={{ background: '#dde3ee', color: '#111', fontFamily: "'Inter', sans-serif" }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@400;500;600&display=swap');.ff{font-family:'Syne',sans-serif;}`}</style>

      {/* ── HERO BAND ── */}
      <div className="relative w-full overflow-hidden" style={{ height: '280px' }}>
        <img
          src="https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=1600&q=80"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.60)' }} />

        <div className="relative h-full flex flex-col justify-between px-8 py-8 max-w-7xl mx-auto w-full">
          <div className="self-start">
            <p
              className="text-xs font-bold px-2.5 py-1 rounded-full inline-block"
              style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa' }}
            >
              {SPIRIT_GROUPS.length} spirit families · {COCKTAIL_COLLECTIONS.length} collections
            </p>
          </div>

          <div>
             <h1 className="ff text-5xl font-extrabold tracking-tight mb-3 leading-tight text-white">
              Biblioteca de Cocktailuri
            </h1>
            <p className="text-lg mb-5" style={{ color: '#ccc' }}>
              Descoperă cocktailuri după spirit, stil și ocazie
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
      <div className="px-6 py-12 max-w-7xl mx-auto space-y-16">

        {/* ── SPIRIT FAMILIES ── */}
        <section>
          <div className="mb-6">
            <h2 className="ff text-xl font-bold mb-1" style={{ color: '#111' }}>Explorează după Spirit</h2>
            <p style={{ color: '#888' }} className="text-xs">Descoperă rețete de cocktail organizate după spiritul de bază</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {SPIRIT_GROUPS.map((spirit) => (
              <Link
                key={spirit.slug}
                href={`/search?q=${encodeURIComponent(spirit.slug)}&mode=cocktails`}
                className="group relative flex flex-col rounded-[12px] overflow-hidden border transition-all duration-300"
                style={{
                  borderColor: 'rgba(0,0,0,0.08)',
                  borderWidth: '1px',
                  height: '160px',
                  background: '#fff',
                }}
              >
                {/* Image */}
                <div className="h-[95px] overflow-hidden flex-shrink-0 w-full">
                  <img
                    src={spirit.img}
                    alt={spirit.family}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>

                {/* Text */}
                <div className="flex-1 px-3 py-2 flex flex-col justify-between" style={{ background: '#fff' }}>
                  <div>
                    <h3 className="ff text-sm font-bold leading-tight truncate" style={{ color: '#111' }}>
                      {spirit.emoji} {spirit.family}
                    </h3>
                    <p style={{ color: '#888' }} className="text-xs line-clamp-1">{spirit.desc}</p>
                  </div>
                  <span style={{ color: '#a78bfa' }} className="text-xs font-bold ml-auto flex-shrink-0">→</span>
                </div>

                {/* Hover border */}
                <div
                  className="absolute inset-0 rounded-[12px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{ border: '1px solid rgba(167,139,250,0.4)' }}
                />
              </Link>
            ))}
          </div>
        </section>

        {/* ── FEATURED COLLECTIONS ── */}
        <section>
          <h2 className="ff text-xl font-bold mb-6" style={{ color: '#111' }}>Colecții Populare</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {COCKTAIL_COLLECTIONS.map((col) => (
              <Link
                key={col.title}
                href={`/search?q=${encodeURIComponent(col.title)}&mode=cocktails`}
                className="group relative flex flex-col rounded-2xl overflow-hidden border transition-all duration-300"
                style={{
                  height: '280px',
                  background: '#fff',
                  borderColor: 'rgba(0,0,0,0.08)',
                  borderWidth: '1px',
                }}
              >
                {/* Image top - larger */}
                <div className="h-[160px] overflow-hidden flex-shrink-0 w-full">
                  <img
                    src={col.img}
                    alt={col.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>

                {/* Text bottom */}
                <div className="flex-1 px-4 py-4 flex flex-col justify-between">
                  <div>
                    <h3 className="ff font-bold text-lg leading-tight mb-2 flex items-center gap-2" style={{ color: '#111' }}>
                      <span>{col.emoji}</span>
                      {col.title}
                    </h3>
                    <p style={{ color: '#888' }} className="text-sm leading-relaxed">{col.desc}</p>
                  </div>
                  <div className="flex items-end justify-between gap-2 pt-2">
                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg ml-auto flex-shrink-0"
                      style={{ background: 'rgba(139,92,246,0.15)', color: '#7c3aed' }}
                    >
                      {col.count} cocktail-uri
                    </span>
                  </div>
                </div>

                {/* Hover border */}
                <div
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{ border: '1px solid rgba(167,139,250,0.4)' }}
                />
              </Link>
            ))}
          </div>
        </section>

        {/* ── QUICK LINKS ── */}
        <section>
          <h2 className="ff text-xl font-bold mb-6" style={{ color: '#111' }}>Descoperă Mai Mult</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Toate Cocktailurile', href: '/search?mode=cocktails', emoji: '🍸' },
              { label: 'În Tendințe', href: '/search?mode=cocktails&sort=trending', emoji: '🔥' },
              { label: 'Fără Alcool', href: '/search?mode=cocktails&q=mocktail', emoji: '🍃' },
              { label: 'Adaugă o Rețetă', href: '/submit/recipe', emoji: '✍️' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-all hover:border-purple-300"
                style={{
                  background: '#fff',
                  borderColor: 'rgba(0,0,0,0.08)',
                  color: '#555',
                }}
              >
                <span className="text-xl">{link.emoji}</span>
                <span className="text-sm font-medium">{link.label}</span>
              </Link>
            ))}
          </div>
        </section>

      </div>
    </main>
  )
}
