/**
 * Shared TypeScript interfaces for the data-access layer.
 * These types are used across posts and votes queries.
 */

/**
 * Creator profile information embedded in recipe cards
 */
export interface CreatorProfile {
  id: string
  display_name: string
  handle: string
  avatar_url: string | null
}

/**
 * Approach/region information embedded in recipe cards
 */
export interface ApproachInfo {
  id: string
  name: string
  slug: string
}

/**
 * Full recipe card with all metadata for display
 * Used in homepage, search, and trending endpoints
 */
export interface RecipeCard {
  id: string
  title: string
  slug: string
  summary: string | null
  hero_image_url: string | null
  type: 'recipe' | 'cocktail' | 'short' | 'video' | 'image'
  status: 'active' | 'archived' | 'deleted'
  created_at: string
  is_tested: boolean
  quality_score: number | null
  diet_tags: string[]
  food_tags: string[]
  created_by: CreatorProfile
  approach: ApproachInfo | null
}

/**
 * Minimal recipe for lightweight operations (planner, autocomplete)
 * Includes recipe_json for nutrition and cooking info
 */
export interface MinimalRecipe {
  id: string
  title: string
  slug: string
  hero_image_url: string | null
  recipe_json: Record<string, unknown> | null
  diet_tags: string[]
  food_tags: string[]
}

/**
 * Vote aggregation map: post_id → net votes
 */
export type VoteMap = Record<string, number>

/**
 * Vote aggregation with trending component
 */
export interface VoteStats {
  net: number
  trending: number
}

/**
 * Vote aggregation map with trending: post_id → { net, trending }
 */
export type VoteStatsMap = Record<string, VoteStats>

/**
 * Filters for recipe queries
 */
export interface PostFilters {
  type?: 'recipe' | 'cocktail' | 'short' | 'video' | 'image'
  status?: 'active' | 'archived' | 'deleted'
  region?: string // approach slug
  country?: string // country slug
  dietTags?: string[]
  foodTags?: string[]
  searchQuery?: string
  isTested?: boolean
  qualityMin?: number
}

/**
 * Pagination and sorting options
 */
export interface PaginationOptions {
  page?: number
  perPage?: number
  sortBy?: 'created_at' | 'quality_score' | 'trending'
  sortOrder?: 'asc' | 'desc'
}

/**
 * Vote record from the votes table
 */
export interface VoteRecord {
  id: string
  post_id: string
  user_id: string
  value: 1 | -1
  created_at: string
}
