'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'

/* ── Types ────────────────────────────────────────────────────────────────── */

interface ShopItem {
  id: string
  name: string
  totalQty: number
  unit: string
  category: string
  fromRecipes: string[]
  selected: boolean
  affiliateUrls: Record<string, string>  // vendorId → profitshare tracked URL
}

/* ── Vendor Configuration ─────────────────────────────────────────────────── */
// Sorted by commission rate (highest first) per category

interface Vendor {
  id: string
  name: string
  color: string         // brand accent color
  icon: string          // emoji
  searchUrl: (q: string) => string
  commission: string
  bestFor: string[]     // categories this vendor is best for
}

const VENDORS: Vendor[] = [
  {
    id: 'bauturialcoolice',
    name: 'BauturiAlcoolice.ro',
    color: '#7b2d8e',
    icon: '🍷',
    searchUrl: (q) => `https://www.bauturialcoolice.ro/catalogsearch/result/?q=${encodeURIComponent(q)}`,
    commission: '8%',
    bestFor: ['Spirtoase', 'Lichioruri', 'Vin', 'Bere', 'Mixere', 'Băuturi alcoolice'],
  },
  {
    id: 'unicorn',
    name: 'Unicorn Naturals',
    color: '#6bb536',
    icon: '🦄',
    searchUrl: (q) => `https://unicorn-naturals.ro/?s=${encodeURIComponent(q)}`,
    commission: '10%',
    bestFor: ['Bio', 'Naturale', 'Miere', 'Siropuri'],
  },
  {
    id: 'scufita',
    name: 'Scufița Roșie',
    color: '#d44040',
    icon: '🧺',
    searchUrl: (q) => `https://scufita-rosie.ro/?s=${encodeURIComponent(q)}`,
    commission: '10%',
    bestFor: ['Condimente', 'Naturale', 'Ceaiuri'],
  },
  {
    id: 'vegis',
    name: 'Vegis.ro',
    color: '#3aa655',
    icon: '🌿',
    searchUrl: (q) => `https://vegis.ro/search?q=${encodeURIComponent(q)}`,
    commission: '8%',
    bestFor: ['Vegan', 'Bio', 'Sănătos', 'Fără gluten'],
  },
  {
    id: 'parmashop',
    name: 'ParmaShop.ro',
    color: '#c8860a',
    icon: '🇮🇹',
    searchUrl: (q) => `https://www.parmashop.ro/?q=${encodeURIComponent(q)}`,
    commission: '1-10%',
    bestFor: ['Paste', 'Ulei de măsline', 'Parmezan', 'Delicatese'],
  },
  {
    id: 'nosugar',
    name: 'NoSugarShop.ro',
    color: '#e85d75',
    icon: '🚫🍬',
    searchUrl: (q) => `https://www.nosugarshop.ro/?s=${encodeURIComponent(q)}`,
    commission: '3-10%',
    bestFor: ['Fără zahăr', 'Keto', 'Diabet'],
  },
  {
    id: 'emag',
    name: 'eMAG.ro',
    color: '#f7c948',
    icon: '🛒',
    searchUrl: (q) => `https://www.emag.ro/search/${encodeURIComponent(q.replace(/\s+/g, '+'))}`,
    commission: '1-5%',
    bestFor: ['Toate', 'General'],
  },
]

// Detect best vendor for an item based on category keywords
const ALCOHOL_KEYWORDS = ['vodka', 'vodcă', 'rom', 'rum', 'gin', 'whiskey', 'whisky', 'tequila', 'lichior', 'vin', 'bere', 'prosecco', 'champagne', 'șampanie', 'bitter', 'angostura', 'aperol', 'campari', 'vermouth', 'vermut', 'triple sec', 'cointreau', 'kahlua', 'baileys', 'amaretto', 'sambuca', 'grappa', 'țuică', 'pălincă', 'rachiu', 'absint', 'cognac', 'brandy', 'armagnac']

function isAlcoholic(name: string): boolean {
  const lower = name.toLowerCase()
  return ALCOHOL_KEYWORDS.some(kw => lower.includes(kw))
}

function getRecommendedVendors(item: ShopItem): Vendor[] {
  // Alcoholic items → Bauturi first, then eMAG
  if (isAlcoholic(item.name) || item.category === 'Spirtoase' || item.category === 'Lichioruri' || item.category === 'Băuturi alcoolice') {
    return VENDORS.filter(v => v.id === 'bauturialcoolice' || v.id === 'emag')
  }
  // All other items → all food vendors, sorted by commission (already sorted)
  return VENDORS.filter(v => v.id !== 'bauturialcoolice')
}

/* ── Constants ────────────────────────────────────────────────────────────── */

const STORAGE_KEY = 'marechef_emag_shop_items'

const CATEGORY_ICONS: Record<string, string> = {
  'Lactate': '🥛', 'Carne': '🥩', 'Legume': '🥬', 'Fructe': '🍎',
  'Condimente': '🧂', 'Panificație': '🍞', 'Cereale': '🌾', 'Uleiuri': '🫒',
  'Conserve': '🥫', 'Ouă': '🥚', 'Pește': '🐟', 'Paste': '🍝',
  'Dulciuri': '🍫', 'Băuturi': '🥤', 'Spirtoase': '🍸', 'Lichioruri': '🍹',
  'Mixere': '🥤', 'Garnituri': '🍋', 'Gheață': '🧊', 'Băuturi alcoolice': '🍷',
  'Altele': '🛒',
}

/* ── Normalization ────────────────────────────────────────────────────────── */

const STRIP_UNITS = new Set([
  'g', 'kg', 'ml', 'l', 'dl',
  'lingura', 'lingură', 'linguri',
  'lingurita', 'linguriță', 'lingurițe', 'lingurite',
  'cana', 'cană', 'cani', 'căni',
  'pahar', 'pahare', 'felie', 'felii',
  'bucata', 'bucată', 'bucati', 'bucăți',
  'legatura', 'legătură', 'legaturi',
  'catel', 'cățel', 'catei', 'căței',
  'fir', 'fire', 'varf', 'vârf', 'pumn', 'pumni',
  'pachet', 'pachete', 'cutie', 'cutii',
  'conserva', 'conservă', 'plic',
  'frunza', 'frunză', 'frunze', 'foaie', 'foi',
  'strop', 'praf', 'ramurica', 'rămurică',
  'crenguita', 'crenguță',
  'cup', 'cups', 'tbsp', 'tsp', 'tablespoon', 'teaspoon',
  'oz', 'ounce', 'lb', 'pound',
  'pinch', 'dash', 'bunch', 'clove', 'cloves',
  'slice', 'slices', 'piece', 'pieces', 'sprig', 'sprigs',
])

const STRIP_ADJECTIVES = /\b(proaspăt|proaspătă|proaspete|tocat|tocată|tocate|topit|topită|topite|tăiat|tăiată|tăiate|feliat|feliată|feliate|măcinat|măcinată|prăjit|prăjită|ras|rasă|fiert|fiartă|mărunt|fin|mare|mediu|mic|fresh|frozen|dried|chopped|diced|minced|sliced)\b/gi

function normalizeForSearch(raw: string): string {
  let s = raw.trim()
  s = s.replace(/^[\d\s\/.,½⅓⅔¼¾⅛-]+/, '').trim()
  const words = s.split(/\s+/)
  let startIdx = 0
  while (startIdx < words.length && STRIP_UNITS.has(words[startIdx].toLowerCase())) startIdx++
  if (startIdx > 0 && words[startIdx]?.toLowerCase() === 'de') startIdx++
  s = words.slice(startIdx).join(' ')
  s = s.replace(/\(.*?\)/g, '').replace(/,.*$/, '')
  s = s.replace(STRIP_ADJECTIVES, '')
  s = s.replace(/\s+/g, ' ').trim()
  return s || raw.trim()
}

const SMALL_UNITS = new Set([
  'lingurita', 'linguriță', 'lingurițe', 'lingurite',
  'lingura', 'lingură', 'linguri',
  'varf', 'vârf', 'pumn', 'pumni', 'strop', 'praf',
  'fir', 'fire', 'catel', 'cățel', 'catei', 'căței',
  'frunza', 'frunză', 'frunze', 'foaie', 'foi',
  'ramurica', 'rămurică', 'crenguita', 'crenguță',
  'buc', 'bucata', 'bucată', 'bucati', 'bucăți',
  'felie', 'felii', 'cana', 'cană', 'cani', 'căni',
  'pahar', 'pahare', 'pachet', 'pachete',
  'cutie', 'cutii', 'conserva', 'conservă', 'plic',
  'legatura', 'legătură', 'legaturi',
  'pinch', 'dash', 'sprig', 'sprigs', 'clove', 'cloves',
  'slice', 'slices', 'piece', 'pieces',
  'cup', 'cups', 'can', 'cans',
  'tsp', 'teaspoon', 'teaspoons',
  'tbsp', 'tablespoon', 'tablespoons',
])

const WEIGHT_UNITS = new Set(['g', 'kg', 'ml', 'l', 'dl', 'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds'])

function buildSearchQuery(itemName: string, totalQty: number, unit: string): string {
  const name = normalizeForSearch(itemName)
  const unitLower = unit.toLowerCase()
  if (WEIGHT_UNITS.has(unitLower) && totalQty > 0) {
    const qty = totalQty % 1 === 0 ? String(totalQty) : totalQty.toFixed(0)
    return `${qty}${unitLower} ${name}`
  }
  return name
}

function getCategoryIcon(category: string): string {
  return CATEGORY_ICONS[category] || '🛒'
}

/* ── Component ────────────────────────────────────────────────────────────── */

export default function ShopPage() {
  const [items, setItems] = useState<ShopItem[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [affiliateLoading, setAffiliateLoading] = useState(false)
  const [activeVendor, setActiveVendor] = useState<string>('emag')

  // Generate affiliate links for ALL vendors via Profitshare API
  const generateAffiliateLinks = useCallback(async (shopItems: ShopItem[]) => {
    if (shopItems.length === 0) return
    setAffiliateLoading(true)
    try {
      // Build links for ALL vendors
      const allLinks: Array<{ name: string; url: string }> = []
      const linkMap: Array<{ itemIdx: number; vendorId: string }> = []

      shopItems.forEach((item, itemIdx) => {
        const query = buildSearchQuery(item.name, item.totalQty, item.unit)
        const vendors = getRecommendedVendors(item)
        vendors.forEach(vendor => {
          allLinks.push({ name: `${vendor.id}:${query}`, url: vendor.searchUrl(query) })
          linkMap.push({ itemIdx, vendorId: vendor.id })
        })
      })

      // Batch call (max 50 per request)
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
          // Fill with empty for this batch
          allResults.push(...batch.map(() => ({ ps_url: '' })))
        }
      }

      // Map results back to items
      setItems(prev => {
        const updated = [...prev]
        allResults.forEach((result, i) => {
          const mapping = linkMap[i]
          if (mapping && result.ps_url) {
            if (!updated[mapping.itemIdx].affiliateUrls) {
              updated[mapping.itemIdx] = { ...updated[mapping.itemIdx], affiliateUrls: {} }
            }
            updated[mapping.itemIdx].affiliateUrls[mapping.vendorId] = result.ps_url
          }
        })
        return updated
      })
    } catch {
      // Silently fail — direct links as fallback
    } finally {
      setAffiliateLoading(false)
    }
  }, [])

  // Load items from localStorage
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

  // Group by category
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
  const currentVendor = VENDORS.find(v => v.id === activeVendor) || VENDORS[VENDORS.length - 1]

  const toggleItem = (id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item))
  }

  const toggleAll = () => {
    const allSelected = items.every(i => i.selected)
    setItems(prev => prev.map(item => ({ ...item, selected: !allSelected })))
  }

  const getItemUrl = (item: ShopItem, vendorId: string): string => {
    // Use affiliate URL if available, otherwise direct vendor search
    if (item.affiliateUrls[vendorId]) return item.affiliateUrls[vendorId]
    const vendor = VENDORS.find(v => v.id === vendorId)
    if (!vendor) return '#'
    return vendor.searchUrl(buildSearchQuery(item.name, item.totalQty, item.unit))
  }

  const getBestVendorForItem = (item: ShopItem): Vendor => {
    const recommended = getRecommendedVendors(item)
    return recommended[0] || currentVendor
  }

  const openSingleItem = (item: ShopItem, vendorId?: string) => {
    const vid = vendorId || getBestVendorForItem(item).id
    window.open(getItemUrl(item, vid), '_blank', 'noopener')
  }

  const openAllSelected = () => {
    const selected = items.filter(i => i.selected)
    if (selected.length === 0) return
    const batch = selected.slice(0, 10)
    batch.forEach((item, i) => {
      const vid = activeVendor === 'smart' ? getBestVendorForItem(item).id : activeVendor
      setTimeout(() => {
        window.open(getItemUrl(item, vid), '_blank', 'noopener')
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
          <Link href="/plan" className="text-sm text-muted-foreground hover:text-foreground transition-colors">&larr; Înapoi la planificator</Link>
        </div>
        <div className="text-center py-16">
          <p className="text-4xl mb-4">🛒</p>
          <h1 className="text-xl font-bold mb-2">Nicio listă de cumpărături</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Generează o listă de cumpărături din planificatorul de mese sau party planner.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/plan" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-white font-medium text-sm hover:bg-amber-600 transition-colors">
              Planificator mese
            </Link>
            <Link href="/cocktails/plan" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-500 text-white font-medium text-sm hover:bg-purple-600 transition-colors">
              Party planner
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/plan" className="text-sm text-muted-foreground hover:text-foreground transition-colors">&larr; Înapoi la planificator</Link>
      </div>

      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold tracking-tight">Cumpără online</h1>
        <span className="text-xs text-muted-foreground px-3 py-1 rounded-full bg-muted">
          {selectedCount} / {totalCount} selectate
        </span>
      </div>
      <p className="text-muted-foreground text-sm mb-4">
        Selectează produsele și magazinul preferat. Fiecare produs se deschide într-un tab nou.
        {affiliateLoading && <span className="ml-2 text-amber-500 text-xs">Se generează link-urile...</span>}
      </p>

      {/* Vendor selector */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-3 mb-4">
        {VENDORS.map(vendor => (
          <button
            key={vendor.id}
            onClick={() => setActiveVendor(vendor.id)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
              activeVendor === vendor.id
                ? 'border-current shadow-sm'
                : 'border-border opacity-60 hover:opacity-100'
            }`}
            style={activeVendor === vendor.id ? { color: vendor.color, borderColor: vendor.color, backgroundColor: `${vendor.color}10` } : {}}
          >
            <span>{vendor.icon}</span>
            <span className="whitespace-nowrap">{vendor.name}</span>
            <span className="text-[10px] opacity-60">{vendor.commission}</span>
          </button>
        ))}
      </div>

      {/* Select all / open all */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={toggleAll} className="text-xs font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 transition-colors">
          {items.every(i => i.selected) ? 'Deselectează tot' : 'Selectează tot'}
        </button>
        <button
          onClick={openAllSelected}
          disabled={selectedCount === 0}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
            selectedCount > 0
              ? 'text-white shadow-md hover:shadow-lg'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
          style={selectedCount > 0 ? { backgroundColor: currentVendor.color } : {}}
        >
          <span>{currentVendor.icon}</span>
          Deschide {selectedCount > 0 ? `${selectedCount} produse` : ''} pe {currentVendor.name}
        </button>
      </div>

      {/* Items grouped by category */}
      <div className="space-y-4">
        {grouped.map(([category, categoryItems]) => (
          <div key={category} className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 border-b border-border">
              <span className="text-sm">{getCategoryIcon(category)}</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{category}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">{categoryItems.length}</span>
            </div>
            <div className="divide-y divide-border">
              {categoryItems.map(item => {
                const bestVendor = getBestVendorForItem(item)
                const displayVendor = activeVendor === 'emag' ? bestVendor : currentVendor
                const query = buildSearchQuery(item.name, item.totalQty, item.unit)

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

                    {/* Name and details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {item.totalQty % 1 === 0 ? item.totalQty : item.totalQty.toFixed(1)} {item.unit}
                        {item.fromRecipes.length > 0 && <span className="ml-1">· {item.fromRecipes.slice(0, 2).join(', ')}</span>}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60">{query}</p>
                    </div>

                    {/* Vendor buttons — show best + eMAG fallback */}
                    <div className="shrink-0 flex items-center gap-1">
                      {/* Best vendor for this item */}
                      {bestVendor.id !== 'emag' && (
                        <button
                          onClick={() => openSingleItem(item, bestVendor.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors hover:opacity-80"
                          style={{ backgroundColor: `${bestVendor.color}20`, color: bestVendor.color }}
                          title={`${bestVendor.name} (${bestVendor.commission})`}
                        >
                          <span className="text-xs">{bestVendor.icon}</span>
                          <span className="hidden sm:inline">{bestVendor.name.split('.')[0]}</span>
                        </button>
                      )}
                      {/* Active vendor (if different) */}
                      <button
                        onClick={() => openSingleItem(item, displayVendor.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors hover:opacity-80"
                        style={{ backgroundColor: `${displayVendor.color}20`, color: displayVendor.color }}
                        title={`${displayVendor.name} (${displayVendor.commission})`}
                      >
                        <span className="text-xs">{displayVendor.icon}</span>
                        <span className="hidden sm:inline">{displayVendor.name.split('.')[0]}</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom sticky bar */}
      <div className="sticky bottom-0 left-0 right-0 mt-6 -mx-4 px-4 pb-4 pt-3 bg-gradient-to-t from-background via-background to-transparent">
        <button
          onClick={openAllSelected}
          disabled={selectedCount === 0}
          className={`w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-semibold text-sm transition-all ${
            selectedCount > 0 ? 'text-white shadow-lg hover:shadow-xl' : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
          style={selectedCount > 0 ? { backgroundColor: currentVendor.color } : {}}
        >
          <span>{currentVendor.icon}</span>
          {selectedCount > 0 ? `Deschide ${selectedCount} produse pe ${currentVendor.name}` : 'Selectează produse'}
        </button>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Se deschide câte un tab pentru fiecare produs · Link-uri afiliate Profitshare
        </p>
      </div>
    </main>
  )
}
