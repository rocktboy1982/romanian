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
  'oz', 'ounce', 'ounces',
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
