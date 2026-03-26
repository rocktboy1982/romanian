import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { REGION_META } from '@/lib/recipe-taxonomy'

export const metadata: Metadata = {
  title: 'Bucătăriile Lumii | MareChef.ro',
  description: 'Descoperă rețete autentice din fiecare colț al planetei. Asia, Europa, Africa, Americi și Oceania pe MareChef.ro.',
  openGraph: {
    title: 'Bucătăriile Lumii | MareChef.ro',
    description: 'Descoperă rețete autentice din fiecare colț al planetei.',
    url: 'https://marechef.ro/cookbooks',
    type: 'website',
    locale: 'ro_RO',
    siteName: 'MareChef.ro',
  },
  alternates: { canonical: 'https://marechef.ro/cookbooks' },
}

/* ─── Continent groups ─────────────────────────────────────────────── */
const CONTINENT_GROUPS = [
  {
    continent: '🌏 Asia',
    desc: 'Rute antice de mirodenii și mâncare de stradă modernă',
    ids: ['east-asia', 'southeast-asia', 'south-asia'],
  },
  {
    continent: '🕌 Orientul Mijlociu',
    desc: 'Arome din Drumul Mătăsii de la Istanbul la Samarkand',
    ids: ['middle-east', 'central-asia'],
  },
  {
    continent: '🏰 Europa',
    desc: 'De la pivnițe Alpine la țărmurile Mediteranei',
    ids: ['western-europe', 'northern-europe', 'eastern-europe'],
  },
  {
    continent: '🌍 Africa',
    desc: 'Un continent cu arome îndrăznețe și tradiție profundă',
    ids: ['north-africa', 'west-africa', 'east-africa', 'southern-africa'],
  },
  {
    continent: '🌎 Americi',
    desc: 'Abundență din Lumea Nouă de la Arctic la Patagonia',
    ids: ['north-america', 'central-america-caribbean', 'south-america'],
  },
  {
    continent: '🌊 Oceania',
    desc: 'Insule din Pacific, mâncare tradițională și fuziune',
    ids: ['oceania'],
  },
]

/* ─── Hero images per region ─────────────────────────────────────────── */
const REGION_IMAGES: Record<string, string> = {
  'east-asia':       'https://images.unsplash.com/photo-1617093727343-374698b1b08d?w=600&q=80',
  'southeast-asia':  'https://images.unsplash.com/photo-1562565652-a0d8f0c59eb4?w=600&q=80',
  'south-asia':      'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600&q=80',
  'middle-east':     'https://images.unsplash.com/photo-1547573854-74d2a71d0826?w=600&q=80',
  'central-asia':    'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80',
  'western-europe':  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80',
  'northern-europe': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&q=80',
  'eastern-europe':  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80',
  'north-africa':    'https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=600&q=80',
  'west-africa':     'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=600&q=80',
  'east-africa':     'https://images.unsplash.com/photo-1567364816519-cbc9c4a9b6c1?w=600&q=80',
  'southern-africa': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80',
  'north-america':   'https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&q=80',
  'central-america-caribbean': 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&q=80',
  'south-america':   'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=600&q=80',
  'oceania':         'https://images.unsplash.com/photo-1523428096881-5bd79d043006?w=600&q=80',
}

const REGION_LABELS: Record<string, { name: string; emoji: string; desc: string }> = {
  'east-asia':       { name: 'Asia de Est',       emoji: '🍜', desc: 'China, Japonia, Coreea' },
  'southeast-asia':  { name: 'Asia de Sud-Est',   emoji: '🌴', desc: 'Thailanda, Vietnam, Indonezia' },
  'south-asia':      { name: 'Asia de Sud',       emoji: '🍛', desc: 'India, Pakistan, Bangladesh' },
  'middle-east':     { name: 'Orientul Mijlociu',  emoji: '🧆', desc: 'Liban, Turcia, Iran' },
  'central-asia':    { name: 'Asia Centrală',      emoji: '🏔️', desc: 'Georgia, Kazahstan, Uzbekistan' },
  'western-europe':  { name: 'Europa de Vest',     emoji: '🥖', desc: 'Franța, Italia, Spania' },
  'northern-europe': { name: 'Europa de Nord',     emoji: '🐟', desc: 'Scandinavia, Finlanda, Țările Baltice' },
  'eastern-europe':  { name: 'Europa de Est',      emoji: '🥟', desc: 'Polonia, Ungaria, Balcani' },
  'north-africa':    { name: 'Africa de Nord',     emoji: '🏺', desc: 'Maroc, Tunisia, Egipt' },
  'west-africa':     { name: 'Africa de Vest',     emoji: '🌍', desc: 'Nigeria, Ghana, Senegal' },
  'east-africa':     { name: 'Africa de Est',      emoji: '☕', desc: 'Etiopia, Kenya, Tanzania' },
  'southern-africa': { name: 'Africa de Sud',      emoji: '🔥', desc: 'Africa de Sud, Zimbabwe, Madagascar' },
  'north-america':   { name: 'America de Nord',    emoji: '🍔', desc: 'SUA, Canada, Mexic' },
  'central-america-caribbean': { name: 'America Centrală', emoji: '🌮', desc: 'Cuba, Jamaica, Panama' },
  'south-america':   { name: 'America de Sud',     emoji: '🥩', desc: 'Argentina, Peru, Brazilia' },
  'oceania':         { name: 'Oceania',             emoji: '🌊', desc: 'Australia, Fiji, Samoa' },
}

export default function CookbooksPage() {
  return (
    <main className="min-h-screen" style={{ background: '#dde3ee' }}>
      <div className="max-w-6xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-3" style={{ fontFamily: "'Syne', sans-serif", color: '#111' }}>
            Bucătăriile Lumii
          </h1>
          <p className="text-gray-500 text-lg">Descoperă rețete autentice din fiecare colț al planetei</p>
        </div>

        {/* Continent sections */}
        {CONTINENT_GROUPS.map(group => {
          const regions = group.ids.filter(id => REGION_META[id] || REGION_LABELS[id])

          return (
            <section key={group.continent} className="mb-12">
              {/* Continent header */}
              <div className="mb-5">
                <h2 className="text-2xl font-bold mb-1" style={{ color: '#111' }}>{group.continent}</h2>
                <p className="text-sm text-gray-500">{group.desc}</p>
              </div>

              {/* Region cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {regions.map(id => {
                  const info = REGION_LABELS[id] || { name: id, emoji: '🍽️', desc: '' }
                  const img = REGION_IMAGES[id] || ''
                  const meta = REGION_META[id]
                  const countryCount = meta?.countries?.length || 0

                  return (
                    <Link
                      key={id}
                      href={`/cookbooks/region/${id}`}
                      className="group relative block rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all"
                      style={{ aspectRatio: '16/10' }}
                    >
                      {img && (
                        <Image
                          src={img}
                          alt={info.name}
                          fill
                          unoptimized
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                      )}
                      {/* Gradient overlay */}
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.15) 55%, transparent 100%)' }} />

                      {/* Country count badge */}
                      {countryCount > 0 && (
                        <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', color: '#fff' }}>
                          {countryCount} bucătării
                        </span>
                      )}

                      {/* Info */}
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-2xl">{info.emoji}</span>
                          <h3 className="text-xl font-bold text-white">{info.name}</h3>
                        </div>
                        <p className="text-xs text-white/70">{info.desc}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          )
        })}

        {/* Footer */}
        <div className="text-center mt-8">
          <Link
            href="/recipes"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all hover:scale-105"
            style={{ background: '#111', color: '#fff' }}
          >
            🍽️ Toate rețetele ({Object.keys(REGION_META).length}+ bucătării)
          </Link>
        </div>
      </div>
    </main>
  )
}
