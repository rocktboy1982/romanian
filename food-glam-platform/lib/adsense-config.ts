/**
 * Google AdSense Configuration
 *
 * Replace the placeholder values with your actual AdSense publisher ID
 * and ad slot IDs once your account is approved.
 *
 * To get started:
 * 1. Sign up at https://www.google.com/adsense/
 * 2. Add your site and verify ownership via public/ads.txt
 * 3. Create ad units in AdSense dashboard and copy slot IDs here
 * 4. Set NEXT_PUBLIC_ADSENSE_PUB_ID in .env.local
 */

/** AdSense publisher ID (ca-pub-XXXXXXXXXXXXXXXX) */
export const ADSENSE_PUB_ID =
  process.env.NEXT_PUBLIC_ADSENSE_PUB_ID || 'ca-pub-1860386577458088'

/** Whether ads are enabled globally. Flip to false to kill all ads instantly. */
export const ADS_ENABLED =
  process.env.NEXT_PUBLIC_ADS_ENABLED !== 'false'

/** Ad slot IDs — create these in your AdSense dashboard */
export const AD_SLOTS = {
  /** Horizontal banner (728x90 desktop, responsive mobile) */
  banner: process.env.NEXT_PUBLIC_AD_SLOT_BANNER || '1234567890',
  /** In-feed native ad (blends into recipe/card grids) */
  inFeed: process.env.NEXT_PUBLIC_AD_SLOT_INFEED || '2345678901',
  /** Sidebar rectangle (300x250 or responsive) */
  sidebar: process.env.NEXT_PUBLIC_AD_SLOT_SIDEBAR || '3456789012',
  /** In-article ad (between content sections) */
  inArticle: process.env.NEXT_PUBLIC_AD_SLOT_INARTICLE || '4567890123',
} as const

export type AdSlotKey = keyof typeof AD_SLOTS

/**
 * Ad placement definitions — maps page locations to slot types + sizing.
 * Used by placement components (AdBanner, AdInFeed, AdSidebar) to pick
 * the correct ad slot and responsive format.
 */
export const AD_PLACEMENTS = {
  // Recipe detail page
  'recipe-between-ingredients-directions': {
    slot: 'inArticle' as AdSlotKey,
    format: 'fluid' as const,
    layout: 'in-article' as const,
  },
  'recipe-sidebar': {
    slot: 'sidebar' as AdSlotKey,
    format: 'auto' as const,
    layout: undefined,
  },

  // Cocktail detail page
  'cocktail-between-stats-ingredients': {
    slot: 'inArticle' as AdSlotKey,
    format: 'fluid' as const,
    layout: 'in-article' as const,
  },
  'cocktail-sidebar': {
    slot: 'sidebar' as AdSlotKey,
    format: 'auto' as const,
    layout: undefined,
  },

  // Homepage
  'homepage-banner': {
    slot: 'banner' as AdSlotKey,
    format: 'auto' as const,
    layout: undefined,
  },
  'homepage-infeed': {
    slot: 'inFeed' as AdSlotKey,
    format: 'fluid' as const,
    layout: 'in-article' as const,
  },

  'homepage-bottom-banner': {
    slot: 'banner' as AdSlotKey,
    format: 'auto' as const,
    layout: undefined,
  },
  'homepage-bottom-infeed': {
    slot: 'inFeed' as AdSlotKey,
    format: 'fluid' as const,
    layout: 'in-article' as const,
  },

  // Feed page
  'feed-infeed': {
    slot: 'inFeed' as AdSlotKey,
    format: 'fluid' as const,
    layout: 'in-article' as const,
  },

  // Search results
  'search-infeed': {
    slot: 'inFeed' as AdSlotKey,
    format: 'fluid' as const,
    layout: 'in-article' as const,
  },

  // Region cookbook
  'cookbook-banner': {
    slot: 'banner' as AdSlotKey,
    format: 'auto' as const,
    layout: undefined,
  },

  // Index pages
  'recipes-hero-banner': {
    slot: 'banner' as AdSlotKey,
    format: 'auto' as const,
    layout: undefined,
  },
  'cocktails-hero-banner': {
    slot: 'banner' as AdSlotKey,
    format: 'auto' as const,
    layout: undefined,
  },
  'cocktailbooks-between-sections': {
    slot: 'banner' as AdSlotKey,
    format: 'auto' as const,
    layout: undefined,
  },
} as const

export type AdPlacementKey = keyof typeof AD_PLACEMENTS
