'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import FallbackImage from '@/components/FallbackImage'
import Link from 'next/link'
import { MOCK_TRENDING } from '@/lib/mock-data'

interface TrendingItem {
  id: string
  title: string
  slug: string
  votes: number
  tag?: string
  hero_image_url?: string
  created_by?: { display_name: string; avatar_url: string | null }
  _type: 'recipe' | 'cocktail'
}

/* Rank indicator — medal for top 3, plain number otherwise */
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-xl leading-none drop-shadow-lg">🥇</span>
  if (rank === 2) return <span className="text-xl leading-none drop-shadow-lg">🥈</span>
  if (rank === 3) return <span className="text-xl leading-none drop-shadow-lg">🥉</span>
  return (
    <span
      className="text-sm font-extrabold leading-none"
      style={{ color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,1)' }}
    >
      #{rank}
    </span>
  )
}

export default function TrendingSection() {
  const [recipes, setRecipes] = useState<TrendingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'recipes' | 'cocktails'>('recipes')

  useEffect(() => {
    // Fetch recipes from trending API
    fetch('/api/trending')
      .then(res => res.json())
      .then(data => {
        const raw: TrendingItem[] = (data.recipes || []).map((r: TrendingItem) => {
          const mock = MOCK_TRENDING.find(m => m.id === r.id || m.slug === r.slug)
          return {
            ...r,
            hero_image_url: r.hero_image_url ?? mock?.hero_image_url,
            created_by: r.created_by ?? mock?.created_by,
            _type: 'recipe' as const,
          }
        })
        setRecipes(raw)
      })
      .catch(() => {
        setRecipes(
          MOCK_TRENDING.map(r => ({ ...r, _type: 'recipe' as const }))
        )
      })
      .finally(() => setLoading(false))
  }, [])

  const [cocktails, setCocktails] = useState<TrendingItem[]>([])

  useEffect(() => {
    // Fetch cocktails from search API, sorted by trending (quality_score desc)
    fetch('/api/search/cocktails?sort=trending&per_page=10')
      .then(res => res.json())
      .then(data => {
        const items: TrendingItem[] = (data.cocktails || []).map((c: any) => ({
          id: c.id,
          title: c.title,
          slug: c.slug,
          votes: c.quality_score || 0,
          hero_image_url: c.hero_image_url,
          created_by: c.created_by,
          _type: 'cocktail' as const,
        }))
        setCocktails(items)
      })
      .catch(() => {
        // Fallback: empty list if API fails
        setCocktails([])
      })
  }, [])

  const items = tab === 'recipes' ? recipes : cocktails

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col h-full bg-white border border-gray-200 dark:bg-[#111] dark:border-white/[0.08]"
    >
       {/* ── Header ── */}
       <div
         className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/[0.07]"
       >
        <div className="flex items-center gap-2">
          <span className="text-base">🔥</span>
            <span
              className="font-bold text-sm tracking-wide text-gray-900 dark:text-[#f0f0f0]"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
             În tendințe acum
           </span>
           {!loading && (
             <span
               className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
               style={{ background: 'rgba(139,26,43,0.15)', color: '#8B1A2B' }}
             >
               {items.length}
             </span>
           )}
        </div>
          <Link
            href={tab === 'recipes' ? '/search?sort=trending' : '/search?mode=cocktails&sort=trending'}
            className="text-[11px] font-semibold transition-opacity hover:opacity-100 opacity-70"
            style={{ color: '#8B1A2B' }}
          >
            Vezi tot →
          </Link>
      </div>

       {/* ── Tab toggle ── */}
       <div
         className="flex px-3 pt-2.5 pb-1 gap-1.5 border-b border-gray-100 dark:border-white/[0.05]"
       >
          <button
            onClick={() => setTab('recipes')}
            className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
              tab === 'recipes'
                ? "bg-[rgba(139,26,43,0.18)] text-[#8B1A2B]"
                : "bg-gray-100 text-gray-500 dark:bg-white/[0.05] dark:text-gray-500"
            }`}
          >
           🍽️ Rețete
         </button>
        <button
          onClick={() => setTab('cocktails')}
          className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
            tab === 'cocktails'
              ? "bg-[rgba(139,26,43,0.2)] text-[#b8394e]"
              : "bg-gray-100 text-gray-500 dark:bg-white/[0.05] dark:text-gray-500"
          }`}
        >
          🍹 Cocktailuri
        </button>
      </div>

      {/* ── Loading skeleton ── */}
      {loading && tab === 'recipes' && (
        <div className="p-3 space-y-3">
           {Array.from({ length: 8 }).map((_, i) => (
             <div key={i} className="rounded-2xl overflow-hidden animate-pulse bg-gray-200 dark:bg-[#1a1a1a]" style={{ height: 130 }} />
           ))}
        </div>
      )}

       {/* ── Empty state ── */}
        {!loading && items.length === 0 && (
          <p className="px-4 py-10 text-sm text-center text-gray-400 dark:text-[#444]">
            Nimic în tendințe deocamdată
          </p>
        )}

      {/* ── List ── */}
      {(!loading || tab === 'cocktails') && items.length > 0 && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {items.map((item, i) => {
            const href = item._type === 'cocktail'
              ? `/cocktails/${item.slug}`
              : `/recipes/${item.slug}`
            const accentColor = item._type === 'cocktail' ? '#b8394e' : '#8B1A2B'

            return (
              <Link
                key={item.id}
                href={href}
                className="group relative block rounded-2xl overflow-hidden"
                style={{ height: 130 }}
              >
                 {/* Hero image */}
                 {item.hero_image_url ? (
                   <FallbackImage
                     src={item.hero_image_url}
                     alt=""
                     fill
                     fallbackEmoji={item._type === 'cocktail' ? '🍹' : '🍽️'}
                     className="object-cover group-hover:scale-105 transition-transform duration-500"
                     sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                   />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center text-3xl bg-gray-200 dark:bg-[#1a1a1a]">
                     {item._type === 'cocktail' ? '🍹' : '🍽️'}
                   </div>
                 )}

                {/* Gradient overlay */}
                <div
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.15) 55%, transparent 100%)' }}
                />

                {/* Rank badge — top left */}
                <div className="absolute top-2 left-2">
                  <RankBadge rank={i + 1} />
                </div>

                {/* Type badge — top right (cocktails only) */}
                 {item._type === 'cocktail' && (
                   <span
                     className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                     style={{ background: 'rgba(139,26,43,0.75)', color: '#fff' }}
                   >
                     🍹 Cocktail
                   </span>
                 )}

                {/* Info overlay — bottom */}
                <div className="absolute bottom-0 left-0 right-0 px-3 py-2.5">
                  <p
                    className="text-xs font-bold leading-snug line-clamp-2 group-hover:text-white transition-colors mb-1"
                    style={{ color: '#f0f0f0' }}
                  >
                    {item.title}
                  </p>
                  <div className="flex items-center justify-between">
                    {item.created_by && (
                      <span className="text-[10px] truncate max-w-[110px]" style={{ color: '#aaa' }}>
                        {item.created_by.display_name}
                      </span>
                    )}
                    <span
                      className="text-[11px] font-bold flex items-center gap-0.5 flex-shrink-0"
                      style={{ color: accentColor }}
                    >
                      ♥ {item.votes.toLocaleString()}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

       {/* ── Footer ── */}
       {(!loading || tab === 'cocktails') && items.length > 0 && (
         <div
           className="px-4 py-2.5 border-t border-gray-100 dark:border-white/[0.05]"
         >
          <Link
            href={tab === 'recipes' ? '/search?sort=trending' : '/search?mode=cocktails&sort=trending'}
             className="block text-center text-xs font-semibold py-1.5 rounded-xl transition-all"
              style={
                 tab === 'cocktails'
                   ? { background: 'rgba(139,26,43,0.1)', color: '#b8394e', border: '1px solid rgba(139,26,43,0.2)' }
                   : { background: 'rgba(139,26,43,0.08)', color: '#8B1A2B', border: '1px solid rgba(139,26,43,0.15)' }
               }
           >
             {tab === 'recipes' ? 'Vezi toate rețetele în tendințe →' : 'Vezi toate cocktailurile în tendințe →'}
           </Link>
        </div>
      )}
    </div>
  )
}
