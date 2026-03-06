'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TonightRecommendation } from '@/lib/recommendations'

/* ─── reason pill ────────────────────────────────────────────────────────── */

function ReasonPill({ reason }: { reason: string }) {
  const cfg =
    reason === 'Trending'
      ? { bg: 'rgba(255,77,109,0.15)', color: '#ff4d6d', icon: '🔥' }
      : reason === 'From your Cookbook'
      ? { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', icon: '📖' }
      : { bg: 'rgba(96,165,250,0.15)', color: '#60a5fa', icon: '✨' }

  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.icon} {reason}
    </span>
  )
}

/* ─── mock fallback data ─────────────────────────────────────────────────── */

import { MOCK_RECIPES } from '@/lib/mock-data'

const MOCK_RECS: TonightRecommendation[] = MOCK_RECIPES.slice(0, 5).map(r => ({
  id: r.id,
  title: r.title,
  slug: r.slug,
  summary: r.summary,
  hero_image_url: r.hero_image_url,
  approach_name: r.region ?? null,
  cook_time_minutes: 30,
  servings: r.servings ?? 4,
  net_votes: r.votes,
  reason: r.tag === 'Trending' ? 'Trending' : 'Popular in Global' as TonightRecommendation['reason'],
  score: r.votes,
}))

/* ─── component ──────────────────────────────────────────────────────────── */

export default function TonightCard() {
  const router = useRouter()
  const [recs, setRecs] = useState<TonightRecommendation[]>([])
  const [loading, setLoading] = useState(true)

  /* timezone-aware label */
  const hour = typeof window !== 'undefined' ? new Date().getHours() : 12
  const isTonight = hour >= 18
  const label  = isTonight ? "Alegerile diseară" : "Alegerile astazi"
  const emoji  = isTonight ? '🌙' : '🍽️'

  useEffect(() => {
    fetch('/api/tonight')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setRecs(d.recommendations || []); setLoading(false) })
      .catch(() => { setRecs(MOCK_RECS); setLoading(false) })
  }, [])

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{emoji}</span>
          <span
            className="font-bold text-sm tracking-wide"
            style={{ fontFamily: "'Syne', sans-serif", color: '#f0f0f0' }}
          >
            {label}
          </span>
        </div>
         <span className="text-[10px]" style={{ color: '#444' }}>
           {isTonight ? 'Pentru cina diseară' : 'Idei de mâncare pentru astazi'}
         </span>
       </div>

       {/* ── Loading skeleton ── */}
       {loading && (
         <div className="p-3 space-y-2">
           {Array.from({ length: 5 }).map((_, i) => (
             <div key={i} className="flex gap-3 p-2 items-center">
               <div className="w-14 h-14 rounded-xl animate-pulse flex-shrink-0" style={{ background: '#222' }} />
               <div className="flex-1 space-y-2">
                 <div className="h-3 rounded animate-pulse" style={{ background: '#222', width: '80%' }} />
                 <div className="h-2.5 rounded animate-pulse" style={{ background: '#222', width: '50%' }} />
               </div>
             </div>
           ))}
         </div>
       )}

       {/* ── Empty ── */}
       {!loading && recs.length === 0 && (
         <p className="px-4 py-10 text-sm text-center" style={{ color: '#444' }}>
           Nicio alegere deocamdată — revino mai târziu
         </p>
       )}

      {/* ── Vertical list ── */}
      {!loading && recs.length > 0 && (
        <div>
          {recs.map((rec, i) => (
            <div
              key={rec.id}
              className="group flex gap-3 px-3 py-2.5 transition-colors hover:bg-white/[0.03] cursor-pointer"
              style={{ borderBottom: i < recs.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
              onClick={() => router.push(`/recipes/${rec.slug}`)}
            >
              {/* Thumbnail */}
              <div className="flex-shrink-0 rounded-xl overflow-hidden" style={{ width: 56, height: 56 }}>
                <img
                  src={rec.hero_image_url}
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                <p
                  className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-white transition-colors"
                  style={{ color: '#ddd' }}
                >
                  {rec.title}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <ReasonPill reason={rec.reason} />
                  {rec.cook_time_minutes && (
                    <span className="text-[10px]" style={{ color: '#555' }}>
                      ⏱ {rec.cook_time_minutes}m
                    </span>
                  )}
                  {rec.net_votes > 0 && (
                    <span className="text-[10px]" style={{ color: '#555' }}>
                      ♥ {rec.net_votes}
                    </span>
                  )}
                </div>
              </div>

               {/* Cook CTA */}
               <button
                 onClick={e => { e.stopPropagation(); router.push(`/recipes/${rec.slug}?cook=true`) }}
                 className="flex-shrink-0 self-center px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                 style={{
                   background: 'rgba(255,149,0,0.12)',
                   color: '#ff9500',
                   border: '1px solid rgba(255,149,0,0.2)',
                 }}
               >
                 Gătește
               </button>
             </div>
           ))}
         </div>
       )}

       {/* ── Footer ── */}
       {!loading && recs.length > 0 && (
         <div
           className="px-4 py-2.5"
           style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
         >
           <button
             onClick={() => router.push('/tonight-recommendations')}
             className="w-full text-center text-xs font-semibold py-1.5 rounded-xl transition-all"
             style={{
               background: isTonight ? 'rgba(255,149,0,0.08)' : 'rgba(96,165,250,0.08)',
               color: isTonight ? '#ff9500' : '#60a5fa',
               border: `1px solid ${isTonight ? 'rgba(255,149,0,0.15)' : 'rgba(96,165,250,0.15)'}`,
             }}
           >
             {isTonight ? 'Mai multe alegeri pentru diseară →' : 'Mai multe alegeri pentru astazi →'}
           </button>
         </div>
       )}
    </div>
  )
}
