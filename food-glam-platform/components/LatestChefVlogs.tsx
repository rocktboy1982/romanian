'use client'

import Link from 'next/link'
import TierStar from '@/components/TierStar'
import {
  MOCK_CHEF_POSTS,
  MOCK_CHEF_PROFILES,
} from '@/lib/mock-chef-data'

/* ─── relative date helper ───────────────────────────────────────────────── */

function relativeDate(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return `${Math.floor(diffDays / 7)}w ago`
}

/* ─── build sorted posts ─────────────────────────────────────────────────── */

/* Sort by chef follower_count (proxy for popularity) desc, then post date desc */
const SORTED_POSTS = [...MOCK_CHEF_POSTS]
  .map(post => {
    const chef = MOCK_CHEF_PROFILES.find(c => c.handle === post.chef_handle)
    return { post, chef: chef ?? null }
  })
  .filter(({ chef }) => chef !== null)
  .sort((a, b) => {
    const followerDiff = (b.chef!.follower_count) - (a.chef!.follower_count)
    if (followerDiff !== 0) return followerDiff
    return new Date(b.post.created_at).getTime() - new Date(a.post.created_at).getTime()
  })
  .slice(0, 8)

/* ─── component ──────────────────────────────────────────────────────────── */

export default function LatestChefVlogs() {
  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col h-full"
      style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">👨‍🍳</span>
           <span
             className="font-bold text-sm tracking-wide"
             style={{ fontFamily: "'Syne', sans-serif", color: '#f0f0f0' }}
           >
             Vloguri Chef
           </span>
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: 'rgba(255,149,0,0.15)', color: '#ff9500' }}
          >
            {SORTED_POSTS.length}
          </span>
        </div>
         <span className="text-[11px]" style={{ color: '#444' }}>
           Postări recente
         </span>
       </div>

       {/* ── List ── */}
      <div className="flex-1 overflow-y-auto">
        {SORTED_POSTS.map(({ post, chef }, i) => (
          <Link
            key={post.id}
            href={`/chefs/${post.chef_handle}`}
            className="group flex items-start gap-3 px-3 py-3.5 transition-colors hover:bg-white/[0.03]"
            style={{
              borderBottom:
                i < SORTED_POSTS.length - 1
                  ? '1px solid rgba(255,255,255,0.04)'
                  : 'none',
            }}
          >
            {/* Chef avatar */}
            <div
              className="flex-shrink-0 rounded-xl overflow-hidden"
              style={{ width: 112, height: 112 }}
            >
              {chef?.avatar_url ? (
                <img
                  src={chef.avatar_url}
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-xl"
                  style={{ background: '#1a1a1a' }}
                >
                  👨‍🍳
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {/* Chef name + tier */}
              <div className="flex items-center gap-1 mb-0.5">
                <span
                  className="text-[11px] font-semibold truncate"
                  style={{ color: '#888' }}
                >
                  {chef?.display_name}
                </span>
                {chef && <TierStar tier={chef.tier} size={10} />}
              </div>
              {/* Post title */}
              <p
                className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-white transition-colors mb-1"
                style={{ color: '#ddd' }}
              >
                {post.title}
              </p>
              {/* Description snippet */}
              {post.description && (
                <p className="text-[11px] leading-relaxed line-clamp-2" style={{ color: '#555' }}>
                  {post.description}
                </p>
              )}
              {/* Meta row */}
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="text-[11px] font-semibold flex items-center gap-0.5"
                  style={{ color: '#ff4d6d' }}
                >
                  ♥ {post.votes}
                </span>
                <span className="text-[10px]" style={{ color: '#444' }}>
                  {relativeDate(post.created_at)}
                </span>
              </div>
            </div>

            {/* Arrow hint */}
            <span
              className="flex-shrink-0 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: '#555' }}
            >
              →
            </span>
          </Link>
        ))}
      </div>
      {/* ── Footer ── */}
      <div
        className="px-4 py-2.5"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
         <Link
           href="/chefs"
           className="block text-center text-xs font-semibold py-1.5 rounded-xl transition-all"
           style={{
             background: 'rgba(255,149,0,0.08)',
             color: '#ff9500',
             border: '1px solid rgba(255,149,0,0.15)',
           }}
         >
           Vezi toate vlogurile chef →
         </Link>
       </div>
     </div>
   )
}
