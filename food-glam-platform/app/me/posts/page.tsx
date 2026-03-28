'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase-client'
import { MOCK_RECIPES } from '@/lib/mock-data'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import DeleteContentButton from '@/components/DeleteContentButton'

type PostStatus = 'draft' | 'pending_review' | 'active' | 'rejected' | 'archived'

type MyPost = {
  id: string
  title: string
  slug: string | null
  type: string
  status: PostStatus
  hero_image_url?: string
  rejection_reason?: string
  created_at: string
}

const STATUS_LABELS: Record<PostStatus, string> = {
  draft: 'Ciornă',
  pending_review: 'În revizuire',
  active: 'Publicat',
  rejected: 'Respins',
  archived: 'Arhivat',
}

const STATUS_COLORS: Record<PostStatus, string> = {
  draft: 'bg-stone-100 text-stone-600',
  pending_review: 'bg-amber-100 text-amber-700',
  active: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  archived: 'bg-stone-100 text-stone-400',
}

const ALL_STATUSES: PostStatus[] = ['active', 'draft', 'pending_review', 'rejected', 'archived']

// Mock posts derived from MOCK_RECIPES — simulates what a logged-in user would see
const MOCK_POSTS: MyPost[] = MOCK_RECIPES.slice(0, 4).map((r, i) => ({
  id: r.id,
  title: r.title,
  slug: r.slug,
  type: 'recipe',
  status: (['active', 'active', 'pending_review', 'draft'] as PostStatus[])[i],
  created_at: new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000).toISOString(),
}))

export default function MyPostsPage() {
  const [posts, setPosts] = useState<MyPost[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<PostStatus | 'all'>('all')
  const toast = useToast()

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      // Try fetching from Supabase first — prefer marechef-session
      let user = null
      try {
        const backup = localStorage.getItem('marechef-session')
        if (backup) {
          const parsed = JSON.parse(backup)
          if (parsed?.user) user = parsed.user
        }
      } catch {}
      if (!user) {
        const { data: { session } } = await supabase.auth.getSession()
        user = session?.user ?? null
      }
      if (user) {
        const { data, error } = await supabase
          .from('posts')
          .select('id, title, slug, type, status, hero_image_url, created_at')
          .eq('created_by', user.id)
          .order('created_at', { ascending: false })
        if (!error && data && data.length > 0) {
          setPosts(data.map(d => ({ ...d, slug: d.slug ?? null } as MyPost)))
          setLoading(false)
          return
        }
      }
      // Fallback: mock data
      setPosts(MOCK_POSTS)
    } catch {
      setPosts(MOCK_POSTS)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  const resubmit = async (postId: string) => {
    try {
      const res = await fetch('/api/submit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: postId, status: 'draft' }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Failed to resubmit')
      }
      toast.push({ message: 'Postarea a fost mutată înapoi în Ciornă pentru editare', type: 'success' })
      await fetchPosts()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      toast.push({ message: msg, type: 'error' })
    }
  }

  const filtered = filter === 'all' ? posts : posts.filter(p => p.status === filter)

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Postările mele</h1>
        <Link
          href="/submit/recipe"
          className="text-sm font-medium px-4 py-2 rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors"
        >
          + Postare nouă
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1.5 mb-6 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            filter === 'all' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          Toate ({posts.length})
        </button>
        {ALL_STATUSES.map(s => {
          const count = posts.filter(p => p.status === s).length
          if (count === 0) return null
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === s ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {STATUS_LABELS[s]} ({count})
            </button>
          )
        })}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-2 border-foreground/20 border-t-foreground/70 rounded-full animate-spin" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </div>
          <p className="text-muted-foreground text-sm">
            {filter === 'all' ? 'Nu ai postări încă.' : `Nicio postare cu statusul „${STATUS_LABELS[filter as PostStatus].toLowerCase()}".`}
          </p>
          {filter === 'all' && (
            <Link
              href="/submit/recipe"
              className="mt-4 text-sm font-medium underline underline-offset-4 hover:text-foreground/70 transition-colors"
            >
              Creează prima ta postare
            </Link>
          )}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <ul className="divide-y divide-border">
          {filtered.map((post) => {
            const status = (post.status || 'draft') as PostStatus
            const label = STATUS_LABELS[status] ?? status
            const colorClass = STATUS_COLORS[status] ?? 'bg-stone-100 text-stone-600'
            const formattedDate = new Date(post.created_at).toLocaleDateString('ro-RO', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })

            return (
              <li key={post.id} className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{post.title || 'Fără titlu'}</span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
                      >
                        {label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {post.type === 'recipe' ? 'rețetă' : post.type} · {formattedDate}
                    </p>

                    {/* Rejection reason */}
                    {status === 'rejected' && post.rejection_reason && (
                      <p className="text-xs text-red-600 mt-1.5 bg-red-50 rounded-md px-2.5 py-1.5">
                        <span className="font-medium">Motiv:</span> {post.rejection_reason}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-1.5 shrink-0">
                    {/* Edit button for drafts and rejected */}
                    {(status === 'draft' || status === 'rejected') && (
                      <Link
                        href={`/submit/recipe?edit=${post.id}`}
                        className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-md border hover:bg-muted transition-colors"
                      >
                        Editează
                      </Link>
                    )}

                    {/* Resubmit button for rejected posts */}
                    {status === 'rejected' && (
                      <Button size="sm" variant="outline" onClick={() => resubmit(post.id)}>
                        Trece în Ciornă
                      </Button>
                    )}

                    {/* View button for published posts */}
                    {status === 'active' && post.slug && (
                      <Link
                        href={`/recipes/${post.slug}`}
                        className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-md border hover:bg-muted transition-colors"
                      >
                        Vezi
                      </Link>
                    )}

                    {/* Delete button for all posts */}
                    <DeleteContentButton
                      postId={post.id}
                      postTitle={post.title}
                      onDeleted={() => setPosts(prev => prev.filter(p => p.id !== post.id))}
                      variant="button"
                      size="sm"
                    />
                   </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
