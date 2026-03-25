export const dynamic = 'force-dynamic'

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
  twitter: {
    card: 'summary_large_image',
    title: 'Bucătăriile Lumii | MareChef.ro',
    description: 'Descoperă rețete autentice din fiecare colț al planetei.',
  },
  alternates: {
    canonical: 'https://marechef.ro/cookbooks',
  },
}

/* ─── Region hero images (beautiful food photos from Unsplash/Pexels) ───── */
const REGION_HERO_IMAGES: Record<string, string> = {
  'east-asia':       'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=800&q=80', // Japanese ramen
  'southeast-asia':  'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800&q=80', // Thai street food
  'south-asia':      'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80', // Indian curry
  'middle-east':     'https://images.unsplash.com/photo-1541529086526-db283c563270?w=800&q=80', // Middle Eastern mezze
  'north-africa':    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80', // Moroccan tagine spread
  'west-africa':     'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80', // West African stew
  'east-africa':     'https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&q=80', // Ethiopian injera
  'southern-africa': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80', // BBQ grilled meat
  'western-europe':  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80', // French cuisine
  'eastern-europe':  'https://images.unsplash.com/photo-1600891964599-f61ba0e24092?w=800&q=80', // Eastern European hearty
  'north-america':   'https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&q=80', // American BBQ burger
  'south-america':   'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=800&q=80', // Ceviche/South American
  'oceania':         'https://images.unsplash.com/photo-1529489609808-440133d7ec7f?w=800&q=80', // Australian seafood
  'central-asia':    'https://images.unsplash.com/photo-1576866209830-589e1bfbaa4d?w=800&q=80', // Central Asian plov
  'northern-europe': 'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=800&q=80', // Nordic spread
}

/* ─── Approximate recipe counts per region ───────────────────────────────── */
const REGION_COUNTS: Record<string, number> = {
  'east-asia':       420,
  'southeast-asia':  310,
  'south-asia':      380,
  'middle-east':     225,
  'north-africa':    190,
  'west-africa':     145,
  'east-africa':     120,
  'southern-africa': 95,
  'western-europe':  490,
  'eastern-europe':  270,
  'north-america':   350,
  'south-america':   280,
  'oceania':         110,
  'central-asia':    80,
  'northern-europe': 160,
}

/* ─── The 12 featured regions shown on this page ─────────────────────────── */
const FEATURED_REGIONS = [
  'east-asia',
  'southeast-asia',
  'south-asia',
  'middle-east',
  'north-africa',
  'west-africa',
  'western-europe',
  'eastern-europe',
  'north-america',
  'south-america',
  'oceania',
  'central-asia',
]

export default function CookbooksPage() {
  const regions = FEATURED_REGIONS
    .map((id) => ({ id, ...REGION_META[id] }))
    .filter((r) => r.label)

  return (
    <main
      className="min-h-screen"
      style={{ background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap');
        .ff { font-family: 'Syne', sans-serif; }
        .region-card-hover {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .region-card-hover:hover {
          transform: scale(1.03);
          box-shadow: 0 20px 40px rgba(0,0,0,0.18);
        }
        .region-card-hover:hover .card-img {
          transform: scale(1.06);
        }
        .card-img {
          transition: transform 0.5s ease;
        }
      `}</style>

      {/* ── PAGE HEADER ── */}
      <div className="px-6 pt-12 pb-6 max-w-7xl mx-auto text-center">
        <h1
          className="ff text-4xl md:text-5xl font-extrabold tracking-tight mb-4"
          style={{ color: 'hsl(var(--foreground))' }}
        >
          Bucătăriile Lumii
        </h1>
        <p
          className="text-lg max-w-2xl mx-auto"
          style={{ color: 'hsl(var(--muted-foreground))' }}
        >
          Descoperă rețete autentice din fiecare colț al planetei
        </p>
      </div>

      {/* ── REGION CARDS GRID ── */}
      <div className="px-6 pb-16 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {regions.map((r) => {
            const heroImg = REGION_HERO_IMAGES[r.id]
            const count = REGION_COUNTS[r.id] ?? 0

            return (
              <Link
                key={r.id}
                href={`/cookbooks/region/${r.id}`}
                className="group region-card-hover relative rounded-2xl overflow-hidden block"
                style={{ aspectRatio: '4 / 3' }}
              >
                {/* Hero image */}
                <div className="absolute inset-0 overflow-hidden">
                  {heroImg ? (
                    <Image
                      src={heroImg}
                      alt={r.label}
                      fill
                      unoptimized={true}
                      className="card-img object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-7xl"
                      style={{ background: '#2a2a3a' }}
                    >
                      {r.emoji}
                    </div>
                  )}
                </div>

                {/* Gradient overlay */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.08) 100%)',
                  }}
                />

                {/* Recipe count badge — top right */}
                {count > 0 && (
                  <div className="absolute top-3 right-3">
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{
                        background: 'rgba(255,255,255,0.18)',
                        backdropFilter: 'blur(6px)',
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.25)',
                      }}
                    >
                      {count}+ rețete
                    </span>
                  </div>
                )}

                {/* Text content — bottom */}
                <div className="absolute bottom-0 left-0 right-0 px-5 pb-5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{r.emoji}</span>
                  </div>
                  <h2
                    className="ff text-xl font-bold leading-tight"
                    style={{ color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}
                  >
                    {r.label}
                  </h2>
                  {r.description && (
                    <p
                      className="text-sm mt-1 line-clamp-2"
                      style={{ color: 'rgba(255,255,255,0.75)' }}
                    >
                      {r.description}
                    </p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>

        {/* ── FOOTER LINK ── */}
        <div className="mt-12 text-center">
          <Link
            href="/recipes"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm transition-all duration-200"
            style={{
              background: 'hsl(var(--primary))',
              color: 'hsl(var(--primary-foreground))',
            }}
          >
            <span>Toate rețetele</span>
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </main>
  )
}
