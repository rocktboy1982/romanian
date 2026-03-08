/**
 * JSON-LD Recipe Extractor
 * Extracts structured recipe data from HTML pages using JSON-LD markup.
 * Standalone module — no framework dependencies.
 *
 * Usage:
 *   const { extractRecipesFromHtml } = require('./json-ld-extractor')
 *   const recipes = extractRecipesFromHtml(htmlString)
 */

/**
 * Extract all JSON-LD blocks from an HTML string.
 * @param {string} html - Raw HTML content
 * @returns {object[]} Array of parsed JSON-LD objects
 */
function extractJsonLdBlocks(html) {
  const results = []
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m
  while ((m = re.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1].trim())
      const items = Array.isArray(data) ? data : [data]
      for (const item of items) {
        if (item) results.push(item)
      }
    } catch {
      // Skip malformed JSON-LD blocks
    }
  }
  return results
}

/**
 * Find Recipe objects from JSON-LD blocks.
 * Handles nested @graph arrays and direct Recipe types.
 * @param {object[]} blocks - JSON-LD blocks from extractJsonLdBlocks
 * @returns {object[]} Array of Recipe-type objects
 */
function findRecipes(blocks) {
  const recipes = []
  for (const block of blocks) {
    if (!block) continue

    // Direct Recipe type
    if (block['@type'] === 'Recipe') {
      recipes.push(block)
    }

    // Recipe inside @graph array
    if (block['@graph'] && Array.isArray(block['@graph'])) {
      for (const item of block['@graph']) {
        if (item && item['@type'] === 'Recipe') {
          recipes.push(item)
        }
      }
    }

    // Recipe in array at top level
    if (Array.isArray(block)) {
      for (const item of block) {
        if (item && item['@type'] === 'Recipe') {
          recipes.push(item)
        }
      }
    }
  }
  return recipes
}

/**
 * Parse ISO 8601 duration (PT1H30M) to minutes.
 * Handles: PT1H30M, PT45M, PT2H, P0DT0H30M, etc.
 * @param {string} duration - ISO 8601 duration string
 * @returns {number} Total minutes
 */
function parseDuration(duration) {
  if (!duration) return 0
  const str = String(duration)
  let minutes = 0

  // Match hours: PT1H, P0DT1H, etc.
  const hoursMatch = str.match(/(\d+)H/i)
  if (hoursMatch) {
    minutes += parseInt(hoursMatch[1], 10) * 60
  }

  // Match minutes: PT30M, PT1H30M, etc.
  const minutesMatch = str.match(/(\d+)M/i)
  if (minutesMatch) {
    minutes += parseInt(minutesMatch[1], 10)
  }

  return minutes || 0
}

/**
 * Normalize a JSON-LD Recipe into a standard shape.
 * Handles various edge cases found in real-world recipe sites.
 * @param {object} recipe - Raw JSON-LD Recipe object
 * @returns {object|null} Normalized recipe with consistent fields, or null if invalid
 */
function normalizeRecipe(recipe) {
  if (!recipe) return null

  // Extract title
  const title = (recipe.name || '').trim()
  if (!title || title.length < 3) return null

  // Extract and normalize ingredients
  const rawIngredients = recipe.recipeIngredient || []
  const ingredients = rawIngredients
    .filter(Boolean)
    .map(i => String(i).trim())
    .filter(i => i.length > 1)

  if (ingredients.length < 3) return null

  // Extract and normalize instructions
  let instructions = []
  const rawInstructions = recipe.recipeInstructions || []

  for (const step of rawInstructions) {
    if (typeof step === 'string') {
      const trimmed = step.trim()
      if (trimmed.length > 5) instructions.push(trimmed)
    } else if (step && step.text) {
      const trimmed = String(step.text).trim()
      if (trimmed.length > 5) instructions.push(trimmed)
    } else if (step && step['@type'] === 'HowToSection' && step.itemListElement) {
      for (const sub of step.itemListElement) {
        if (sub && sub.text) {
          const trimmed = String(sub.text).trim()
          if (trimmed.length > 5) instructions.push(trimmed)
        } else if (typeof sub === 'string') {
          const trimmed = sub.trim()
          if (trimmed.length > 5) instructions.push(trimmed)
        }
      }
    } else if (step && step.itemListElement && Array.isArray(step.itemListElement)) {
      // Handle HowToStep with itemListElement
      for (const sub of step.itemListElement) {
        if (sub && sub.text) {
          const trimmed = String(sub.text).trim()
          if (trimmed.length > 5) instructions.push(trimmed)
        }
      }
    }
  }

  // Handle sites that embed all steps in a single long string (e.g., taste.co.za)
  if (instructions.length === 1 && instructions[0].length > 100) {
    const split = instructions[0]
      .split(/(?=\d+\.\s)/)
      .map(s => s.trim())
      .filter(s => s.length > 10)
    if (split.length >= 2) {
      instructions = split
    }
  }

  if (instructions.length < 1) return null

  // Extract times
  const prepTime = parseDuration(recipe.prepTime) || 15
  const cookTime = parseDuration(recipe.cookTime) || 30
  const totalTime = prepTime + cookTime

  // Determine difficulty
  const difficulty = totalTime <= 30 ? 'easy' : totalTime <= 75 ? 'medium' : 'hard'

  // Extract servings
  let servings = 4
  if (recipe.recipeYield) {
    const yieldValue = Array.isArray(recipe.recipeYield)
      ? recipe.recipeYield[0]
      : recipe.recipeYield
    const parsed = parseInt(String(yieldValue), 10)
    if (!isNaN(parsed) && parsed > 0 && parsed <= 100) {
      servings = parsed
    }
  }

  // Extract image
  let imageUrl = ''
  if (recipe.image) {
    if (typeof recipe.image === 'string') {
      imageUrl = recipe.image
    } else if (recipe.image.url) {
      imageUrl = recipe.image.url
    } else if (Array.isArray(recipe.image) && recipe.image.length > 0) {
      const firstImage = recipe.image[0]
      imageUrl = typeof firstImage === 'string' ? firstImage : (firstImage.url || '')
    }
  }

  // Extract description/summary
  let summary = (recipe.description || '').trim()
  if (summary.length > 300) {
    summary = summary.slice(0, 297) + '...'
  }

  // Extract cuisine type
  const cuisine = recipe.recipeCuisine || ''

  // Extract category
  const category = recipe.recipeCategory || ''

  // Extract video URL
  let videoUrl = ''
  if (recipe.video) {
    if (typeof recipe.video === 'string') {
      videoUrl = recipe.video
    } else if (recipe.video.contentUrl) {
      videoUrl = recipe.video.contentUrl
    } else if (recipe.video.embedUrl) {
      videoUrl = recipe.video.embedUrl
    }
  }

  // Extract nutrition info
  const nutrition = recipe.nutrition || {}

  return {
    title,
    summary: summary || title,
    description: recipe.description || summary || title,
    ingredients,
    instructions,
    prepTime,
    cookTime,
    totalTime,
    servings,
    difficulty,
    imageUrl,
    cuisine,
    category,
    videoUrl,
    nutrition,
    sourceUrl: recipe.url || '',
  }
}

/**
 * Main entry point: extract recipes from HTML.
 * @param {string} html - Raw HTML content
 * @returns {object[]} Array of normalized recipe objects
 */
function extractRecipesFromHtml(html) {
  const blocks = extractJsonLdBlocks(html)
  const recipes = findRecipes(blocks)
  return recipes
    .map(normalizeRecipe)
    .filter(r => r !== null)
}

module.exports = {
  extractJsonLdBlocks,
  findRecipes,
  normalizeRecipe,
  parseDuration,
  extractRecipesFromHtml,
}
