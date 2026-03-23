"use client"

import React, { useEffect, useState, useMemo, useCallback } from "react"
import Image from 'next/image'
import { supabase } from "@/lib/supabase-client"
import { useToast } from "@/components/ui/toast"
import SaveButton from "@/components/collections/save-button"
import CollectionPickerModal from "@/components/collections/collection-picker-modal"
import Link from "next/link"
import { usePreferredRecipes } from "@/lib/preferred-recipes"

type Post = {
  id: string
  title: string
  slug: string
  type: string
  hero_image_url?: string | null
  diet_tags?: string[] | null
  food_tags?: string[] | null
  video_url?: string | null
  created_at?: string | null
  approach_id?: string
}

type CollectionItem = {
  collection_id: string
  post_id: string
  user_id: string
  created_at: string
  posts?: Post | null
}

type SortMode = "date_added" | "name" | "newest"

export default function MeCookbookClient() {
  const { push } = useToast()
  const { addRecipe: addToPreferred, removeRecipe: removeFromPreferred, isPreferred } = usePreferredRecipes()
  const [items, setItems] = useState<CollectionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [sortBy, setSortBy] = useState<SortMode>("date_added")
  const [filterTag, setFilterTag] = useState("")
  const [filterFoodTag, setFilterFoodTag] = useState("")
  const [pickerPostId, setPickerPostId] = useState<string | null>(null)

  const fetchSavedItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/collection-items")
      if (res.ok) {
        const data: CollectionItem[] = await res.json()
        // Filter to only recipe-type posts (exclude video/short)
        const recipes = data.filter((item) => {
          const post = item.posts
          if (!post) return true // keep items without post data
          return post.type === "recipe" || !post.type
        })
        setItems(recipes)
      }
    } catch {
      push({ message: "Eroare la încărcarea rețetelor salvate", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [push])

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      setUser(data.user ? { id: data.user.id } : null)
    })()
    fetchSavedItems()
  }, [fetchSavedItems])

  // Collect all unique diet tags for filter
  const allTags = useMemo(() => {
    const tags = new Set<string>()
    items.forEach((item) => {
      item.posts?.diet_tags?.forEach((t) => tags.add(t))
    })
    return Array.from(tags).sort()
  }, [items])

  // Collect all unique food tags for filter
  const allFoodTags = useMemo(() => {
    const tags = new Set<string>()
    items.forEach((item) => {
      item.posts?.food_tags?.forEach((t) => tags.add(t))
    })
    return Array.from(tags).sort()
  }, [items])

  // Filtered + sorted items
  const displayItems = useMemo(() => {
    let filtered = items
    if (filterTag) {
      filtered = filtered.filter((item) =>
        item.posts?.diet_tags?.includes(filterTag)
      )
    }
    if (filterFoodTag) {
      filtered = filtered.filter((item) =>
        item.posts?.food_tags?.includes(filterFoodTag)
      )
    }
    const sorted = [...filtered]
    switch (sortBy) {
      case "name":
        sorted.sort((a, b) =>
          (a.posts?.title || "").localeCompare(b.posts?.title || "")
        )
        break
      case "newest":
        sorted.sort((a, b) =>
          (b.posts?.created_at || "").localeCompare(a.posts?.created_at || "")
        )
        break
      case "date_added":
      default:
        sorted.sort((a, b) =>
          (b.created_at || "").localeCompare(a.created_at || "")
        )
        break
    }
    return sorted
  }, [items, filterTag, filterFoodTag, sortBy])

  const handleUnsave = async (postId: string) => {
    setItems((prev) => prev.filter((i) => i.post_id !== postId))
    try {
      await fetch("/api/collection-items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId }),
      })
      push({ message: "Recipe removed from cookbook", type: "success" })
    } catch {
      fetchSavedItems()
      push({ message: "Failed to remove recipe", type: "error" })
    }
  }

  // Auth gate removed - show empty state instead of sign-in wall (SSO disabled in dev)

  return (
    <main className="min-h-screen" style={{ background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}><div className="container mx-auto px-4 py-8 pb-24">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-orange-200 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-700">
              <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Rețetele mele</h1>
            <p className="text-sm text-gray-500">{items.length} rețet{items.length !== 1 ? "e" : "ă"} salvat{items.length !== 1 ? "e" : "ă"}</p>
          </div>
        </div>
      </div>

      {/* Filters & Sort Bar */}
      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Sort */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Sortare</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortMode)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="date_added">Data adăugării</option>
              <option value="name">Nume A-Z</option>
              <option value="newest">Cele mai noi</option>
            </select>
          </div>

          {/* Diet tag filter */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Diet</label>
              <select
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All</option>
                {allTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Food tag filter */}
          {allFoodTags.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Food</label>
              <select
                value={filterFoodTag}
                onChange={(e) => setFilterFoodTag(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All</option>
                {allFoodTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(filterTag || filterFoodTag) && (
            <button
              onClick={() => { setFilterTag(""); setFilterFoodTag("") }}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-2xl bg-gray-100 animate-pulse h-64" />
          ))}
        </div>
      ) : displayItems.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-gray-300">
              <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Nicio rețetă salvată</h2>
          <p className="text-gray-500 mb-6 max-w-sm mx-auto">
            Explorează rețetele și apasă pe inimioară pentru a le salva aici.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            Explorează rețete
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayItems.map((item) => {
            const post = item.posts
            if (!post) {
              return (
                <div
                  key={item.post_id}
                  className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Saved post</span>
                    <button
                      onClick={() => handleUnsave(item.post_id)}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="text-xs text-gray-300 mt-1">ID: {item.post_id}</div>
                </div>
              )
            }

            return (
              <div
                key={item.post_id}
                className="group rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                {/* Image */}
                <div className="relative aspect-[4/3] bg-gradient-to-br from-amber-50 to-orange-50 overflow-hidden">
                  {post.hero_image_url ? (
                    <Image
                      src={post.hero_image_url}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-amber-200">
                        <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                  )}

                  {/* Save button overlay */}
                  <div className="absolute top-3 right-3">
                    <SaveButton postId={post.id} isSaved={true} onToggle={(saved) => { if (!saved) handleUnsave(post.id) }} size="sm" />
                  </div>

                  {/* Collection picker button */}
                  <button
                    onClick={() => setPickerPostId(post.id)}
                    className="absolute top-3 left-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-sm text-gray-500 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    title="Add to collection"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                  </button>

                  {/* Diet tags */}
                  {post.diet_tags && post.diet_tags.length > 0 && (
                    <div className="absolute bottom-3 left-3 flex flex-wrap gap-1">
                      {post.diet_tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 text-[10px] font-medium bg-white/90 backdrop-blur-sm rounded-full text-gray-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-1 line-clamp-2">
                    {post.title}
                  </h3>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-400">
                      Saved {new Date(item.created_at).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (isPreferred(post.id)) {
                            removeFromPreferred(post.id)
                            push({ message: "Removed from Preferred", type: "success" })
                          } else {
                            addToPreferred(
                              {
                                id: post.id,
                                slug: post.slug,
                                title: post.title,
                                hero_image_url: post.hero_image_url,
                                dietTags: post.diet_tags ?? [],
                              },
                              "cookbook"
                            )
                            push({ message: "Added to Preferred Recipes", type: "success" })
                          }
                        }}
                        className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                          isPreferred(post.id)
                            ? "bg-amber-100 border-amber-300 text-amber-700 hover:bg-red-50 hover:border-red-300 hover:text-red-500"
                            : "border-amber-300 text-amber-600 hover:bg-amber-50"
                        }`}
                        title={isPreferred(post.id) ? "Remove from Preferred" : "Add to Preferred Recipes"}
                      >
                        {isPreferred(post.id) ? "⭐ Preferred" : "☆ Prefer"}
                      </button>
                      <Link
                        href={`/recipes/${post.slug || post.id}`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        View Recipe
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Collection Picker Modal */}
      {pickerPostId && (
        <CollectionPickerModal
          postId={pickerPostId}
          open={true}
          onClose={() => setPickerPostId(null)}
          onSaved={() => {
            push({ message: "Saved to collection!", type: "success" })
          }}
        />
      )}
    </div></main>
  )
}
