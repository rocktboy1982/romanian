"use client"

import React, { useEffect, useState, useMemo, useCallback } from "react"
import Image from 'next/image'
import { supabase } from "@/lib/supabase-client"
import { useToast } from "@/components/ui/toast"
import SaveButton from "@/components/collections/save-button"
import Link from "next/link"

type Post = {
  id: string
  title: string
  slug: string
  type: string
  hero_image_url?: string | null
  video_url?: string | null
  created_at?: string | null
}

type CollectionItem = {
  collection_id: string
  post_id: string
  user_id: string
  created_at: string
  posts?: Post | null
}

type SortMode = "date_added" | "name"

export default function MeWatchlistClient() {
  const { push } = useToast()
  const [items, setItems] = useState<CollectionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [sortBy, setSortBy] = useState<SortMode>("date_added")
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set())

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/collection-items")
      if (res.ok) {
        const data: CollectionItem[] = await res.json()
        // Filter to video/short/image type posts
        const media = data.filter((item) => {
          const post = item.posts
          if (!post) return false
          return post.type === "video" || post.type === "short" || post.type === "image" || post.video_url
        })
        setItems(media)
      }
    } catch {
      push({ message: "Failed to load watchlist", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [push])

  useEffect(() => {
    ;(async () => {
      const { data: { session: _sess } } = await supabase.auth.getSession(); const data = { user: _sess?.user ?? null }
      setUser(data.user ? { id: data.user.id } : null)
    })()
    fetchItems()

    // Load watched state from localStorage
    try {
      const raw = localStorage.getItem("watchlist_watched")
      if (raw) setWatchedIds(new Set(JSON.parse(raw)))
    } catch {
      // ignore
    }
  }, [fetchItems])

  const toggleWatched = (postId: string) => {
    setWatchedIds((prev) => {
      const next = new Set(prev)
      if (next.has(postId)) {
        next.delete(postId)
      } else {
        next.add(postId)
      }
      try {
        localStorage.setItem("watchlist_watched", JSON.stringify(Array.from(next)))
      } catch {
        // ignore
      }
      return next
    })
  }

  const handleUnsave = async (postId: string) => {
    setItems((prev) => prev.filter((i) => i.post_id !== postId))
    try {
      await fetch("/api/collection-items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId }),
      })
      push({ message: "Removed from watchlist", type: "success" })
    } catch {
      fetchItems()
    }
  }

  const displayItems = useMemo(() => {
    const sorted = [...items]
    if (sortBy === "name") {
      sorted.sort((a, b) => (a.posts?.title || "").localeCompare(b.posts?.title || ""))
    } else {
      sorted.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
    }
    return sorted
  }, [items, sortBy])

  const unwatchedCount = items.filter((i) => !watchedIds.has(i.post_id)).length

  // Auth gate removed - SSO disabled in dev

  return (
    <main className="min-h-screen" style={{ background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}><div className="container mx-auto px-4 py-8 pb-24">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-200 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-700">
              <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Watch Later</h1>
            <p className="text-sm text-gray-500">
              {items.length} saved &middot; {unwatchedCount} unwatched
            </p>
          </div>
        </div>
      </div>

      {/* Sort */}
      {items.length > 0 && (
        <div className="flex items-center gap-3 mb-6">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Sort</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortMode)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="date_added">Date Added</option>
            <option value="name">Name A-Z</option>
          </select>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl bg-gray-100 animate-pulse aspect-video" />
          ))}
        </div>
      ) : displayItems.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-gray-300">
              <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">No videos saved yet</h2>
          <p className="text-gray-500 mb-6 max-w-sm mx-auto">
            Browse videos and shorts, then save them to watch later.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            Explore Content
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayItems.map((item) => {
            const post = item.posts
            if (!post) return null
            const isWatched = watchedIds.has(post.id)

            return (
              <div
                key={item.post_id}
                className={`group rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 ${
                  isWatched ? "border-gray-100 bg-gray-50 opacity-70" : "border-gray-100 bg-white"
                }`}
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-gradient-to-br from-violet-50 to-indigo-50 overflow-hidden">
                  {post.hero_image_url ? (
                    <Image
                      src={post.hero_image_url}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="text-violet-200">
                        <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
                      </svg>
                    </div>
                  )}

                  {/* Play icon overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </div>
                  </div>

                  {/* Save button */}
                  <div className="absolute top-3 right-3">
                    <SaveButton postId={post.id} isSaved={true} onToggle={(saved) => { if (!saved) handleUnsave(post.id) }} size="sm" />
                  </div>

                  {/* Watched badge */}
                  {isWatched && (
                    <div className="absolute bottom-3 left-3 px-2 py-0.5 text-[10px] font-medium bg-green-500 text-white rounded-full">
                      Watched
                    </div>
                  )}

                  {/* Type badge */}
                  <div className="absolute top-3 left-3 px-2 py-0.5 text-[10px] font-semibold uppercase bg-black/40 backdrop-blur-sm text-white rounded-full">
                    {post.type || "video"}
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-2 line-clamp-2">
                    {post.title}
                  </h3>
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => toggleWatched(post.id)}
                      className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${
                        isWatched
                          ? "bg-green-50 text-green-600 hover:bg-green-100"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {isWatched ? "✓ Watched" : "Mark Watched"}
                    </button>
                    <span className="text-xs text-gray-400">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div></main>
  )
}
