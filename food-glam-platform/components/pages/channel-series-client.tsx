"use client"

import React, { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase-client"
import { useToast } from "@/components/ui/toast"
import Link from "next/link"

type Collection = {
  id: string
  title: string
  items?: unknown[] | null
  created_at?: string | null
  user_id: string
}

type ChannelSeriesClientProps = {
  handle: string
}

export default function ChannelSeriesClient({ handle }: ChannelSeriesClientProps) {
  const { push } = useToast()
  const [series, setSeries] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<{ id: string; display_name: string; handle: string } | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [creating, setCreating] = useState(false)

  const isOwner = currentUserId && profile && currentUserId === profile.id

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // Get profile by handle
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, display_name, handle")
        .eq("handle", handle)
        .single()

      if (profileData) {
        setProfile(profileData)

        // Fetch series collections for this user
        const res = await fetch(`/api/collections?type=series&owner_id=${profileData.id}`)
        if (res.ok) {
          const data = await res.json()
          setSeries(data)
        }
      }

      // Get current user
      const { data: { session: userSession } } = await supabase.auth.getSession(); const userData = { user: userSession?.user ?? null }
      setCurrentUserId(userData.user?.id || null)
    } catch {
      push({ message: "Failed to load series", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [handle, push])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const createSeries = async () => {
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const slug = newTitle
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")

      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          type: "series",
          visibility: "public",
          slug,
        }),
      })

      if (res.ok) {
        const created = await res.json()
        setSeries((prev) => [created, ...prev])
        setNewTitle("")
        setShowCreate(false)
        push({ message: "Series created!", type: "success" })
      }
    } catch {
      push({ message: "Failed to create series", type: "error" })
    } finally {
      setCreating(false)
    }
  }

  const getSeriesDisplayTitle = (title: string) => {
    return title.startsWith("series:") ? title.slice(7) : title
  }

  const getSeriesSlug = (col: Collection): string => {
    // Try to extract slug from items metadata
    if (Array.isArray(col.items) && col.items.length > 0) {
      try {
        const meta = typeof col.items[0] === "string" ? JSON.parse(col.items[0] as string) : col.items[0]
        if (meta && typeof meta === "object" && "slug" in meta) return meta.slug as string
      } catch {
        // ignore
      }
    }
    // Fallback: generate from title
    return getSeriesDisplayTitle(col.title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  }

  return (
    <main className="container mx-auto px-4 py-8 pb-24">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-200 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-700">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {profile ? `${profile.display_name}'s Series` : "Series"}
              </h1>
              <p className="text-sm text-gray-500">
                {series.length} curated collection{series.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {isOwner && (
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Series
            </button>
          )}
        </div>

        {/* Create form */}
        {showCreate && isOwner && (
          <div className="mt-4 p-4 rounded-2xl border border-gray-200 bg-gray-50">
            <div className="flex gap-3">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createSeries()}
                placeholder="Series title, e.g. '5 Weeknight Pastas'"
                className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                onClick={createSeries}
                disabled={creating || !newTitle.trim()}
                className="px-5 py-2 text-sm font-medium text-white bg-primary rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {creating ? "Creating..." : "Create"}
              </button>
              <button
                onClick={() => { setShowCreate(false); setNewTitle("") }}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-gray-100 animate-pulse h-48" />
          ))}
        </div>
      ) : series.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-gray-300">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">No series yet</h2>
          <p className="text-gray-500 max-w-sm mx-auto">
            {isOwner
              ? "Create your first curated series to showcase your best content."
              : "This creator hasn't published any series yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {series.map((s) => {
            const displayTitle = getSeriesDisplayTitle(s.title)
            const slug = getSeriesSlug(s)

            return (
              <Link
                key={s.id}
                href={`/channel/${handle}/series/${slug}`}
                className="group rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm hover:shadow-md transition-all duration-200"
              >
                {/* Cover gradient */}
                <div className="aspect-[16/9] bg-gradient-to-br from-emerald-100 via-teal-50 to-cyan-100 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(16,185,129,0.15),transparent_60%)]" />
                  <div className="relative flex flex-col items-center gap-2">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-400">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                      <path d="M8 21h8M12 17v4" />
                    </svg>
                    <span className="text-xs text-emerald-600 font-medium">Series</span>
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 text-sm mb-1 group-hover:text-primary transition-colors">
                    {displayTitle}
                  </h3>
                  <div className="text-xs text-gray-400">
                    {s.created_at && new Date(s.created_at).toLocaleDateString()}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
