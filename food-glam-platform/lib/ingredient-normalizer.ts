import { resolveIngredientName } from '@/lib/ingredient-aliases'


/**
 * Ingredient Normalizer for Shopping Lists
 */

// ── Ingredient Categories (shopping aisle grouping) ─────────────────────────
// Maps English canonical ingredient names to Romanian category labels.
// Variants like "red onion", "yellow onion" all map to the same category
// but remain as separate line items in the shopping list.
const CATEGORY_MAP: Record<string, string> = {
  // Legume / Vegetables
  'onion': 'Legume', 'red onion': 'Legume', 'scallion': 'Legume', 'leek': 'Legume',
  'garlic': 'Legume', 'potato': 'Legume', 'sweet potato': 'Legume',
  'tomato': 'Legume', 'cucumber': 'Legume', 'bell pepper': 'Legume',
  'red pepper': 'Legume', 'green pepper': 'Legume', 'chili pepper': 'Legume',
  'carrot': 'Legume', 'celery': 'Legume', 'spinach': 'Legume',
  'cabbage': 'Legume', 'red cabbage': 'Legume', 'cauliflower': 'Legume',
  'broccoli': 'Legume', 'zucchini': 'Legume', 'eggplant': 'Legume',
  'pumpkin': 'Legume', 'mushroom': 'Legume', 'corn': 'Legume',
  'peas': 'Legume', 'green beans': 'Legume', 'beans': 'Legume',
  'lentils': 'Legume', 'beet': 'Legume', 'asparagus': 'Legume',
  'fennel': 'Legume', 'lettuce': 'Legume', 'arugula': 'Legume',
  'bok choy': 'Legume', 'artichoke': 'Legume', 'kohlrabi': 'Legume',
  'brussels sprouts': 'Legume', 'chard': 'Legume', 'collard greens': 'Legume',
  'snow peas': 'Legume', 'sugar snap peas': 'Legume', 'plantain': 'Legume',
  'chickpeas': 'Legume', 'turnip': 'Legume', 'rutabaga': 'Legume',

  // Fructe / Fruits
  'apple': 'Fructe', 'pear': 'Fructe', 'banana': 'Fructe',
  'orange': 'Fructe', 'lemon': 'Fructe', 'lime': 'Fructe',
  'strawberry': 'Fructe', 'raspberry': 'Fructe', 'cherry': 'Fructe',
  'peach': 'Fructe', 'grape': 'Fructe', 'mango': 'Fructe',
  'pineapple': 'Fructe', 'watermelon': 'Fructe', 'melon': 'Fructe',
  'avocado': 'Fructe', 'fig': 'Fructe', 'date': 'Fructe',
  'pomegranate': 'Fructe', 'kiwi': 'Fructe', 'plum': 'Fructe',
  'apricot': 'Fructe', 'coconut': 'Fructe', 'olive': 'Fructe',
  'citrus': 'Fructe', 'blueberry': 'Fructe', 'cranberry': 'Fructe',

  // Carne / Meat
  'chicken': 'Carne', 'beef': 'Carne', 'pork': 'Carne', 'lamb': 'Carne',
  'veal': 'Carne', 'turkey': 'Carne', 'duck': 'Carne',
  'ground beef': 'Carne', 'ground meat': 'Carne', 'meat': 'Carne',
  'sausage': 'Carne', 'bacon': 'Carne', 'ham': 'Carne',
  'chicken breast': 'Carne', 'chicken paprikash': 'Carne',

  // Pește și fructe de mare / Seafood
  'fish': 'Pește', 'salmon': 'Pește', 'tuna': 'Pește', 'cod': 'Pește',
  'shrimp': 'Pește', 'jumbo shrimp': 'Pește', 'sardine': 'Pește',
  'smoked salmon': 'Pește', 'fish fillet': 'Pește',

  // Lactate / Dairy
  'milk': 'Lactate', 'whole milk': 'Lactate', 'cheese': 'Lactate',
  'cottage cheese': 'Lactate', 'feta cheese': 'Lactate',
  'butter': 'Lactate', 'cream': 'Lactate', 'heavy cream': 'Lactate',
  'light cream': 'Lactate', 'sour cream': 'Lactate',
  'yogurt': 'Lactate', 'whipped cream': 'Lactate',
  'egg': 'Lactate', 'eggs': 'Lactate', 'egg white': 'Lactate',
  'ghee': 'Lactate',

  // Cereale și paste / Grains & Pasta
  'rice': 'Cereale', 'long grain rice': 'Cereale', 'pasta': 'Cereale',
  'flour': 'Cereale', 'all-purpose flour': 'Cereale',
  'breadcrumbs': 'Cereale', 'groats': 'Cereale',
  'cornstarch': 'Cereale', 'baking powder': 'Cereale',
  'baking soda': 'Cereale', 'yeast': 'Cereale', 'dry yeast': 'Cereale',

  // Condimente / Spices & Seasonings
  'salt': 'Condimente', 'black pepper': 'Condimente', 'white pepper': 'Condimente',
  'paprika': 'Condimente', 'sweet paprika': 'Condimente', 'hot paprika': 'Condimente',
  'cumin': 'Condimente', 'cinnamon': 'Condimente', 'nutmeg': 'Condimente',
  'cardamom': 'Condimente', 'turmeric': 'Condimente', 'ginger': 'Condimente',
  'oregano': 'Condimente', 'basil': 'Condimente', 'thyme': 'Condimente',
  'rosemary': 'Condimente', 'dill': 'Condimente', 'parsley': 'Condimente',
  'fresh parsley': 'Condimente', 'cilantro': 'Condimente', 'coriander': 'Condimente',
  'bay leaf': 'Condimente', 'bay leaves': 'Condimente', 'tarragon': 'Condimente',
  'chives': 'Condimente', 'caraway': 'Condimente', 'poppy seeds': 'Condimente',
  'sesame seeds': 'Condimente', 'flax seeds': 'Condimente',
  'vanilla extract': 'Condimente', 'rose water': 'Condimente',
  'spices': 'Condimente', 'herbs': 'Condimente',

  // Uleiuri și sosuri / Oils & Sauces
  'oil': 'Uleiuri', 'olive oil': 'Uleiuri', 'vegetable oil': 'Uleiuri',
  'coconut oil': 'Uleiuri', 'palm oil': 'Uleiuri',
  'vinegar': 'Uleiuri', 'apple cider vinegar': 'Uleiuri',
  'soy sauce': 'Uleiuri', 'tomato paste': 'Uleiuri', 'sauce': 'Uleiuri',
  'garlic sauce': 'Uleiuri',

  // Dulciuri / Sweeteners
  'sugar': 'Dulciuri', 'brown sugar': 'Dulciuri', 'honey': 'Dulciuri',
  'maple syrup': 'Dulciuri', 'chocolate': 'Dulciuri',

  // Nuci și semințe / Nuts & Seeds
  'almonds': 'Nuci', 'pistachios': 'Nuci', 'walnuts': 'Nuci',
  'peanuts': 'Nuci', 'cashews': 'Nuci', 'hazelnuts': 'Nuci',
  'macadamia': 'Nuci', 'pecans': 'Nuci', 'pine nuts': 'Nuci',

  // Lichide / Liquids
  'water': 'Lichide', 'beef broth': 'Lichide', 'chicken broth': 'Lichide',
  'vegetable broth': 'Lichide', 'coconut milk': 'Lichide',
  'lemon juice': 'Lichide', 'tea': 'Lichide',

  // Altele / Other
  'sauerkraut': 'Altele', 'roast': 'Altele', 'vegetables': 'Altele',
}

// Category display order for consistent rendering
export const CATEGORY_ORDER = [
  'Legume', 'Fructe', 'Carne', 'Pește',
  'Lactate', 'Cereale', 'Condimente',
  'Uleiuri', 'Dulciuri', 'Nuci', 'Lichide', 'Altele',
]

/**
 * Get the shopping category for an ingredient based on its canonical English name.
 * Returns Romanian category label, or "Altele" if unknown.
 */
export function getIngredientCategory(canonicalName: string): string {
  return CATEGORY_MAP[canonicalName.toLowerCase()] ?? 'Altele'
}

const UNIT_CONVERSIONS: Record<string, { base: string; factor: number }> = {
  'ml': { base: 'ml', factor: 1 },
  'l': { base: 'ml', factor: 1000 },
  'cup': { base: 'ml', factor: 236.588 },
  'cups': { base: 'ml', factor: 236.588 },
  'tbsp': { base: 'ml', factor: 14.7868 },
  'tsp': { base: 'ml', factor: 4.92892 },
  'g': { base: 'g', factor: 1 },
  'kg': { base: 'g', factor: 1000 },
  'oz': { base: 'g', factor: 28.3495 },
  'lb': { base: 'g', factor: 453.592 },
}

export interface ParsedIngredient {
  original: string
  amount: number | null
  unit: string | null
  name: string
  normalizedName: string
}

export interface MergedIngredient {
  name: string
  amount: string
  unit: string
}

export function parseIngredient(ingredient: string): ParsedIngredient {
  const original = ingredient.trim()
  const pattern = /^([\d\s\/.\\-]+)?\s*([a-zA-Z\s]+?)?\s+(.+)$/
  const match = ingredient.match(pattern)
  
  let amount: number | null = null
  let unit: string | null = null
  let name = original
  
  if (match) {
    const [, amountStr, unitStr, nameStr] = match
    
    if (amountStr) {
      const clean = amountStr.trim()
      if (clean.includes('/')) {
        const parts = clean.split(/\s+/)
        let total = 0
        for (const part of parts) {
          if (part.includes('/')) {
            const [num, denom] = part.split('/')
            total += parseFloat(num) / parseFloat(denom)
          } else {
            total += parseFloat(part)
          }
        }
        amount = total
      } else if (clean.includes('-')) {
        const [, high] = clean.split('-')
        amount = parseFloat(high)
      } else {
        amount = parseFloat(clean)
      }
    }
    
    if (unitStr) {
      unit = unitStr.trim().toLowerCase()
    }
    
    name = nameStr.trim()
  }
  
  const rawNormalized = name.toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/,.*$/, '')
    .replace(/\b(fresh|frozen|dried|chopped|diced|minced|sliced)\b/g, '')
    .trim()
  // Resolve foreign-language ingredient names to English canonical
  const normalizedName = resolveIngredientName(rawNormalized)
  
  return { original, amount, unit, name, normalizedName }
}

export function mergeIngredients(ingredients: string[]): MergedIngredient[] {
  const parsed = ingredients.map(parseIngredient)
  const groups = new Map<string, ParsedIngredient[]>()
  
  for (const item of parsed) {
    const key = item.normalizedName
    const existing = groups.get(key) || []
    existing.push(item)
    groups.set(key, existing)
  }
  
  const merged: MergedIngredient[] = []
  
  for (const items of Array.from(groups.values())) {
    if (items.length === 1) {
      const item = items[0]
      merged.push({
        name: item.name,
        amount: item.amount !== null ? String(item.amount) : '',
        unit: item.unit || '',
      })
    } else {
      merged.push({
        name: items[0].name,
        amount: items.map(i => i.amount || 0).reduce((a, b) => a + b, 0).toString(),
        unit: items[0].unit || '',
      })
    }
  }
  
  return merged.sort((a, b) => a.name.localeCompare(b.name))
}

/** Recipe ingredient interface for JSON extraction */
export interface RecipeIngredient {
  name: string
  amount?: number
  unit?: string
}

/** Extract ingredients array from various recipe_json formats */
export function extractIngredientsFromJson(recipeJson: Record<string, unknown>): RecipeIngredient[] {
  // Try common recipe JSON structures
  const candidates = [
    recipeJson.ingredients,
    recipeJson.recipeIngredient,
    (recipeJson.recipe as Record<string, unknown>)?.ingredients,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.map(item => {
        if (typeof item === 'string') {
          return parseSimpleIngredient(item)
        }
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>
          return {
            name: String(obj.name || obj.ingredient || obj.text || ''),
            amount: Number(obj.amount || obj.quantity || 0) || 0,
            unit: String(obj.unit || obj.unitOfMeasure || ''),
          }
        }
        return { name: String(item), amount: 0, unit: '' }
      }).filter(i => i.name.length > 0)
    }
  }

  return []
}

/** Best-effort parse of "2 cups flour" style strings */
export function parseSimpleIngredient(str: string): RecipeIngredient {
  const match = str.match(/^([\d./]+)\s*([\w]+)?\s+(.+)$/)
  if (match) {
    const amount = parseFraction(match[1])
    return { name: match[3].trim(), amount, unit: match[2] || '' }
  }
  return { name: str.trim(), amount: 0, unit: '' }
}

/** Parse fraction strings like "1/2" or "1" into a number */
export function parseFraction(str: string): number {
  if (str.includes('/')) {
    const parts = str.split('/')
    const num = parseFloat(parts[0])
    const den = parseFloat(parts[1])
    if (den === 0) return 0
    return num / den
  }
  return parseFloat(str) || 0
}

/** Normalize key for merging: lowercase name + unit */
export function normalizeIngredientKey(name: string, unit: string): string {
  return `${name.toLowerCase().trim()}|${unit.toLowerCase().trim()}`
}
