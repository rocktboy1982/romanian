/**
 * AI Provider — centralised Claude client for vision & text tasks
 *
 * Vision tasks (photo → ingredient recognition):
 *   → claude-haiku-4-5-20251001 (fast, cheap, great vision)
 *
 * Text tasks (ingredient normalisation, budget optimisation):
 *   → claude-haiku-4-5-20251001
 *
 * Fallback: rule-based parser (no API key required)
 */

import Anthropic from '@anthropic-ai/sdk'

const API_KEY = process.env.ANTHROPIC_API_KEY ?? ''

let _client: Anthropic | null = null

function getClient(): Anthropic {
  if (!_client) {
    if (!API_KEY) throw new Error('ANTHROPIC_API_KEY is not set')
    _client = new Anthropic({ apiKey: API_KEY })
  }
  return _client
}

export function isAiAvailable(): boolean {
  return !!API_KEY
}

const MODEL = 'claude-haiku-4-5-20251001'

/* ─── Shared types ────────────────────────────────────────────────────────── */

export type BudgetTier = 'budget' | 'normal' | 'premium'

export interface NormalisedIngredient {
  original: string
  canonical_name: string
  quantity: number | null
  unit: string | null
  category: string
  search_query: string
  alternatives: string[]
  optional: boolean
  substitution_candidates: SubstitutionCandidate[]
}

export interface SubstitutionCandidate {
  original: string
  substitute: string
  reason: string
  estimated_saving_ron: number
}

export interface RecognisedIngredient {
  name: string
  canonical_name: string
  quantity_estimate: string | null
  confidence: number
  category: string
  source_context?: string
}

export interface RecognitionResult {
  session_id: string
  context: string
  ingredients: RecognisedIngredient[]
  confidence_overall: number
  processing_time_ms: number
}

export interface VendorProduct {
  id: string
  name: string
  brand?: string
  imageUrl?: string
  pricePerUnit: number
  currency: string
  unit: string
  packageSize: string
  inStock: boolean
  storeUrl: string
  category: string
  vendor: string
  pricePerBaseUnit?: number
  baseUnitLabel?: string
}

export interface CartItem {
  product: VendorProduct
  quantity: number
  ingredientRef: string
}

export interface CartResult {
  checkoutUrl?: string
  storeOrderId?: string
  requiresAppHandoff?: boolean
  handoffMessage?: string
  estimatedTotal?: number
  currency?: string
}

export interface IngredientMatch {
  ingredientRef: string
  canonical: string
  product: VendorProduct | null
  substitution?: SubstitutionCandidate
  packSizeOptions: VendorProduct[]
  recommended: VendorProduct | null
}

/* ─── Rule-based fallback normaliser ─────────────────────────────────────── */

const UNIT_WORDS = new Set(['g', 'kg', 'ml', 'l', 'tbsp', 'tsp', 'cup', 'cups', 'piece', 'pieces', 'bunch', 'clove', 'cloves', 'slice', 'slices', 'can', 'jar', 'bottle'])

const CATEGORY_MAP: Record<string, string> = {
  mozzarella: 'dairy', cheese: 'dairy', milk: 'dairy', butter: 'dairy', cream: 'dairy', yogurt: 'dairy',
  tomato: 'produce', tomatoes: 'produce', basil: 'produce', garlic: 'produce', onion: 'produce',
  chicken: 'meat', beef: 'meat', pork: 'meat', lamb: 'meat',
  salmon: 'seafood', tuna: 'seafood', shrimp: 'seafood',
  flour: 'pantry', sugar: 'pantry', salt: 'pantry', oil: 'pantry', vinegar: 'pantry', pasta: 'pantry', rice: 'pantry',
  bread: 'bakery', dough: 'bakery',
  wine: 'beverages', beer: 'beverages', juice: 'beverages',
}

export function ruleBasedNormalise(
  ingredientText: string,
  _tier: BudgetTier = 'normal'
): NormalisedIngredient {
  const text = ingredientText.trim().toLowerCase()
  const tokens = text.split(/\s+/)

  let quantity: number | null = null
  let unit: string | null = null
  const nameTokens: string[] = []

  for (const token of tokens) {
    const num = parseFloat(token.replace(',', '.'))
    if (!isNaN(num) && quantity === null) {
      quantity = num
    } else if (UNIT_WORDS.has(token) && unit === null) {
      unit = token
    } else {
      nameTokens.push(token)
    }
  }

  const rawName = nameTokens.join(' ')
    .replace(/[,.()\[\]]/g, '')
    .replace(/\b(fresh|frozen|dried|chopped|diced|minced|sliced|torn|grated)\b/g, '')
    .trim()

  const canonical = rawName || text
  const category = Object.entries(CATEGORY_MAP).find(([k]) => canonical.includes(k))?.[1] ?? 'pantry'

  return {
    original: ingredientText,
    canonical_name: canonical,
    quantity,
    unit,
    category,
    search_query: quantity ? `${canonical} ${quantity}${unit ?? ''}`.trim() : canonical,
    alternatives: [],
    optional: text.includes('optional') || text.includes('to taste'),
    substitution_candidates: [],
  }
}

/* ─── AI normaliser ──────────────────────────────────────────────────────── */

export async function normaliseIngredients(
  ingredients: string[],
  tier: BudgetTier,
  vendorName: string
): Promise<NormalisedIngredient[]> {
  if (!isAiAvailable()) {
    return ingredients.map(i => ruleBasedNormalise(i, tier))
  }

  const prompt = `You are a grocery product parser and budget optimiser.
Parse ALL ingredients below in one pass and return a JSON array.

Budget tier: "${tier}"
Vendor: "${vendorName}"

For each ingredient extract:
- original: exact input string
- canonical_name: clean searchable product name (lowercase)
- quantity: number only or null
- unit: g | kg | ml | L | tbsp | tsp | cup | piece | bunch | clove | slice | null
- category: produce | dairy | meat | seafood | bakery | pantry | frozen | beverages
- search_query: best search string for "${vendorName}"
- alternatives: array of 2-3 alternative search terms
- optional: true if "optional" or "to taste"
- substitution_candidates: for budget tier only — array of cheaper swaps.
  Each: { "original": string, "substitute": string, "reason": string, "estimated_saving_ron": number }
  For normal/premium tier: always empty array [].

Tier guidance:
- budget: prefer store-brand search terms, flag expensive items as substitution candidates
- normal: balanced quality/price search terms, no substitutions
- premium: named brand search terms, no substitutions

Return ONLY a valid JSON array. No explanation. No markdown.

Ingredients:
${JSON.stringify(ingredients)}`

  try {
    const client = getClient()
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed as NormalisedIngredient[]
    return ingredients.map(i => ruleBasedNormalise(i, tier))
  } catch {
    return ingredients.map(i => ruleBasedNormalise(i, tier))
  }
}

/* ─── Vision recogniser ──────────────────────────────────────────────────── */

export async function recogniseIngredientsFromPhoto(
  imageBase64: string,
  mimeType: string,
  contextHint: string,
  sessionId: string
): Promise<RecognitionResult> {
  const start = Date.now()

  if (!isAiAvailable()) {
    return {
      session_id: sessionId,
      context: contextHint || 'unknown',
      ingredients: [],
      confidence_overall: 0,
      processing_time_ms: 0,
    }
  }

  const prompt = `You are a food ingredient recognition system.
Identify all visible food ingredients in this photo.

Context hint: "${contextHint || 'unknown'}"

For each ingredient return:
- name: common name in Romanian (e.g. "Mozzarella proaspătă")
- canonical_name: lowercase searchable form (e.g. "mozzarella")
- quantity_estimate: visible quantity string or null (e.g. "~250g", "3 bucăți", "1 legătură")
- confidence: 0.0 to 1.0 (omit items below 0.5)
- category: produce | dairy | meat | seafood | pantry | bakery | beverage | frozen | other

Also return:
- context: overall scene type — fridge | market | pantry | receipt | other

Return ONLY valid JSON in this exact shape:
{
  "context": "fridge",
  "ingredients": [
    {
      "name": "Mozzarella proaspătă",
      "canonical_name": "mozzarella",
      "quantity_estimate": "~250g",
      "confidence": 0.95,
      "category": "dairy"
    }
  ]
}

Be conservative — only include items you are reasonably confident about (confidence > 0.5).`

  try {
    const client = getClient()
    const mediaType = mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageBase64,
            },
          },
          { type: 'text', text: prompt },
        ],
      }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const parsed = JSON.parse(text) as { context: string; ingredients: RecognisedIngredient[] }

    const overall = parsed.ingredients.length > 0
      ? parsed.ingredients.reduce((s, i) => s + i.confidence, 0) / parsed.ingredients.length
      : 0

    return {
      session_id: sessionId,
      context: parsed.context ?? contextHint,
      ingredients: parsed.ingredients.map(i => ({ ...i, source_context: contextHint })),
      confidence_overall: Math.round(overall * 100) / 100,
      processing_time_ms: Date.now() - start,
    }
  } catch {
    return {
      session_id: sessionId,
      context: contextHint || 'unknown',
      ingredients: [],
      confidence_overall: 0,
      processing_time_ms: Date.now() - start,
    }
  }
}
