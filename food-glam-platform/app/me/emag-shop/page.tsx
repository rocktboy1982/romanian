'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { normalizeIngredientForSearch, isAlcoholicIngredient, getEmagSearchUrl as buildEmagUrl, getBauturiSearchUrl as buildBauturiUrl } from '@/lib/normalize-for-search'

/* ── Types ────────────────────────────────────────────────────────────────── */

interface ShopItem {
  id: string
  name: string
  totalQty: number
  unit: string
  category: string
  fromRecipes: string[]
  selected: boolean
  affiliateUrls: Record<string, string>
}

/* ── Vendors (only verified working searches) ─────────────────────────────── */

interface Vendor {
  id: string
  name: string
  shortName: string
  color: string
  icon: string
  searchUrl: (q: string) => string
}

const EMAG: Vendor = {
  id: 'emag',
  name: 'eMAG.ro',
  shortName: 'eMAG',
  color: '#f7c948',
  icon: '🛒',
  searchUrl: (q) => `https://www.emag.ro/search/${encodeURIComponent(q.replace(/\s+/g, '+'))}`,
}

const BAUTURI: Vendor = {
  id: 'bauturialcoolice',
  name: 'BauturiAlcoolice.ro',
  shortName: 'Băuturi',
  color: '#7b2d8e',
  icon: '🍷',
  searchUrl: (q) => `https://bauturialcoolice.ro/index.php?route=product/search&search=${encodeURIComponent(q)}`,
}

function isAlcoholic(item: ShopItem): boolean {
  const cat = item.category.toLowerCase()
  return cat.includes('spirtoase') || cat.includes('lichior') || cat.includes('alcool') ||
    isAlcoholicIngredient(item.name)
}

/* ── Constants & Normalization ────────────────────────────────────────────── */

const STORAGE_KEY = 'marechef_emag_shop_items'

const CATEGORY_ICONS: Record<string, string> = {
  'Lactate': '🥛', 'Carne': '🥩', 'Legume': '🥬', 'Fructe': '🍎',
  'Condimente': '🧂', 'Panificație': '🍞', 'Cereale': '🌾', 'Uleiuri': '🫒',
  'Conserve': '🥫', 'Ouă': '🥚', 'Pește': '🐟', 'Paste': '🍝',
  'Dulciuri': '🍫', 'Băuturi': '🥤', 'Spirtoase': '🍸', 'Lichioruri': '🍹',
  'Mixere': '🥤', 'Garnituri': '🍋', 'Gheață': '🧊', 'Băuturi alcoolice': '🍷',
  'Altele': '🛒',
}

// Normalization imported from @/lib/normalize-for-search

/* ── Component ────────────────────────────────────────────────────────────── */

export default function ShopPage() {
  const [items, setItems] = useState<ShopItem[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [affiliateLoading, setAffiliateLoading] = useState(false)

  const generateAffiliateLinks = useCallback(async (shopItems: ShopItem[]) => {
    if (shopItems.length === 0) return
    setAffiliateLoading(true)
    try {
      const allLinks: Array<{ name: string; url: string }> = []
      const linkMap: Array<{ itemIdx: number; vendorId: string }> = []

      shopItems.forEach((item, itemIdx) => {
        const query = normalizeIngredientForSearch(item.name)
        // Always generate eMAG link
        allLinks.push({ name: `emag:${query}`, url: EMAG.searchUrl(query) })
        linkMap.push({ itemIdx, vendorId: 'emag' })
        // Also generate BauturiAlcoolice link for alcohol items
        if (isAlcoholic(item)) {
          allLinks.push({ name: `bauturi:${query}`, url: BAUTURI.searchUrl(query) })
          linkMap.push({ itemIdx, vendorId: 'bauturialcoolice' })
        }
      })

      const batchSize = 50
      const allResults: Array<{ ps_url: string }> = []
      for (let i = 0; i < allLinks.length; i += batchSize) {
        const batch = allLinks.slice(i, i + batchSize)
        const res = await fetch('/api/profitshare/links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ links: batch }),
        })
        if (res.ok) {
          const data = await res.json()
          allResults.push(...(data.links || []))
        } else {
          allResults.push(...batch.map(() => ({ ps_url: '' })))
        }
      }

      setItems(prev => {
        const updated = prev.map(item => ({ ...item, affiliateUrls: { ...item.affiliateUrls } }))
        allResults.forEach((result, i) => {
          const mapping = linkMap[i]
          if (mapping && result.ps_url) {
            updated[mapping.itemIdx].affiliateUrls[mapping.vendorId] = result.ps_url
          }
        })
        return updated
      })
    } catch { /* silent */ }
    finally { setAffiliateLoading(false) }
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Array<{ id: string; name: string; totalQty: number; unit: string; category: string; fromRecipes: string[] }>
        const loaded = parsed.map(item => ({ ...item, selected: true, affiliateUrls: {} }))
        setItems(loaded)
        generateAffiliateLinks(loaded)
      }
    } catch { /* ignore */ }
    setHydrated(true)
  }, [generateAffiliateLinks])

  const grouped = useMemo(() => {
    const map: Record<string, ShopItem[]> = {}
    items.forEach(item => {
      const cat = item.category || 'Altele'
      if (!map[cat]) map[cat] = []
      map[cat].push(item)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [items])

  const selectedCount = items.filter(i => i.selected).length
  const totalCount = items.length

  const toggleItem = (id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item))
  }

  const toggleAll = () => {
    const allSelected = items.every(i => i.selected)
    setItems(prev => prev.map(item => ({ ...item, selected: !allSelected })))
  }

  const getItemUrl = (item: ShopItem, vendor: Vendor): string => {
    if (item.affiliateUrls[vendor.id]) return item.affiliateUrls[vendor.id]
    return vendor.searchUrl(normalizeIngredientForSearch(item.name))
  }

  const safeOpen = (url: string) => {
    try { const u = new URL(url); if (u.protocol === 'https:') window.open(u.href, '_blank', 'noopener,noreferrer') } catch { /* invalid */ }
  }

  const openItem = (item: ShopItem, vendor: Vendor) => {
    safeOpen(getItemUrl(item, vendor))
  }

  const openAllSelected = () => {
    const selected = items.filter(i => i.selected)
    if (selected.length === 0) return
    const batch = selected.slice(0, 10)
    batch.forEach((item, i) => {
      const vendor = isAlcoholic(item) ? BAUTURI : EMAG
      setTimeout(() => {
        safeOpen(getItemUrl(item, vendor))
      }, i * 300)
    })
    if (selected.length > 10) {
      const openedIds = new Set(batch.map(i => i.id))
      setItems(prev => prev.map(item => openedIds.has(item.id) ? { ...item, selected: false } : item))
    }
  }

  if (!hydrated) return null

  if (items.length === 0) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <Link href="/plan" className="text-sm text-muted-foreground hover:text-foreground transition-colors">&larr; Înapoi</Link>
        </div>
        <div className="text-center py-16">
          <p className="text-4xl mb-4">🛒</p>
          <h1 className="text-xl font-bold mb-2">Nicio listă de cumpărături</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Generează o listă din planificatorul de mese sau party planner.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/plan" className="px-5 py-2.5 rounded-xl bg-amber-500 text-white font-medium text-sm hover:bg-amber-600 transition-colors">Planificator mese</Link>
            <Link href="/cocktails/plan" className="px-5 py-2.5 rounded-xl bg-purple-500 text-white font-medium text-sm hover:bg-purple-600 transition-colors">Party planner</Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-6">
        <Link href="/plan" className="text-sm text-muted-foreground hover:text-foreground transition-colors">&larr; Înapoi</Link>
      </div>

      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold tracking-tight">Cumpără online</h1>
        <span className="text-xs text-muted-foreground px-3 py-1 rounded-full bg-muted">
          {selectedCount} / {totalCount}
        </span>
      </div>
      <p className="text-muted-foreground text-sm mb-5">
        Apasă pe butonul unui produs pentru a-l căuta în magazin. Băuturile alcoolice au și opțiunea BauturiAlcoolice.ro.
        {affiliateLoading && <span className="ml-2 text-amber-500 text-xs">Se pregătesc link-urile...</span>}
      </p>

      {/* Select all */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={toggleAll} className="text-xs font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 transition-colors">
          {items.every(i => i.selected) ? 'Deselectează tot' : 'Selectează tot'}
        </button>
      </div>

      {/* Items grouped by category */}
      <div className="space-y-4">
        {grouped.map(([category, categoryItems]) => (
          <div key={category} className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 border-b border-border">
              <span className="text-sm">{CATEGORY_ICONS[category] || '🛒'}</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{category}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">{categoryItems.length}</span>
            </div>
            <div className="divide-y divide-border">
              {categoryItems.map(item => {
                const alcohol = isAlcoholic(item)
                return (
                  <div key={item.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${item.selected ? '' : 'opacity-40'}`}>
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleItem(item.id)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        item.selected ? 'bg-amber-500 border-amber-500 text-white' : 'border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {item.selected && (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>

                    {/* Name and qty */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {item.totalQty % 1 === 0 ? item.totalQty : item.totalQty.toFixed(1)} {item.unit}
                        {item.fromRecipes.length > 0 && <span className="ml-1">· {item.fromRecipes.slice(0, 2).join(', ')}</span>}
                      </p>
                    </div>

                    {/* Vendor buttons */}
                    <div className="shrink-0 flex items-center gap-1.5">
                      {/* BauturiAlcoolice — only for alcohol */}
                      {alcohol && (
                        <button
                          onClick={() => openItem(item, BAUTURI)}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors hover:opacity-80"
                          style={{ backgroundColor: '#7b2d8e15', color: '#7b2d8e', border: '1px solid #7b2d8e30' }}
                          title="Caută pe BauturiAlcoolice.ro"
                        >
                          <span>🍷</span>
                          <span className="hidden sm:inline">Băuturi</span>
                        </button>
                      )}
                      {/* eMAG — always */}
                      <button
                        onClick={() => openItem(item, EMAG)}
                        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors hover:opacity-80"
                        style={{ backgroundColor: '#f7c94815', color: '#b8960a', border: '1px solid #f7c94830' }}
                        title="Caută pe eMAG.ro"
                      >
                        <span>🛒</span>
                        <span className="hidden sm:inline">eMAG</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="sticky bottom-0 left-0 right-0 mt-6 -mx-4 px-4 pb-4 pt-3 bg-gradient-to-t from-background via-background to-transparent">
        <button
          onClick={openAllSelected}
          disabled={selectedCount === 0}
          className={`w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-medium text-sm transition-all ${
            selectedCount > 0 ? 'bg-foreground/10 text-foreground border border-border hover:bg-foreground/15' : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
        >
          {selectedCount > 0
            ? `Deschide ${selectedCount} produse online`
            : 'Selectează produse'
          }
        </button>
        <p className="text-[10px] text-muted-foreground text-center mt-1.5">
          Alcool → BauturiAlcoolice.ro · Restul → eMAG.ro
        </p>
      </div>
    </main>
  )
}
