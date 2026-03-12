'use client'

import { useState } from 'react'
import Image from 'next/image'
import FallbackImage from '@/components/FallbackImage'
import Link from 'next/link'
import TierStar from '@/components/TierStar'
import { MOCK_RECIPES, MOCK_APPROACHES } from '@/lib/mock-data'
import { MOCK_CHEF_PROFILES } from '@/lib/mock-chef-data'
import CommunitySection from '@/components/CommunitySection'

/* ─── types ──────────────────────────────────────────────────────────────── */

type Tab = 'recipes' | 'chefs' | 'rising' | 'cuisine' | 'community'

/* ─── derived data ───────────────────────────────────────────────────────── */

const TOP_RECIPES = [...MOCK_RECIPES].sort((a, b) => b.votes - a.votes)

const TOP_CHEFS = [...MOCK_CHEF_PROFILES].sort(
  (a, b) => b.follower_count - a.follower_count
)

const RISING_RECIPES = [...MOCK_RECIPES]
  .sort((a, b) => b.quality_score - a.quality_score)

// For each region that has recipes, find the #1 by votes
const CUISINE_LEADERS = MOCK_APPROACHES
  .map(approach => {
    const regionRecipes = MOCK_RECIPES
      .filter(r => r.region === approach.id)
      .sort((a, b) => b.votes - a.votes)
    if (regionRecipes.length === 0) return null
    return { approach, top: regionRecipes[0], total: regionRecipes.length }
  })
  .filter(Boolean) as { approach: typeof MOCK_APPROACHES[0]; top: typeof MOCK_RECIPES[0]; total: number }[]

/* ─── helper components ──────────────────────────────────────────────────── */

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-2xl leading-none">🥇</span>
  if (rank === 2) return <span className="text-2xl leading-none">🥈</span>
  if (rank === 3) return <span className="text-2xl leading-none">🥉</span>
  return (
    <span
      className="text-sm font-extrabold tabular-nums w-8 text-center block"
      style={{ color: '#999', fontFamily: "'Syne', sans-serif" }}
    >
      {rank}
    </span>
  )
}

function formatFollowers(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  return String(n)
}

const DIET_COLORS: Record<string, string> = {
  vegan: '#4ade80',
  vegetarian: '#86efac',
  pescatarian: '#60a5fa',
  'gluten-free': '#fbbf24',
}

/* ══════════════════════════════════════════════════════════════════════════
   TAB PANELS
═══════════════════════════════════════════════════════════════════════════ */

function TopRecipesTab() {
  return (
    <div>
      {TOP_RECIPES.map((recipe, i) => (
        <Link
          key={recipe.id}
          href={`/recipes/${recipe.slug}`}
          className="group flex items-center gap-5 px-5 py-5 transition-colors hover:bg-black/[0.02]"
          style={{
            borderBottom: i < TOP_RECIPES.length - 1
              ? '1px solid rgba(0,0,0,0.07)'
              : 'none',
          }}
        >
          {/* Rank */}
          <div className="flex-shrink-0 w-10 flex items-center justify-center">
            <RankBadge rank={i + 1} />
          </div>

            {/* Thumbnail */}
            <div
              className="flex-shrink-0 rounded-2xl overflow-hidden relative"
              style={{ width: 96, height: 96 }}
            >
              {recipe.hero_image_url ? (
                <FallbackImage
                  src={recipe.hero_image_url}
                  alt=""
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="96px"
                  fallbackEmoji="🍽️"
                />
             ) : (
               <div
                 className="w-full h-full flex items-center justify-center text-2xl"
                 style={{ background: '#e8e8e8' }}
               >
                 🍽️
               </div>
             )}
           </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p
              className="text-base font-bold leading-snug line-clamp-1 group-hover:text-black transition-colors"
              style={{ color: '#111' }}
            >
              {recipe.title}
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {recipe.created_by && (
                <span className="flex items-center gap-1 text-sm" style={{ color: '#888' }}>
                  {recipe.created_by.display_name}
                  <TierStar tier={recipe.created_by.tier} size={11} />
                </span>
              )}
              {recipe.dietTags.slice(0, 2).map(tag => (
                <span
                  key={tag}
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: `${DIET_COLORS[tag] ?? '#888'}18`,
                    color: DIET_COLORS[tag] ?? '#888',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-1">
               {recipe.is_tested && (
                 <span className="text-xs font-semibold" style={{ color: '#4ade80' }}>
                   ✓ Testat
                 </span>
               )}
               <span className="text-xs" style={{ color: '#999' }}>
                 {recipe.comments} comentarii
               </span>
            </div>
          </div>

          {/* Score */}
          <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
            <span
              className="text-2xl font-extrabold tabular-nums"
              style={{ color: '#ff4d6d' }}
            >
              {recipe.votes.toLocaleString()}
            </span>
               <span className="text-xs" style={{ color: '#999' }}>voturi</span>
          </div>
        </Link>
      ))}
    </div>
  )
}

function TopChefsTab() {
  const [following, setFollowing] = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setFollowing(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  return (
    <div>
      {TOP_CHEFS.map((chef, i) => {
        const isFollowing = following.has(chef.id)
        return (
          <div
            key={chef.id}
            className="flex items-center gap-5 px-5 py-5"
            style={{
              borderBottom: i < TOP_CHEFS.length - 1
                ? '1px solid rgba(0,0,0,0.07)'
                : 'none',
            }}
          >
            {/* Rank */}
            <div className="flex-shrink-0 w-10 flex items-center justify-center">
              <RankBadge rank={i + 1} />
            </div>

             {/* Avatar */}
             <Link href={`/chefs/${chef.handle}`} className="flex-shrink-0 group">
                <div
                  className="rounded-full overflow-hidden ring-2 ring-transparent group-hover:ring-orange-500 transition-all relative"
                  style={{ width: 72, height: 72 }}
                >
                  <FallbackImage
                    src={chef.avatar_url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="72px"
                    fallbackEmoji="👨‍🍳"
                  />
               </div>
             </Link>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <Link href={`/chefs/${chef.handle}`} className="group/name">
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-base font-bold group-hover/name:text-black transition-colors truncate"
                    style={{ color: '#ff9500' }}
                  >
                    {chef.display_name}
                  </span>
                  <TierStar tier={chef.tier} size={13} />
                </div>
              </Link>
              <p className="text-sm mt-1 line-clamp-2" style={{ color: '#555' }}>
                {chef.bio}
              </p>
              <div className="flex items-center gap-3 mt-1">
               <span className="text-xs font-semibold" style={{ color: '#ff9500' }}>
                   {formatFollowers(chef.follower_count)} urmăritori
                 </span>
                 <span className="text-xs" style={{ color: '#aaa' }}>
                   {chef.post_count} postări
                 </span>
              </div>
            </div>

            {/* Follow button */}
            <button
              onClick={() => toggle(chef.id)}
              className="flex-shrink-0 text-sm font-semibold px-4 py-2 rounded-full transition-all"
              style={
                isFollowing
                  ? {
                      background: 'rgba(0,0,0,0.07)',
                      color: '#888',
                      border: '1px solid rgba(0,0,0,0.12)',
                    }
                  : {
                      background: 'linear-gradient(135deg,#ff4d6d,#ff9500)',
                      color: '#fff',
                    }
              }
            >
               {isFollowing ? 'Urmăresc' : 'Urmărește'}
            </button>
          </div>
        )
      })}
    </div>
  )
}

function RisingTab() {
  return (
    <div>
       <div className="px-4 py-2.5" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
         <p className="text-[11px]" style={{ color: '#999' }}>
           Clasificate după scor de calitate — rețete cu evaluări înalte care pot avea mai puține voturi deocamdată.
         </p>
       </div>
      {RISING_RECIPES.map((recipe, i) => {
        const stars = Math.round(recipe.quality_score)
        return (
          <Link
            key={recipe.id}
            href={`/recipes/${recipe.slug}`}
            className="group flex items-center gap-5 px-5 py-5 transition-colors hover:bg-black/[0.02]"
            style={{
              borderBottom: i < RISING_RECIPES.length - 1 ? '1px solid rgba(0,0,0,0.07)' : 'none',
            }}
          >
            {/* Rank */}
            <div className="flex-shrink-0 w-10 flex items-center justify-center">
              <RankBadge rank={i + 1} />
            </div>

              {/* Thumbnail */}
              <div
                className="flex-shrink-0 rounded-2xl overflow-hidden relative"
                style={{ width: 96, height: 96 }}
              >
                {recipe.hero_image_url ? (
                  <FallbackImage
                    src={recipe.hero_image_url}
                    alt=""
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="96px"
                    fallbackEmoji="🍽️"
                  />
               ) : (
                 <div
                   className="w-full h-full flex items-center justify-center text-2xl"
                 style={{ background: '#e8e8e8' }}
                 >
                   🍽️
                 </div>
               )}
             </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p
                className="text-base font-bold leading-snug line-clamp-1 group-hover:text-black transition-colors"
                style={{ color: '#111' }}
              >
                {recipe.title}
              </p>
              {/* Star rating */}
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-sm" style={{ letterSpacing: '-1px' }}>
                  {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
                </span>
                <span className="text-sm font-bold" style={{ color: '#ff9500' }}>
                  {recipe.quality_score.toFixed(1)}
                </span>
              </div>
              {recipe.created_by && (
                <span className="flex items-center gap-1 text-sm mt-0.5" style={{ color: '#888' }}>
                  {recipe.created_by.display_name}
                  <TierStar tier={recipe.created_by.tier} size={11} />
                </span>
              )}
            </div>

            {/* Votes (secondary) */}
            <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
              <span
                className="text-xl font-bold tabular-nums"
                style={{ color: '#888' }}
              >
                {recipe.votes}
              </span>
              <span className="text-xs" style={{ color: '#999' }}>voturi</span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function ByCuisineTab() {
  return (
    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {CUISINE_LEADERS.map(({ approach, top, total }) => (
        <Link
          key={approach.id}
          href={`/cookbooks/region/${approach.id}`}
          className="group relative rounded-2xl overflow-hidden"
          style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)' }}
        >
            {/* Hero image */}
            <div className="relative h-44 overflow-hidden">
              {top.hero_image_url ? (
                <FallbackImage
                  src={top.hero_image_url}
                  alt=""
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  fallbackEmoji="🍽️"
                />
             ) : (
               <div
                 className="w-full h-full flex items-center justify-center text-3xl"
                 style={{ background: '#222' }}
               >
                 🌍
               </div>
             )}
            {/* Dark overlay */}
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.1) 60%)' }}
            />
            {/* Region label */}
            <div className="absolute bottom-2 left-3 right-3">
              <p
                className="text-sm font-extrabold tracking-wide uppercase truncate"
                style={{ color: '#ff9500', fontFamily: "'Syne', sans-serif" }}
              >
                {approach.name}
              </p>
            </div>
            {/* Count badge */}
            <div
              className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(0,0,0,0.6)', color: '#888' }}
            >
              {total} recipe{total !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Card body */}
          <div className="px-4 py-3">
            <p
              className="text-sm font-semibold leading-snug line-clamp-1 group-hover:text-white transition-colors"
              style={{ color: '#111' }}
            >
              🥇 {top.title}
            </p>
            <div className="flex items-center justify-between mt-1">
              {top.created_by && (
                <span className="text-xs flex items-center gap-1 truncate" style={{ color: '#888' }}>
                  {top.created_by.display_name}
                  <TierStar tier={top.created_by.tier} size={10} />
                </span>
              )}
              <span
                className="text-xs font-semibold flex-shrink-0"
                style={{ color: '#ff4d6d' }}
              >
                ♥ {top.votes}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════════════════════════ */

const TABS: { id: Tab; label: string; icon: string; description: string }[] = [
  { id: 'recipes', label: 'Rețete de top',  icon: '🏆', description: 'Cele mai votate' },
  { id: 'chefs',   label: 'Chefii de top',    icon: '👨‍🍳', description: 'Cei mai urmăriți' },
  { id: 'rising',  label: 'În creștere',       icon: '⭐', description: 'Cel mai bine evaluate' },
  { id: 'cuisine',   label: 'După bucătărie', icon: '🌍', description: 'Pe regiune' },
  { id: 'community', label: 'Comunitate',  icon: '💬', description: 'Discuții recente' },
]

export default function RankingsPage() {
  const [tab, setTab] = useState<Tab>('recipes')

  const current = TABS.find(t => t.id === tab)!

  return (
    <main
      className="min-h-screen"
      style={{ background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}
    >
      {/* ── Hero header ── */}
      <div
        className="px-4 py-8 text-center"
        style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}
      >
         <h1
           className="text-3xl font-extrabold tracking-tight mb-1"
           style={{
             fontFamily: "'Syne', sans-serif",
             background: 'linear-gradient(90deg,#ff4d6d,#ff9500)',
             WebkitBackgroundClip: 'text',
             WebkitTextFillColor: 'transparent',
           }}
         >
           🏆 Clasament
         </h1>
         <p className="text-sm" style={{ color: '#888' }}>
           Rețetele cu cele mai multe voturi ale comunității, chefii de top și gemele ascunse
         </p>
      </div>

      {/* ── Tab bar ── */}
      <div
        className="sticky top-[105px] z-30 px-4 py-3 flex items-center justify-center gap-2 flex-wrap"
        style={{ background: 'hsl(var(--background))', borderBottom: '1px solid hsl(var(--border))' }}
      >
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all"
            style={
              tab === t.id
                ? {
                    background: 'linear-gradient(135deg,#ff4d6d,#ff9500)',
                    color: '#fff',
                  }
                : {
                    background: 'rgba(0,0,0,0.06)',
                    color: '#555',
                    border: '1px solid rgba(0,0,0,0.1)',
                  }
            }
          >
            <span>{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.label.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {/* ── Panel ── */}
      <div className="max-w-6xl mx-auto py-6 px-6">
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)' }}
        >
          {/* Panel header */}
          <div
            className="relative flex items-center justify-between px-6 py-5 overflow-hidden"
            style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}
          >
            {/* giant ghost watermark */}
            <span
              className="absolute right-4 top-1/2 -translate-y-1/2 select-none pointer-events-none"
              style={{ fontSize: 96, lineHeight: 1, opacity: 0.07 }}
            >
              {current.icon}
            </span>

            <div className="flex items-center gap-3">
              <span
                className="text-3xl"
                style={{ filter: 'drop-shadow(0 0 12px rgba(255,149,0,0.4))' }}
              >
                {current.icon}
              </span>
              <div>
                <p
                  className="font-extrabold text-xl leading-tight"
                  style={{ fontFamily: "'Syne', sans-serif", color: '#111' }}
                >
                  {current.label}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#888' }}>
                  {current.description}
                </p>
              </div>
            </div>
          </div>

          {/* Tab content */}
          {tab === 'recipes' && <TopRecipesTab />}
          {tab === 'chefs'   && <TopChefsTab />}
          {tab === 'rising'  && <RisingTab />}
          {tab === 'cuisine'    && <ByCuisineTab />}
          {tab === 'community' && <div className="p-5"><CommunitySection /></div>}
        </div>

        {/* Footer note */}
         <p className="text-center text-[11px] mt-4" style={{ color: '#bbb' }}>
           Clasamentele se actualizează în timp real pe măsură ce comunitatea votează · Datele afișate sunt în direct
         </p>
      </div>
    </main>
  )
}
