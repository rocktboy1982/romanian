/**
 * image-search.js — Reusable multi-provider image search module
 *
 * Providers: Pexels, Unsplash, Pixabay
 * Each provider is API-compliant (attribution, hotlinking, download triggers).
 *
 * Usage:
 *   const { createImageSearchClient } = require('./image-search')
 *
 *   const client = createImageSearchClient({
 *     pexels:   { apiKey: '...' },
 *     unsplash: { accessKey: '...' },
 *     pixabay:  { apiKey: '...' },
 *   })
 *
 *   // Search one provider
 *   const result = await client.search('chicken tikka masala', { provider: 'pexels' })
 *
 *   // Search all providers with fallback (tries each until a result is found)
 *   const result = await client.search('sushi', { strategy: 'fallback' })
 *
 *   // Search all in parallel and pick the best
 *   const result = await client.search('tacos', { strategy: 'race' })
 *
 *   // Trigger Unsplash download endpoint (required by their API guidelines)
 *   await client.triggerDownload(result)
 *
 *   // Check rate limits
 *   const limits = client.getRateLimits()
 *
 * Result shape:
 *   {
 *     url: string,              // Hotlinked image URL (CDN)
 *     source: 'pexels' | 'unsplash' | 'pixabay',
 *     photoId: string,
 *     photographer: string,
 *     photographerUrl: string,
 *     sourceUrl: string,        // Link to photo page on source site
 *     downloadLocation?: string, // Unsplash only — must call triggerDownload()
 *     attribution: {            // Ready-to-use attribution object for DB storage
 *       source: string,
 *       photographer: string,
 *       photographerUrl: string,
 *       sourceUrl: string,
 *       photoId: string,
 *     }
 *   }
 */

const https = require('https')

// ── HTTP Client ─────────────────────────────────────────

function httpsGet(url, headers = {}, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: { 'User-Agent': 'ImageSearchModule/1.0', ...headers },
      timeout,
    }

    const req = https.get(options, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
          json() { try { return JSON.parse(body) } catch { return null } },
        })
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')) })
  })
}

// ── Pexels Provider ─────────────────────────────────────

function createPexelsProvider(config) {
  const apiKey = config.apiKey
  if (!apiKey) return null

  let remaining = 200 // Pexels: 200 req/hr

  return {
    name: 'pexels',
    remaining() { return remaining },

    async search(query, options = {}) {
      const orientation = options.orientation || 'landscape'
      const perPage = options.perPage || 3
      const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=${orientation}`

      const res = await httpsGet(url, { 'Authorization': apiKey })

      if (res.headers['x-ratelimit-remaining']) {
        remaining = parseInt(res.headers['x-ratelimit-remaining'], 10)
      }

      if (res.statusCode === 429) {
        remaining = 0
        return { rateLimited: true }
      }

      const data = res.json()
      if (!data || !data.photos || data.photos.length === 0) return null

      const photo = data.photos[0]
      const imageUrl = photo.src?.large || photo.src?.medium || photo.src?.original
      if (!imageUrl) return null

      return {
        url: imageUrl,
        source: 'pexels',
        photoId: String(photo.id),
        photographer: photo.photographer || 'Unknown',
        photographerUrl: photo.photographer_url || '',
        sourceUrl: photo.url || `https://www.pexels.com/photo/${photo.id}/`,
        attribution: {
          source: 'pexels',
          photographer: photo.photographer || 'Unknown',
          photographerUrl: photo.photographer_url || '',
          sourceUrl: photo.url || `https://www.pexels.com/photo/${photo.id}/`,
          photoId: String(photo.id),
        },
      }
    },
  }
}

// ── Unsplash Provider ───────────────────────────────────

function createUnsplashProvider(config) {
  const accessKey = config.accessKey
  if (!accessKey) return null

  let remaining = 50 // Unsplash demo: 50 req/hr

  const authHeaders = {
    'Authorization': `Client-ID ${accessKey}`,
    'Accept-Version': 'v1',
  }

  return {
    name: 'unsplash',
    remaining() { return remaining },

    async search(query, options = {}) {
      const orientation = options.orientation || 'landscape'
      const perPage = options.perPage || 3
      const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=${orientation}&content_filter=high&order_by=relevant`

      const res = await httpsGet(url, authHeaders)

      if (res.headers['x-ratelimit-remaining']) {
        remaining = parseInt(res.headers['x-ratelimit-remaining'], 10)
      }

      if (res.statusCode === 403 || res.statusCode === 429) {
        remaining = 0
        return { rateLimited: true }
      }

      const data = res.json()
      if (!data || !data.results || data.results.length === 0) return null

      const photo = data.results[0]
      const imageUrl = photo.urls?.regular || photo.urls?.small
      if (!imageUrl) return null

      const photographer = photo.user?.name || 'Unknown'
      const photographerUrl = photo.user?.links?.html || `https://unsplash.com/@${photo.user?.username || ''}`
      const sourceUrl = photo.links?.html || `https://unsplash.com/photos/${photo.id}`

      return {
        url: imageUrl,
        source: 'unsplash',
        photoId: photo.id,
        photographer,
        photographerUrl,
        sourceUrl,
        downloadLocation: photo.links?.download_location || '',
        attribution: {
          source: 'unsplash',
          photographer,
          photographerUrl,
          sourceUrl,
          photoId: photo.id,
        },
      }
    },

    /**
     * Unsplash API guideline: must trigger download_location when a photo is used.
     * Does NOT download the actual image — just signals usage to Unsplash.
     */
    async triggerDownload(downloadLocation) {
      if (!downloadLocation) return false
      try {
        await httpsGet(downloadLocation, authHeaders)
        return true
      } catch {
        return false
      }
    },
  }
}

// ── Pixabay Provider ────────────────────────────────────

function createPixabayProvider(config) {
  const apiKey = config.apiKey
  if (!apiKey) return null

  // Pixabay doesn't expose rate-limit headers; enforced server-side at ~100 req/min
  let remaining = 5000

  return {
    name: 'pixabay',
    remaining() { return remaining },

    async search(query, options = {}) {
      const orientation = options.orientation === 'landscape' ? 'horizontal' : options.orientation === 'portrait' ? 'vertical' : 'all'
      const perPage = options.perPage || 3
      const category = options.category || 'food'
      const url = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&image_type=photo&orientation=${orientation}&category=${category}&per_page=${perPage}&safesearch=true`

      const res = await httpsGet(url)

      if (res.statusCode === 429) {
        remaining = 0
        return { rateLimited: true }
      }

      const data = res.json()
      if (!data || !data.hits || data.hits.length === 0) return null

      const photo = data.hits[0]
      // largeImageURL is 1280px (no auth needed), webformatURL is 640px
      const imageUrl = photo.largeImageURL || photo.webformatURL
      if (!imageUrl) return null

      const photographer = photo.user || 'Unknown'
      const photographerUrl = `https://pixabay.com/users/${photo.user}-${photo.user_id}/`
      const sourceUrl = photo.pageURL || `https://pixabay.com/photos/id-${photo.id}/`

      return {
        url: imageUrl,
        source: 'pixabay',
        photoId: String(photo.id),
        photographer,
        photographerUrl,
        sourceUrl,
        attribution: {
          source: 'pixabay',
          photographer,
          photographerUrl,
          sourceUrl,
          photoId: String(photo.id),
        },
      }
    },
  }
}

// ── Client Factory ──────────────────────────────────────

/**
 * Create an image search client with one or more providers.
 *
 * @param {Object} config
 * @param {Object} [config.pexels]   - { apiKey: string }
 * @param {Object} [config.unsplash] - { accessKey: string }
 * @param {Object} [config.pixabay]  - { apiKey: string }
 * @param {Object} [config.options]  - { userAgent?: string, defaultOrientation?: string }
 * @returns {ImageSearchClient}
 */
function createImageSearchClient(config = {}) {
  const providers = {}

  if (config.pexels) {
    const p = createPexelsProvider(config.pexels)
    if (p) providers.pexels = p
  }
  if (config.unsplash) {
    const p = createUnsplashProvider(config.unsplash)
    if (p) providers.unsplash = p
  }
  if (config.pixabay) {
    const p = createPixabayProvider(config.pixabay)
    if (p) providers.pixabay = p
  }

  // Default provider order: Pexels (200/hr) > Pixabay (high limit) > Unsplash (50/hr)
  const defaultOrder = ['pexels', 'pixabay', 'unsplash']

  return {
    /**
     * Search for an image across providers.
     *
     * @param {string} query - Search query (e.g., "chicken tikka masala food")
     * @param {Object} [options]
     * @param {'pexels'|'unsplash'|'pixabay'} [options.provider]   - Use a specific provider
     * @param {'fallback'|'race'} [options.strategy='fallback']     - fallback: try each in order; race: all in parallel
     * @param {string} [options.orientation='landscape']
     * @param {number} [options.perPage=3]
     * @param {string} [options.category]                            - Pixabay category filter
     * @param {string[]} [options.providerOrder]                     - Custom provider priority
     * @returns {Promise<ImageResult|null>}
     */
    async search(query, options = {}) {
      const orientation = options.orientation || config.options?.defaultOrientation || 'landscape'
      const searchOpts = { orientation, perPage: options.perPage || 3, category: options.category }

      // Single provider mode
      if (options.provider) {
        const p = providers[options.provider]
        if (!p) return null
        if (p.remaining() <= 1) return null
        const result = await p.search(query, searchOpts)
        if (result && result.rateLimited) return null
        return result
      }

      const order = options.providerOrder || defaultOrder

      // Race mode: all providers in parallel, first result wins
      if (options.strategy === 'race') {
        const available = order.filter(n => providers[n] && providers[n].remaining() > 1)
        if (available.length === 0) return null

        const results = await Promise.allSettled(
          available.map(n => providers[n].search(query, searchOpts))
        )

        for (const r of results) {
          if (r.status === 'fulfilled' && r.value && !r.value.rateLimited && r.value.url) {
            return r.value
          }
        }
        return null
      }

      // Fallback mode (default): try each provider in order
      for (const name of order) {
        const p = providers[name]
        if (!p || p.remaining() <= 1) continue

        try {
          const result = await p.search(query, searchOpts)
          if (result && result.rateLimited) continue
          if (result && result.url) return result
        } catch {
          continue
        }
      }

      return null
    },

    /**
     * Trigger the Unsplash download endpoint (required by their API).
     * Call this after using an Unsplash photo.
     *
     * @param {ImageResult} result - The search result (must have downloadLocation)
     * @returns {Promise<boolean>}
     */
    async triggerDownload(result) {
      if (!result || result.source !== 'unsplash' || !result.downloadLocation) return false
      const unsplash = providers.unsplash
      if (!unsplash || !unsplash.triggerDownload) return false
      return unsplash.triggerDownload(result.downloadLocation)
    },

    /**
     * Get current rate limit status for all providers.
     * @returns {Object} { pexels: number, unsplash: number, pixabay: number }
     */
    getRateLimits() {
      const limits = {}
      for (const [name, p] of Object.entries(providers)) {
        limits[name] = p.remaining()
      }
      return limits
    },

    /**
     * Check if any provider has capacity.
     * @returns {boolean}
     */
    hasCapacity() {
      return Object.values(providers).some(p => p.remaining() > 1)
    },

    /**
     * Get the best available provider (most remaining capacity).
     * @returns {string|null}
     */
    bestProvider() {
      let best = null
      let bestRemaining = 0
      for (const [name, p] of Object.entries(providers)) {
        if (p.remaining() > bestRemaining) {
          best = name
          bestRemaining = p.remaining()
        }
      }
      return best
    },

    /** List registered provider names */
    providers: Object.keys(providers),
  }
}

module.exports = { createImageSearchClient }
