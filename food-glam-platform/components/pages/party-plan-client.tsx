"use client"

import Image from 'next/image'
import React, { useState, useMemo, useCallback, useEffect } from "react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface CocktailData {
  id: string
  slug: string
  title: string
  hero_image_url: string | null
  // Flat fields returned by search API
  ingredients?: string[]
  serves?: number
  spirit?: string
  // Nested object (also returned by search API, and stored in DB)
  recipe_json: {
    ingredients?: string[]
    serves?: number
    spirit?: string
    category?: string
    difficulty?: string
  } | null
}

/** Read ingredients from whichever location has data (recipe_json or flat) */
function getIngredients(c: CocktailData): string[] {
  const list = c.recipe_json?.ingredients ?? c.ingredients ?? []
  return list.filter((s) => s && s.trim() !== '')
}

function getServes(c: CocktailData): number {
  return c.recipe_json?.serves ?? c.serves ?? 1
}

function getSpirit(c: CocktailData): string | undefined {
  return c.recipe_json?.spirit ?? c.spirit
}

interface PartyItem {
  id: string
  cocktail: CocktailData
  rounds: number
}

interface PartyPlanState {
  partyName: string
  guestCount: number
  cocktails: PartyItem[]
}

type View = 'planner' | 'shopping'

// ─── Ingredient aggregation ───────────────────────────────────────────────────

interface AggregatedIngredient {
  name: string
  amount: number
  unit: string
  category: string
  sources: string[]
}

function parseIngredient(ingredientStr: string): { amount: number; unit: string; name: string } {
  let str = ingredientStr.trim()

  // Strip Romanian range expressions: "2 până la 3 linii X" → "3 linii X" (take upper bound)
  const rangeMatch = str.match(/^\d+[.,]?\d*\s+până\s+la\s+(\d+[.,]?\d*)\s+(.+)$/)
  if (rangeMatch) {
    str = `${rangeMatch[1]} ${rangeMatch[2]}`
  }

  // Match leading amount: mixed fraction "1 1/2", simple fraction "1/2",
  // comma decimal "4,5", dot decimal "4.5", or plain integer "60"
  const amountMatch = str.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+[.,]\d+|\d+)/)
  if (!amountMatch) {
    return { amount: 1, unit: 'bucată', name: str }
  }

  const amountStr = amountMatch[0].trim()
  const rest = str.slice(amountMatch[0].length).trim()

  // Parse the numeric value
  let amount = 1
  if (amountStr.includes('/')) {
    if (amountStr.includes(' ')) {
      // Mixed fraction: "1 1/2"
      const spaceIdx = amountStr.lastIndexOf(' ')
      const whole = parseInt(amountStr.slice(0, spaceIdx), 10)
      const [num, den] = amountStr.slice(spaceIdx + 1).split('/').map(Number)
      amount = whole + num / den
    } else {
      // Simple fraction: "3/4"
      const [num, den] = amountStr.split('/').map(Number)
      amount = num / den
    }
  } else {
    // Handle comma decimal "4,5" → 4.5
    amount = parseFloat(amountStr.replace(',', '.')) || 1
  }

  // Parse unit and name from remainder
  // Common units: cl, ml, oz, linguri, lingurita, liniute, linii, cana, pahar, etc.
  const unitMatch = rest.match(/^([a-zA-ZăâîșțĂÂÎȘȚ]+\.?)\s+(.+)$/)
  if (unitMatch) {
    return { amount, unit: unitMatch[1], name: unitMatch[2].trim() }
  }

  // No unit recognised — treat as piece
  return { amount, unit: 'bucată', name: rest || str }
}

/**
 * Convert bar-specific measurement units to practical shopping units.
 * E.g. 60 linii (dashes) → 30 ml, 10 oz → 300 ml, etc.
 */
function normalizeToShoppingUnit(amount: number, unit: string): { amount: number; unit: string } {
  const u = unit.toLowerCase()

  // Dashes → picături (drops), convert to ml only when very large
  if (u === 'linii' || u === 'liniute' || u === 'liniuțe' || u === 'dash' || u === 'dashes') {
    if (amount > 50) return { amount: Math.ceil(amount * 0.5), unit: 'ml' }
    return { amount, unit: 'picături' }
  }

  // Shots → ml (1 shot ≈ 30 ml)
  if (u === 'shot' || u === 'shots' || u === 'lovituri') {
    return { amount: Math.round(amount * 30), unit: 'ml' }
  }

  // oz → ml (1 oz ≈ 30 ml)
  if (u === 'oz') {
    return { amount: Math.round(amount * 30), unit: 'ml' }
  }

  // cl → ml for consistency (1 cl = 10 ml), but only for large amounts
  if (u === 'cl' && amount >= 100) {
    return { amount: Math.round(amount / 100), unit: 'L' }
  }

  // linguri / lingurita stay as-is (practical units)
  return { amount, unit }
}

/** Format a numeric amount for display: no trailing .0, max 1 decimal */
function formatAmount(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(1).replace(/\.0$/, '')
}

function categorizeIngredient(name: string): string {
  const lower = name.toLowerCase()

  // Spirits — English + Romanian variants
  if ([
    'gin', 'vodka', 'vodcă', 'vodca', 'rum', 'whisky', 'whiskey', 'whiski',
    'tequila', 'brandy', 'cognac', 'mezcal', 'bourbon', 'scotch',
    'coniac', 'rachiu', 'țuică', 'tuica', 'palincă', 'palinca',
  ].some(s => lower.includes(s))) {
    return 'spirits'
  }

  // Liqueurs — English + Romanian variants
  if ([
    'campari', 'aperol', 'vermouth', 'vermut', 'amaretto', 'cointreau',
    'triple sec', 'chartreuse', 'maraschino', 'amaro', 'kahlua', 'baileys',
    'frangelico', 'chambord', 'benedictine', 'st. germain', 'elderflower',
    'licor', 'lichior', 'creme de', 'crème de', 'cremă de', 'lillet',
    'suze', 'aperitiv', 'bitter',
  ].some(l => lower.includes(l))) {
    return 'liqueurs'
  }

  // Mixers — English + Romanian
  if ([
    'soda', 'tonic', 'cola', 'ginger beer', 'ginger ale',
    'juice', 'suc de', 'suc ', 'sucul',
    'coconut', 'cream', 'lapte', 'milk',
    'egg white', 'albuș', 'albus',
    'club soda', 'sparkling water', 'apă gazoasă', 'apa gazoasa',
    'apă sodă', 'apa soda', 'sifon',
    'espresso', 'cafea', 'coffee',
    'ceai', 'tea', 'nectar',
  ].some(m => lower.includes(m))) {
    return 'mixers'
  }

  // Garnishes — English + Romanian
  if ([
    'lime', 'lemon', 'lămâie', 'lamaie', 'orange', 'portocal',
    'cherry', 'cireașă', 'cireasa', 'olive', 'măslină', 'maslina',
    'mint', 'mentă', 'menta', 'basil', 'busuioc',
    'rosemary', 'rozmarin', 'cucumber', 'castravete',
    'celery', 'țelină', 'telina', 'cinnamon', 'scorțișoară', 'scortisoara',
    'ananas', 'pineapple', 'grapefruit', 'mango', 'fructe',
  ].some(g => lower.includes(g))) {
    return 'garnishes'
  }

  // Syrups & Bitters
  if ([
    'simple syrup', 'sirop', 'sugar', 'zahăr', 'zahar',
    'honey', 'miere', 'grenadine', 'grenadină', 'grenadina',
    'angostura', 'peychauds', 'orange bitters', 'agave',
    'orgeat', 'falernum',
  ].some(s => lower.includes(s))) {
    return 'syrups'
  }

  return 'other'
}

function aggregateIngredients(cocktails: PartyItem[]): AggregatedIngredient[] {
  const accumulator: Record<string, AggregatedIngredient> = {}

  cocktails.forEach((item) => {
    const serves = getServes(item.cocktail)
    const ingredients = getIngredients(item.cocktail)
    const multiplier = item.rounds / serves // rounds / serves, multiply by guestCount later

    ingredients.forEach((ingredientStr) => {
      const { amount, unit, name } = parseIngredient(ingredientStr)
      const key = `${name.toLowerCase()}__${unit}`
      const category = categorizeIngredient(name)

      if (accumulator[key]) {
        accumulator[key].amount += amount * multiplier
        if (!accumulator[key].sources.includes(item.cocktail.title)) {
          accumulator[key].sources.push(item.cocktail.title)
        }
      } else {
        accumulator[key] = {
          name,
          amount: amount * multiplier,
          unit,
          category,
          sources: [item.cocktail.title],
        }
      }
    })
  })

  return Object.values(accumulator).sort((a, b) => {
    const categoryOrder = { spirits: 0, liqueurs: 1, mixers: 2, garnishes: 3, syrups: 4, other: 5 }
    const catA = categoryOrder[a.category as keyof typeof categoryOrder] ?? 5
    const catB = categoryOrder[b.category as keyof typeof categoryOrder] ?? 5
    if (catA !== catB) return catA - catB
    return a.name.localeCompare(b.name)
  })
}

function getCategoryEmoji(category: string): string {
  const emojis: Record<string, string> = {
    spirits: '🥃',
    liqueurs: '🍊',
    mixers: '🧊',
    garnishes: '🍋',
    syrups: '🍯',
    other: '📦',
  }
  return emojis[category] || '📦'
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    spirits: 'Spirtoase',
    liqueurs: 'Lichioruri',
    mixers: 'Mixere',
    garnishes: 'Garnituri',
    syrups: 'Siropuri & Bitters',
    other: 'Altele',
  }
  return labels[category] || 'Altele'
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PartyPlanClient() {
  const [state, setState] = useState<PartyPlanState>({
    partyName: 'Petrecerea mea',
    guestCount: 10,
    cocktails: [],
  })

  const [view, setView] = useState<View>('planner')
  const [shopGrouping, setShopGrouping] = useState<'ingredients' | 'cocktail'>('ingredients')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CocktailData[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  // Load from localStorage on mount, then re-hydrate any cocktails missing recipe_json
  useEffect(() => {
    async function loadAndHydrate() {
      try {
        const saved = localStorage.getItem('party-plan-state')
        if (!saved) return

        const parsed: PartyPlanState = JSON.parse(saved)

        // Detect cocktails that are missing ingredients (saved before API fix)
        const stale = parsed.cocktails.filter(
          (item) => getIngredients(item.cocktail).length === 0
        )

        if (stale.length === 0) {
          setState(parsed)
          return
        }

        // Re-fetch full data for stale cocktails by their slugs
        const hydrated = await Promise.all(
          parsed.cocktails.map(async (item) => {
            if (getIngredients(item.cocktail).length > 0) return item
            try {
              const res = await fetch(
                `/api/search/cocktails?q=${encodeURIComponent(item.cocktail.slug)}&per_page=5`
              )
              const data = await res.json()
              const fresh = (data.cocktails || []).find(
                (c: CocktailData) => c.slug === item.cocktail.slug || c.id === item.cocktail.id
              )
              if (fresh) return { ...item, cocktail: fresh }
            } catch { /* keep stale on error */ }
            return item
          })
        )

        setState({ ...parsed, cocktails: hydrated })
      } catch (e) {
        console.error('Failed to load party plan state:', e)
      }
    }
    loadAndHydrate()
  }, [])

  // Save to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem('party-plan-state', JSON.stringify(state))
  }, [state])

  // Search cocktails
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setSearchLoading(true)
    try {
      const res = await fetch(`/api/search/cocktails?q=${encodeURIComponent(query)}&per_page=12`)
      const data = await res.json()
      setSearchResults(data.cocktails || [])
    } catch (e) {
      console.error('Search error:', e)
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }, [])

  // Add cocktail to party
  const addCocktail = useCallback((cocktail: CocktailData) => {
    setState((prev) => {
      const exists = prev.cocktails.some((item) => item.cocktail.id === cocktail.id)
      if (exists) return prev

      return {
        ...prev,
        cocktails: [
          ...prev.cocktails,
          {
            id: `${cocktail.id}-${Date.now()}`,
            cocktail,
            rounds: 2,
          },
        ],
      }
    })
  }, [])

  // Remove cocktail from party
  const removeCocktail = useCallback((itemId: string) => {
    setState((prev) => ({
      ...prev,
      cocktails: prev.cocktails.filter((item) => item.id !== itemId),
    }))
  }, [])

  // Update rounds
  const updateRounds = useCallback((itemId: string, rounds: number) => {
    setState((prev) => ({
      ...prev,
      cocktails: prev.cocktails.map((item) =>
        item.id === itemId ? { ...item, rounds: Math.max(1, rounds) } : item
      ),
    }))
  }, [])

  // Clear plan
  const clearPlan = useCallback(() => {
    if (confirm('Ești sigur că vrei să golești planul?')) {
      setState({
        partyName: 'Petrecerea mea',
        guestCount: 10,
        cocktails: [],
      })
      setSearchQuery('')
      setSearchResults([])
    }
  }, [])

  // Aggregate ingredients
  const aggregatedIngredients = useMemo(
    () => aggregateIngredients(state.cocktails),
    [state.cocktails]
  )

  // Group by category
  const ingredientsByCategory = useMemo(() => {
    const grouped: Record<string, AggregatedIngredient[]> = {}
    aggregatedIngredients.forEach((ing) => {
      if (!grouped[ing.category]) {
        grouped[ing.category] = []
      }
      grouped[ing.category].push(ing)
    })
    return grouped
  }, [aggregatedIngredients])

  // Copy shopping list to clipboard
  const copyShoppingList = useCallback(() => {
    const lines: string[] = [
      `🎉 ${state.partyName}`,
      `👥 ${state.guestCount} oaspeți`,
      `🍹 ${state.cocktails.length} cocktail-uri`,
      '',
    ]

    Object.entries(ingredientsByCategory).forEach(([category, items]) => {
      lines.push(`${getCategoryEmoji(category)} ${getCategoryLabel(category)}`)
      items.forEach((ing) => {
        const raw = ing.amount * state.guestCount
        const norm = normalizeToShoppingUnit(raw, ing.unit)
        lines.push(`  • ${formatAmount(norm.amount)} ${norm.unit} ${ing.name}`)
      })
      lines.push('')
    })

    const text = lines.join('\n')
    navigator.clipboard.writeText(text).then(() => {
      alert('Lista de cumpărături a fost copiată!')
    })
  }, [state, ingredientsByCategory])

  // Share shopping list
  const shareShoppingList = useCallback(() => {
    const lines: string[] = [
      `🎉 ${state.partyName}`,
      `👥 ${state.guestCount} oaspeți`,
      `🍹 ${state.cocktails.length} cocktail-uri`,
      '',
    ]

    Object.entries(ingredientsByCategory).forEach(([category, items]) => {
      lines.push(`${getCategoryEmoji(category)} ${getCategoryLabel(category)}`)
      items.forEach((ing) => {
        const raw = ing.amount * state.guestCount
        const norm = normalizeToShoppingUnit(raw, ing.unit)
        lines.push(`  • ${formatAmount(norm.amount)} ${norm.unit} ${ing.name}`)
      })
      lines.push('')
    })

    const text = lines.join('\n')

    if (navigator.share) {
      navigator.share({
        title: `${state.partyName} - Lista de cumpărături`,
        text,
      }).catch(() => {})
    } else {
      copyShoppingList()
    }
  }, [state, ingredientsByCategory, copyShoppingList])

  // Print shopping list
  const printShoppingList = useCallback(() => {
    let html = `<!DOCTYPE html><html><head><title>${state.partyName} - Listă de cumpărături</title><style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 780px; margin: 0 auto; padding: 32px 40px; color: #111; font-size: 16px; line-height: 1.5; }
      h1 { font-size: 26px; font-weight: 800; margin-bottom: 6px; }
      .meta { font-size: 15px; color: #555; margin-bottom: 28px; border-bottom: 2px solid #111; padding-bottom: 14px; }
      h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #888; border-bottom: 1px solid #e0e0e0; padding-bottom: 6px; margin: 24px 0 10px 0; }
      .cocktails-header { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #888; border-bottom: 1px solid #e0e0e0; padding-bottom: 6px; margin: 32px 0 10px 0; }
      ul { list-style: none; padding: 0; margin: 0; }
      li.item { display: flex; align-items: flex-start; gap: 12px; padding: 7px 0; border-bottom: 1px solid #f2f2f2; }
      .check { width: 18px; height: 18px; border: 2px solid #bbb; border-radius: 4px; flex-shrink: 0; margin-top: 2px; }
      .name { font-weight: 600; font-size: 16px; }
      .qty { color: #7c3aed; font-weight: 700; font-size: 15px; float: right; }
      .cocktail-item { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f5f5f5; font-size: 14px; }
      .cocktail-rounds { color: #888; font-size: 13px; }
      @media print {
        body { padding: 0; font-size: 13pt; }
        @page { size: A4; margin: 1.8cm 2cm; }
        h1 { font-size: 22pt; }
        .meta { font-size: 12pt; }
        h2 { font-size: 9pt; }
        .name { font-size: 13pt; }
        .qty { font-size: 12pt; }
        li.item { break-inside: avoid; }
      }
    </style></head><body>`

    html += `<h1>🎉 ${state.partyName}</h1>`
    html += `<p class="meta">👥 ${state.guestCount} oaspeți · 🍹 ${state.cocktails.length} cocktail-uri · ${shopGrouping === 'ingredients' ? 'După ingrediente' : 'După cocktail'}</p>`

    if (shopGrouping === 'ingredients') {
      // Aggregated by ingredient category
      Object.entries(ingredientsByCategory).forEach(([category, items]) => {
        html += `<h2>${getCategoryEmoji(category)} ${getCategoryLabel(category)}</h2><ul>`
        items.forEach((ing) => {
          const raw = ing.amount * state.guestCount
          const norm = normalizeToShoppingUnit(raw, ing.unit)
          html += `<li class="item"><div class="check"></div><div class="name">${ing.name}</div><div class="qty">${formatAmount(norm.amount)} ${norm.unit}</div></li>`
        })
        html += `</ul>`
      })
    } else {
      // Grouped by cocktail — each cocktail with its scaled ingredients
      state.cocktails.forEach((item) => {
        const serves = getServes(item.cocktail)
        const multiplier = (item.rounds * state.guestCount) / serves
        const totalServings = Math.ceil(item.rounds * state.guestCount / serves)
        html += `<h2>🍹 ${item.cocktail.title} <span style="font-weight:400;font-size:10px;text-transform:none;letter-spacing:0">${item.rounds} runde · ~${totalServings} porții</span></h2><ul>`
        const ingredients = getIngredients(item.cocktail)
        ingredients.forEach((ingStr) => {
          const parsed = parseIngredient(ingStr)
          const scaledAmount = parsed.amount * multiplier
          const norm = normalizeToShoppingUnit(scaledAmount, parsed.unit)
          html += `<li class="item"><div class="check"></div><div class="name">${parsed.name}</div><div class="qty">${formatAmount(norm.amount)} ${norm.unit}</div></li>`
        })
        html += `</ul>`
      })
    }

    html += `</body></html>`

    const printWin = window.open('', '_blank', 'width=700,height=900')
    if (printWin) {
      printWin.document.write(html)
      printWin.document.close()
      printWin.focus()
      printWin.print()
    }
  }, [state, ingredientsByCategory, shopGrouping])

  return (
    <main
      className="min-h-screen"
      style={{ background: '#dde3ee', color: '#111', fontFamily: "'Inter', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@400;500;600&display=swap');
        .ff { font-family: 'Syne', sans-serif; }
      `}</style>

      {/* ── HEADER ── */}
      <div className="px-6 md:px-8 py-8 max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="ff text-4xl md:text-5xl font-bold mb-2" style={{ color: '#111' }}>
            🎉 Planificator de Petrecere
          </h1>
          <p style={{ color: '#555' }} className="text-base">
            Adaugă cocktail-uri și generează lista de cumpărături
          </p>
        </div>

        {/* Event details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Party name */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#666' }}>
              Nume eveniment
            </label>
            <input
              type="text"
              value={state.partyName}
              onChange={(e) => setState({ ...state, partyName: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border"
              style={{ background: '#fff', borderColor: 'rgba(0,0,0,0.08)', color: '#111' }}
            />
          </div>

          {/* Guest count */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#666' }}>
              Număr de oaspeți
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setState({ ...state, guestCount: Math.max(1, state.guestCount - 1) })}
                className="w-10 h-10 rounded-lg flex items-center justify-center font-bold transition-colors"
                style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', color: '#7c3aed' }}
              >
                −
              </button>
              <input
                type="number"
                value={state.guestCount}
                onChange={(e) => setState({ ...state, guestCount: Math.max(1, parseInt(e.target.value) || 1) })}
                className="flex-1 px-4 py-2.5 rounded-xl border text-center"
                style={{ background: '#fff', borderColor: 'rgba(0,0,0,0.08)', color: '#111' }}
              />
              <button
                onClick={() => setState({ ...state, guestCount: state.guestCount + 1 })}
                className="w-10 h-10 rounded-lg flex items-center justify-center font-bold transition-colors"
                style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', color: '#7c3aed' }}
              >
                +
              </button>
            </div>
          </div>

          {/* View toggle */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#666' }}>
              Vizualizare
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setView('planner')}
                className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                style={{
                  background: view === 'planner' ? '#7c3aed' : '#fff',
                  color: view === 'planner' ? '#fff' : '#111',
                  border: `1px solid ${view === 'planner' ? '#7c3aed' : 'rgba(0,0,0,0.08)'}`,
                }}
              >
                🍹 Cocktail-uri
              </button>
              <button
                onClick={() => setView('shopping')}
                className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                style={{
                  background: view === 'shopping' ? '#7c3aed' : '#fff',
                  color: view === 'shopping' ? '#fff' : '#111',
                  border: `1px solid ${view === 'shopping' ? '#7c3aed' : 'rgba(0,0,0,0.08)'}`,
                }}
              >
                📋 Listă
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="px-6 md:px-8 pb-12 max-w-6xl mx-auto">
        {view === 'planner' ? (
          // ── PLANNER VIEW ──
          <div className="space-y-6">
            {/* Search */}
            <div>
              <input
                type="text"
                placeholder="Caută cocktail-uri..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border text-base"
                style={{ background: '#fff', borderColor: 'rgba(0,0,0,0.08)', color: '#111' }}
              />
            </div>

            {/* Search results */}
            {searchQuery && (
              <div>
                <p className="text-sm font-semibold mb-3" style={{ color: '#666' }}>
                  {searchLoading ? 'Se caută...' : `${searchResults.length} rezultate`}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {searchResults.map((cocktail) => (
                    <button
                      key={cocktail.id}
                      onClick={() => addCocktail(cocktail)}
                      className="group rounded-xl overflow-hidden transition-all hover:shadow-lg"
                      style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)' }}
                    >
                      <div className="relative w-full" style={{ height: '120px' }}>
                        {cocktail.hero_image_url ? (
                          <Image
                            src={cocktail.hero_image_url}
                            alt={cocktail.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform"
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl" style={{ background: '#f0f0f0' }}>
                            🍹
                          </div>
                        )}
                      </div>
                      <div className="p-2.5">
                        <p className="text-xs font-semibold line-clamp-2" style={{ color: '#111' }}>
                          {cocktail.title}
                        </p>
                        {getSpirit(cocktail) && (
                          <p className="text-[10px] mt-1" style={{ color: '#888' }}>
                            {getSpirit(cocktail)}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Selected cocktails */}
            {state.cocktails.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold" style={{ color: '#666' }}>
                    {state.cocktails.length} cocktail-uri · {state.cocktails.reduce((sum, item) => sum + item.rounds, 0)} runde
                  </p>
                  <button
                    onClick={clearPlan}
                    className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)' }}
                  >
                    Golește planul
                  </button>
                </div>

                <div className="space-y-3">
                  {state.cocktails.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 p-4 rounded-xl"
                      style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)' }}
                    >
                      {/* Image */}
                      <div className="relative flex-shrink-0" style={{ width: '80px', height: '80px' }}>
                        {item.cocktail.hero_image_url ? (
                          <Image
                            src={item.cocktail.hero_image_url}
                            alt={item.cocktail.title}
                            fill
                            className="object-cover rounded-lg"
                            sizes="80px"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl rounded-lg" style={{ background: '#f0f0f0' }}>
                            🍹
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm mb-1" style={{ color: '#111' }}>
                          {item.cocktail.title}
                        </h3>
                        {getSpirit(item.cocktail) && (
                          <p className="text-xs mb-2" style={{ color: '#888' }}>
                            {getSpirit(item.cocktail)}
                          </p>
                        )}
                        <p className="text-xs" style={{ color: '#666' }}>
                          {item.rounds} runde · {Math.round((item.rounds * state.guestCount) / getServes(item.cocktail))} porții
                        </p>
                      </div>

                      {/* Rounds control */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateRounds(item.id, item.rounds - 1)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold transition-colors"
                          style={{ background: '#f0f0f0', color: '#7c3aed' }}
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-semibold text-sm" style={{ color: '#111' }}>
                          {item.rounds}
                        </span>
                        <button
                          onClick={() => updateRounds(item.id, item.rounds + 1)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold transition-colors"
                          style={{ background: '#f0f0f0', color: '#7c3aed' }}
                        >
                          +
                        </button>
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() => removeCocktail(item.id)}
                        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold transition-colors"
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {state.cocktails.length === 0 && !searchQuery && (
              <div className="text-center py-12">
                <p style={{ color: '#888' }} className="text-base">
                  Caută și adaugă cocktail-uri pentru a începe
                </p>
              </div>
            )}
          </div>
        ) : (
          // ── SHOPPING LIST VIEW ──
          <div className="space-y-6">
            {/* Header */}
            <div className="p-6 rounded-xl" style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)' }}>
              <h2 className="ff text-2xl font-bold mb-2" style={{ color: '#111' }}>
                {state.partyName}
              </h2>
              <p className="text-sm mb-4" style={{ color: '#666' }}>
                👥 {state.guestCount} oaspeți · 🍹 {state.cocktails.length} cocktail-uri
              </p>
              <div className="flex gap-2">
                <button
                  onClick={printShoppingList}
                  className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all"
                  style={{ background: '#111', color: '#fff' }}
                >
                  🖨️ Printează
                </button>
                <button
                  onClick={shareShoppingList}
                  className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all"
                  style={{ background: '#a78bfa', color: '#fff' }}
                >
                  📤 Partajează
                </button>
              </div>
            </div>

            {/* Grouping toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setShopGrouping('ingredients')}
                className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                style={{
                  background: shopGrouping === 'ingredients' ? '#111' : '#fff',
                  color: shopGrouping === 'ingredients' ? '#fff' : '#555',
                  border: `1px solid ${shopGrouping === 'ingredients' ? '#111' : 'rgba(0,0,0,0.08)'}`,
                }}
              >
                📦 După ingrediente
              </button>
              <button
                onClick={() => setShopGrouping('cocktail')}
                className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                style={{
                  background: shopGrouping === 'cocktail' ? '#111' : '#fff',
                  color: shopGrouping === 'cocktail' ? '#fff' : '#555',
                  border: `1px solid ${shopGrouping === 'cocktail' ? '#111' : 'rgba(0,0,0,0.08)'}`,
                }}
              >
                🍹 După cocktail
              </button>
            </div>

            {/* Shopping list */}
            {state.cocktails.length === 0 ? (
              <div className="text-center py-12">
                <p style={{ color: '#888' }} className="text-base">
                  Adaugă cocktail-uri pentru a genera lista de cumpărături
                </p>
              </div>
            ) : shopGrouping === 'ingredients' ? (
              /* ── Grouped by ingredient category ── */
              <div className="space-y-6">
                {Object.entries(ingredientsByCategory).map(([category, items]) => (
                  <div key={category} className="p-6 rounded-xl" style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)' }}>
                    <h3 className="font-semibold text-base mb-4 flex items-center gap-2" style={{ color: '#111' }}>
                      <span>{getCategoryEmoji(category)}</span>
                      {getCategoryLabel(category)}
                    </h3>
                    <ul className="space-y-2">
                      {items.map((ing, idx) => {
                        const raw = ing.amount * state.guestCount
                        const norm = normalizeToShoppingUnit(raw, ing.unit)
                        return (
                          <li key={idx} className="flex items-center justify-between text-sm">
                            <span style={{ color: '#333' }}>
                              {ing.name}
                            </span>
                            <span className="font-semibold" style={{ color: '#7c3aed' }}>
                              {formatAmount(norm.amount)} {norm.unit}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              /* ── Grouped by cocktail ── */
              <div className="space-y-6">
                {state.cocktails.map((item) => {
                  const serves = getServes(item.cocktail)
                  const multiplier = (item.rounds * state.guestCount) / serves
                  const totalServings = Math.ceil(item.rounds * state.guestCount / serves)
                  const ingredients = getIngredients(item.cocktail)
                  return (
                    <div key={item.id} className="p-6 rounded-xl" style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)' }}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-base flex items-center gap-2" style={{ color: '#111' }}>
                          🍹 {item.cocktail.title}
                        </h3>
                        <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed' }}>
                          {item.rounds} runde · ~{totalServings} porții
                        </span>
                      </div>
                      {ingredients.length > 0 ? (
                        <ul className="space-y-2">
                          {ingredients.map((ingStr, idx) => {
                            const parsed = parseIngredient(ingStr)
                            const scaledAmount = parsed.amount * multiplier
                            const norm = normalizeToShoppingUnit(scaledAmount, parsed.unit)
                            return (
                              <li key={idx} className="flex items-center justify-between text-sm">
                                <span style={{ color: '#333' }}>{parsed.name}</span>
                                <span className="font-semibold" style={{ color: '#7c3aed' }}>
                                  {formatAmount(norm.amount)} {norm.unit}
                                </span>
                              </li>
                            )
                          })}
                        </ul>
                      ) : (
                        <p className="text-sm italic" style={{ color: '#888' }}>Nu sunt ingrediente listate.</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
