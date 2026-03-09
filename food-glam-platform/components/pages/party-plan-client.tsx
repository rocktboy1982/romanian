"use client"

import Image from 'next/image'
import React, { useState, useMemo, useCallback, useEffect } from "react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface CocktailData {
  id: string
  slug: string
  title: string
  hero_image_url: string | null
  recipe_json: {
    ingredients?: string[]
    serves?: number
    spirit?: string
    category?: string
    difficulty?: string
  } | null
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
  // Parse strings like "60 ml Gin", "30 ml Fresh lemon juice", "1 Lime wedge"
  const match = ingredientStr.match(/^([\d.]+)\s*([a-zA-Z\s]*?)\s+(.+)$/)
  if (match) {
    const amount = parseFloat(match[1]) || 1
    const unit = match[2].trim() || 'piece'
    const name = match[3].trim()
    return { amount, unit, name }
  }
  return { amount: 1, unit: 'piece', name: ingredientStr }
}

function categorizeIngredient(name: string): string {
  const lower = name.toLowerCase()

  // Spirits
  if (['gin', 'vodka', 'rum', 'whisky', 'tequila', 'brandy', 'cognac', 'mezcal'].some(s => lower.includes(s))) {
    return 'spirits'
  }

  // Liqueurs
  if (['campari', 'aperol', 'vermouth', 'amaretto', 'cointreau', 'triple sec', 'chartreuse', 'maraschino', 'amaro', 'kahlua', 'baileys', 'frangelico', 'chambord', 'benedictine', 'st. germain', 'elderflower'].some(l => lower.includes(l))) {
    return 'liqueurs'
  }

  // Mixers
  if (['soda', 'tonic', 'cola', 'ginger beer', 'ginger ale', 'juice', 'lemon juice', 'lime juice', 'orange juice', 'cranberry', 'pineapple', 'coconut', 'cream', 'milk', 'egg white', 'club soda', 'sparkling water'].some(m => lower.includes(m))) {
    return 'mixers'
  }

  // Garnishes
  if (['lime', 'lemon', 'orange', 'cherry', 'olive', 'mint', 'basil', 'rosemary', 'cucumber', 'celery', 'pineapple', 'cinnamon'].some(g => lower.includes(g))) {
    return 'garnishes'
  }

  // Syrups & Bitters
  if (['simple syrup', 'sugar', 'honey', 'grenadine', 'angostura', 'peychauds', 'orange bitters'].some(s => lower.includes(s))) {
    return 'syrups'
  }

  return 'other'
}

function aggregateIngredients(cocktails: PartyItem[]): AggregatedIngredient[] {
  const accumulator: Record<string, AggregatedIngredient> = {}

  cocktails.forEach((item) => {
    const serves = item.cocktail.recipe_json?.serves || 1
    const ingredients = item.cocktail.recipe_json?.ingredients || []
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
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CocktailData[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('party-plan-state')
      if (saved) {
        setState(JSON.parse(saved))
      }
    } catch (e) {
      console.error('Failed to load party plan state:', e)
    }
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
        const amount = (ing.amount * state.guestCount).toFixed(1)
        lines.push(`  • ${amount} ${ing.unit} ${ing.name}`)
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
        const amount = (ing.amount * state.guestCount).toFixed(1)
        lines.push(`  • ${amount} ${ing.unit} ${ing.name}`)
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
    html += `<p class="meta">👥 ${state.guestCount} oaspeți · 🍹 ${state.cocktails.length} cocktail-uri</p>`

    // Shopping list by category
    Object.entries(ingredientsByCategory).forEach(([category, items]) => {
      html += `<h2>${getCategoryEmoji(category)} ${getCategoryLabel(category)}</h2><ul>`
      items.forEach((ing) => {
        const amount = (ing.amount * state.guestCount)
        const formatted = amount % 1 === 0 ? String(amount) : amount.toFixed(1)
        html += `<li class="item"><div class="check"></div><div class="name">${ing.name}</div><div class="qty">${formatted} ${ing.unit}</div></li>`
      })
      html += `</ul>`
    })

    // Cocktails list
    html += `<p class="cocktails-header">COCKTAIL-URI SELECTATE</p><ul>`
    state.cocktails.forEach((item) => {
      const serves = item.cocktail.recipe_json?.serves || 1
      const totalServings = item.rounds * state.guestCount / serves
      html += `<li class="cocktail-item"><span>${item.cocktail.title}</span><span class="cocktail-rounds">${item.rounds} runde · ~${Math.ceil(totalServings)} porții</span></li>`
    })
    html += `</ul>`

    html += `</body></html>`

    const printWin = window.open('', '_blank', 'width=700,height=900')
    if (printWin) {
      printWin.document.write(html)
      printWin.document.close()
      printWin.focus()
      printWin.print()
    }
  }, [state, ingredientsByCategory])

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
                        {cocktail.recipe_json?.spirit && (
                          <p className="text-[10px] mt-1" style={{ color: '#888' }}>
                            {cocktail.recipe_json.spirit}
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
                        {item.cocktail.recipe_json?.spirit && (
                          <p className="text-xs mb-2" style={{ color: '#888' }}>
                            {item.cocktail.recipe_json.spirit}
                          </p>
                        )}
                        <p className="text-xs" style={{ color: '#666' }}>
                          {item.rounds} runde · {Math.round((item.rounds * state.guestCount) / (item.cocktail.recipe_json?.serves || 1))} porții
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
                  onClick={copyShoppingList}
                  className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all"
                  style={{ background: '#7c3aed', color: '#fff' }}
                >
                  📋 Copiază
                </button>
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

            {/* Shopping list by category */}
            {state.cocktails.length === 0 ? (
              <div className="text-center py-12">
                <p style={{ color: '#888' }} className="text-base">
                  Adaugă cocktail-uri pentru a genera lista de cumpărături
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(ingredientsByCategory).map(([category, items]) => (
                  <div key={category} className="p-6 rounded-xl" style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)' }}>
                    <h3 className="font-semibold text-base mb-4 flex items-center gap-2" style={{ color: '#111' }}>
                      <span>{getCategoryEmoji(category)}</span>
                      {getCategoryLabel(category)}
                    </h3>
                    <ul className="space-y-2">
                      {items.map((ing, idx) => {
                        const totalAmount = (ing.amount * state.guestCount).toFixed(1)
                        return (
                          <li key={idx} className="flex items-center justify-between text-sm">
                            <span style={{ color: '#333' }}>
                              {ing.name}
                            </span>
                            <span className="font-semibold" style={{ color: '#7c3aed' }}>
                              {totalAmount} {ing.unit}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
