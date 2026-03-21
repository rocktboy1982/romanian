'use client'

import { isAlcoholicIngredient, normalizeIngredientForSearch } from '@/lib/normalize-for-search'

interface Props {
  ingredients: string[]
  type?: 'recipe' | 'cocktail'
}

export default function BuyIngredientsButtons({ ingredients, type = 'recipe' }: Props) {
  if (!ingredients || ingredients.length === 0) return null

  const items = ingredients.map(ing => ({
    name: normalizeIngredientForSearch(ing),
    raw: ing,
    isAlcohol: isAlcoholicIngredient(ing),
  })).filter(i => i.name.length > 1)

  const foodItems = items.filter(i => !i.isAlcohol)
  const alcoholItems = items.filter(i => i.isAlcohol)

  const openEmagTabs = () => {
    const list = type === 'cocktail' ? foodItems : items.filter(i => !i.isAlcohol)
    const toOpen = list.length > 0 ? list : items
    toOpen.forEach((item, i) => {
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

  const showEmag = type === 'recipe' ? items.length > 0 : foodItems.length > 0
  const showBauturi = alcoholItems.length > 0
  const emagCount = type === 'recipe' ? items.length : (foodItems.length > 0 ? foodItems.length : items.length)

  return (
    <div className="flex gap-2 mt-3">
      {showEmag && (
        <button
          onClick={openEmagTabs}
          className="flex-1 px-3 py-2.5 rounded-lg text-xs font-semibold text-center transition-all hover:scale-[1.02]"
          style={{ background: 'linear-gradient(135deg,#f59e0b,#ea580c)', color: '#fff' }}
        >
          🛒 Cumpără de pe eMAG ({emagCount})
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
