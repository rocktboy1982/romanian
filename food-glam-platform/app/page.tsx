'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import FallbackImage from '@/components/FallbackImage'
import { useRouter } from 'next/navigation'
import LatestChefVlogs from '@/components/LatestChefVlogs'
import TrendingSection from '@/components/TrendingSection'
import { AdBanner, AdInFeed } from '@/components/ads/ad-placements'
import { REGION_META } from '@/lib/recipe-taxonomy'
import { MOCK_RECIPES } from '@/lib/mock-data'
import { MOCK_CHEF_POSTS, MOCK_CHEF_PROFILES } from '@/lib/mock-chef-data'
import { usePreferredRecipes } from '@/lib/preferred-recipes'

/* ─── types ────────────────────────────────────────────────────────────── */

interface Recipe {
  id: string
  slug: string
  title: string
  summary: string | null
  hero_image_url: string
  region: string
  votes: number
  comments: number
  tag: string
  badges: string[] | undefined
  dietTags: string[]
  foodTags: string[]
  is_tested: boolean
  quality_score: number | null
  created_by: {
    id: string
    display_name: string
    handle: string
    avatar_url: string | null
  }
  is_saved: boolean
}

/* ─── static chef data derived from mock ────────────────────────────────── */

const CHEFS = MOCK_RECIPES.slice(0, 8).map((r, i) => ({
  id: r.created_by.id,
  name: r.created_by.display_name,
  handle: r.created_by.handle,
  avatar: r.created_by.avatar_url ?? `https://i.pravatar.cc/150?img=${i + 10}`,
  cuisine: r.foodTags[0] ?? 'Global',
  followers: [12400, 38700, 9100, 54200, 21300, 67800, 4500, 31900][i] ?? 10000,
  recipeImg: r.hero_image_url,
  hasStory: i < 5,
}))

/* ─── tab config ─────────────────────────────────────────────────────────── */
const FEED_TABS = ['Pentru tine', 'În tendințe', 'Urmărite', 'Noi'] as const
type FeedTab = typeof FEED_TABS[number]

/* ─── region pills (flat, curated) ──────────────────────────────────────── */
const REGION_PILLS = [
  'east-asia', 'southeast-asia', 'south-asia', 'middle-east',
  'north-africa', 'western-europe', 'eastern-europe', 'north-america', 'south-america',
]



/* ══════════════════════════════════════════════════════════════════════════
   HOME PAGE
═══════════════════════════════════════════════════════════════════════════ */

export default function Home() {
  const router = useRouter()
  const { addRecipe, removeRecipe, preferredIds } = usePreferredRecipes()

  /* fetch */
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/homepage')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setRecipes(d.recipes || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const feed: Recipe[] = recipes.length > 0 ? recipes : (!loading ? MOCK_RECIPES : [])

  /* interactive state */
  const [activeTab, setActiveTab] = useState<FeedTab>('Pentru tine')
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [followedChefs, setFollowedChefs] = useState<Set<string>>(new Set())
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({})
  const [burstId, setBurstId] = useState<string | null>(null)
  const [activeStory, setActiveStory] = useState<number | null>(null)
  const [toastId, setToastId] = useState<string | null>(null)

  /* initialise like counts from data */
  useEffect(() => {
    if (feed.length === 0) return
    setLikeCounts(prev => {
      const next = { ...prev }
      feed.forEach(r => { if (!(r.id in next)) next[r.id] = r.votes })
      return next
    })
  }, [feed])

  const toggleLike = useCallback((id: string) => {
    setLikedIds(prev => {
      const next = new Set(prev)
      const liked = next.has(id)
      liked ? next.delete(id) : next.add(id)
      setLikeCounts(c => ({ ...c, [id]: (c[id] ?? 0) + (liked ? -1 : 1) }))
      if (!liked) { setBurstId(id); setTimeout(() => setBurstId(null), 700) }
      return next
    })
  }, [])

  const toggleSave = useCallback((recipe: Recipe) => {
    const id = recipe.id
    const isSaved = savedIds.has(id) || preferredIds.has(id)
    
    setSavedIds(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
    
    // Add/remove from preferred recipes
    if (isSaved) {
      removeRecipe(id)
    } else {
      addRecipe({
        id: recipe.id,
        slug: recipe.slug,
        title: recipe.title,
        hero_image_url: recipe.hero_image_url,
        region: recipe.region,
        dietTags: recipe.dietTags,
        foodTags: recipe.foodTags,
      }, 'manual')
      
      // Show toast
      setToastId(id)
      setTimeout(() => setToastId(null), 1500)
    }
  }, [savedIds, preferredIds, addRecipe, removeRecipe])

  const toggleFollow = useCallback((id: string) => {
    setFollowedChefs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }, [])

  /* tab filter — simple demo logic */
  const tabFeed = (() => {
    if (activeTab === 'În tendințe') return [...feed].sort((a, b) => b.votes - a.votes)
    if (activeTab === 'Noi') return [...feed].reverse()
    if (activeTab === 'Urmărite') return feed.filter((_, i) => i % 2 === 0)
    return feed
  })()

  return (
    <>
      {/* ── Google Fonts ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@400;500;600&display=swap');
        .ff-display { font-family: 'Syne', sans-serif; }
        .ff-body    { font-family: 'Inter', sans-serif; }

        /* heart burst keyframes */
        @keyframes heartBurst {
          0%   { transform: scale(0.5); opacity: 1; }
          60%  { transform: scale(1.6); opacity: 1; }
          100% { transform: scale(1.1); opacity: 0; }
        }
        .heart-burst { animation: heartBurst 0.7s ease forwards; }

        /* story ring pulse */
        @keyframes storyPulse {
          0%, 100% { box-shadow: 0 0 0 3px #ff4d6d, 0 0 0 5px #ff9500; }
          50%       { box-shadow: 0 0 0 3px #c0392b, 0 0 0 6px #e67e22; }
        }
        .story-ring { animation: storyPulse 2.5s ease-in-out infinite; }

        /* slide in */
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .slide-up { animation: slideUp 0.4s ease forwards; }

        /* tab underline slide */
        @keyframes tabIn {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }

        /* feed card hover lift */
        .feed-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .feed-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,0.5); }

        /* double tap overlay */
        .dtap-overlay { pointer-events: none; }

        /* custom scrollbar */
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        /* toast animation */
        @keyframes toastSlideIn {
          from { transform: translateY(20px) scale(0.9); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes toastSlideOut {
          from { transform: translateY(0) scale(1); opacity: 1; }
          to { transform: translateY(20px) scale(0.9); opacity: 0; }
        }
        .toast-enter { animation: toastSlideIn 0.3s ease; }
        .toast-exit { animation: toastSlideOut 0.3s ease; }
      `}</style>

      <main className="ff-body min-h-screen bg-[#f8f8f8] text-[#1a1a1a] dark:bg-[#0d0d0d] dark:text-[#f0f0f0]">



        {/* ════════════════════════════════════════════════════════
            STORIES STRIP  (Instagram-style)
        ════════════════════════════════════════════════════════ */}
        <section className="px-4 pt-10 pb-4 relative">
          {/* Quick actions — top right, same level as story avatars */}
          <div className="absolute top-10 right-4 flex items-center gap-2 z-10 pt-2">
            <Link
              href="/me/scan"
              className="flex flex-col items-center gap-1"
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 dark:bg-white/[0.07] border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/[0.12] transition-colors">
                <span className="text-base">📷</span>
              </div>
              <span className="text-[9px] text-gray-500">Scanează</span>
            </Link>
            <Link
              href="/me/grocery"
              className="flex flex-col items-center gap-1"
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 dark:bg-white/[0.07] border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/[0.12] transition-colors">
                <span className="text-base">🛒</span>
              </div>
              <span className="text-[9px] text-gray-500">Magazin</span>
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto hide-scrollbar pt-2 pb-2 pr-24" style={{ scrollSnapType: 'x mandatory' }}>

            {/* "Add story" button */}
            <div className="flex-shrink-0 flex flex-col items-center gap-1.5" style={{ scrollSnapAlign: 'start' }}>
              <Link href="/chefs/me/new-post">
                <div className="w-[68px] h-[68px] rounded-full flex items-center justify-center relative bg-gray-100 border-2 border-dashed border-gray-300 dark:bg-white/5 dark:border-white/20">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-500 dark:text-gray-500"><path d="M12 5v14M5 12h14"/></svg>
                </div>
              </Link>
              <span className="text-[10px] text-gray-500">Povestea ta</span>
            </div>

            {CHEFS.map((chef, i) => (
              <button
                key={chef.id}
                className="flex-shrink-0 flex flex-col items-center gap-1.5"
                style={{ scrollSnapAlign: 'start' }}
                onClick={() => setActiveStory(activeStory === i ? null : i)}
              >
                <div className="relative">
                   <FallbackImage
                      src={chef.avatar}
                      alt={chef.name}
                      width={68}
                      height={68}
                      fallbackEmoji="👨‍🍳"
                      className={`w-[68px] h-[68px] rounded-full object-cover ${
                        chef.hasStory && activeStory !== i
                          ? 'p-0.5'
                          : 'border-2 border-gray-300 dark:border-white/12'
                      }`}
                      style={chef.hasStory && activeStory !== i
                        ? { background: 'linear-gradient(135deg,#ff4d6d,#ff9500)', borderRadius: '50%' }
                        : {}}
                    />
                  {chef.hasStory && activeStory !== i && (
                    <div className="absolute inset-0 rounded-full story-ring" style={{ border: '2px solid transparent' }} />
                  )}
                   {activeStory === i && (
                     <div className="absolute inset-0 rounded-full border-2 border-gray-500 dark:border-gray-500" />
                   )}
                </div>
                <span className={`text-[10px] max-w-[68px] truncate ${activeStory === i ? 'text-gray-500 dark:text-gray-500' : 'text-gray-400 dark:text-gray-400'}`}>
                  {chef.name.split(' ')[0]}
                </span>
              </button>
            ))}
          </div>

          {/* story viewer */}
          {activeStory !== null && (() => {
            const chef = CHEFS[activeStory]
            const handleKey = chef.handle.replace(/^@/, '')
            // Latest post for this chef, or fall back to the recipe image
            const latestPost = MOCK_CHEF_POSTS
              .filter(p => p.chef_handle === handleKey)
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null
            const profile = MOCK_CHEF_PROFILES.find(p => p.handle === handleKey) ?? null
            const img = latestPost?.hero_image_url ?? chef.recipeImg
            const postTitle = latestPost?.title ?? chef.cuisine
            const postDesc = latestPost?.description ?? null
            const postSlug = latestPost?.slug ?? null
            return (
              <div className="slide-up mt-4 rounded-2xl overflow-hidden bg-white border border-gray-200 dark:bg-[#1a1a1a] dark:border-white/10">
                {/* Hero image */}
                 <div className="relative" style={{ height: 200 }}>
                   <FallbackImage src={img} alt={postTitle} fill className="object-cover" fallbackEmoji="🍽️" sizes="(max-width: 768px) 100vw, (max-width: 1024px) 90vw, 80vw" />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 55%)' }} />
                  {/* Close */}
                  <button
                    onClick={() => setActiveStory(null)}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: 'rgba(0,0,0,0.55)' }}
                  >✕</button>
                  {/* Post type label */}
                  <span className="absolute top-3 left-3 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,149,0,0.85)', color: '#fff' }}>
                    {latestPost ? 'Ultima postare' : 'Ultima rețetă'}
                  </span>
                  {/* Title overlay */}
                  <div className="absolute bottom-3 left-4 right-4">
                    <p className="font-semibold text-base leading-snug text-white line-clamp-2">{postTitle}</p>
                  </div>
                </div>

                {/* Body */}
                <div className="p-4">
                    {/* Chef info row */}
                     <div className="flex items-center gap-2.5 mb-3">
                       <FallbackImage src={chef.avatar} alt={chef.name} width={36} height={36} fallbackEmoji="👨‍🍳" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                     <div className="flex-1 min-w-0">
                       <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight truncate">{chef.name}</p>
                       <p className="text-[11px] text-gray-600 dark:text-gray-400 truncate">{chef.handle} · {(chef.followers / 1000).toFixed(1)}k urmăritori</p>
                     </div>
                    <Link
                      href={`/chefs/${handleKey}`}
                      onClick={() => setActiveStory(null)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0 bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-400"
                    >
                      Vezi profilul
                    </Link>
                  </div>

                   {/* Bio snippet (only if no post desc) */}
                   {!postDesc && profile?.bio && (
                     <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">{profile.bio}</p>
                   )}

                   {/* Post description */}
                   {postDesc && (
                     <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed mb-3 line-clamp-3">{postDesc}</p>
                   )}

                  {/* CTA */}
                  {postSlug && (
                    <Link
                      href={`/recipes/${postSlug}`}
                      onClick={() => setActiveStory(null)}
                      className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
                      style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff' }}
                    >
                      Vezi rețeta
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"/></svg>
                    </Link>
                  )}
                </div>
              </div>
            )
          })()}
        </section>


        {/* ════════════════════════════════════════════════════════
            FEED TABS
        ════════════════════════════════════════════════════════ */}
        <div
          className="sticky z-40 flex gap-1 px-4 pb-3 bg-[#f8f8f8]/90 dark:bg-[#0d0d0d]/90 backdrop-blur-md"
          style={{ top: 57 }}
        >
          {FEED_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-[#ff4d6d] to-[#ff9500] text-white'
                  : 'bg-gray-100 text-gray-500 dark:bg-white/[0.07] dark:text-gray-500'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════
            REGION CHIPS  (horizontal scroll)
        ════════════════════════════════════════════════════════ */}
        <section className="px-4 pb-8">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3 text-center text-gray-500">Descoperă bucătării</p>
          <div className="flex gap-2 flex-wrap justify-center pb-1">
            {REGION_PILLS.map(id => {
              const r = REGION_META[id]
              if (!r) return null
              return (
                <Link key={id} href={`/cookbooks/region/${id}`}
                  className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all bg-gray-100 border border-gray-200 text-gray-700 dark:bg-white/[0.07] dark:border-white/10 dark:text-gray-400">
                  <span>{r.emoji}</span>
                  <span>{r.label}</span>
                </Link>
              )
            })}
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            AD PLACEMENT
        ════════════════════════════════════════════════════════ */}
        <div className="px-4 pb-8">
          <AdBanner placement="homepage-banner" />
        </div>

        {/* ════════════════════════════════════════════════════════
            4-COLUMN GRID LAYOUT  (desktop responsive)
        ════════════════════════════════════════════════════════ */}
        <div className="px-4 pb-8 grid grid-cols-1 lg:grid-cols-4 gap-6 lg:items-stretch">
          {/* COL 1: Latest Chef Vlogs */}
          <div className="lg:col-span-1 flex flex-col">
            <LatestChefVlogs />
          </div>

          {/* COL 2–3: Feed — strict 2-col grid, equal-height tiles */}
          <div className="lg:col-span-2 flex flex-col">
            {loading && (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="rounded-2xl overflow-hidden animate-pulse bg-gray-200 dark:bg-[#1a1a1a]" style={{ height: 360 }} />
                ))}
              </div>
            )}
            {!loading && (
              <div className="grid grid-cols-2 gap-3">
                {tabFeed.slice(0, 8).map((recipe, i) => {
                  const liked = likedIds.has(recipe.id)
                  const saved = savedIds.has(recipe.id) || preferredIds.has(recipe.id)
                  const count = likeCounts[recipe.id] ?? recipe.votes
                  const isBursting = burstId === recipe.id
                  return (
                    <div
                      key={recipe.id}
                      className="feed-card rounded-2xl overflow-hidden slide-up flex flex-col bg-white dark:bg-[#1a1a1a]"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      {/* image — fixed 280px, always equal */}
                     <div
                        className="relative cursor-pointer flex-shrink-0"
                        style={{ height: 280 }}
                        onDoubleClick={() => toggleLike(recipe.id)}
                        onClick={() => router.push(`/recipes/${recipe.slug}`)}
                      >
                          <FallbackImage src={recipe.hero_image_url} alt={recipe.title} fill className="object-cover" fallbackEmoji="🍽️" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
                        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.1) 55%, transparent 100%)' }} />
                        {/* tag badge */}
                        <div className="absolute top-2 left-2">
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold"
                            style={{ background: recipe.tag === 'Trending' ? 'rgba(255,77,109,0.9)' : recipe.tag === 'New' ? 'rgba(0,200,150,0.9)' : 'rgba(255,149,0,0.9)', backdropFilter: 'blur(4px)' }}>
                            {recipe.tag === 'Trending' ? '🔥' : recipe.tag === 'New' ? '✨' : '⭐'} {recipe.tag}
                          </span>
                        </div>
                        {isBursting && (
                          <div className="absolute inset-0 flex items-center justify-center dtap-overlay">
                            <span className="heart-burst text-5xl">❤️</span>
                          </div>
                        )}
                        {toastId === recipe.id && (
                          <div className="absolute inset-0 flex items-center justify-center dtap-overlay">
                           <div className="toast-enter bg-black bg-opacity-80 px-3 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5">
                               <span>⭐</span><span>Salvat</span>
                             </div>
                          </div>
                        )}
                        {/* title + chef overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-3.5">
                          <h3 className="ff-display font-bold text-sm leading-snug mb-1.5 line-clamp-2 text-white">{recipe.title}</h3>
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-1.5">
                                {recipe.created_by.avatar_url && (
                                  <FallbackImage src={recipe.created_by.avatar_url} alt="" width={24} height={24} fallbackEmoji="👨‍🍳" className="w-6 h-6 rounded-full object-cover border border-white/30" />
                                )}
                              <span className="text-xs text-gray-300 truncate max-w-[72px]">{recipe.created_by.display_name}</span>
                            </div>
                            <button
                              onClick={e => { e.stopPropagation(); toggleFollow(recipe.created_by.id) }}
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all flex-shrink-0 text-white ${
                                followedChefs.has(recipe.created_by.id)
                                  ? 'bg-gray-300 dark:bg-white/15'
                                  : 'bg-gradient-to-r from-[#ff4d6d] to-[#ff9500]'
                              }`}
                              >
                                {followedChefs.has(recipe.created_by.id) ? '✓' : '+ Urmărește'}
                             </button>
                          </div>
                        </div>
                      </div>
                      {/* action row */}
                      <div className="flex items-center justify-between px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <button onClick={() => toggleLike(recipe.id)} className={`flex items-center gap-1.5 transition-transform active:scale-110 ${liked ? 'text-[#ff4d6d]' : 'text-gray-500 dark:text-gray-500'}`}>
                            <svg width="17" height="17" viewBox="0 0 24 24" fill={liked ? '#ff4d6d' : 'none'} stroke={liked ? '#ff4d6d' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                            <span className={`text-xs font-semibold ${liked ? 'text-[#ff4d6d]' : 'text-gray-500 dark:text-gray-500'}`}>{count}</span>
                          </button>
                          <button onClick={() => router.push(`/recipes/${recipe.slug}#comments`)} className="flex items-center gap-1.5 text-gray-500 dark:text-gray-500">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                            <span className="text-xs font-semibold">{recipe.comments}</span>
                          </button>
                          <button onClick={async () => { const url = `${window.location.origin}/recipes/${recipe.slug}`; if (navigator.share) await navigator.share({ title: recipe.title, url }); else await navigator.clipboard.writeText(url) }} className="text-gray-500 dark:text-gray-500">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                          </button>
                          <button onClick={e => { e.stopPropagation(); router.push(`/recipes/${recipe.slug}/print`) }} className="text-gray-500 dark:text-gray-500" title="Print recipe">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                          </button>
                        </div>
                        <button onClick={() => toggleSave(recipe)} className={`transition-transform active:scale-110 ${saved ? 'text-[#ff9500]' : 'text-gray-500 dark:text-gray-500'}`}>
                          <svg width="17" height="17" viewBox="0 0 24 24" fill={saved ? '#ff9500' : 'none'} stroke={saved ? '#ff9500' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                        </button>
                      </div>
                      {recipe.dietTags.length > 0 && (
                        <div className="flex gap-1.5 px-3 pb-3 flex-wrap">
                          {recipe.dietTags.map(t => (
                            <Link key={t} href={`/search?diet_tags=${encodeURIComponent(t)}`}
                              onClick={e => e.stopPropagation()}
                              className="text-[10px] px-2 py-0.5 rounded-full hover:opacity-80 transition-opacity bg-gray-100 text-gray-600 dark:bg-white/8 dark:text-gray-400">{t}</Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Ad boxes — styled like recipe cards */}
                <AdInFeed placement="homepage-bottom-banner" className="rounded-2xl overflow-hidden" />
                <AdInFeed placement="homepage-bottom-infeed" className="rounded-2xl overflow-hidden" />
              </div>
            )}
          </div>

          {/* COL 4: Trending */}
          <div className="lg:col-span-1 flex flex-col">
            <TrendingSection />
          </div>
        </div>
        {/* bottom padding for mobile nav */}
        <div className="h-20 md:h-4" />
      </main>
    </>
  )
}
