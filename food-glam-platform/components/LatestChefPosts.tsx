'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import TierStar from '@/components/TierStar'
import type { ChefBlogPost, ChefProfile } from '@/lib/mock-chef-data'
import { MOCK_LATEST_CHEF_POSTS, MOCK_CHEF_PROFILES } from '@/lib/mock-chef-data'

type PostWithChef = ChefBlogPost & { chef?: ChefProfile }

export default function LatestChefPosts() {
  const [posts, setPosts] = useState<PostWithChef[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/chefs/latest')
      .then(r => r.json())
      .then(data => {
        setPosts(data.posts ?? [])
        setLoading(false)
      })
      .catch(() => {
        // fallback: embed mock data directly
        const fallback = MOCK_LATEST_CHEF_POSTS.map(post => ({
          ...post,
          chef: MOCK_CHEF_PROFILES.find(p => p.handle === post.chef_handle),
        }))
        setPosts(fallback)
        setLoading(false)
      })
  }, [])

  return (
    <section className="px-4 pb-10">
       {/* header */}
       <div className="flex items-center justify-between mb-4">
         <p className="ff-display text-xl font-bold">Ultimele de la Chef</p>
         <span className="text-xs" style={{ color: '#555' }}>Din bucătărie</span>
       </div>

      {/* horizontal scroll strip */}
      <div
        className="flex gap-3 overflow-x-auto hide-scrollbar pb-1"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex-shrink-0 rounded-2xl overflow-hidden animate-pulse"
                style={{ width: 200, height: 260, background: '#1a1a1a', scrollSnapAlign: 'start' }}
              />
            ))
          : posts.map(post => (
              <Link
                key={post.id}
                href={`/recipes/${post.slug}`}
                className="flex-shrink-0 rounded-2xl overflow-hidden relative group"
                style={{ width: 200, height: 260, background: '#1a1a1a', scrollSnapAlign: 'start', display: 'block' }}
              >
                {/* cover */}
                <img
                  src={post.hero_image_url}
                  alt={post.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* gradient overlay */}
                <div
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.92) 40%, rgba(0,0,0,0.1) 100%)' }}
                />

                {/* content */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  {/* chef row */}
                  {post.chef && (
                    <Link
                      href={`/chefs/${post.chef.handle}`}
                      className="flex items-center gap-1.5 mb-2"
                      onClick={e => e.stopPropagation()}
                    >
                      <img
                        src={post.chef.avatar_url}
                        alt={post.chef.display_name}
                        className="w-5 h-5 rounded-full object-cover border border-white/30 flex-shrink-0"
                      />
                      <span className="text-[11px] font-semibold truncate" style={{ color: '#ccc' }}>
                        {post.chef.display_name}
                      </span>
                      {post.chef.tier !== 'user' && (
                        <TierStar tier={post.chef.tier} size={10} />
                      )}
                    </Link>
                  )}

                  {/* title */}
                  <h3 className="ff-display text-sm font-bold leading-snug line-clamp-2 mb-1.5">
                    {post.title}
                  </h3>

                  {/* meta */}
                  <div className="flex items-center gap-2 text-[10px]" style={{ color: '#777' }}>
                    <span>❤️ {post.votes}</span>
                    <span>💬 {post.comments}</span>
                  </div>
                </div>
              </Link>
            ))}
      </div>
    </section>
  )
}
