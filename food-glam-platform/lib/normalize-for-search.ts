/**
 * Normalize an ingredient string for product search on eMAG / BauturiAlcoolice.
 * Strips quantities, units, cooking adjectives, parenthetical notes — returns just the product name.
 *
 * Examples:
 *   "2 căni lapte degresat" → "lapte degresat"
 *   "1/2 linguriță praf de usturoi" → "praf de usturoi"
 *   "500g varză, tăiată fâșii" → "varză"
 *   "45 ml rom Malibu" → "rom Malibu"
 *   "3 căței de usturoi, tocați" → "usturoi"
 *   "1 conserve (8 oz) sos de roșii" → "sos de roșii"
 *   "6 căni de supă de vită" → "supă de vită"
 */

// All known units (Romanian + English) — if the word matches, it's a unit to strip
const UNITS = new Set([
  // Metric
  'g', 'gr', 'kg', 'ml', 'l', 'dl', 'cl',
  // Romanian volume/count
  'lingura', 'lingură', 'linguri',
  'lingurita', 'linguriță', 'lingurițe', 'lingurite',
  'cana', 'cană', 'cani', 'căni',
  'pahar', 'pahare',
  'felie', 'felii',
  'bucata', 'bucată', 'bucati', 'bucăți', 'buc',
  'legatura', 'legătură', 'legaturi',
  'catel', 'cățel', 'catei', 'căței',
  'fir', 'fire',
  'varf', 'vârf',
  'pumn', 'pumni',
  'pachet', 'pachete',
  'cutie', 'cutii',
  'conserva', 'conservă', 'conserve',
  'plic',
  'frunza', 'frunză', 'frunze',
  'foaie', 'foi',
  'strop',
  'ramurica', 'rămurică',
  'crenguita', 'crenguță',
  'buchet', 'buchete',
  'capatana', 'căpățână',
  'cap',
  'disc', 'discuri',
  'tulpina', 'tulpină',
  'halba', 'halbă',
  'litru', 'litri',
  // English
  'cup', 'cups',
  'tbsp', 'tablespoon', 'tablespoons',
  'tsp', 'teaspoon', 'teaspoons',
  'oz', 'ounce', 'ounces', 'uncii', 'uncie',
  'lb', 'lbs', 'pound', 'pounds',
  'pinch', 'dash', 'bunch',
  'clove', 'cloves',
  'slice', 'slices',
  'piece', 'pieces',
  'can', 'cans',
  'sprig', 'sprigs',
  'leaf', 'leaves',
  'head', 'heads',
  'stalk', 'stalks',
  'strip', 'strips',
  // Misc
  'shot', 'jigger', 'parte', 'part',
  'lovitură', 'lovitura', 'lovitură',
  'galoane', 'gal',
])

// Cooking adjectives — use space boundaries (not \b which breaks on ă, î, ș, ț)
const COOKING_ADJECTIVES = new Set([
  'proaspăt', 'proaspătă', 'proaspete', 'proaspeți',
  'tocat', 'tocată', 'tocate', 'tocați',
  'topit', 'topită', 'topite', 'topiți',
  'tăiat', 'tăiată', 'tăiate', 'tăiați',
  'feliat', 'feliată', 'feliate',
  'măcinat', 'măcinată', 'măcinate',
  'prăjit', 'prăjită', 'prăjite', 'prăjiți',
  'ras', 'rasă', 'rase',
  'fiert', 'fiartă', 'fierte', 'fierți',
  'mărunt', 'măruntă', 'mărunt',
  'fin', 'fină', 'fine',
  'uscat', 'uscată', 'uscate', 'uscați',
  'rehidratați', 'rehidratate',
  'întreg', 'întreagă', 'întregi',
  'zdrobit', 'zdrobită', 'zdrobite', 'zdrobiți',
  'copt', 'coaptă', 'coapte',
  'stors', 'stoarsă', 'stoarse',
  'congelat', 'congelată', 'congelate',
  'înmuiat', 'înmuiată', 'înmuiate',
  'mare', 'mediu', 'mic', 'mică', 'mici', 'mari',
  'cubulețe', 'cuburi', 'felii', 'fâșii', 'jumătăți', 'sferturi',
  'galbenă', 'roșie', 'verde', 'negru', 'neagră', 'alb', 'albă',
  'fresh', 'frozen', 'dried', 'chopped', 'diced', 'minced', 'sliced',
  'crushed', 'grated', 'peeled', 'whole', 'small', 'medium', 'large',
])

// Prepositions that connect unit to product
const PREPOSITIONS = new Set(['de', 'of', 'cu', 'din', 'pentru', 'la', 'sau'])

export function normalizeIngredientForSearch(raw: string): string {
  let s = raw.trim()

  // 1. Remove parenthetical notes: "(8 oz)", "(opțional)", "(nota 1a)", etc.
  s = s.replace(/\(.*?\)/g, '')

  // 2. Remove everything after comma — usually cooking instructions
  //    "varză, tăiată fâșii" → "varză"
  const commaIdx = s.indexOf(',')
  if (commaIdx > 3) { // only if comma isn't at the very start
    s = s.substring(0, commaIdx)
  }

  // 3. Remove leading numbers (integers, decimals, fractions, unicode fractions, ranges)
  //    "2 căni" → "căni", "1/2 linguriță" → "linguriță", "1½" → ""
  s = s.replace(/^[\d\s\/.,½⅓⅔¼¾⅛²³\-–]+/, '').trim()

  // 4. Strip known unit words from the beginning (may be multiple: "linguri de")
  const words = s.split(/\s+/)
  let startIdx = 0

  // Skip unit words
  while (startIdx < words.length && UNITS.has(words[startIdx].toLowerCase())) {
    startIdx++
  }

  // Skip prepositions after units ("de", "of", "cu")
  while (startIdx < words.length && PREPOSITIONS.has(words[startIdx].toLowerCase())) {
    startIdx++
  }

  s = words.slice(startIdx).join(' ')

  // 5. Remove cooking adjectives (word-by-word, no \b — handles Unicode ă î ș ț)
  s = s.split(/\s+/).filter(w => !COOKING_ADJECTIVES.has(w.toLowerCase())).join(' ')

  // 6. Clean up orphaned prepositions at start/end (from stripped adjectives/units)
  s = s.replace(/\s+/g, ' ').trim()
  const cleanWords = s.split(/\s+/)
  while (cleanWords.length > 1 && PREPOSITIONS.has(cleanWords[0].toLowerCase())) {
    cleanWords.shift()
  }
  // Also strip trailing prepositions
  while (cleanWords.length > 1 && PREPOSITIONS.has(cleanWords[cleanWords.length - 1].toLowerCase())) {
    cleanWords.pop()
  }
  s = cleanWords.join(' ')

  // 7. Clean up: multiple spaces, trailing/leading whitespace
  s = s.replace(/\s+/g, ' ').trim()

  // 7. If we stripped everything, fall back to original (minus parens and commas)
  if (!s || s.length < 2) {
    s = raw.replace(/\(.*?\)/g, '').replace(/,.*$/, '').replace(/^[\d\s\/.,½⅓⅔¼¾⅛²³\-–]+/, '').trim()
  }

  return s
}

// Alcohol detection for vendor routing
const ALCOHOL_KEYWORDS = [
  'vodka', 'vodcă', 'rom ', 'rum ', 'gin ', 'gin,', 'whiskey', 'whisky',
  'tequila', 'lichior', 'vin ', 'vin,', 'bere', 'prosecco', 'champagne',
  'șampanie', 'bitter', 'angostura', 'aperol', 'campari', 'vermouth', 'vermut',
  'triple sec', 'cointreau', 'kahlua', 'baileys', 'amaretto', 'sambuca',
  'grappa', 'țuică', 'pălincă', 'rachiu', 'absint', 'cognac', 'brandy',
  'mezcal', 'scotch', 'bourbon', 'chartreuse', 'curaçao', 'curacao',
  'maraschino', 'jägermeister', 'limoncello', 'fernet', 'grand marnier',
  'bénédictine', 'benedictina', 'pernod', 'galliano', 'midori', 'malibu',
  'drambuie', 'ouzo', 'sake', 'absinthe', 'everclear'
]

export function isAlcoholicIngredient(name: string): boolean {
  const lower = ` ${name.toLowerCase()} `
  return ALCOHOL_KEYWORDS.some(kw => lower.includes(kw))
}

/**
 * Parse a raw ingredient string into { qty, unit, name, category }.
 * Used by the shopping list builder to separate quantity from product.
 *
 * "2 căni lapte degresat" → { qty: 2, unit: "căni", name: "lapte degresat" }
 * "1/2 linguriță praf de usturoi" → { qty: 0.5, unit: "linguriță", name: "praf de usturoi" }
 * "500g varză, tăiată fâșii" → { qty: 500, unit: "g", name: "varză" }
 * "3 ouă" → { qty: 3, unit: "buc", name: "ouă" }
 * "sare și piper" → { qty: 1, unit: "buc", name: "sare și piper" }
 */
export function parseIngredientString(raw: string): { qty: number; unit: string; name: string; category: string } {
  let s = raw.trim()

  // Remove parenthetical notes first
  s = s.replace(/\(.*?\)/g, '').trim()

  // Remove everything after comma
  const commaIdx = s.indexOf(',')
  if (commaIdx > 3) s = s.substring(0, commaIdx)

  s = s.trim()

  // Step 1: Extract leading number (integers, fractions, unicode fractions, decimals, ranges)
  let qty = 0
  let rest = s

  // Replace unicode fractions
  rest = rest.replace(/½/g, ' 1/2').replace(/⅓/g, ' 1/3').replace(/⅔/g, ' 2/3')
    .replace(/¼/g, ' 1/4').replace(/¾/g, ' 3/4').replace(/⅛/g, ' 1/8').trim()

  const numMatch = rest.match(/^([\d\s\/.,\-–]+)/)
  if (numMatch) {
    const numStr = numMatch[1].trim()
    rest = rest.slice(numMatch[0].length).trim()

    // Parse the number
    if (numStr.includes('/')) {
      const parts = numStr.split(/\s+/)
      let total = 0
      for (const part of parts) {
        if (part.includes('/')) {
          const [num, denom] = part.split('/')
          const n = parseFloat(num)
          const d = parseFloat(denom)
          if (!isNaN(n) && !isNaN(d) && d !== 0) total += n / d
        } else {
          const v = parseFloat(part.replace(',', '.'))
          if (!isNaN(v)) total += v
        }
      }
      qty = total
    } else if (numStr.includes('-') || numStr.includes('–')) {
      // Range: take higher value
      const rangeParts = numStr.split(/[-–]/)
      qty = parseFloat(rangeParts[rangeParts.length - 1].replace(',', '.')) || 1
    } else {
      qty = parseFloat(numStr.replace(',', '.')) || 0
    }
  }

  if (qty === 0) qty = 1 // default

  // Step 2: Try to match a known unit word at the start of rest
  const words = rest.split(/\s+/).filter(Boolean)
  let unit = 'buc'
  let nameStartIdx = 0

  if (words.length > 0 && UNITS.has(words[0].toLowerCase())) {
    unit = words[0]
    nameStartIdx = 1
    // Skip preposition after unit ("de", "of")
    if (words[nameStartIdx] && PREPOSITIONS.has(words[nameStartIdx].toLowerCase())) {
      nameStartIdx++
    }
  } else if (words.length > 0) {
    // Check for units glued to number: "500g" → already split by numMatch
    // No unit found — default to "buc"
  }

  // Step 3: Build the product name from remaining words
  let name = words.slice(nameStartIdx).join(' ')

  // Strip cooking adjectives
  name = name.split(/\s+/).filter(w => !COOKING_ADJECTIVES.has(w.toLowerCase())).join(' ')

  // Clean orphaned prepositions
  const nameWords = name.split(/\s+/).filter(Boolean)
  while (nameWords.length > 1 && PREPOSITIONS.has(nameWords[0].toLowerCase())) nameWords.shift()
  while (nameWords.length > 1 && PREPOSITIONS.has(nameWords[nameWords.length - 1].toLowerCase())) nameWords.pop()
  name = nameWords.join(' ').trim()

  if (!name || name.length < 2) name = raw.replace(/\(.*?\)/g, '').replace(/,.*$/, '').replace(/^[\d\s\/.,½⅓⅔¼¾⅛-]+/, '').trim()

  // Step 4: Guess category from the ingredient name
  const category = guessCategory(name)

  return { qty, unit, name, category }
}

function guessCategory(name: string): string {
  const lower = name.toLowerCase()
  if (/lapte|smântân|brânz|cheddar|mozza|iaurt|frișc|parmezan|mascarpone|gorgonzola|cream|ricotta/.test(lower)) return 'Lactate'
  if (/carne|pui|pulp|piept|vita|porc|miel|curcan|bacon|prosciutto|pancetta/.test(lower)) return 'Carne'
  if (/ceap|usturoi|morcov|ardei|roși|cartof|dovl|varză|spanac|fasol|mazăr|linte|năut|vinete/.test(lower)) return 'Legume'
  if (/măr |mere|banană|lămâi|lime|portocal|căpșun|afin|zmeură|cireș|ananas|mango|pere|piersic|kiwi|fruct/.test(lower)) return 'Fructe'
  if (/sare|piper|boia|oregano|cimbru|rozmarin|curcuma|ghimbir|scorțișoară|dafin|chimion|coriandru|vanilie|nucșoar|condiment|garam|chili/.test(lower)) return 'Condimente'
  if (/fain|pâine|chifle|cozonac|aluat|crustă|pesmet/.test(lower)) return 'Panificație'
  if (/orez|paste |tăiței|penne|spaghetti|fusilli|mălai|griș|ovăz|quinoa|couscous/.test(lower)) return 'Cereale'
  if (/ulei|untură|măslin/.test(lower)) return 'Uleiuri'
  if (/conserv|sos de|bulion|passata/.test(lower)) return 'Conserve'
  if (/ou[ăa]?\b|ouă|albuș|gălbenuș/.test(lower)) return 'Ouă'
  if (/pește|somon|ton |cod |crap|sardine|anșoa|creveț/.test(lower)) return 'Pește'
  if (/ciocolat|cacao|zahăr|miere|sirop|caramel/.test(lower)) return 'Dulciuri'
  if (/unt\b/.test(lower)) return 'Lactate'
  if (/vodka|vodcă|gin\b|rom\b|rum\b|whisky|tequila|cognac|bere|vin\b|lichior|bitter|vermut|prosecco|champagne/.test(lower)) return 'Spirtoase'
  if (/apă|suc |sifon|tonic|sprite|cola|cafea|ceai|espresso/.test(lower)) return 'Băuturi'
  if (/gheață|gheata/.test(lower)) return 'Gheață'
  if (/nuc[ăi]|migdal|caju|alun|semințe|susan/.test(lower)) return 'Nuci'
  return 'Altele'
}

// Generate eMAG search URL
export function getEmagSearchUrl(ingredientName: string): string {
  const normalized = normalizeIngredientForSearch(ingredientName)
  return `https://www.emag.ro/search/${encodeURIComponent(normalized.replace(/\s+/g, '+'))}`
}

// Generate BauturiAlcoolice search URL
export function getBauturiSearchUrl(ingredientName: string): string {
  const normalized = normalizeIngredientForSearch(ingredientName)
  return `https://bauturialcoolice.ro/index.php?route=product/search&search=${encodeURIComponent(normalized)}`
}
