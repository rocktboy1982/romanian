'use client'

import { useState } from 'react'
import { isAlcoholicIngredient, normalizeIngredientForSearch } from '@/lib/normalize-for-search'

interface Props {
  ingredients: string[]
  type?: 'recipe' | 'cocktail'
}

export default function BuyIngredientsButtons({ ingredients, type = 'recipe' }: Props) {
  const [loading, setLoading] = useState(false)

  if (!ingredients || ingredients.length === 0) return null

  const items = ingredients.map(ing => ({
    name: normalizeIngredientForSearch(ing),
    raw: ing,
    isAlcohol: isAlcoholicIngredient(ing),
  })).filter(i => i.name.length > 1)

  const foodItems = items.filter(i => !i.isAlcohol)
  const alcoholItems = items.filter(i => i.isAlcohol)

  const openEmagTabs = async () => {
    const list = type === 'cocktail' ? (foodItems.length > 0 ? foodItems : items) : items.filter(i => !i.isAlcohol)
    const toOpen = list.length > 0 ? list : items
    if (toOpen.length === 0) return

    setLoading(true)

    // Build raw eMAG search URLs for each ingredient
    const rawLinks = toOpen.map(item => ({
      name: item.name,
      url: `https://www.emag.ro/search/${encodeURIComponent(item.name)}`,
    }))

    // Try to get affiliate-tracked URLs via Profitshare API
    let urls: string[] = rawLinks.map(l => l.url)
    try {
      const res = await fetch('/api/profitshare/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ links: rawLinks }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.links && data.links.length > 0) {
          urls = data.links.map((l: { ps_url?: string; url: string }) => l.ps_url || l.url)
        }
      }
    } catch {
      // Fall back to raw URLs
    }

    setLoading(false)

    // Open each ingredient in its own tab
    urls.forEach((url, i) => {
      setTimeout(() => {
        try { const u = new URL(url); if (u.protocol === 'https:') window.open(u.href, '_blank', 'noopener,noreferrer') } catch { /* invalid */ }
      }, i * 300)
    })
  }

  const openBauturiTabs = () => {
    alcoholItems.forEach((item, i) => {
      setTimeout(() => {
        const url = `https://www.bauturialcoolice.ro/index.php?route=product/search&search=${encodeURIComponent(item.name)}`
        window.open(url, '_blank', 'noopener,noreferrer')
      }, i * 300)
    })
  }

  const showEmag = type === 'recipe' ? items.length > 0 : foodItems.length > 0
  const showBauturi = alcoholItems.length > 0
  const emagCount = type === 'recipe' ? items.filter(i => !i.isAlcohol).length || items.length : (foodItems.length > 0 ? foodItems.length : items.length)

  return (
    <div className="flex gap-2 mt-3">
      {showEmag && (
        <button
          onClick={openEmagTabs}
          disabled={loading}
          className="flex-1 px-3 py-2.5 rounded-lg text-xs font-semibold text-center transition-all hover:scale-[1.02] disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg,#f59e0b,#ea580c)', color: '#fff' }}
        >
          {loading ? '⏳ Se generează...' : `🛒 Cumpără de pe eMAG (${emagCount})`}
        </button>
      )}
      {showBauturi && (
        <button
          onClick={openBauturiTabs}
          className="flex-1 px-3 py-2.5 rounded-lg text-xs font-semibold text-center transition-all hover:scale-[1.02]"
          style={{ background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', color: '#fff' }}
        >
          🍷 BauturiAlcoolice ({alcoholItems.length})
        </button>
      )}
    </div>
  )
}
