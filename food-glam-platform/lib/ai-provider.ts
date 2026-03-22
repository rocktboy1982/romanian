/**
 * AI Provider — centralised Gemini client for vision & text tasks
 *
 * Vision tasks (photo → ingredient recognition):
 *   → gemini-2.0-flash  (excellent vision, cheap)
 *
 * Text tasks (ingredient normalisation, budget optimisation):
 *   → gemini-2.0-flash-lite  (fast, cheapest)
 *
 * Fallback: rule-based parser (no API key required)
 *
 * Get a free API key at https://aistudio.google.com/apikey
 * Set GOOGLE_API_KEY in .env.local and Vercel env vars.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

const API_KEY = process.env.GOOGLE_API_KEY ?? ''

let _client: GoogleGenerativeAI | null = null

function getClient(): GoogleGenerativeAI {
  if (!_client) {
    if (!API_KEY) throw new Error('GOOGLE_API_KEY is not set')
    _client = new GoogleGenerativeAI(API_KEY)
  }
  return _client
}

export function isAiAvailable(): boolean {
  return !!API_KEY
}

/* ─── Text model: Flash-Lite for ingredient normalisation ─────────────────── */

export function getTextModel() {
  return getClient().getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
    },
  })
}

/* ─── Vision model: 2.5 Flash for photo recognition ─────────────────────── */

export function getVisionModel() {
  return getClient().getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
    },
  })
}

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
- budget: prefer store-brand search terms, flag expensive items (pine nuts, saffron, truffle) as substitution candidates
- normal: balanced quality/price search terms, no substitutions
- premium: named brand search terms (e.g. "Bella Italia mozzarella"), no substitutions

Return ONLY a valid JSON array. No explanation. No markdown.

Ingredients:
${JSON.stringify(ingredients)}`

  try {
    const model = getTextModel()
    const result = await model.generateContent(prompt)
    const text = result.response.text()
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

  const prompt = `You are a food ingredient recognition system for a ROMANIAN cooking platform.
Identify all visible food ingredients in this photo.
IMPORTANT: ALL text output MUST be in ROMANIAN. Never use English names.

Context hint: "${contextHint || 'unknown'}"

For each ingredient return:
- name: name in Romanian (e.g. "Ouă", "Lapte", "Struguri verzi", "Afine", "Morcovi")
- canonical_name: also in Romanian, lowercase (e.g. "ouă", "lapte", "struguri", "afine", "morcovi")
- quantity_estimate: visible quantity in Romanian or null (e.g. "~250g", "3 bucăți", "1 legătură", "~6 buc")
- confidence: 0.0 to 1.0 (omit items below 0.5)
- category: legume | fructe | lactate | carne | pește | cereale | condimente | panificație | conserve | băuturi | altele

Also return:
- context: overall scene type — frigider | piață | cămară | bon | altele

Return ONLY valid JSON in this exact shape:
{
  "context": "frigider",
  "ingredients": [
    {
      "name": "Ouă",
      "canonical_name": "ouă",
      "quantity_estimate": "~6 buc",
      "confidence": 0.95,
      "category": "lactate"
    },
    {
      "name": "Lapte",
      "canonical_name": "lapte",
      "quantity_estimate": "~1L",
      "confidence": 0.98,
      "category": "lactate"
    }
  ]
}

Be thorough — list everything visible. ALL names MUST be in Romanian.`

  try {
    const model = getVisionModel()
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      },
    ])

    const text = result.response.text()
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
