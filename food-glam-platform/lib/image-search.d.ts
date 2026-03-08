/**
 * image-search.d.ts — TypeScript declarations for image-search module
 *
 * Multi-provider image search client supporting Pexels, Unsplash, and Pixabay.
 * Provides unified API for searching, downloading, and managing rate limits.
 */

/**
 * Attribution information for an image result
 */
export interface ImageAttribution {
  source: 'pexels' | 'unsplash' | 'pixabay'
  photographer: string
  photographerUrl: string
  sourceUrl: string
  photoId: string
}

/**
 * Search result from an image provider
 */
export interface ImageSearchResult {
  url: string
  source: 'pexels' | 'unsplash' | 'pixabay'
  photoId: string
  photographer: string
  photographerUrl: string
  sourceUrl: string
  downloadLocation?: string
  attribution: ImageAttribution
}

/**
 * Search options for image queries
 */
export interface ImageSearchOptions {
  provider?: 'pexels' | 'unsplash' | 'pixabay'
  strategy?: 'fallback' | 'race'
  orientation?: 'landscape' | 'portrait' | 'square'
  perPage?: number
  category?: string
  providerOrder?: string[]
}

/**
 * Configuration for a specific provider
 */
export interface ProviderConfig {
  apiKey?: string
  accessKey?: string
}

/**
 * Configuration for image search client
 */
export interface ImageSearchClientConfig {
  pexels?: { apiKey: string }
  unsplash?: { accessKey: string }
  pixabay?: { apiKey: string }
  options?: {
    userAgent?: string
    defaultOrientation?: string
  }
}

/**
 * Rate limit status for all providers
 */
export interface RateLimits {
  [provider: string]: number
}

/**
 * Image search client interface
 */
export interface ImageSearchClient {
  /**
   * Search for an image across providers
   * @param query - Search query (e.g., "chicken tikka masala")
   * @param options - Search options (provider, strategy, orientation, etc.)
   * @returns Promise resolving to ImageSearchResult or null if no results found
   */
  search(query: string, options?: ImageSearchOptions): Promise<ImageSearchResult | null>

  /**
   * Trigger the Unsplash download endpoint (required by their API)
   * @param result - The search result with downloadLocation
   * @returns Promise resolving to boolean indicating success
   */
  triggerDownload(result: ImageSearchResult): Promise<boolean>

  /**
   * Get current rate limit status for all providers
   * @returns Object with remaining requests per provider
   */
  getRateLimits(): RateLimits

  /**
   * Check if any provider has capacity
   * @returns boolean indicating if at least one provider has remaining capacity
   */
  hasCapacity(): boolean

  /**
   * Get the best available provider (most remaining capacity)
   * @returns Provider name or null if no providers available
   */
  bestProvider(): string | null

  /**
   * List registered provider names
   */
  providers: string[]
}

/**
 * Create an image search client with one or more providers
 * @param config - Configuration object with provider credentials
 * @returns ImageSearchClient instance
 */
export function createImageSearchClient(config?: ImageSearchClientConfig): ImageSearchClient
