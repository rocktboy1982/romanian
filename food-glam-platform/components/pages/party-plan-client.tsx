"use client"

import FallbackImage from '@/components/FallbackImage'
import React, { useState, useMemo, useCallback, useEffect } from "react"
import { isAlcoholicIngredient } from '@/lib/normalize-for-search'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

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
    let parsedUnit = unitMatch[1]
    let parsedAmount = amount
    const parsedName = translateIngredientName(unitMatch[2].trim())

    // Normalize all volume units to ml for consistent aggregation
    const u = parsedUnit.toLowerCase()
    if (u === 'cl') { parsedAmount = amount * 10; parsedUnit = 'ml' }
    else if (u === 'dl') { parsedAmount = amount * 100; parsedUnit = 'ml' }
    else if (u === 'l') { parsedAmount = amount * 1000; parsedUnit = 'ml' }
    else if (u === 'oz') { parsedAmount = amount * 30; parsedUnit = 'ml' }

    return { amount: parsedAmount, unit: parsedUnit, name: parsedName }
  }

  // No unit recognised — treat as piece
  return { amount, unit: 'bucată', name: translateIngredientName(rest || str) }
}

/**
 * Translate common English ingredient names and known bad Romanian translations
 * into correct bar Romanian.
 */
function translateIngredientName(name: string): string {
  const n = name.trim()
  const lower = n.toLowerCase()

  // Common direct mappings (case-insensitive key → Romanian value)
  const MAP: Record<string, string> = {
    // Dairy
    'cream': 'frișcă lichidă',
    'crema': 'frișcă lichidă',
    'heavy cream': 'frișcă lichidă',
    'light cream': 'frișcă ușoară',
    'half and half': 'jumătate frișcă, jumătate lapte',
    'jumătate și jumătate': 'jumătate frișcă, jumătate lapte',
    'whipped cream': 'frișcă bătută',
    // Fruits / garnish
    'lemon': 'lămâie',
    'lime': 'limetă',
    // Herbs — wrong machine translation
    'monetărie': 'mentă',  // "mint" was translated as a coin-mint
    // Sweet & sour
    'dulce și acru': 'mix dulce-acru',
    'dulce-acru': 'mix dulce-acru',
    'sweet and sour': 'mix dulce-acru',
    'sweet & sour': 'mix dulce-acru',
    // Spirits - English names
    'light rum': 'rom ușor',
    'dark rum': 'rom negru',
    'aged rum': 'rom îmbătrânit',
    'spiced rum': 'rom condimentat',
    'blended whisky': 'whisky blended',
    'scotch': 'scotch whisky',
    'bourbon': 'bourbon',
    'rye whisky': 'whisky rye',
    // Mixers
    'club soda': 'apă sodă',
    'soda water': 'apă sodă',
    'tonic water': 'apă tonică',
    'ginger beer': 'bere de ghimbir',
    'ginger ale': 'ginger ale',
    'cranberry juice': 'suc de afine roșii',
    'orange juice': 'suc de portocale',
    'pineapple juice': 'suc de ananas',
    'lemon juice': 'suc de lămâie',
    'lime juice': 'suc de limetă',
    'grapefruit juice': 'suc de grapefruit',
    'tomato juice': 'suc de roșii',
    // Liqueurs — brand normalization
    'amaro muntenegru': 'Amaro Montenegro',
    'crema de cacao': 'Cremă de Cacao',
    'creme de cacao': 'Cremă de Cacao',
    'crème de cacao': 'Cremă de Cacao',
    'creme de menthe': 'Cremă de Mentă',
    'crème de menthe': 'Cremă de Mentă',
    // Bitters
    'angostura bitters': 'Angostura Bitters',
    'orange bitters': 'bitters de portocale',
    // Other bar staples
    'simple syrup': 'sirop de zahăr',
    'sugar syrup': 'sirop de zahăr',
    'grenadine': 'grenadină',
    'triple sec': 'Triple Sec',
    'egg white': 'albuș de ou',
    'egg yolk': 'gălbenuș de ou',
    'whole egg': 'ou întreg',
    'coconut cream': 'cremă de cocos',
    'coconut milk': 'lapte de cocos',
  }

  // Exact match (case-insensitive)
  if (MAP[lower]) return MAP[lower]

  // Partial substitutions for compound names (e.g. "Cream" at end of phrase)
  let result = n
  result = result.replace(/\bcream\b/gi, 'frișcă lichidă')
  result = result.replace(/\blemon\b/gi, 'lămâie')
  result = result.replace(/\blime\b/gi, 'limetă')
  result = result.replace(/\bmonetărie\b/gi, 'mentă')
  result = result.replace(/\blight rum\b/gi, 'rom ușor')
  result = result.replace(/\bdark rum\b/gi, 'rom negru')
  result = result.replace(/[Dd]ulce[\s-]și[\s-]acru/g, 'mix dulce-acru')
  result = result.replace(/[Cc]reme de [Cc]acao/g, 'Cremă de Cacao')
  result = result.replace(/[Cc]rème de [Cc]acao/g, 'Cremă de Cacao')
  result = result.replace(/[Cc]reme de [Mm]enthe/g, 'Cremă de Mentă')
  result = result.replace(/[Aa]maro [Mm]untenegru/g, 'Amaro Montenegro')
  // "a cincea" / "al cincilea" = a fifth (750ml bottle)
  result = result.replace(/^a\s+cincea\s+/i, 'sticlă (750ml) ')
  result = result.replace(/^al\s+cincilea\s+/i, 'sticlă (750ml) ')

  return result
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

  // Jigger → ml (1 jigger = 44 ml)
  if (u === 'jigger' || u === 'jiggers') {
    return { amount: Math.round(amount * 44), unit: 'ml' }
  }

  // Shots → ml (1 shot ≈ 30 ml)
  if (u === 'shot' || u === 'shots' || u === 'lovituri' || u === 'lovitură') {
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
      const rawKey = `${name.toLowerCase()}__${unit}`
      // Guard against prototype pollution via crafted ingredient names
      const UNSAFE_KEYS = ['__proto__', 'constructor', 'prototype']
      if (UNSAFE_KEYS.includes(rawKey.split('__')[0])) return
      const key = rawKey
      const category = categorizeIngredient(name)

      if (Object.prototype.hasOwnProperty.call(accumulator, key)) {
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
  const [shopGrouping, setShopGrouping] = useState<'foodgroups' | 'product' | 'cocktail'>('foodgroups')
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

    if (shopGrouping === 'foodgroups') {
      Object.entries(ingredientsByCategory).forEach(([category, items]) => {
        lines.push(`${getCategoryEmoji(category)} ${getCategoryLabel(category)}`)
        items.forEach((ing) => {
          const raw = ing.amount * state.guestCount
          const norm = normalizeToShoppingUnit(raw, ing.unit)
          lines.push(`  • ${formatAmount(norm.amount)} ${norm.unit} ${ing.name}`)
        })
        lines.push('')
      })
    } else if (shopGrouping === 'product') {
      lines.push('🏷️ Toate produsele')
      aggregatedIngredients
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'ro'))
        .forEach((ing) => {
          const raw = ing.amount * state.guestCount
          const norm = normalizeToShoppingUnit(raw, ing.unit)
          lines.push(`  • ${formatAmount(norm.amount)} ${norm.unit} ${ing.name}`)
        })
      lines.push('')
    } else {
      // cocktail mode
      state.cocktails.forEach((item) => {
        const serves = getServes(item.cocktail)
        const multiplier = (item.rounds * state.guestCount) / serves
        const totalServings = Math.ceil(item.rounds * state.guestCount / serves)
        lines.push(`🍹 ${item.cocktail.title} (${item.rounds} runde · ~${totalServings} porții)`)
        const ingredients = getIngredients(item.cocktail)
        ingredients.forEach((ingStr) => {
          const parsed = parseIngredient(ingStr)
          const scaledAmount = parsed.amount * multiplier
          const norm = normalizeToShoppingUnit(scaledAmount, parsed.unit)
          lines.push(`  • ${formatAmount(norm.amount)} ${norm.unit} ${parsed.name}`)
        })
        lines.push('')
      })
    }

    const text = lines.join('\n')
    navigator.clipboard.writeText(text).then(() => {
      alert('Lista de cumpărături a fost copiată!')
    })
  }, [state, ingredientsByCategory, aggregatedIngredients, shopGrouping])

  // Share shopping list
  const shareShoppingList = useCallback(() => {
    const lines: string[] = [
      `🎉 ${state.partyName}`,
      `👥 ${state.guestCount} oaspeți`,
      `🍹 ${state.cocktails.length} cocktail-uri`,
      '',
    ]

    if (shopGrouping === 'foodgroups') {
      Object.entries(ingredientsByCategory).forEach(([category, items]) => {
        lines.push(`${getCategoryEmoji(category)} ${getCategoryLabel(category)}`)
        items.forEach((ing) => {
          const raw = ing.amount * state.guestCount
          const norm = normalizeToShoppingUnit(raw, ing.unit)
          lines.push(`  • ${formatAmount(norm.amount)} ${norm.unit} ${ing.name}`)
        })
        lines.push('')
      })
    } else if (shopGrouping === 'product') {
      lines.push('🏷️ Toate produsele')
      aggregatedIngredients
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'ro'))
        .forEach((ing) => {
          const raw = ing.amount * state.guestCount
          const norm = normalizeToShoppingUnit(raw, ing.unit)
          lines.push(`  • ${formatAmount(norm.amount)} ${norm.unit} ${ing.name}`)
        })
      lines.push('')
    } else {
      // cocktail mode
      state.cocktails.forEach((item) => {
        const serves = getServes(item.cocktail)
        const multiplier = (item.rounds * state.guestCount) / serves
        const totalServings = Math.ceil(item.rounds * state.guestCount / serves)
        lines.push(`🍹 ${item.cocktail.title} (${item.rounds} runde · ~${totalServings} porții)`)
        const ingredients = getIngredients(item.cocktail)
        ingredients.forEach((ingStr) => {
          const parsed = parseIngredient(ingStr)
          const scaledAmount = parsed.amount * multiplier
          const norm = normalizeToShoppingUnit(scaledAmount, parsed.unit)
          lines.push(`  • ${formatAmount(norm.amount)} ${norm.unit} ${parsed.name}`)
        })
        lines.push('')
      })
    }

    const text = lines.join('\n')

    if (navigator.share) {
      navigator.share({
        title: `${state.partyName} - Lista de cumpărături`,
        text,
      }).catch(() => {})
    } else {
      copyShoppingList()
    }
  }, [state, ingredientsByCategory, aggregatedIngredients, shopGrouping, copyShoppingList])

  // Print shopping list
  const printShoppingList = useCallback(() => {
    let html = `<!DOCTYPE html><html><head><title>${escapeHtml(state.partyName)} - Listă de cumpărături</title><style>
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
      .qty { color: #8B1A2B; font-weight: 700; font-size: 15px; float: right; }
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

    html += `<h1>🎉 ${escapeHtml(state.partyName)}</h1>`
    const modeLabel = shopGrouping === 'foodgroups' 
      ? 'Grupe de alimente' 
      : shopGrouping === 'product' 
        ? 'Pe produs' 
        : 'Pe rețete'
    html += `<p class="meta">👥 ${state.guestCount} oaspeți · 🍹 ${state.cocktails.length} cocktail-uri · ${modeLabel}</p>`

    if (shopGrouping === 'foodgroups') {
      // Aggregated by ingredient category
      Object.entries(ingredientsByCategory).forEach(([category, items]) => {
        html += `<h2>${getCategoryEmoji(category)} ${getCategoryLabel(category)}</h2><ul>`
        items.forEach((ing) => {
          const raw = ing.amount * state.guestCount
          const norm = normalizeToShoppingUnit(raw, ing.unit)
          html += `<li class="item"><div class="check"></div><div class="name">${escapeHtml(ing.name)}</div><div class="qty">${escapeHtml(formatAmount(norm.amount))} ${escapeHtml(norm.unit)}</div></li>`
        })
        html += `</ul>`
      })
    } else if (shopGrouping === 'product') {
      // Flat alphabetical list of all ingredients
      html += `<h2>🏷️ Toate produsele</h2><ul>`
      aggregatedIngredients
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'ro'))
        .forEach((ing) => {
          const raw = ing.amount * state.guestCount
          const norm = normalizeToShoppingUnit(raw, ing.unit)
          html += `<li class="item"><div class="check"></div><div class="name">${escapeHtml(ing.name)} <span style="color:#999;font-size:12px">(${escapeHtml(getCategoryLabel(ing.category))})</span></div><div class="qty">${escapeHtml(formatAmount(norm.amount))} ${escapeHtml(norm.unit)}</div></li>`
        })
      html += `</ul>`
    } else {
      // Grouped by cocktail — each cocktail with its scaled ingredients
      state.cocktails.forEach((item) => {
        const serves = getServes(item.cocktail)
        const multiplier = (item.rounds * state.guestCount) / serves
        const totalServings = Math.ceil(item.rounds * state.guestCount / serves)
        html += `<h2>🍹 ${escapeHtml(item.cocktail.title)} <span style="font-weight:400;font-size:10px;text-transform:none;letter-spacing:0">${item.rounds} runde · ~${totalServings} porții</span></h2><ul>`
        const ingredients = getIngredients(item.cocktail)
        ingredients.forEach((ingStr) => {
          const parsed = parseIngredient(ingStr)
          const scaledAmount = parsed.amount * multiplier
          const norm = normalizeToShoppingUnit(scaledAmount, parsed.unit)
          html += `<li class="item"><div class="check"></div><div class="name">${escapeHtml(parsed.name)}</div><div class="qty">${escapeHtml(formatAmount(norm.amount))} ${escapeHtml(norm.unit)}</div></li>`
        })
        html += `</ul>`
      })
    }

    html += `</body></html>`

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const blobUrl = URL.createObjectURL(blob)
    const printWin = window.open(blobUrl, '_blank', 'width=700,height=900')
    if (printWin) {
      printWin.addEventListener('load', () => { printWin.focus(); printWin.print(); URL.revokeObjectURL(blobUrl) })
    } else {
      URL.revokeObjectURL(blobUrl)
    }
  }, [state, ingredientsByCategory, aggregatedIngredients, shopGrouping])

  return (
    <main
      className="min-h-screen"
      style={{ background: 'hsl(var(--background))', color: 'hsl(var(--foreground))', fontFamily: "'Inter', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@400;500;600&display=swap');
        .ff { font-family: 'Syne', sans-serif; }
      `}</style>

      {/* ── HEADER ── */}
      <div className="px-6 md:px-8 py-8 max-w-6xl mx-auto">
        <div className="mb-8">
            <h1 className="ff text-4xl md:text-5xl font-bold mb-2 text-[#1a1a1a]">
              🎉 Planificator de Petrecere
            </h1>
            <p className="text-base text-gray-500">
              Adaugă cocktail-uri și generează lista de cumpărături
            </p>
        </div>

         {/* Event details */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
           {/* Party name */}
           <div>
              <label className="block text-xs font-semibold mb-2 text-gray-600">
                Nume eveniment
              </label>
              <input
                type="text"
                value={state.partyName}
                onChange={(e) => setState({ ...state, partyName: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border bg-white border-gray-200 text-[#1a1a1a]"
              />
           </div>

           {/* Guest count */}
           <div>
              <label className="block text-xs font-semibold mb-2 text-gray-600">
                Număr de oaspeți
              </label>
               <div className="flex items-center gap-2">
                 <button
                   onClick={() => setState({ ...state, guestCount: Math.max(1, state.guestCount - 1) })}
                   className="w-10 h-10 rounded-lg flex items-center justify-center font-bold transition-colors bg-white border border-gray-200 text-[#8B1A2B]"
                >
                  −
                </button>
                <input
                  type="number"
                  value={state.guestCount}
                  onChange={(e) => setState({ ...state, guestCount: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="flex-1 px-4 py-2.5 rounded-xl border text-center bg-white border-gray-200 text-[#1a1a1a]"
                />
                 <button
                  onClick={() => setState({ ...state, guestCount: state.guestCount + 1 })}
                  className="w-10 h-10 rounded-lg flex items-center justify-center font-bold transition-colors bg-white border border-gray-200 text-[#8B1A2B]"
                >
                  +
                </button>
              </div>
           </div>

           {/* View toggle */}
           <div>
              <label className="block text-xs font-semibold mb-2 text-gray-600">
                Vizualizare
              </label>
               <div className="flex gap-2">
                 <button
                   onClick={() => setView('planner')}
                   className={`flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                     view === 'planner'
                       ? 'bg-[#8B1A2B] text-white border border-[#8B1A2B]'
                       : 'bg-white text-[#1a1a1a] border border-gray-200'
                   }`}
                 >
                   🍹 Cocktail-uri
                 </button>
                 <button
                   onClick={() => setView('shopping')}
                   className={`flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                     view === 'shopping'
                       ? 'bg-[#8B1A2B] text-white border border-[#8B1A2B]'
                       : 'bg-white text-[#1a1a1a] border border-gray-200'
                   }`}
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
                  className="w-full px-4 py-3 rounded-xl border text-base bg-white border-gray-200 text-[#1a1a1a]"
                />
             </div>

             {/* Search results */}
             {searchQuery && (
               <div>
                  <p className="text-sm font-semibold mb-3 text-gray-600">
                    {searchLoading ? 'Se caută...' : `${searchResults.length} rezultate`}
                  </p>
                 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                   {searchResults.map((cocktail) => (
                      <button
                        key={cocktail.id}
                        onClick={() => addCocktail(cocktail)}
                        className="group rounded-xl overflow-hidden transition-all hover:shadow-lg bg-white border border-gray-200"
                      >
                        <div className="relative w-full" style={{ height: '120px' }}>
                          <FallbackImage
                            src={cocktail.hero_image_url || ''}
                            alt={cocktail.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform"
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            fallbackEmoji="🍹"
                          />
                        </div>
                        <div className="p-2.5">
                          <p className="text-xs font-semibold line-clamp-2 text-[#1a1a1a]">
                            {cocktail.title}
                          </p>
                          {getSpirit(cocktail) && (
                            <p className="text-[10px] mt-1 text-gray-400">
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
                    <p className="text-sm font-semibold text-gray-600">
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
                        className="flex items-center gap-4 p-4 rounded-xl bg-white border border-gray-200"
                      >
                        {/* Image */}
                        <div className="relative flex-shrink-0" style={{ width: '80px', height: '80px' }}>
                          <FallbackImage
                            src={item.cocktail.hero_image_url || ''}
                            alt={item.cocktail.title}
                            fill
                            className="object-cover rounded-lg"
                            sizes="80px"
                            fallbackEmoji="🍹"
                          />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm mb-1 text-[#1a1a1a]">
                            {item.cocktail.title}
                          </h3>
                          {getSpirit(item.cocktail) && (
                            <p className="text-xs mb-2 text-gray-400">
                              {getSpirit(item.cocktail)}
                            </p>
                          )}
                          <p className="text-xs text-gray-600">
                            {item.rounds} runde · {Math.round((item.rounds * state.guestCount) / getServes(item.cocktail))} porții
                          </p>
                        </div>

                        {/* Rounds control */}
                        <div className="flex items-center gap-2">
                           <button
                             onClick={() => updateRounds(item.id, item.rounds - 1)}
                             className="w-8 h-8 rounded-lg flex items-center justify-center font-bold transition-colors bg-gray-100 text-[#8B1A2B]"
                          >
                            −
                          </button>
                          <span className="w-8 text-center font-semibold text-sm text-[#1a1a1a]">
                            {item.rounds}
                          </span>
                           <button
                             onClick={() => updateRounds(item.id, item.rounds + 1)}
                             className="w-8 h-8 rounded-lg flex items-center justify-center font-bold transition-colors bg-gray-100 text-[#8B1A2B]"
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
                  <p className="text-base text-gray-400">
                    Caută și adaugă cocktail-uri pentru a începe
                  </p>
                </div>
              )}
          </div>
        ) : (
          // ── SHOPPING LIST VIEW ──
          <div className="space-y-6">
             {/* Header */}
              <div className="p-6 rounded-xl bg-white border border-gray-200">
                <h2 className="ff text-2xl font-bold mb-2 text-[#1a1a1a]">
                  {state.partyName}
                </h2>
                <p className="text-sm mb-4 text-gray-600">
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
                   style={{ background: '#b8394e', color: '#fff' }}
                 >
                   📤 Partajează
                 </button>
               </div>
               {/* Buy online buttons — opens one tab per product */}
               {(() => {
                 const allItems = aggregatedIngredients.map(ing => ({
                   name: ing.name,
                   isAlcohol: isAlcoholicIngredient(ing.name),
                 }))
                 const foodItems = allItems.filter(i => !i.isAlcohol)
                 const alcoholItems = allItems.filter(i => i.isAlcohol)

                 const openEmagTabs = () => {
                   const items = foodItems.length > 0 ? foodItems : allItems
                   items.forEach((item, i) => {
                     setTimeout(() => {
                       window.open(`https://www.emag.ro/search/${encodeURIComponent(item.name)}`, '_blank')
                     }, i * 300)
                   })
                 }

                 const openBauturiTabs = () => {
                   alcoholItems.forEach((item, i) => {
                     setTimeout(() => {
                       window.open(`https://www.bauturialcoolice.ro/index.php?route=product/search&search=${encodeURIComponent(item.name)}`, '_blank')
                     }, i * 300)
                   })
                 }

                 return (
                   <div className="flex gap-2">
                     <button
                       onClick={openEmagTabs}
                       className="flex-1 px-4 py-3 rounded-lg font-semibold text-sm text-center transition-all"
                       style={{ background: 'linear-gradient(135deg,#f59e0b,#ea580c)', color: '#fff' }}
                     >
                       🛒 Cumpără de pe eMAG ({(foodItems.length > 0 ? foodItems : allItems).length} produse)
                     </button>
                     {alcoholItems.length > 0 && (
                       <button
                         onClick={openBauturiTabs}
                         className="flex-1 px-4 py-3 rounded-lg font-semibold text-sm text-center transition-all"
                         style={{ background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', color: '#fff' }}
                       >
                         🍷 BauturiAlcoolice ({alcoholItems.length} produse)
                       </button>
                     )}
                   </div>
                 )
               })()}
             </div>

               {/* Grouping toggle */}
               <div className="flex gap-2">
                 <button
                   onClick={() => setShopGrouping('foodgroups')}
                   className={`flex-1 px-3 py-2.5 rounded-xl font-semibold text-xs transition-all ${
                     shopGrouping === 'foodgroups'
                       ? 'bg-[#111] text-white border border-[#111]'
                       : 'bg-white text-gray-500 border border-gray-200'
                   }`}
                 >
                   📦 Grupe
                 </button>
                 <button
                   onClick={() => setShopGrouping('product')}
                   className={`flex-1 px-3 py-2.5 rounded-xl font-semibold text-xs transition-all ${
                     shopGrouping === 'product'
                       ? 'bg-[#111] text-white border border-[#111]'
                       : 'bg-white text-gray-500 border border-gray-200'
                   }`}
                 >
                   🏷️ Produse
                 </button>
                 <button
                   onClick={() => setShopGrouping('cocktail')}
                   className={`flex-1 px-3 py-2.5 rounded-xl font-semibold text-xs transition-all ${
                     shopGrouping === 'cocktail'
                       ? 'bg-[#111] text-white border border-[#111]'
                       : 'bg-white text-gray-500 border border-gray-200'
                   }`}
                 >
                   🍹 Rețete
                 </button>
               </div>

              {/* Shopping list */}
               {state.cocktails.length === 0 ? (
                 <div className="text-center py-12">
                   <p className="text-base text-gray-400">
                     Adaugă cocktail-uri pentru a genera lista de cumpărături
                   </p>
                 </div>
               ) : shopGrouping === 'foodgroups' ? (
                 /* ── Grouped by ingredient category ── */
                 <div className="space-y-6">
                   {Object.entries(ingredientsByCategory).map(([category, items]) => (
                     <div key={category} className="p-6 rounded-xl bg-white border border-gray-200">
                       <h3 className="font-semibold text-base mb-4 flex items-center gap-2 text-[#1a1a1a]">
                         <span>{getCategoryEmoji(category)}</span>
                         {getCategoryLabel(category)}
                       </h3>
                       <ul className="space-y-2">
                         {items.map((ing, idx) => {
                           const raw = ing.amount * state.guestCount
                           const norm = normalizeToShoppingUnit(raw, ing.unit)
                           return (
                             <li key={idx} className="flex items-center justify-between text-sm">
                               <span className="text-gray-700">
                                 {ing.name}
                               </span>
                               <span className="font-semibold text-[#8B1A2B]">
                                 {formatAmount(norm.amount)} {norm.unit}
                               </span>
                             </li>
                           )
                         })}
                       </ul>
                     </div>
                   ))}
                 </div>
               ) : shopGrouping === 'product' ? (
                 /* ── Flat product list ── */
                 <div className="space-y-6">
                   <div className="p-6 rounded-xl bg-white border border-gray-200">
                     <h3 className="font-semibold text-base mb-4 flex items-center gap-2 text-[#1a1a1a]">
                       <span>🏷️</span> Toate produsele
                     </h3>
                     <ul className="space-y-2">
                       {aggregatedIngredients
                         .slice()
                         .sort((a, b) => a.name.localeCompare(b.name, 'ro'))
                         .map((ing, idx) => {
                           const raw = ing.amount * state.guestCount
                           const norm = normalizeToShoppingUnit(raw, ing.unit)
                           return (
                             <li key={idx} className="flex items-center justify-between text-sm">
                               <span className="text-gray-700">
                                 {ing.name}
                                 <span className="text-xs ml-2 text-gray-400">
                                   ({getCategoryLabel(ing.category)})
                                 </span>
                               </span>
                               <span className="font-semibold text-[#8B1A2B]">
                                 {formatAmount(norm.amount)} {norm.unit}
                               </span>
                             </li>
                           )
                         })}
                     </ul>
                   </div>
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
                       <div key={item.id} className="p-6 rounded-xl bg-white border border-gray-200">
                         <div className="flex items-center justify-between mb-4">
                           <h3 className="font-semibold text-base flex items-center gap-2 text-[#1a1a1a]">
                             🍹 {item.cocktail.title}
                           </h3>
                           <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(139,26,43,0.1)', color: '#8B1A2B' }}>
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
                                   <span className="text-gray-700">{parsed.name}</span>
                                   <span className="font-semibold text-[#8B1A2B]">
                                     {formatAmount(norm.amount)} {norm.unit}
                                   </span>
                                 </li>
                               )
                             })}
                           </ul>
                         ) : (
                           <p className="text-sm italic text-gray-400">Nu sunt ingrediente listate.</p>
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
