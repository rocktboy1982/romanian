"use client"

import React, { useEffect, useState, useCallback } from "react"
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

type Collection = {
  id: string
  title: string
  items?: unknown[] | null
  created_at?: string | null
  user_id: string
}

type CollectionItem = {
  collection_id: string
  post_id: string
  user_id: string
  created_at: string
  posts?: Post | null
}

type SeriesDetailClientProps = {
  handle: string
  slug: string
}

export default function SeriesDetailClient({ handle, slug }: SeriesDetailClientProps) {
  const { push } = useToast()
  const [series, setSeries] = useState<Collection | null>(null)
  const [items, setItems] = useState<CollectionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<{ id: string; display_name: string } | null>(null)
  const [showAddPost, setShowAddPost] = useState(false)
  const [postIdInput, setPostIdInput] = useState("")
  const [adding, setAdding] = useState(false)

  const isOwner = currentUserId && profile && currentUserId === profile.id

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // Get profile by handle
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("handle", handle)
        .single()

      if (!profileData) {
        setLoading(false)
        return
      }
      setProfile(profileData)

      // Get current user
      const { data: { session: userSession } } = await supabase.auth.getSession(); const userData = { user: userSession?.user ?? null }
      setCurrentUserId(userData.user?.id || null)

      // Fetch series collections to find matching slug
      const res = await fetch(`/api/collections?type=series&owner_id=${profileData.id}`)
      if (res.ok) {
        const collections: Collection[] = await res.json()
        // Find series matching slug
        const match = collections.find((c) => {
          const title = c.title.startsWith("series:") ? c.title.slice(7) : c.title
          const generatedSlug = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")

          // Check metadata slug or generated slug
          if (Array.isArray(c.items) && c.items.length > 0) {
            try {
              const meta = typeof c.items[0] === "string" ? JSON.parse(c.items[0] as string) : c.items[0]
              if (meta && typeof meta === "object" && "slug" in meta && meta.slug === slug) return true
            } catch {
              // ignore
            }
          }
          return generatedSlug === slug
        })

        if (match) {
          setSeries(match)

          // Fetch items for this collection
          if (userData.user) {
            const itemsRes = await fetch(`/api/collection-items?collection_id=${match.id}`)
            if (itemsRes.ok) {
              const itemsData = await itemsRes.json()
              setItems(itemsData)
            }
          }
        }
      }
    } catch {
      push({ message: "Failed to load series", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [handle, slug, push])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const addPost = async () => {
    if (!postIdInput.trim() || !series) return
    setAdding(true)
    try {
      const res = await fetch("/api/collection-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postIdInput.trim(), collection_id: series.id }),
      })
      if (res.ok) {
        push({ message: "Post added to series!", type: "success" })
        setPostIdInput("")
        setShowAddPost(false)
        fetchData()
      } else {
        const err = await res.json()
        push({ message: err.error || "Failed to add post", type: "error" })
      }
    } catch {
      push({ message: "Failed to add post", type: "error" })
    } finally {
      setAdding(false)
    }
  }

  const removePost = async (postId: string) => {
    if (!series) return
    setItems((prev) => prev.filter((i) => i.post_id !== postId))
    try {
      await fetch("/api/collection-items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId, collection_id: series.id }),
      })
      push({ message: "Post removed from series", type: "success" })
    } catch {
      fetchData()
    }
  }

  const displayTitle = series
    ? series.title.startsWith("series:") ? series.title.slice(7) : series.title
    : "Series"

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/channel/${handle}/series/${slug}`
    : ""

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: displayTitle, url: shareUrl })
      } else {
        await navigator.clipboard.writeText(shareUrl)
        push({ message: "Link copied to clipboard!", type: "success" })
      }
    } catch {
      // user cancelled share
    }
  }

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-100 rounded-lg w-64" />
          <div className="h-4 bg-gray-100 rounded w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl bg-gray-100 h-48" />
            ))}
          </div>
        </div>
      </main>
    )
  }

  if (!series) {
    return (
      <main className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Series Not Found</h1>
        <p className="text-gray-500 mb-6">This series doesn&apos;t exist or has been removed.</p>
        <Link href={`/channel/${handle}/series`} className="text-primary hover:underline text-sm">
          ← Back to all series
        </Link>
      </main>
    )
  }

  return (
    <main className="container mx-auto px-4 py-8 pb-24">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/channel/${handle}/series`}
          className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-4"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          All series
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{displayTitle}</h1>
            <p className="text-sm text-gray-500">
              by {profile?.display_name || handle} &middot; {items.length} post{items.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              Share
            </button>

            {isOwner && (
              <button
                onClick={() => setShowAddPost(!showAddPost)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add Post
              </button>
            )}
          </div>
        </div>

        {/* Add post form */}
        {showAddPost && isOwner && (
          <div className="mt-4 p-4 rounded-2xl border border-gray-200 bg-gray-50">
            <div className="flex gap-3">
              <input
                type="text"
                value={postIdInput}
                onChange={(e) => setPostIdInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addPost()}
                placeholder="Post ID to add..."
                className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                onClick={addPost}
                disabled={adding || !postIdInput.trim()}
                className="px-5 py-2 text-sm font-medium text-white bg-primary rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {adding ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Posts */}
      {items.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-emerald-300">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">No posts in this series</h2>
          <p className="text-gray-500 max-w-sm mx-auto">
            {isOwner ? "Add posts to build out this series." : "This series is still being curated."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item, index) => {
            const post = item.posts

            return (
              <div
                key={item.post_id}
                className="group rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm hover:shadow-md transition-all duration-200"
              >
                {/* Cover */}
                <div className="relative aspect-[4/3] bg-gradient-to-br from-emerald-50 to-teal-50 overflow-hidden">
                  {post?.hero_image_url ? (
                    <Image
                      src={post.hero_image_url}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-4xl font-bold text-emerald-200">#{index + 1}</span>
                    </div>
                  )}

                  {/* Position badge */}
                  <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white text-xs font-bold">
                    {index + 1}
                  </div>

                  {/* Save button */}
                  <div className="absolute top-3 right-3">
                    <SaveButton postId={item.post_id} isSaved={true} size="sm" />
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-2 line-clamp-2">
                    {post?.title || `Post ${item.post_id.slice(0, 8)}`}
                  </h3>
                  <div className="flex items-center justify-between">
                    {post?.slug ? (
                      <Link
                        href={`/recipes/${post.slug}`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        View →
                      </Link>
                    ) : (
                      <span className="text-xs text-gray-400">#{index + 1} in series</span>
                    )}

                    {isOwner && (
                      <button
                        onClick={() => removePost(item.post_id)}
                        className="text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
