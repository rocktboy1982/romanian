/**
 * recipe-importer.js — Reusable TheMealDB recipe importer module
 *
 * Fetches recipes from the free TheMealDB API (themealdb.com/api.php).
 * No API key required (uses test key "1" by default).
 * Normalizes TheMealDB response format into the project's standard recipe shape.
 *
 * Usage:
 *   const { createRecipeImporter } = require('./recipe-importer')
 *
 *   const importer = createRecipeImporter({
 *     apiKey: '1',  // TheMealDB test key (default)
 *     delayMs: 1000, // Delay between API calls (default: 1000ms)
 *   })
 *
 *   // Search by meal name
 *   const result = await importer.search('Arrabiata')
 *
 *   // Get meal by TheMealDB ID
 *   const meal = await importer.getById('52772')
 *
 *   // List meals by country
 *   const meals = await importer.listByCountry('Canadian')
 *
 *   // Get all available countries
 *   const countries = await importer.listCountries()
 *
 *   // Get all available categories
 *   const categories = await importer.listCategories()
 *
 *   // Get a random meal
 *   const random = await importer.getRandom()
 *
 *   // Normalize a TheMealDB meal object to project format
 *   const normalized = importer.normalize(mealObject)
 *
 * Normalized recipe shape:
 *   {
 *     title: string,           // strMeal
 *     slug: string,            // generated from country + title
 *     summary: string,         // first 200 chars of instructions
 *     country: string,         // strArea (lowercase)
 *     category: string,        // strCategory
 *     ingredients: string[],   // combine strIngredient + strMeasure
 *     instructions: string,    // strInstructions
 *     image_url: string,       // strMealThumb
 *     video_url: string|null,  // strYoutube
 *     source_url: string|null, // strSource
 *     tags: string[],          // strTags split by comma
 *     external_id: string,     // idMeal
 *     recipe_json: object,     // full recipe data for DB storage
 *   }
 */

const https = require('https')

// ── HTTP Client ─────────────────────────────────────────

/**
 * Make an HTTPS GET request.
 * @param {string} url - Full URL to fetch
 * @param {object} [headers={}] - Additional headers
 * @param {number} [timeout=15000] - Request timeout in ms
 * @returns {Promise<{statusCode: number, headers: object, body: string, json: function}>}
 */
function httpsGet(url, headers = {}, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: { 'User-Agent': 'RecipeImporterModule/1.0', ...headers },
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

/**
 * Sleep for a given number of milliseconds.
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Recipe Importer Factory ──────────────────────────────

/**
 * Create a recipe importer client for TheMealDB.
 *
 * @param {Object} [config={}]
 * @param {string} [config.apiKey='1'] - TheMealDB API key (test key by default)
 * @param {number} [config.delayMs=1000] - Delay between API calls in milliseconds
 * @returns {RecipeImporter}
 */
function createRecipeImporter(config = {}) {
  const apiKey = config.apiKey || '1'
  const delayMs = config.delayMs || 1000
  const baseUrl = 'https://www.themealdb.com/api/json/v1'

  let lastRequestTime = 0

  /**
   * Enforce rate limiting by delaying between requests.
   * @returns {Promise<void>}
   */
  async function enforceDelay() {
    const now = Date.now()
    const timeSinceLastRequest = now - lastRequestTime
    if (timeSinceLastRequest < delayMs) {
      await sleep(delayMs - timeSinceLastRequest)
    }
    lastRequestTime = Date.now()
  }

  /**
   * Normalize a TheMealDB meal object to project recipe format.
   *
   * @param {Object} meal - TheMealDB meal object
   * @returns {Object} Normalized recipe object
   */
  function normalize(meal) {
    if (!meal) return null

    // Extract ingredients and measures
    const ingredients = []
    for (let i = 1; i <= 20; i++) {
      const ingredient = meal[`strIngredient${i}`]
      const measure = meal[`strMeasure${i}`]

      if (ingredient && ingredient.trim()) {
        const combined = measure && measure.trim()
          ? `${measure.trim()} ${ingredient.trim()}`
          : ingredient.trim()
        ingredients.push(combined)
      }
    }

    // Extract tags
    const tags = meal.strTags
      ? meal.strTags.split(',').map(t => t.trim()).filter(t => t)
      : []

    // Generate slug: country-dish-name format
    const country = (meal.strArea || 'unknown').toLowerCase().replace(/\s+/g, '-')
    const title = meal.strMeal || 'unknown'
    const titleSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const slug = `${country}-${titleSlug}`

    // Extract summary (first 200 chars of instructions)
    const instructions = meal.strInstructions || ''
    const summary = instructions.substring(0, 200)

    return {
      title: meal.strMeal || '',
      slug,
      summary,
      country: (meal.strArea || '').toLowerCase(),
      category: meal.strCategory || '',
      ingredients,
      instructions,
      image_url: meal.strMealThumb || '',
      video_url: meal.strYoutube || null,
      source_url: meal.strSource || null,
      tags,
      external_id: String(meal.idMeal || ''),
      recipe_json: meal, // Store full meal data for DB
    }
  }

  return {
    /**
     * Search for meals by name.
     *
     * @param {string} query - Meal name to search for
     * @returns {Promise<Object[]>} Array of normalized recipe objects
     */
    async search(query) {
      if (!query || !query.trim()) return []

      await enforceDelay()

      try {
        const url = `${baseUrl}/${apiKey}/search.php?s=${encodeURIComponent(query)}`
        const res = await httpsGet(url)

        if (res.statusCode !== 200) return []

        const data = res.json()
        if (!data || !data.meals) return []

        return data.meals.map(meal => normalize(meal))
      } catch (error) {
        console.error('Error searching meals:', error.message)
        return []
      }
    },

    /**
     * Get a single meal by TheMealDB ID.
     *
     * @param {string|number} id - TheMealDB meal ID
     * @returns {Promise<Object|null>} Normalized recipe object or null
     */
    async getById(id) {
      if (!id) return null

      await enforceDelay()

      try {
        const url = `${baseUrl}/${apiKey}/lookup.php?i=${encodeURIComponent(id)}`
        const res = await httpsGet(url)

        if (res.statusCode !== 200) return null

        const data = res.json()
        if (!data || !data.meals || data.meals.length === 0) return null

        return normalize(data.meals[0])
      } catch (error) {
        console.error('Error fetching meal by ID:', error.message)
        return null
      }
    },

    /**
     * List meals filtered by country/area.
     *
     * @param {string} country - Country/area name (e.g., "Canadian", "Italian")
     * @returns {Promise<Object[]>} Array of normalized recipe objects
     */
    async listByCountry(country) {
      if (!country || !country.trim()) return []

      await enforceDelay()

      try {
        const url = `${baseUrl}/${apiKey}/filter.php?a=${encodeURIComponent(country)}`
        const res = await httpsGet(url)

        if (res.statusCode !== 200) return []

        const data = res.json()
        if (!data || !data.meals) return []

        // Note: filter endpoint returns simplified meal objects (no ingredients/instructions)
        // For full details, you'd need to call getById() for each meal
        return data.meals.map(meal => normalize(meal))
      } catch (error) {
        console.error('Error listing meals by country:', error.message)
        return []
      }
    },

    /**
     * Get all available countries/areas.
     *
     * @returns {Promise<string[]>} Array of country names
     */
    async listCountries() {
      await enforceDelay()

      try {
        const url = `${baseUrl}/${apiKey}/list.php?a=list`
        const res = await httpsGet(url)

        if (res.statusCode !== 200) return []

        const data = res.json()
        if (!data || !data.meals) return []

        return data.meals.map(item => item.strArea || '').filter(a => a)
      } catch (error) {
        console.error('Error listing countries:', error.message)
        return []
      }
    },

    /**
     * Get all available meal categories.
     *
     * @returns {Promise<string[]>} Array of category names
     */
    async listCategories() {
      await enforceDelay()

      try {
        const url = `${baseUrl}/${apiKey}/categories.php`
        const res = await httpsGet(url)

        if (res.statusCode !== 200) return []

        const data = res.json()
        if (!data || !data.categories) return []

        return data.categories.map(cat => cat.strCategory || '').filter(c => c)
      } catch (error) {
        console.error('Error listing categories:', error.message)
        return []
      }
    },

    /**
     * Get a random meal.
     *
     * @returns {Promise<Object|null>} Normalized recipe object or null
     */
    async getRandom() {
      await enforceDelay()

      try {
        const url = `${baseUrl}/${apiKey}/random.php`
        const res = await httpsGet(url)

        if (res.statusCode !== 200) return null

        const data = res.json()
        if (!data || !data.meals || data.meals.length === 0) return null

        return normalize(data.meals[0])
      } catch (error) {
        console.error('Error fetching random meal:', error.message)
        return null
      }
    },

    /**
     * Normalize a TheMealDB meal object to project recipe format.
     * Public method for manual normalization.
     *
     * @param {Object} meal - TheMealDB meal object
     * @returns {Object|null} Normalized recipe object or null
     */
    normalize,
  }
}

module.exports = { createRecipeImporter }
