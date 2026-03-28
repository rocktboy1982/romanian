'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import FallbackImage from '@/components/FallbackImage'
import Link from 'next/link'
import TierStar from '@/components/TierStar'
import CommunitySection from '@/components/CommunitySection'

/* ─── types ──────────────────────────────────────────────────────────────── */

type Tab = 'recipes' | 'chefs' | 'cocktails' | 'community'

interface TrendingRecipe {
  id: string
  title: string
  slug: string
  hero_image_url: string | null
  votes: number
  tag?: string
  created_by?: {
    id: string
    display_name: string
    handle: string
    avatar_url: string | null
  } | null
}

interface TopChef {
  id: string
  display_name: string
  handle: string
  avatar_url: string | null
  bio: string | null
  recipe_count: number
}

interface TrendingCocktail {
  id: string
  title: string
  slug: string
  hero_image_url: string | null
  votes: number
}

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

function LoadingSkeleton() {
  return (
    <div className="divide-y divide-black/[0.07]">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-5 px-5 py-5">
          <div className="flex-shrink-0 w-10 h-8 rounded animate-pulse" style={{ background: '#e8e8e8' }} />
          <div className="flex-shrink-0 rounded-2xl animate-pulse" style={{ width: 96, height: 96, background: '#e8e8e8' }} />
          <div className="flex-1 space-y-2">
            <div className="h-4 rounded animate-pulse" style={{ background: '#e8e8e8', width: '70%' }} />
            <div className="h-3 rounded animate-pulse" style={{ background: '#e8e8e8', width: '40%' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   TAB PANELS
═══════════════════════════════════════════════════════════════════════════ */

function TopRecipesTab() {
  const [recipes, setRecipes] = useState<TrendingRecipe[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/trending')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setRecipes(d.recipes || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSkeleton />

  if (recipes.length === 0) {
    return (
      <div className="py-16 text-center text-sm" style={{ color: '#999' }}>
        Nu există rețete de afișat momentan.
      </div>
    )
  }

  return (
    <div>
      {recipes.map((recipe, i) => (
        <Link
          key={recipe.id}
          href={`/recipes/${recipe.slug}`}
          className="group flex items-center gap-5 px-5 py-5 transition-colors hover:bg-black/[0.02]"
          style={{
            borderBottom: i < recipes.length - 1
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
            {recipe.created_by && (
              <div className="flex items-center gap-1 mt-0.5 text-sm" style={{ color: '#888' }}>
                <span>{recipe.created_by.display_name}</span>
                <TierStar tier="user" size={11} />
              </div>
            )}
            {recipe.tag && (
              <span
                className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-1"
                style={{ background: 'rgba(255,77,109,0.1)', color: '#ff4d6d' }}
              >
                {recipe.tag}
              </span>
            )}
          </div>

          {/* Score */}
          <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
            <span
              className="text-2xl font-extrabold tabular-nums"
              style={{ color: '#ff4d6d' }}
            >
              {recipe.votes.toLocaleString('ro-RO')}
            </span>
            <span className="text-xs" style={{ color: '#999' }}>voturi</span>
          </div>
        </Link>
      ))}
    </div>
  )
}

function TopChefsTab() {
  const [chefs, setChefs] = useState<TopChef[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/chefs?limit=20&sort=recipes')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        const list = (d.chefs || d || []) as TopChef[]
        const sorted = [...list].sort((a, b) => (b.recipe_count || 0) - (a.recipe_count || 0)).slice(0, 15)
        setChefs(sorted)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSkeleton />

  if (chefs.length === 0) {
    return (
      <div className="py-16 text-center text-sm" style={{ color: '#999' }}>
        Nu există bucătari de afișat momentan.
      </div>
    )
  }

  return (
    <div>
      {chefs.map((chef, i) => (
        <div
          key={chef.id}
          className="flex items-center gap-5 px-5 py-5"
          style={{
            borderBottom: i < chefs.length - 1
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
                src={chef.avatar_url || ''}
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
                <TierStar tier="user" size={13} />
              </div>
            </Link>
            {chef.bio && (
              <p className="text-sm mt-1 line-clamp-2" style={{ color: '#555' }}>
                {chef.bio}
              </p>
            )}
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs font-semibold" style={{ color: '#ff9500' }}>
                {chef.recipe_count} rețete
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function TopCocktailsTab() {
  const [cocktails, setCocktails] = useState<TrendingCocktail[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/search/cocktails?per_page=10')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        const list = (d.cocktails || d.results || d || []) as TrendingCocktail[]
        setCocktails(list.slice(0, 10))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSkeleton />

  if (cocktails.length === 0) {
    return (
      <div className="py-16 text-center text-sm" style={{ color: '#999' }}>
        Nu există cocktailuri de afișat momentan.
      </div>
    )
  }

  return (
    <div>
      {cocktails.map((cocktail, i) => (
        <Link
          key={cocktail.id}
          href={`/cocktails/${cocktail.slug}`}
          className="group flex items-center gap-5 px-5 py-5 transition-colors hover:bg-black/[0.02]"
          style={{
            borderBottom: i < cocktails.length - 1
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
            {cocktail.hero_image_url ? (
              <FallbackImage
                src={cocktail.hero_image_url}
                alt=""
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                sizes="96px"
                fallbackEmoji="🍹"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-2xl"
                style={{ background: '#e8e8e8' }}
              >
                🍹
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p
              className="text-base font-bold leading-snug line-clamp-1 group-hover:text-black transition-colors"
              style={{ color: '#111' }}
            >
              {cocktail.title}
            </p>
            <span
              className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-1"
              style={{ background: 'rgba(96,165,250,0.1)', color: '#3b82f6' }}
            >
              Cocktail
            </span>
          </div>

          {/* Score */}
          <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
            <span
              className="text-2xl font-extrabold tabular-nums"
              style={{ color: '#60a5fa' }}
            >
              {(cocktail.votes || 0).toLocaleString('ro-RO')}
            </span>
            <span className="text-xs" style={{ color: '#999' }}>voturi</span>
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
  { id: 'recipes',   label: 'Rețete de top',  icon: '🏆', description: 'Cele mai populare' },
  { id: 'chefs',     label: 'Bucătari de top', icon: '👨‍🍳', description: 'Cei mai activi' },
  { id: 'cocktails', label: 'Cocktailuri',     icon: '🍹', description: 'Cele mai populare' },
  { id: 'community', label: 'Comunitate',      icon: '💬', description: 'Discuții recente' },
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
          Rețetele cu cele mai multe voturi ale comunității, bucătarii de top și cocktailurile preferate
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
          {tab === 'recipes'   && <TopRecipesTab />}
          {tab === 'chefs'     && <TopChefsTab />}
          {tab === 'cocktails' && <TopCocktailsTab />}
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
