'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import FallbackImage from '@/components/FallbackImage'
import { useTheme } from '@/components/theme-provider'
import { supabase } from '@/lib/supabase-client'

interface PantryItem {
  id: string
  item_name: string
  canonical_name: string | null
  quantity: string | null
  qty_numeric: number | null
  unit: string | null
  category: string
  expiration_date: string | null
  source: string
  created_at: string
  updated_at: string
}

interface MatchResult {
  id: string
  title: string
  slug: string
  image_url: string | null
  summary: string | null
  match_ratio: number
  matched_count: number
  total_count: number
  effective_missing: number
  matched_ingredients: string[]
  missing_ingredients: string[]
}

const FOOD_CATEGORIES: Record<string, { label: string; emoji: string }> = {
  'Legume': { label: 'Legume', emoji: '🥬' },
  'Fructe': { label: 'Fructe', emoji: '🍎' },
  'Carne': { label: 'Carne', emoji: '🥩' },
  'Pește': { label: 'Pește', emoji: '🐟' },
  'Lactate': { label: 'Lactate', emoji: '🧀' },
  'Cereale': { label: 'Cereale', emoji: '🌾' },
  'Condimente': { label: 'Condimente', emoji: '🌶️' },
  'Uleiuri': { label: 'Uleiuri', emoji: '🫒' },
  'Altele': { label: 'Altele', emoji: '📦' },
}

const BAR_CATEGORIES: Record<string, { label: string; emoji: string }> = {
  'Spirtoase': { label: 'Spirtoase', emoji: '🥃' },
  'Lichioruri': { label: 'Lichioruri', emoji: '🍸' },
  'Mixere': { label: 'Mixere', emoji: '🧃' },
  'Fructe & Garnituri': { label: 'Fructe & Garnituri', emoji: '🍋' },
  'Altele': { label: 'Altele', emoji: '📦' },
}

function isExpiringSoon(date: string | null): 'expired' | 'soon' | 'ok' {
  if (!date) return 'ok'
  const d = new Date(date)
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  if (diff < 0) return 'expired'
  if (diff < 3 * 24 * 60 * 60 * 1000) return 'soon' // 3 days
  return 'ok'
}

export default function InventoryPageClient({ category }: { category: 'pantry' | 'bar' }) {
  const { theme } = useTheme()
  const isBar = category === 'bar'
  const title = isBar ? 'Barul meu' : 'Cămara mea'
  const emptyMsg = isBar ? 'Barul tău e gol. Adaugă băuturi!' : 'Cămara ta e goală. Adaugă ingrediente!'
  const searchLabel = isBar ? 'Ce pot mixa?' : 'Ce pot găti?'
  const addPlaceholder = isBar ? 'Ex: Vodkă, Rom, Tonic...' : 'Ex: Piept de pui, Roșii...'

  const [items, setItems] = useState<PantryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newQty, setNewQty] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const [newExpiry, setNewExpiry] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editQty, setEditQty] = useState('')
  const [editExpiry, setEditExpiry] = useState('')
  const [matches, setMatches] = useState<MatchResult[] | null>(null)
  const [matchLoading, setMatchLoading] = useState(false)

  const isDark = theme === 'dark'
  const bg = isDark ? 'hsl(var(--background))' : '#fff'
  const cardBg = isDark ? 'rgba(255,255,255,0.06)' : '#fff'
  const border = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.15)'

  /**
   * Returns headers including an Authorization Bearer token when a Supabase
   * session exists in localStorage (Google OAuth / implicit flow). This allows
   * API routes that rely on cookie-based auth to fall back to JWT verification.
   */
  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
    return headers
  }, [])

  const fetchItems = useCallback(async () => {
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/pantry?category=${category}`, { headers })
      if (res.ok) setItems(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
  }, [category, getAuthHeaders])

  useEffect(() => { fetchItems() }, [fetchItems])

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return

    await fetch('/api/pantry', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        name: newName.trim(),
        quantity: newQty || null,
        unit: newUnit || null,
        category,
        expiration_date: newExpiry || null,
      }),
    })
    setNewName('')
    setNewQty('')
    setNewUnit('')
    setNewExpiry('')
    fetchItems()
  }

  const deleteItem = async (id: string) => {
    await fetch('/api/pantry', {
      method: 'DELETE',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ id }),
    })
    fetchItems()
  }

  const updateItem = async (id: string) => {
    await fetch('/api/pantry', {
      method: 'PATCH',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        id,
        quantity: editQty || null,
        expiration_date: editExpiry || null,
      }),
    })
    setEditId(null)
    fetchItems()
  }

  const adjustQty = async (item: PantryItem, delta: number) => {
    const current = item.qty_numeric ?? 0
    const next = Math.max(0, current + delta)
    await fetch('/api/pantry', {
      method: 'PATCH',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ id: item.id, quantity: next }),
    })
    fetchItems()
  }

  const searchByInventory = async () => {
    setMatchLoading(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/search/by-inventory?category=${category}&sort=closest&limit=20`, { headers })
      if (res.ok) {
        const data = await res.json()
        setMatches(data.results || [])
      }
    } catch { /* ignore */ }
    setMatchLoading(false)
  }

  return (
    <main className="min-h-screen pb-24" style={{ background: bg, color: 'hsl(var(--foreground))' }}>
      <div className="container mx-auto px-4 py-6 max-w-2xl flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{title}</h1>
          <button
            onClick={searchByInventory}
            disabled={matchLoading || items.length === 0}
            className="text-sm font-semibold px-4 py-2 rounded-full transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff' }}
          >
            {matchLoading ? '...' : searchLabel}
          </button>
        </div>

        {/* Add form */}
        <form onSubmit={addItem} className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-medium opacity-60 mb-1 block">Ingredient *</label>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder={addPlaceholder}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: cardBg, border: `1px solid ${border}` }}
            />
          </div>
          <div className="w-20">
            <label className="text-xs font-medium opacity-60 mb-1 block">Cantitate</label>
            <input
              type="number"
              step="any"
              value={newQty}
              onChange={e => setNewQty(e.target.value)}
              placeholder="1"
              className="w-full px-2 py-2 rounded-lg text-sm outline-none"
              style={{ background: cardBg, border: `1px solid ${border}` }}
            />
          </div>
          <div className="w-20">
            <label className="text-xs font-medium opacity-60 mb-1 block">Unitate</label>
            <select
              value={newUnit}
              onChange={e => setNewUnit(e.target.value)}
              className="w-full px-2 py-2 rounded-lg text-sm outline-none appearance-none"
              style={{ background: cardBg, border: `1px solid ${border}` }}
            >
              <option value="">—</option>
              <option value="g">g</option>
              <option value="kg">kg</option>
              <option value="ml">ml</option>
              <option value="l">l</option>
              <option value="buc">buc</option>
              <option value="linguri">linguri</option>
              <option value="lingurițe">lingurițe</option>
              <option value="căni">căni</option>
              <option value="felii">felii</option>
              <option value="pachete">pachete</option>
              <option value="sticle">sticle</option>
              <option value="conserve">conserve</option>
            </select>
          </div>
          <div className="w-[130px]">
            <label className="text-xs font-medium opacity-60 mb-1 block">Expiră (opțional)</label>
            <input
              type="date"
              value={newExpiry}
              onChange={e => setNewExpiry(e.target.value)}
              className="w-full px-2 py-2 rounded-lg text-sm outline-none"
              style={{ background: cardBg, border: `1px solid ${border}` }}
            />
          </div>
          <button
            type="submit"
            disabled={!newName.trim()}
            className="px-5 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff' }}
          >
            + Adaugă
          </button>
        </form>

        {/* Items list */}
        {loading ? (
          <div className="text-center py-8 opacity-50">Se încarcă...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 opacity-50">{emptyMsg}</div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map(item => {
              const expStatus = isExpiringSoon(item.expiration_date)
              const isEditing = editId === item.id
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                  style={{ background: cardBg, border: `1px solid ${border}` }}
                >
                  {/* Name + expiry */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.item_name}</div>
                    {item.expiration_date && (
                      <div className="text-[10px] mt-0.5" style={{
                        color: expStatus === 'expired' ? '#ef4444' : expStatus === 'soon' ? '#f59e0b' : '#666'
                      }}>
                        {expStatus === 'expired' ? '⚠️ Expirat' : expStatus === 'soon' ? '⏰ Expiră curând' : ''} {item.expiration_date}
                      </div>
                    )}
                  </div>

                  {/* Quantity controls */}
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={editQty}
                        onChange={e => setEditQty(e.target.value)}
                        className="w-14 px-1 py-1 rounded text-xs text-center"
                        style={{ background: cardBg, border: `1px solid ${border}` }}
                      />
                      <input
                        type="date"
                        value={editExpiry}
                        onChange={e => setEditExpiry(e.target.value)}
                        className="px-1 py-1 rounded text-xs"
                        style={{ background: cardBg, border: `1px solid ${border}` }}
                      />
                      <button onClick={() => updateItem(item.id)} className="text-xs px-2 py-1 rounded" style={{ background: '#22c55e', color: '#fff' }}>✓</button>
                      <button onClick={() => setEditId(null)} className="text-xs px-2 py-1 rounded" style={{ background: '#666', color: '#fff' }}>✕</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => adjustQty(item, -1)}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
                        style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${border}` }}
                      >
                        −
                      </button>
                      <span className="text-sm font-medium w-12 text-center">
                        {item.qty_numeric ?? item.quantity ?? '—'}{item.unit ? ` ${item.unit}` : ''}
                      </span>
                      <button
                        onClick={() => adjustQty(item, 1)}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
                        style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${border}` }}
                      >
                        +
                      </button>
                    </div>
                  )}

                  {/* Actions */}
                  <button
                    onClick={() => {
                      setEditId(item.id)
                      setEditQty(String(item.qty_numeric ?? item.quantity ?? ''))
                      setEditExpiry(item.expiration_date ?? '')
                    }}
                    className="text-xs opacity-40 hover:opacity-100"
                    title="Editează"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="text-xs opacity-40 hover:opacity-100"
                    title="Șterge"
                  >
                    🗑️
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Recipe/Cocktail matches */}
        {matches !== null && (
          <div className="flex flex-col gap-3 mt-4">
            <h2 className="text-lg font-bold">
              {isBar ? '🍸 Cocktailuri posibile' : '🍳 Rețete posibile'}
              <span className="text-sm font-normal opacity-50 ml-2">({matches.length} rezultate)</span>
            </h2>
            {matches.length === 0 ? (
              <div className="text-sm opacity-50 py-4">
                {isBar ? 'Adaugă mai multe băuturi în bar pentru sugestii.' : 'Adaugă mai multe ingrediente în cămară pentru sugestii.'}
              </div>
            ) : (
              matches.map(m => (
                <Link
                  key={m.id}
                  href={isBar ? `/cocktails/${m.slug}` : `/recipes/${m.slug}`}
                  className="flex items-center gap-3 px-3 py-3 rounded-lg transition-all hover:scale-[1.01]"
                  style={{ background: cardBg, border: `1px solid ${border}` }}
                >
                  {m.image_url && (
                    <FallbackImage src={m.image_url} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" fallbackEmoji="🍽️" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{m.title}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                        style={{
                          background: m.match_ratio >= 80 ? '#22c55e' : m.match_ratio >= 50 ? '#f59e0b' : '#ef4444',
                          color: '#fff'
                        }}
                      >
                        {m.match_ratio}% potrivire
                      </span>
                      {m.effective_missing > 0 && (
                        <span className="text-[10px] opacity-50">
                          lipsesc {m.effective_missing} ingrediente
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </main>
  )
}
