/**
 * recipe-importer.d.ts — TypeScript declarations for recipe-importer module
 *
 * TheMealDB recipe importer with normalization to project recipe format.
 * Provides unified API for searching, filtering, and fetching recipes.
 */

/**
 * Normalized recipe object (project standard format)
 */
export interface NormalizedRecipe {
  title: string
  slug: string
  summary: string
  country: string
  category: string
  ingredients: string[]
  instructions: string
  image_url: string
  video_url: string | null
  source_url: string | null
  tags: string[]
  external_id: string
  recipe_json: Record<string, any>
}

/**
 * Configuration for recipe importer
 */
export interface RecipeImporterConfig {
  apiKey?: string
  delayMs?: number
}

/**
 * Recipe importer client interface
 */
export interface RecipeImporter {
  /**
   * Search for meals by name
   * @param query - Meal name to search for
   * @returns Promise resolving to array of normalized recipe objects
   */
  search(query: string): Promise<NormalizedRecipe[]>

  /**
   * Get a single meal by TheMealDB ID
   * @param id - TheMealDB meal ID
   * @returns Promise resolving to normalized recipe object or null
   */
  getById(id: string | number): Promise<NormalizedRecipe | null>

  /**
   * List meals filtered by country/area
   * @param country - Country/area name (e.g., "Canadian", "Italian")
   * @returns Promise resolving to array of normalized recipe objects
   */
  listByCountry(country: string): Promise<NormalizedRecipe[]>

  /**
   * Get all available countries/areas
   * @returns Promise resolving to array of country names
   */
  listCountries(): Promise<string[]>

  /**
   * Get all available meal categories
   * @returns Promise resolving to array of category names
   */
  listCategories(): Promise<string[]>

  /**
   * Get a random meal
   * @returns Promise resolving to normalized recipe object or null
   */
  getRandom(): Promise<NormalizedRecipe | null>

  /**
   * Normalize a TheMealDB meal object to project recipe format
   * @param meal - TheMealDB meal object
   * @returns Normalized recipe object or null
   */
  normalize(meal: Record<string, any>): NormalizedRecipe | null
}

/**
 * Create a recipe importer client for TheMealDB
 * @param config - Configuration object with API key and delay settings
 * @returns RecipeImporter instance
 */
export function createRecipeImporter(config?: RecipeImporterConfig): RecipeImporter
