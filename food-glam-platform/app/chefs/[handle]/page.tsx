'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import FallbackImage from '@/components/FallbackImage'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import TierStar from '@/components/TierStar'
import { sanitizeText, sanitizeUrl } from '@/lib/sanitize'
import type { ChefTier } from '@/components/TierStar'

interface ProfileData {
  id: string
  handle: string
  display_name: string
  bio: string
  avatar_url: string | null
  banner_url: string | null
  follower_count: number
  following_count: number
  post_count: number
  is_following: boolean
  is_own_profile: boolean
  tier?: ChefTier
}

interface PostItem {
  id: string
  slug: string
  title: string
  summary: string
  hero_image_url: string
  votes: number
  comments: number
  created_at: string
  type?: string
}

interface MockUser {
  id: string
  display_name: string
  handle: string
  avatar_url: string | null
}

interface VlogEntry {
  id: string
  date: string
  body: string
  attachedRecipe?: {
    id: string
    slug: string
    title: string
    hero_image_url: string
  }
  sponsoredProduct?: {
    name: string
    imageUrl: string
    linkUrl: string
    description: string
    disclosure: 'Ad' | 'Sponsored' | 'Partner' | 'Gifted'
  }
  createdAt: string
  updatedAt: string
}

/* ─── helpers ─────────────────────────────────────────────────────────────── */

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}z`
}

function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

const TIER_LABEL: Record<string, string> = {
  pro: 'Chef Profesionist',
  amateur: 'Amator / Influencer',
  user: 'Bucătar Casnic',
}

/* ─── component ───────────────────────────────────────────────────────────── */

export default function ChefPage() {
  const params = useParams()
  const router = useRouter()
  const handle = typeof params?.handle === 'string' ? params.handle : ''

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [posts, setPosts] = useState<PostItem[]>([])
  const [vlogEntries, setVlogEntries] = useState<VlogEntry[]>([])
  const [mockUser, setMockUser] = useState<MockUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [hydrated, setHydrated] = useState(false)
  const [isOwner, setIsOwner] = useState(false)

  // Load mock user and check real auth
  useEffect(() => {
    const userStr = localStorage.getItem('mock_user')
    if (userStr) {
      try {
        setMockUser(JSON.parse(userStr))
      } catch {}
    }
    setHydrated(true)
  }, [])

  // Load profile: try real API first, fall back to mock
  useEffect(() => {
    if (!handle) return

    const loadProfile = async () => {
      try {
        // Try real API first
        const realRes = await fetch(`/api/profiles/${handle}`)
        if (realRes.ok) {
          const realData = await realRes.json()
          const profileData: ProfileData = {
            ...realData.profile,
            tier: 'user' as ChefTier,
          }
          setProfile(profileData)
          setIsFollowing(realData.profile.is_following)
          setFollowerCount(realData.profile.follower_count)
          setIsOwner(realData.profile.is_own_profile)
          setLoading(false)
          return
        }
      } catch (err) {
        console.error('Real profile fetch error:', err)
      }

      // Fall back to mock API
      try {
        const mockRes = await fetch(`/api/chefs/${handle}/posts`)
        if (!mockRes.ok) {
          setLoading(false)
          return
        }
        const mockData = await mockRes.json()
        if (mockData.error) {
          setLoading(false)
          return
        }

        const mockProfile: ProfileData = {
          id: mockData.profile.id,
          handle: mockData.profile.handle,
          display_name: mockData.profile.display_name,
          bio: mockData.profile.bio,
          avatar_url: mockData.profile.avatar_url,
          banner_url: mockData.profile.banner_url,
          follower_count: mockData.profile.follower_count,
          following_count: mockData.profile.following_count,
          post_count: mockData.profile.post_count,
          is_following: mockData.profile.is_following,
          is_own_profile: mockData.profile.is_own_profile,
          tier: mockData.profile.tier || 'user',
        }

        try {
          const raw = localStorage.getItem(`chef_profile_override_${handle}`)
          if (raw) {
            const ov = JSON.parse(raw)
            if (ov.display_name) mockProfile.display_name = sanitizeText(ov.display_name)
            if (ov.bio) mockProfile.bio = sanitizeText(ov.bio)
            if (ov.avatar_url) mockProfile.avatar_url = sanitizeUrl(ov.avatar_url)
            if (ov.banner_url) mockProfile.banner_url = sanitizeUrl(ov.banner_url)
          }
        } catch {}

        setProfile(mockProfile)
        setIsFollowing(mockData.profile.is_following)
        setFollowerCount(mockData.profile.follower_count)
        setLoading(false)
      } catch (err) {
        console.error('Mock profile fetch error:', err)
        setLoading(false)
      }
    }

    loadProfile()
  }, [handle])

  // Load posts: try real API first, fall back to mock
  useEffect(() => {
    if (!handle) return

    const loadPosts = async () => {
      try {
        // Try real API first
        const realRes = await fetch(`/api/profiles/${handle}/posts`)
        if (realRes.ok) {
          const realData = await realRes.json()
          const formattedPosts: PostItem[] = realData.posts.map((p: Record<string, unknown>) => ({
            id: p.id,
            slug: p.slug,
            title: p.title,
            summary: p.summary || '',
            hero_image_url: p.hero_image_url,
            votes: p.votes || 0,
            comments: p.comments || 0,
            created_at: p.created_at,
            type: p.type,
          }))
          setPosts(formattedPosts)
          return
        }
      } catch (err) {
        console.error('Real posts fetch error:', err)
      }

      // Fall back to mock API
      try {
        const mockRes = await fetch(`/api/chefs/${handle}/posts`)
        if (!mockRes.ok) return
        const mockData = await mockRes.json()
        if (mockData.error) return

        const mockPosts: PostItem[] = mockData.posts.map((p: Record<string, unknown>) => ({
          id: p.id,
          slug: p.slug,
          title: p.title,
          summary: p.description || '',
          hero_image_url: p.hero_image_url,
          votes: p.votes || 0,
          comments: p.comments || 0,
          created_at: p.created_at,
        }))
        setPosts(mockPosts)
      } catch (err) {
        console.error('Mock posts fetch error:', err)
      }
    }

    loadPosts()
  }, [handle])

  // Load vlog entries from localStorage
  useEffect(() => {
    if (!hydrated) return
    const entriesStr = localStorage.getItem(`chef_vlog_${handle}`)
    if (entriesStr) {
      try {
        const entries = JSON.parse(entriesStr) as VlogEntry[]
        setVlogEntries(entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
      } catch {}
    }
  }, [handle, hydrated])

  /* ── loading skeleton ── */
   if (loading) {
     return (
       <div style={{ minHeight: '100vh', background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
         <div className="animate-pulse">
          <div style={{ height: 220, background: '#e8e8e8' }} />
          <div className="px-4 pt-16 space-y-3">
            <div className="h-5 rounded" style={{ background: '#d0d0d0', width: '40%' }} />
            <div className="h-3 rounded" style={{ background: '#d0d0d0', width: '60%' }} />
          </div>
        </div>
      </div>
    )
  }

   /* ── not found ── */
   if (!profile) {
     return (
       <div style={{ minHeight: '100vh', background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}
         className="flex flex-col items-center justify-center gap-4">
        <p className="text-2xl">😕</p>
        <p className="text-lg font-semibold">Chef negăsit</p>
        <Link href="/" style={{ color: '#ff9500' }} className="text-sm">← Acasă</Link>
      </div>
    )
  }

   return (
     <div style={{ minHeight: '100vh', background: 'hsl(var(--background))', color: 'hsl(var(--foreground))', fontFamily: "'Inter', sans-serif" }}>
       <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@400;500;600&display=swap');.ff-display{font-family:'Syne',sans-serif;}`}</style>

        {/* ── Banner ── */}
        <div className="relative" style={{ height: 220 }}>
          <FallbackImage
            src={profile.banner_url || ''}
            alt=""
            fill
            className="object-cover"
            fallbackEmoji="🍽️"
          />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(245,245,245,0.97) 100%)' }} />

         {/* back button */}
         <button
           onClick={() => router.back()}
           className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold backdrop-blur"
           style={{ background: 'rgba(255,255,255,0.7)', color: '#111', border: '1px solid rgba(0,0,0,0.12)' }}
         >
           ← Înapoi
         </button>
      </div>

      {/* ── Profile header ── */}
      <div className="px-4 relative max-w-5xl mx-auto" style={{ marginTop: -56 }}>
          {/* avatar + tier star */}
          <div className="relative inline-block mb-3">
             <FallbackImage
               src={profile.avatar_url || ''}
               alt={profile.display_name}
               className="rounded-full object-cover border-4"
               style={{ width: 88, height: 88, borderColor: 'hsl(var(--background))' }}
               fallbackEmoji="👨‍🍳"
             />
            {profile.tier && profile.tier !== 'user' && (
              <span
                className="absolute bottom-0 right-0 flex items-center justify-center rounded-full"
                style={{ width: 24, height: 24, background: 'hsl(var(--background))', border: '2px solid hsl(var(--background))' }}
             >
               <TierStar tier={profile.tier} size={16} />
             </span>
           )}
        </div>

         {/* name + tier label */}
         <div className="flex items-start justify-between gap-3 mb-1">
           <div>
             <div className="flex items-center gap-2 flex-wrap">
               <h1 className="ff-display text-2xl font-bold leading-tight">{profile.display_name}</h1>
         {profile.tier && profile.tier !== 'user' && (
           <span
             className="text-[10px] font-bold px-2 py-0.5 rounded-full"
             style={profile.tier === 'pro'
               ? { background: 'rgba(255,77,109,0.15)', color: '#c0392b', border: '1px solid rgba(255,77,109,0.3)' }
               : { background: 'rgba(100,100,100,0.1)', color: '#555', border: '1px solid rgba(0,0,0,0.15)' }}
           >
             {TIER_LABEL[profile.tier] || 'Bucătar Casnic'}
           </span>
               )}
             </div>
             <p className="text-sm" style={{ color: '#888' }}>@{profile.handle}</p>
           </div>

         {/* owner: edit profile | others: follow */}
            {isOwner || (mockUser && mockUser.handle === handle) ? (
              <Link
                href="/me/profile/edit"
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all"
                style={{ background: 'rgba(0,0,0,0.06)', color: '#333', border: '1px solid rgba(0,0,0,0.15)' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Editează profilul
              </Link>
            ) : (
              <button
                onClick={() => {
                  setIsFollowing(f => !f)
                  setFollowerCount(c => isFollowing ? c - 1 : c + 1)
                }}
                className="flex-shrink-0 px-5 py-2 rounded-full text-sm font-bold transition-all"
                style={isFollowing
                  ? { background: 'rgba(0,0,0,0.08)', color: '#333', border: '1px solid rgba(0,0,0,0.15)' }
                  : { background: 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff' }}
              >
                {isFollowing ? '✓ Urmărești' : '+ Urmărește'}
              </button>
            )}
        </div>

        {/* bio */}
        <p className="text-sm leading-relaxed mb-4" style={{ color: '#555' }}>{sanitizeText(profile.bio)}</p>

         {/* stats row */}
         <div className="flex gap-6 mb-6 pb-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
           {[
             { label: 'Postări', value: fmtNumber(profile.post_count) },
             { label: 'Urmăritori', value: fmtNumber(followerCount) },
             { label: 'Urmăresc', value: fmtNumber(profile.following_count) },
           ].map(stat => (
             <div key={stat.label} className="text-center">
               <p className="ff-display text-lg font-bold">{stat.value}</p>
               <p className="text-[11px] uppercase tracking-wide" style={{ color: '#999' }}>{stat.label}</p>
             </div>
           ))}
         </div>

         {/* ── Posts ── */}
         <div className="flex items-center justify-between mb-4">
           <h2 className="ff-display text-lg font-bold">
             Postări <span style={{ color: '#999' }}>{posts.length + vlogEntries.length}</span>
           </h2>
           {mockUser && mockUser.handle === handle && (
             <Link href={`/chefs/${handle}/new-post`}
               className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all"
               style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff' }}>
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
               Intrare nouă
             </Link>
           )}
         </div>

         {posts.length === 0 && vlogEntries.length === 0 ? (
           <p className="text-sm text-center py-12" style={{ color: '#bbb' }}>Nicio postare încă.</p>
        ) : (
          <div className="pb-20">
            {/* Merge and sort all items by date (newest first) */}
             {(() => {
               type DisplayItem = { type: 'post'; data: PostItem; date: string } | { type: 'vlog'; data: VlogEntry; date: string }
               const allItems: DisplayItem[] = [
                 ...posts.map(p => ({ type: 'post' as const, data: p, date: p.created_at.split('T')[0] })),
                 ...vlogEntries.map(v => ({ type: 'vlog' as const, data: v, date: v.date }))
               ]
              allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              
              // Group by date
              const grouped = new Map<string, DisplayItem[]>()
              allItems.forEach(item => {
                if (!grouped.has(item.date)) grouped.set(item.date, [])
                grouped.get(item.date)!.push(item)
              })

              return (
                <div className="space-y-6">
                  {Array.from(grouped.entries()).map(([date, items]) => {
                     const dateObj = new Date(date + 'T00:00:00')
                     const dateLabel = dateObj.toLocaleDateString('ro-RO', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                    
                    return (
                      <div key={date}>
                        <p className="text-xs font-semibold uppercase tracking-widest mb-2 pb-2" style={{ color: '#999', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>📅 {dateLabel}</p>
                        <div className="space-y-4">
                          {items.map(item => (
                            item.type === 'post' ? (
                              // API Post
                              <article
                                key={item.data.id}
                                className="group flex rounded-2xl overflow-hidden transition-all hover:ring-1 hover:ring-white/10"
                                style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)', height: 416 }}
                              >
                                 {/* Image — left */}
                                 <Link href={`/recipes/${item.data.slug}`} className="relative overflow-hidden flex-shrink-0" style={{ flex: '1.3', minWidth: 0 }}>
                                   <FallbackImage
                                     src={item.data.hero_image_url}
                                     alt={item.data.title}
                                     className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                     fill
                                     fallbackEmoji="🍽️"
                                   />
                                   <div className="absolute top-2 left-2">
                                     <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(255,149,0,0.9)', backdropFilter: 'blur(4px)' }}>
                       🍽️ Rețetă
                                     </span>
                                   </div>
                                </Link>

                                {/* Text panel — right */}
                                <div className="flex flex-col justify-between px-6 py-5" style={{ flex: '3', minWidth: 0, borderLeft: '1px solid rgba(0,0,0,0.08)' }}>
                                  <div className="min-w-0">
                                    <Link href={`/recipes/${item.data.slug}`}>
                                      <h3 className="ff-display text-2xl font-bold leading-snug line-clamp-2 hover:text-black transition-colors mb-3" style={{ color: '#111' }}>
                                        {item.data.title}
                                      </h3>
                                    </Link>
                                     <p className="text-base leading-relaxed line-clamp-3" style={{ color: '#666' }}>
                                       {item.data.summary}
                                     </p>
                                  </div>
                                  <div className="flex items-center justify-between mt-2">
                                    <div className="flex items-center gap-3 text-sm" style={{ color: '#999' }}>
                                      <span style={{ color: '#ff4d6d' }}>♥ {item.data.votes}</span>
                                      <span>💬 {item.data.comments}</span>
                                      <span>{timeAgo(item.data.created_at)}</span>
                                    </div>
                                    <Link
                                       href={`/recipes/${item.data.slug}`}
                                       className="text-sm font-semibold px-4 py-2 rounded-full flex-shrink-0 transition-all"
                                       style={{ background: 'rgba(255,149,0,0.12)', color: '#ff9500', border: '1px solid rgba(255,149,0,0.2)' }}
                                     >
                                       Vezi →
                                     </Link>
                                  </div>
                                </div>
                              </article>
                            ) : (
                              // Vlog Entry
                              <article
                                key={item.data.id}
                                className="rounded-2xl overflow-hidden p-4"
                                style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)' }}
                              >
                                 {item.data.attachedRecipe && (
                                   <div className="mb-3 rounded-lg overflow-hidden" style={{ height: 80 }}>
                                     <FallbackImage src={item.data.attachedRecipe.hero_image_url} alt="" fill className="object-cover" sizes="(max-width: 640px) 100vw, 400px" fallbackEmoji="🍽️" />
                                   </div>
                                 )}

                                <p className="text-sm leading-relaxed mb-3" style={{ color: '#333', whiteSpace: 'pre-wrap' }}>
                                  {sanitizeText(item.data.body)}
                                </p>

                                {item.data.attachedRecipe && (
                                  <div className="flex items-center gap-2 mb-3 text-sm">
                                    <span style={{ color: '#888' }}>🍽️</span>
                                    <Link href={`/recipes/${item.data.attachedRecipe.slug}`}
                                      className="font-semibold hover:underline" style={{ color: '#ff9500' }}>
                                      {item.data.attachedRecipe.title}
                                    </Link>
                                  </div>
                                )}

                                {item.data.sponsoredProduct && (
                                  <div className="mt-4 pt-4 rounded-lg p-3" style={{ background: 'rgba(212,160,23,0.06)', border: '1px solid rgba(212,160,23,0.2)', borderLeft: '3px solid #d4a017' }}>
                                    <div className="relative mb-3">
                                      <span className="absolute top-0 right-0 px-2 py-0.5 text-xs font-bold rounded-full" style={{ background: 'rgba(212,160,23,0.3)', color: '#d4a017' }}>
                                        {item.data.sponsoredProduct.disclosure}
                                      </span>
                                       <div className="flex gap-3 items-start pr-16">
                                         {item.data.sponsoredProduct.imageUrl && (
                                           <FallbackImage src={sanitizeUrl(item.data.sponsoredProduct.imageUrl)} alt="" className="w-16 h-16 rounded flex-shrink-0 object-cover" fallbackEmoji="🛍️" />
                                         )}
                                        <div className="flex-1 min-w-0">
                                          <p className="font-semibold text-sm" style={{ color: '#111' }}>{item.data.sponsoredProduct.name}</p>
                                          <p className="text-xs leading-relaxed mt-1" style={{ color: '#666' }}>{item.data.sponsoredProduct.description}</p>
                                        </div>
                                      </div>
                                    </div>
                                    <a
                                       href={sanitizeUrl(item.data.sponsoredProduct.linkUrl)}
                                       target="_blank"
                                       rel="noopener noreferrer"
                                       className="inline-block text-xs font-semibold px-3 py-1.5 rounded-full transition-all hover:opacity-80"
                                       style={{ background: 'rgba(212,160,23,0.15)', color: '#d4a017', border: '1px solid rgba(212,160,23,0.3)' }}
                                     >
                                       Cumpără →
                                     </a>
                                  </div>
                                )}

                                 {mockUser && mockUser.handle === handle && (
                                   <div className="flex justify-end">
                                     <Link href={`/chefs/${handle}/new-post?date=${item.data.date}`}
                                       className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full opacity-60 hover:opacity-100 transition-opacity"
                                       style={{ background: 'rgba(0,0,0,0.05)' }}>
                                       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                       Editează
                                     </Link>
                                   </div>
                                 )}
                              </article>
                            )
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
