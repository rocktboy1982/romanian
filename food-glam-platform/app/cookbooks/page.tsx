export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Image from 'next/image'
import FallbackImage from '@/components/FallbackImage'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { REGION_META } from '@/lib/recipe-taxonomy'

export const metadata: Metadata = {
  title: 'Cărți de Rețete | MareChef.ro',
  description: 'Explorează rețete din diferite regiuni și culturi. Descoperă mâncare din Asia, Europa, Africa, Americi și Oceania pe MareChef.ro.',
  openGraph: {
    title: 'Cărți de Rețete | MareChef.ro',
    description: 'Explorează rețete din diferite regiuni și culturi.',
    url: 'https://marechef.ro/cookbooks',
    type: 'website',
    locale: 'ro_RO',
    siteName: 'MareChef.ro',
  },
  twitter: {
    card: 'summary',
    title: 'Cărți de Rețete | MareChef.ro',
    description: 'Explorează rețete din diferite regiuni și culturi.',
  },
  alternates: {
    canonical: 'https://marechef.ro/cookbooks',
  },
}

/* ─── continent groups with descriptions ──────────────────────────────── */
const CONTINENT_GROUPS = [
  {
    continent: 'Asia',
    ids: ['east-asia', 'southeast-asia', 'south-asia'],
    desc: 'Rute antice de mirodenii și mâncare de stradă modernă',
  },
  {
    continent: 'Orientul Mijlociu și Asia Centrală',
    ids: ['middle-east', 'central-asia'],
    desc: 'Arome din Drumul Mătăsii de la Istanbul la Samarkand',
  },
  {
    continent: 'Europa',
    ids: ['western-europe', 'northern-europe', 'eastern-europe'],
    desc: 'De la pivnițe de brânzeturi Alpine la țărmurile Mediteranei',
  },
  {
    continent: 'Africa',
    ids: ['north-africa', 'west-africa', 'east-africa', 'southern-africa'],
    desc: 'Un continent cu arome îndrăznețe și tradiție profundă',
  },
  {
    continent: 'Americi',
    ids: ['north-america', 'south-america'],
    desc: 'Abundență din Noul Lume de la Arctic la Patagonia',
  },
  {
    continent: 'Oceania',
    ids: ['oceania'],
    desc: 'Insule din Pacific, mâncare tradițională și fuziune',
  },
]

/* ─── hero images per region (Unsplash) ──────────────────────────────────── */
const REGION_IMAGES: Record<string, string> = {
  // Landmark / landscape / cultural — meaningful to each region
  'east-asia':        'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=600&q=80', // Tokyo skyline
  'southeast-asia':   'https://images.unsplash.com/photo-1528181304800-259b08848526?w=600&q=80', // Thai temple
  'south-asia':       'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&q=80', // Taj Mahal
  'middle-east':      'https://images.unsplash.com/photo-1548199569-3e1c6aa8f469?w=600&q=80', // Desert dunes
  'central-asia':     'https://images.unsplash.com/photo-1596367407372-96cb88503db6?w=600&q=80', // Registan Samarkand
  'western-europe':   'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=600&q=80', // Paris Eiffel
  'northern-europe':  'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=600&q=80', // Northern lights
  'eastern-europe':   'https://images.unsplash.com/photo-1541849546-216549ae216d?w=600&q=80', // Prague old town
  'north-africa':     'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=600&q=80', // Moroccan medina
  'west-africa':      'https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=600&q=80', // Sahel landscape
  'east-africa':      'https://images.unsplash.com/photo-1612892483236-52d32a0e0ac1?w=600&q=80', // Kilimanjaro savanna
  'southern-africa':  'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=600&q=80', // Cape Town table mountain
  'north-america':    'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=600&q=80', // NYC skyline
  'south-america':    'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=600&q=80', // Rio Sugarloaf
  'oceania':          'https://images.unsplash.com/photo-1523428096881-5bd79d043006?w=600&q=80', // Sydney Opera House
  'international':    'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=600&q=80',
}

/* ─── featured collections ───────────────────────────────────────────────── */
const COLLECTIONS = [
  {
    title: 'Rapid în seara de lucru',
    desc: 'Gata în 30 min',
    emoji: '⚡',
    count: 24,
    query: '',
    img: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=600&q=80',
  },
  {
    title: 'Vegetarian și Vegan',
    desc: 'Pe bază de plante pentru fiecare masă',
    emoji: '🌱',
    count: 18,
    query: 'vegan',
    img: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80',
  },
  {
    title: 'Mâncare de stradă',
    desc: 'Mâncăruri iconice din lume',
    emoji: '🌮',
    count: 15,
    query: 'street-food',
    img: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&q=80',
  },
  {
    title: 'Produse de patiserie',
    desc: 'Pâini, prăjituri și patiserii',
    emoji: '🥐',
    count: 21,
    query: 'pastry',
    img: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80',
  },
  {
    title: 'Sănătos și ușor',
    desc: 'Sub 500 calorii',
    emoji: '🥗',
    count: 19,
    query: 'healthy',
    img: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80',
  },
  {
    title: 'Clasice de confort',
    desc: 'Mâncăruri care se simt ca acasă',
    emoji: '🍲',
    count: 22,
    query: 'casserole',
    img: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=600&q=80',
  },
]

export default async function CookbooksPage() {
  const supabase = await createServerSupabaseClient()
  const { data: cuisines } = await supabase
    .from('cuisines')
    .select('id, name, slug, country_code, description, featured_image_url')
    .order('name')

  const hasCuisines = cuisines && cuisines.length > 0

  return (
    <main
      className="min-h-screen"
      style={{ background: 'hsl(var(--background))', color: 'hsl(var(--foreground))', fontFamily: "'Inter', sans-serif" }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@400;500;600&display=swap');.ff{font-family:'Syne',sans-serif;}`}</style>

      {/* ── HERO BAND ── */}
      <div className="relative w-full overflow-hidden" style={{ height: '280px' }}>
       {/* Background image with dark overlay */}
          <FallbackImage
            src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1600&q=80"
            alt=""
            fill
            className="absolute object-cover"
            sizes="100vw"
            fallbackEmoji="🍽️"
          />
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.45)' }} />

        {/* Hero content */}
        <div className="relative h-full flex flex-col justify-between px-8 py-8 max-w-7xl mx-auto w-full">
          {/* Top: Info pill */}
          <div className="self-start">
              <p
               className="text-xs font-bold px-2.5 py-1 rounded-full inline-block"
               style={{ background: 'rgba(255,149,0,0.15)', color: '#ff9500' }}
             >
               15 regiuni · 6 colecții
             </p>
          </div>

          {/* Bottom: Headline + Subtitle */}
          <div>
            <h1 className="ff text-5xl font-extrabold tracking-tight mb-3 leading-tight" style={{ color: '#fff' }}>
               Lumea pe o farfurie
             </h1>
             <p className="text-lg" style={{ color: '#eee' }}>
               Explorează rețete după regiune, bucătărie și stil
             </p>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="px-6 py-12 max-w-7xl mx-auto space-y-16">
        {/* ── REGION GROUPS ── */}
        <section className="space-y-10">
          {CONTINENT_GROUPS.map((group) => {
            const regions = group.ids
              .map((id) => ({ id, ...REGION_META[id] }))
              .filter((r) => r.label)

            if (regions.length === 0) return null

            return (
              <div key={group.continent}>
                {/* Continent header */}
                <div className="mb-3">
                  <h2 className="ff text-lg font-bold mb-1" style={{ color: '#111' }}>{group.continent}</h2>
                  <p style={{ color: '#666' }} className="text-xs">
                    {group.desc}
                  </p>
                </div>

                {/* Region horizontal cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {regions.map((r) => {
                    const img = REGION_IMAGES[r.id]
                    return (
                      <Link
                        key={r.id}
                        href={`/cookbooks/region/${r.id}`}
                        className="group relative flex flex-col rounded-[12px] overflow-hidden border transition-all duration-300"
                        style={{
                          borderColor: 'rgba(0,0,0,0.1)',
                          borderWidth: '1px',
                          height: '160px',
                        }}
                      >
                        {/* Image: 95px */}
                          <div className="h-[95px] overflow-hidden flex-shrink-0 w-full relative">
                            {img ? (
                              <FallbackImage
                                src={img}
                                alt={r.label}
                                fill
                                className="object-cover group-hover:scale-105 transition-transform duration-500"
                                sizes="200px"
                                fallbackEmoji="🍽️"
                              />
                           ) : (
                            <div
                              className="w-full h-full flex items-center justify-center text-4xl"
                              style={{ background: '#e8e8e8' }}
                            >
                              {r.emoji}
                            </div>
                          )}
                        </div>

                        {/* Text area: 65px */}
                        <div
                          className="flex-1 px-3 py-2 flex flex-col justify-between"
                          style={{ background: '#fff' }}
                        >
                          <div>
                            <h3 className="ff text-sm font-bold leading-tight truncate" style={{ color: '#111' }}>{r.label}</h3>
                            <p style={{ color: '#666' }} className="text-xs line-clamp-1">
                              {r.description || `Discover authentic flavours and culinary traditions from ${r.label}.`}
                            </p>
                          </div>

                          {/* Bottom: emoji + arrow */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-base flex-shrink-0">{r.emoji}</span>
                            <span style={{ color: '#ff9500' }} className="text-xs font-bold ml-auto flex-shrink-0">
                              →
                            </span>
                          </div>
                        </div>

                        {/* Hover border effect */}
                        <div
                          className="absolute inset-0 rounded-[12px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                          style={{
                            border: '1px solid rgba(255,149,0,0.35)',
                          }}
                        />
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </section>

         {/* ── FEATURED COLLECTIONS ── */}
         <section>
           <h2 className="ff text-xl font-bold mb-5" style={{ color: '#111' }}>Colecții în evidență</h2>
          <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
            {COLLECTIONS.map((col) => (
              <Link
                key={col.title}
                href={`/search${col.query ? `?q=${col.query}` : ''}`}
                className="group relative flex flex-col rounded-3xl overflow-hidden border transition-all duration-300 flex-shrink-0 snap-start"
                style={{
                  width: '200px',
                  height: '180px',
                  background: '#fff',
                  borderColor: 'rgba(0,0,0,0.1)',
                  borderWidth: '1px',
                }}
              >
                  {/* Image top (60%) */}
                  <div className="h-[108px] overflow-hidden flex-shrink-0 w-full relative">
                    <FallbackImage
                      src={col.img}
                      alt={col.title}
                      fill
                      className="object-cover group-hover:scale-104 transition-transform duration-500"
                      sizes="200px"
                      fallbackEmoji="🍽️"
                    />
                 </div>

                {/* Text bottom (40%) */}
                <div className="flex-1 px-3 py-2.5 flex flex-col justify-between">
                  <div>
                    <p className="text-2xl leading-none mb-1">{col.emoji}</p>
                    <h3 className="ff font-bold text-sm leading-tight" style={{ color: '#111' }}>{col.title}</h3>
                  </div>
                  <div className="flex items-start justify-between gap-1">
                    <p style={{ color: '#666' }} className="text-xs leading-tight flex-1">
                      {col.desc}
                    </p>
                    <span
                      className="text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: 'rgba(255,149,0,0.15)', color: '#ff9500' }}
                    >
                      {col.count}
                    </span>
                  </div>
                </div>

                {/* Hover border effect */}
                <div
                  className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{
                    border: '1px solid rgba(255,149,0,0.3)',
                  }}
                />
              </Link>
            ))}
          </div>
        </section>

         {/* ── DB CUISINES GRID (if available) ── */}
         {hasCuisines && (
           <section>
             <h2 className="ff text-xl font-bold mb-5" style={{ color: '#111' }}>După bucătărie</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {cuisines.map((cuisine) => (
                <Link
                  key={cuisine.id}
                  href={`/cookbooks/cuisines/${cuisine.slug}`}
                  className="group relative rounded-2xl overflow-hidden border transition-all duration-300"
                  style={{
                    height: 120,
                    borderColor: 'rgba(0,0,0,0.1)',
                    borderWidth: '1px',
                  }}
                 >
                    {cuisine.featured_image_url ? (
                      <FallbackImage
                        src={cuisine.featured_image_url}
                        alt={cuisine.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        sizes="200px"
                        fallbackEmoji="🍽️"
                      />
                   ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl" style={{ background: '#e8e8e8' }}>
                      🍽️
                    </div>
                  )}
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 60%)' }} />
                  <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5">
                    <p className="text-xs font-bold truncate">{cuisine.name}</p>
                    {cuisine.country_code && (
                      <p className="text-[10px]" style={{ color: '#aaa' }}>
                        {cuisine.country_code}
                      </p>
                    )}
                  </div>

                  {/* Hover border effect */}
                  <div
                    className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                    style={{
                      border: '1px solid rgba(255,149,0,0.3)',
                    }}
                  />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
