'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'

/* ── Types ────────────────────────────────────────────────────────────────── */

interface EmagShopItem {
  id: string
  name: string
  totalQty: number
  unit: string
  category: string
  fromRecipes: string[]
  selected: boolean
}

/* ── Affiliate Config ─────────────────────────────────────────────────────── */

// Profitshare affiliate code for eMAG program
// Set this after registering at https://profitshare.ro → apply for eMAG program
// Format: your unique affiliate code from Profitshare dashboard
const PROFITSHARE_AFF_CODE = process.env.NEXT_PUBLIC_PROFITSHARE_AFF_CODE || ''

function wrapAffiliateUrl(targetUrl: string): string {
  if (!PROFITSHARE_AFF_CODE) return targetUrl
  const unique = `marechef_${Date.now()}`
  return `https://event.2performant.com/events/click?ad_type=quicklink&aff_code=${PROFITSHARE_AFF_CODE}&unique=${unique}&redirect_to=${encodeURIComponent(targetUrl)}`
}

/* ── Constants ────────────────────────────────────────────────────────────── */

const STORAGE_KEY = 'marechef_emag_shop_items'

const CATEGORY_ICONS: Record<string, string> = {
  'Lactate': '🥛',
  'Carne': '🥩',
  'Legume': '🥬',
  'Fructe': '🍎',
  'Condimente': '🧂',
  'Panificație': '🍞',
  'Cereale': '🌾',
  'Uleiuri': '🫒',
  'Conserve': '🥫',
  'Ouă': '🥚',
  'Pește': '🐟',
  'Paste': '🍝',
  'Dulciuri': '🍫',
  'Băuturi': '🥤',
  'Altele': '🛒',
}

// Romanian units, cooking adjectives, and prepositions to strip from ingredient names
const STRIP_UNITS = new Set([
  'g', 'kg', 'ml', 'l', 'dl',
  'lingura', 'lingură', 'linguri',
  'lingurita', 'linguriță', 'lingurițe', 'lingurite',
  'cana', 'cană', 'cani', 'căni',
  'pahar', 'pahare',
  'felie', 'felii',
  'bucata', 'bucată', 'bucati', 'bucăți',
  'legatura', 'legătură', 'legaturi',
  'catel', 'cățel', 'catei', 'căței',
  'fir', 'fire',
  'varf', 'vârf',
  'pumn', 'pumni',
  'pachet', 'pachete',
  'cutie', 'cutii',
  'conserva', 'conservă',
  'plic',
  'frunza', 'frunză', 'frunze',
  'foaie', 'foi',
  'strop', 'praf',
  'ramurica', 'rămurică',
  'crenguita', 'crenguță',
  'cup', 'cups', 'tbsp', 'tsp', 'tablespoon', 'teaspoon',
  'oz', 'ounce', 'lb', 'pound',
  'pinch', 'dash', 'bunch', 'clove', 'cloves',
  'slice', 'slices', 'piece', 'pieces', 'sprig', 'sprigs',
])

const STRIP_ADJECTIVES = /\b(proaspăt|proaspătă|proaspete|tocat|tocată|tocate|topit|topită|topite|tăiat|tăiată|tăiate|feliat|feliată|feliate|măcinat|măcinată|prăjit|prăjită|ras|rasă|fiert|fiartă|mărunt|fin|mare|mediu|mic|fresh|frozen|dried|chopped|diced|minced|sliced)\b/gi

function normalizeForSearch(raw: string): string {
  let s = raw.trim()

  // Remove leading numbers, fractions, decimals
  s = s.replace(/^[\d\s\/.,½⅓⅔¼¾⅛-]+/, '').trim()

  // Remove known units at the start
  const words = s.split(/\s+/)
  let startIdx = 0
  while (startIdx < words.length && STRIP_UNITS.has(words[startIdx].toLowerCase())) {
    startIdx++
  }
  // Also skip "de" / "of" preposition after unit
  if (startIdx > 0 && words[startIdx]?.toLowerCase() === 'de') {
    startIdx++
  }
  s = words.slice(startIdx).join(' ')

  // Remove parenthetical notes and everything after comma
  s = s.replace(/\(.*?\)/g, '').replace(/,.*$/, '')

  // Remove cooking adjectives
  s = s.replace(STRIP_ADJECTIVES, '')

  // Remove "și" (and) at the end — e.g. "sare și piper" stays as-is, that's fine
  // Clean up extra whitespace
  s = s.replace(/\s+/g, ' ').trim()

  return s || raw.trim()  // fallback to original if we stripped everything
}

// Small units that should be stripped — searching "500g sare" is useful, "1 linguriță sare" is not
const SMALL_UNITS = new Set([
  'lingurita', 'linguriță', 'lingurițe', 'lingurite',
  'lingura', 'lingură', 'linguri',
  'varf', 'vârf',
  'pumn', 'pumni',
  'strop', 'praf',
  'fir', 'fire',
  'catel', 'cățel', 'catei', 'căței',
  'frunza', 'frunză', 'frunze',
  'foaie', 'foi',
  'ramurica', 'rămurică',
  'crenguita', 'crenguță',
  'pinch', 'dash', 'sprig', 'sprigs', 'clove', 'cloves',
  'tsp', 'teaspoon', 'teaspoons',
  'tbsp', 'tablespoon', 'tablespoons',
])

// Weight/volume units worth keeping — "500g făină" or "1kg orez" helps eMAG find the right pack size
const WEIGHT_UNITS = new Set([
  'g', 'kg', 'ml', 'l', 'dl',
  'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds',
])

function buildEmagQuery(itemName: string, totalQty: number, unit: string): string {
  const name = normalizeForSearch(itemName)

  // Decide if we include quantity + unit in the search
  const unitLower = unit.toLowerCase()

  if (WEIGHT_UNITS.has(unitLower) && totalQty > 0) {
    // Keep weight/volume: "500 g făină" → "500g faina"
    const qty = totalQty % 1 === 0 ? String(totalQty) : totalQty.toFixed(0)
    return `${qty}${unitLower} ${name}`
  }

  if (!SMALL_UNITS.has(unitLower) && totalQty >= 1 && unitLower) {
    // Keep meaningful quantities: "2 cani smantana", "3 pachete paste"
    // But skip fractions like "1/2 cană" — those are small
    const qty = totalQty % 1 === 0 ? String(totalQty) : totalQty.toFixed(0)
    return `${qty} ${unit} ${name}`
  }

  // Small units or no unit — just the ingredient name
  return name
}

function getEmagSearchUrl(itemName: string, totalQty: number = 0, unit: string = ''): string {
  const query = buildEmagQuery(itemName, totalQty, unit)
    .toLowerCase()
    .replace(/[()]/g, '')
    .trim()
    .replace(/\s+/g, '+')
  const directUrl = `https://www.emag.ro/search/${encodeURIComponent(query)}`
  return wrapAffiliateUrl(directUrl)
}

function getCategoryIcon(category: string): string {
  return CATEGORY_ICONS[category] || CATEGORY_ICONS['Altele']
}

/* ── Component ────────────────────────────────────────────────────────────── */

export default function EmagShopPage() {
  const [items, setItems] = useState<EmagShopItem[]>([])
  const [hydrated, setHydrated] = useState(false)

  // Load items from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Omit<EmagShopItem, 'selected'>[]
        setItems(parsed.map(item => ({ ...item, selected: true })))
      }
    } catch { /* ignore */ }
    setHydrated(true)
  }, [])

  // Group by category
  const grouped = useMemo(() => {
    const map: Record<string, EmagShopItem[]> = {}
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
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, selected: !item.selected } : item
    ))
  }

  const toggleAll = () => {
    const allSelected = items.every(i => i.selected)
    setItems(prev => prev.map(item => ({ ...item, selected: !allSelected })))
  }

  const openSingleItem = (item: EmagShopItem) => {
    window.open(getEmagSearchUrl(item.name, item.totalQty, item.unit), '_blank', 'noopener')
  }

  const openAllSelected = () => {
    const selected = items.filter(i => i.selected)
    if (selected.length === 0) return

    // Open max 10 tabs at once to avoid popup blocker
    const batch = selected.slice(0, 10)
    batch.forEach((item, i) => {
      setTimeout(() => {
        window.open(getEmagSearchUrl(item.name, item.totalQty, item.unit), '_blank', 'noopener')
      }, i * 300) // stagger by 300ms to avoid popup blocker
    })

    if (selected.length > 10) {
      alert(`S-au deschis primele 10 produse. Mai ai ${selected.length - 10} de deschis — apasă din nou.`)
      // Mark opened ones as deselected
      const openedIds = new Set(batch.map(i => i.id))
      setItems(prev => prev.map(item =>
        openedIds.has(item.id) ? { ...item, selected: false } : item
      ))
    }
  }

  if (!hydrated) return null

  if (items.length === 0) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <Link href="/plan" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            &larr; Înapoi la planificator
          </Link>
        </div>
        <div className="text-center py-16">
          <p className="text-4xl mb-4">🛒</p>
          <h1 className="text-xl font-bold mb-2">Nicio listă de cumpărături</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Generează o listă de cumpărături din planificatorul de mese, apoi apasă &quot;Cumpără pe eMAG&quot;.
          </p>
          <Link
            href="/plan"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-white font-medium text-sm hover:bg-amber-600 transition-colors"
          >
            Mergi la planificator
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/plan" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          &larr; Înapoi la planificator
        </Link>
      </div>

      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold tracking-tight">Cumpără pe eMAG</h1>
        <span className="text-xs text-muted-foreground px-3 py-1 rounded-full bg-muted">
          {selectedCount} / {totalCount} selectate
        </span>
      </div>
      <p className="text-muted-foreground text-sm mb-6">
        Selectează produsele pe care vrei să le cauți pe eMAG. Fiecare se deschide într-un tab nou.
      </p>

      {/* Select all / deselect all */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={toggleAll}
          className="text-xs font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
        >
          {items.every(i => i.selected) ? 'Deselectează tot' : 'Selectează tot'}
        </button>
        <button
          onClick={openAllSelected}
          disabled={selectedCount === 0}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
            selectedCount > 0
              ? 'bg-[#f7c948] text-black hover:bg-[#e6b93d] shadow-md hover:shadow-lg'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
        >
          <span>🛒</span>
          Deschide {selectedCount > 0 ? `${selectedCount} produse` : ''} pe eMAG
        </button>
      </div>

      {/* Items grouped by category */}
      <div className="space-y-4">
        {grouped.map(([category, categoryItems]) => (
          <div key={category} className="rounded-2xl border border-border bg-card overflow-hidden">
            {/* Category header */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 border-b border-border">
              <span className="text-sm">{getCategoryIcon(category)}</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{category}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">{categoryItems.length} produse</span>
            </div>

            {/* Items */}
            <div className="divide-y divide-border">
              {categoryItems.map(item => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                    item.selected ? 'bg-amber-50/50 dark:bg-amber-900/10' : 'opacity-50'
                  }`}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleItem(item.id)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      item.selected
                        ? 'bg-amber-500 border-amber-500 text-white'
                        : 'border-gray-300 dark:border-gray-600'
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
                      {item.fromRecipes.length > 0 && (
                        <span className="ml-1">· {item.fromRecipes.join(', ')}</span>
                      )}
                    </p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-400">
                      eMAG: &quot;{buildEmagQuery(item.name, item.totalQty, item.unit)}&quot;
                    </p>
                  </div>

                  {/* eMAG button */}
                  <button
                    onClick={() => openSingleItem(item)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#f7c948] text-black hover:bg-[#e6b93d] transition-colors"
                    title={`Caută "${normalizeForSearch(item.name)}" pe eMAG`}
                  >
                    <span className="text-[10px]">🔍</span>
                    eMAG
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom sticky bar */}
      <div className="sticky bottom-0 left-0 right-0 mt-6 -mx-4 px-4 pb-4 pt-3 bg-gradient-to-t from-background via-background to-transparent">
        <div className="flex items-center gap-3">
          <button
            onClick={openAllSelected}
            disabled={selectedCount === 0}
            className={`flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-semibold text-sm transition-all ${
              selectedCount > 0
                ? 'bg-[#f7c948] text-black hover:bg-[#e6b93d] shadow-lg hover:shadow-xl'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
          >
            <span>🛒</span>
            {selectedCount > 0
              ? `Deschide ${selectedCount} produse pe eMAG`
              : 'Selectează produse'
            }
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Se deschide câte un tab pe emag.ro pentru fiecare produs selectat
        </p>
      </div>
    </main>
  )
}
