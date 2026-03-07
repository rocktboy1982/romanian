/**
 * Affiliate & referral link utilities
 *
 * To activate:
 *  - eMAG: replace EMAG_AFFILIATE_TAG with your real affiliate tag from
 *    https://marketplace.emag.ro/afiliere
 *  - Freshful: replace FRESHFUL_REFERRAL_CODE with the referral code from
 *    your Freshful partner agreement
 */

// ── eMAG ────────────────────────────────────────────────────────────────────
const EMAG_AFFILIATE_TAG = 'marechef-20' // TODO: replace with real affiliate tag

/**
 * Returns an eMAG search URL for a given ingredient name.
 * Opens in a new tab so users don't lose their place.
 */
export function emagSearchUrl(ingredient: string): string {
  const query = encodeURIComponent(ingredient.trim())
  return `https://www.emag.ro/search/${query}?ref=${EMAG_AFFILIATE_TAG}`
}

/**
 * Strips quantity/unit prefix from ingredient strings like "500g pizza dough"
 * so the search hits the right product category.
 * e.g. "500g pizza dough" -> "pizza dough"
 *      "3 tbsp olive oil" -> "olive oil"
 *      "fresh mozzarella, torn" -> "fresh mozzarella"
 */
export function ingredientSearchTerm(raw: string): string {
  // Remove leading quantity + unit (e.g. "500g", "3 tbsp", "2 large")
  const cleaned = raw
    .replace(/^\d+[\d./]*\s*(g|kg|ml|l|tbsp|tsp|cup|cups|oz|lb|lbs|piece|pieces|clove|cloves|large|medium|small|bunch|can|cans|slice|slices|pinch|handful|handful)s?\s+/i, '')
    // Remove anything after comma (preparation notes like ", torn", ", sliced")
    .replace(/,.*$/, '')
    .trim()
  return cleaned || raw.trim()
}

// ── Freshful ─────────────────────────────────────────────────────────────────
const FRESHFUL_REFERRAL_CODE = 'FOODGLAM' // TODO: replace with real referral code from partner agreement

/**
 * Returns a Freshful referral URL.
 * When a partner agreement is in place, this URL earns a referral fee per order.
 */
export function freshfulReferralUrl(): string {
  return `https://www.freshful.ro/?ref=${FRESHFUL_REFERRAL_CODE}`
}

/**
 * Returns a Freshful search URL pre-filled with a query (best-effort —
 * Freshful may not support deep-linking into search, so falls back to homepage).
 */
export function freshfulSearchUrl(ingredient: string): string {
  const query = encodeURIComponent(ingredientSearchTerm(ingredient))
  return `https://www.freshful.ro/search?q=${query}&ref=${FRESHFUL_REFERRAL_CODE}`
}
