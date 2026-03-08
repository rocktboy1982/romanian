/**
 * Data-access layer for posts (recipes) queries.
 * Centralizes repeated Supabase query patterns used across API routes.
 * All functions accept a Supabase client as the first argument (dependency injection).
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { unwrapSupabase } from '@/lib/supabase-utils'
import {
  RecipeCard,
  MinimalRecipe,
  PostFilters,
  PaginationOptions,
  CreatorProfile,
  ApproachInfo,
} from './types'

/**
 * Column selection for full recipe cards with joins
 */
export const RECIPE_CARD_COLUMNS = `
  id,
  title,
  slug,
  summary,
  hero_image_url,
  type,
  status,
  created_at,
  is_tested,
  quality_score,
  diet_tags,
  food_tags,
  created_by:profiles(id, display_name, handle, avatar_url),
  approaches:approaches(id, name, slug)
`

/**
 * Column selection for minimal recipes (lightweight queries)
 */
export const MINIMAL_RECIPE_COLUMNS = `
  id,
  title,
  slug,
  hero_image_url,
  recipe_json,
  diet_tags,
  food_tags
`

/**
 * Fetch recipe cards with full metadata (creator profile, approach)
 * Used in homepage, search, and trending endpoints
 *
 * @param supabase - Supabase client instance
 * @param filters - Optional filters (type, status, region, diet_tags, food_tags, search query)
 * @param pagination - Optional pagination and sorting options
 * @returns Array of recipe cards with creator and approach info
 */
export async function getRecipeCards(
  supabase: SupabaseClient,
  filters?: PostFilters,
  pagination?: PaginationOptions
): Promise<RecipeCard[]> {
  let query = supabase
    .from('posts')
    .select(RECIPE_CARD_COLUMNS)

  // Status filter (default to active)
  query = query.eq('status', filters?.status || 'active')

  // Type filter (default to recipe)
  query = query.eq('type', filters?.type || 'recipe')

  // Diet tags filter
  if (filters?.dietTags && filters.dietTags.length > 0) {
    query = query.contains('diet_tags', filters.dietTags)
  }

  // Food tags filter
  if (filters?.foodTags && filters.foodTags.length > 0) {
    query = query.contains('food_tags', filters.foodTags)
  }

  // Quality score filter
  if (filters?.qualityMin !== undefined && filters.qualityMin > 0) {
    query = query.gte('quality_score', filters.qualityMin)
  }

  // Is tested filter
  if (filters?.isTested) {
    query = query.eq('is_tested', true)
  }

  // Text search on title and summary
  if (filters?.searchQuery) {
    const safeQ = filters.searchQuery.replace(/[%_]/g, '')
    query = query.or(`title.ilike.%${safeQ}%,summary.ilike.%${safeQ}%`)
  }

  // Sorting
  const sortBy = pagination?.sortBy || 'created_at'
  const sortOrder = pagination?.sortOrder || 'desc'
  const ascending = sortOrder === 'asc'

  if (sortBy === 'quality_score') {
    query = query.order('quality_score', { ascending: false, nullsFirst: false })
  }
  query = query.order('created_at', { ascending })

  // Pagination
  const page = pagination?.page || 1
  const perPage = pagination?.perPage || 12
  const offset = (page - 1) * perPage
  query = query.range(offset, offset + perPage - 1)

  const { data, error } = await query

  if (error) {
    console.error('getRecipeCards error:', error)
    return []
  }

  return (data || []).map(post => formatRecipeCard(post))
}

/**
 * Fetch a single recipe by UUID
 *
 * @param supabase - Supabase client instance
 * @param id - Recipe UUID
 * @returns Recipe card or null if not found
 */
export async function getRecipeById(
  supabase: SupabaseClient,
  id: string
): Promise<RecipeCard | null> {
  const { data, error } = await supabase
    .from('posts')
    .select(RECIPE_CARD_COLUMNS)
    .eq('id', id)
    .eq('status', 'active')
    .single()

  if (error) {
    console.error('getRecipeById error:', error)
    return null
  }

  return data ? formatRecipeCard(data) : null
}

/**
 * Fetch a single recipe by slug
 *
 * @param supabase - Supabase client instance
 * @param slug - Recipe slug
 * @returns Recipe card or null if not found
 */
export async function getRecipeBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<RecipeCard | null> {
  const { data, error } = await supabase
    .from('posts')
    .select(RECIPE_CARD_COLUMNS)
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (error) {
    console.error('getRecipeBySlug error:', error)
    return null
  }

  return data ? formatRecipeCard(data) : null
}

/**
 * Fetch minimal recipes for lightweight operations (planner, autocomplete)
 *
 * @param supabase - Supabase client instance
 * @param filters - Optional filters (search query, diet_tags, food_tags)
 * @param limit - Maximum number of results (default 30)
 * @returns Array of minimal recipes
 */
export async function getMinimalRecipes(
  supabase: SupabaseClient,
  filters?: PostFilters,
  limit: number = 30
): Promise<MinimalRecipe[]> {
  let query = supabase
    .from('posts')
    .select(MINIMAL_RECIPE_COLUMNS)
    .eq('type', 'recipe')
    .eq('status', 'active')

  // Text search
  if (filters?.searchQuery) {
    const safeQ = filters.searchQuery.replace(/[%_]/g, '')
    query = query.or(`title.ilike.%${safeQ}%,summary.ilike.%${safeQ}%`)
  }

  // Diet tags filter
  if (filters?.dietTags && filters.dietTags.length > 0) {
    query = query.contains('diet_tags', filters.dietTags)
  }

  // Food tags filter
  if (filters?.foodTags && filters.foodTags.length > 0) {
    query = query.contains('food_tags', filters.foodTags)
  }

  query = query.order('quality_score', { ascending: false, nullsFirst: false }).limit(limit)

  const { data, error } = await query

  if (error) {
    console.error('getMinimalRecipes error:', error)
    return []
  }

  return data || []
}

/**
 * Fetch recipes filtered by region (approach slug prefix)
 *
 * @param supabase - Supabase client instance
 * @param region - Region/approach slug
 * @param pagination - Optional pagination options
 * @returns Array of recipe cards
 */
export async function getRecipesByRegion(
  supabase: SupabaseClient,
  region: string,
  pagination?: PaginationOptions
): Promise<RecipeCard[]> {
  // Look up the approach by slug
  const { data: approach } = await supabase
    .from('approaches')
    .select('id')
    .eq('slug', region)
    .single()

  if (!approach) {
    return []
  }

  return getRecipeCards(supabase, { region }, pagination)
}

/**
 * Fetch recipes filtered by country (slug prefix)
 *
 * @param supabase - Supabase client instance
 * @param countrySlug - Country slug
 * @param pagination - Optional pagination options
 * @returns Array of recipe cards
 */
export async function getRecipesByCountry(
  supabase: SupabaseClient,
  countrySlug: string,
  pagination?: PaginationOptions
): Promise<RecipeCard[]> {
  // Country filtering would typically be done via a countries table join
  // For now, we'll use a simple filter pattern
  let query = supabase
    .from('posts')
    .select(RECIPE_CARD_COLUMNS)
    .eq('status', 'active')
    .eq('type', 'recipe')

  // Assuming there's a country_slug column or similar
  // This is a placeholder - adjust based on actual schema
  query = query.ilike('slug', `${countrySlug}-%`)

  const page = pagination?.page || 1
  const perPage = pagination?.perPage || 12
  const offset = (page - 1) * perPage
  query = query.range(offset, offset + perPage - 1)

  const { data, error } = await query

  if (error) {
    console.error('getRecipesByCountry error:', error)
    return []
  }

  return (data || []).map(post => formatRecipeCard(post))
}

/**
 * Search recipes by text query with optional filters
 *
 * @param supabase - Supabase client instance
 * @param query - Search text (title/summary)
 * @param filters - Optional filters (type, diet_tags, food_tags, etc.)
 * @param pagination - Optional pagination options
 * @returns Array of recipe cards
 */
export async function searchRecipes(
  supabase: SupabaseClient,
  query: string,
  filters?: PostFilters,
  pagination?: PaginationOptions
): Promise<RecipeCard[]> {
  return getRecipeCards(
    supabase,
    { ...filters, searchQuery: query },
    pagination
  )
}

/**
 * Create a new post (recipe)
 *
 * @param supabase - Supabase client instance
 * @param data - Post data (title, content, type, etc.)
 * @returns Created post ID or null on error
 */
export async function createPost(
  supabase: SupabaseClient,
  data: {
    created_by: string
    title: string
    content: string
    type: 'recipe' | 'cocktail' | 'short' | 'video' | 'image'
    slug: string
    status?: 'active' | 'archived' | 'deleted'
    hero_image_url?: string | null
    diet_tags?: string[]
    food_tags?: string[]
    recipe_json?: Record<string, unknown> | null
    summary?: string | null
    approach_id?: string | null
  }
): Promise<string | null> {
  const { data: result, error } = await supabase
    .from('posts')
    .insert({
      created_by: data.created_by,
      title: data.title,
      content: data.content,
      type: data.type,
      slug: data.slug,
      status: data.status || 'active',
      hero_image_url: data.hero_image_url || null,
      diet_tags: data.diet_tags || [],
      food_tags: data.food_tags || [],
      recipe_json: data.recipe_json || null,
      summary: data.summary || null,
      approach_id: data.approach_id || null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('createPost error:', error)
    return null
  }

  return result?.id || null
}

/**
 * Update a post (with ownership check)
 *
 * @param supabase - Supabase client instance
 * @param id - Post UUID
 * @param userId - User ID (for ownership verification)
 * @param data - Partial post data to update
 * @returns true if successful, false otherwise
 */
export async function updatePost(
  supabase: SupabaseClient,
  id: string,
  userId: string,
  data: Partial<{
    title: string
    content: string
    summary: string
    hero_image_url: string | null
    diet_tags: string[]
    food_tags: string[]
    recipe_json: Record<string, unknown> | null
    status: 'active' | 'archived' | 'deleted'
  }>
): Promise<boolean> {
  // Verify ownership
  const { data: post } = await supabase
    .from('posts')
    .select('created_by')
    .eq('id', id)
    .single()

  if (!post || post.created_by !== userId) {
    console.error('updatePost: ownership check failed')
    return false
  }

  const { error } = await supabase
    .from('posts')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('updatePost error:', error)
    return false
  }

  return true
}

/**
 * Soft delete a post (set status to 'deleted')
 *
 * @param supabase - Supabase client instance
 * @param id - Post UUID
 * @param userId - User ID (for ownership verification)
 * @returns true if successful, false otherwise
 */
export async function softDeletePost(
  supabase: SupabaseClient,
  id: string,
  userId: string
): Promise<boolean> {
  return updatePost(supabase, id, userId, { status: 'deleted' })
}

/**
 * Helper function to format raw post data into RecipeCard type
 */
function formatRecipeCard(post: any): RecipeCard {
  const creatorData = post.created_by as any
  const approachData = post.approaches as any

  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    summary: post.summary || null,
    hero_image_url: post.hero_image_url || null,
    type: post.type,
    status: post.status,
    created_at: post.created_at,
    is_tested: post.is_tested || false,
    quality_score: post.quality_score || null,
    diet_tags: post.diet_tags || [],
    food_tags: post.food_tags || [],
    created_by: {
      id: creatorData?.id || '',
      display_name: creatorData?.display_name || 'Unknown',
      handle: creatorData?.handle || '',
      avatar_url: creatorData?.avatar_url || null,
    },
    approach: approachData
      ? {
          id: approachData.id,
          name: approachData.name,
          slug: approachData.slug,
        }
      : null,
  }
}
