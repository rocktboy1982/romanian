/**
 * Batch-translate all recipe records in the Supabase DB to Romanian.
 *
 * Translates: title, summary, ingredients (in recipe_json), instructions (in recipe_json)
 * Uses the free Google Translate endpoint (no API key required).
 *
 * Usage:
 *   node scripts/translate-recipes.js
 *
 * Environment (reads from .env.local automatically):
 *   NEXT_PUBLIC_SUPABASE_URL   — Supabase REST URL
 *   SUPABASE_SERVICE_ROLE_KEY  — Service role key (or anon key)
 *
 * The script:
 * 1. Fetches all recipe posts in batches of 100
 * 2. For each recipe, translates title, summary, and recipe_json fields
 * 3. Updates the DB record with translated content
 * 4. Tracks progress and can resume from where it left off
 */

const { createClient } = require('@supabase/supabase-js')
const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')

// Load .env.local
try {
  const envPath = path.join(__dirname, '..', '.env.local')
  const envContent = fs.readFileSync(envPath, 'utf8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
} catch { /* ignore if no .env.local */ }

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const PROGRESS_FILE = path.join(__dirname, '.translate-progress.json')
const BATCH_SIZE = 100
const TARGET_LANG = 'ro'

// Rate limiting — be gentle with the free endpoint
const DELAY_BETWEEN_RECIPES = 200   // ms between recipes
const DELAY_BETWEEN_FIELDS = 100    // ms between fields within a recipe
const MAX_TEXT_LENGTH = 4500         // max chars per translation request

/**
 * Translate text using the free Google Translate endpoint.
 * Falls back gracefully on failure — returns original text.
 */
async function translateText(text, sourceLang = 'en', targetLang = 'ro') {
  if (!text || typeof text !== 'string' || text.trim().length === 0) return text
  // Skip if already looks Romanian (rough heuristic)
  if (/[ăâîșț]/i.test(text) && text.length > 20) return text

  // Truncate very long texts
  const input = text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text

  const encoded = encodeURIComponent(input)
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encoded}`

  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 15000 }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (Array.isArray(parsed) && Array.isArray(parsed[0])) {
            const translated = parsed[0].map(s => (s && s[0]) || '').join('')
            resolve(translated || text)
          } else {
            resolve(text)
          }
        } catch {
          resolve(text)
        }
      })
    })
    req.on('error', () => resolve(text))
    req.on('timeout', () => { req.destroy(); resolve(text) })
  })
}

/**
 * Translate an array of strings (e.g., ingredients or instructions).
 * Batches them into a single request by joining with a delimiter.
 */
async function translateArray(arr, sourceLang = 'en', targetLang = 'ro') {
  if (!Array.isArray(arr) || arr.length === 0) return arr

  // For short arrays, translate individually for better quality
  if (arr.length <= 5) {
    const results = []
    for (const item of arr) {
      results.push(await translateText(item, sourceLang, targetLang))
      await sleep(DELAY_BETWEEN_FIELDS)
    }
    return results
  }

  // For longer arrays, batch with delimiter
  const DELIMITER = ' ||| '
  const joined = arr.join(DELIMITER)

  // If too long, split into chunks
  if (joined.length > MAX_TEXT_LENGTH) {
    const mid = Math.floor(arr.length / 2)
    const first = await translateArray(arr.slice(0, mid), sourceLang, targetLang)
    await sleep(DELAY_BETWEEN_FIELDS)
    const second = await translateArray(arr.slice(mid), sourceLang, targetLang)
    return [...first, ...second]
  }

  const translated = await translateText(joined, sourceLang, targetLang)
  const parts = translated.split(/\s*\|\|\|\s*/)

  // If split count matches, great. Otherwise fall back to individual translation
  if (parts.length === arr.length) {
    return parts
  }

  // Fallback: translate individually
  const results = []
  for (const item of arr) {
    results.push(await translateText(item, sourceLang, targetLang))
    await sleep(DELAY_BETWEEN_FIELDS)
  }
  return results
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'))
    }
  } catch { /* ignore */ }
  return { translatedIds: [], lastOffset: 0, stats: { total: 0, translated: 0, failed: 0, skipped: 0 } }
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2))
}

async function main() {
  console.log('=== Recipe Translation Script (EN → RO) ===')
  console.log(`Supabase URL: ${SUPABASE_URL}`)
  console.log()

  const progress = loadProgress()
  const translatedSet = new Set(progress.translatedIds)

  // Count total recipes
  const { count } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'recipe')
    .eq('status', 'active')

  console.log(`Total active recipes: ${count}`)
  console.log(`Already translated: ${translatedSet.size}`)
  console.log(`Remaining: ${count - translatedSet.size}`)
  console.log()

  let offset = 0
  let batchNum = 0
  let translated = progress.stats.translated
  let failed = progress.stats.failed
  let skipped = progress.stats.skipped

  while (true) {
    const { data: recipes, error } = await supabase
      .from('posts')
      .select('id, title, summary, slug, recipe_json')
      .eq('type', 'recipe')
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1)

    if (error) {
      console.error(`Error fetching batch at offset ${offset}:`, error.message)
      break
    }

    if (!recipes || recipes.length === 0) {
      console.log('No more recipes to process.')
      break
    }

    batchNum++
    console.log(`--- Batch ${batchNum} (offset ${offset}, ${recipes.length} recipes) ---`)

    for (const recipe of recipes) {
      if (translatedSet.has(recipe.id)) {
        skipped++
        continue
      }

      try {
        const rj = recipe.recipe_json || {}

        // Translate title
        const newTitle = await translateText(recipe.title || '', 'en', TARGET_LANG)
        await sleep(DELAY_BETWEEN_FIELDS)

        // Translate summary
        const newSummary = await translateText(recipe.summary || '', 'en', TARGET_LANG)
        await sleep(DELAY_BETWEEN_FIELDS)

        // Translate ingredients (support both formats)
        const ingredients = rj.ingredients || rj.recipeIngredient || []
        const newIngredients = await translateArray(ingredients, 'en', TARGET_LANG)
        await sleep(DELAY_BETWEEN_FIELDS)

        // Translate instructions/steps
        const instructions = rj.instructions || rj.steps || rj.recipeInstructions || []
        const newInstructions = await translateArray(instructions, 'en', TARGET_LANG)

        // Build updated recipe_json
        const updatedRj = { ...rj }
        if (rj.ingredients) updatedRj.ingredients = newIngredients
        if (rj.recipeIngredient) updatedRj.recipeIngredient = newIngredients
        if (rj.instructions) updatedRj.instructions = newInstructions
        if (rj.steps) updatedRj.steps = newInstructions
        if (rj.recipeInstructions) updatedRj.recipeInstructions = newInstructions

        // Update DB
        const { error: updateErr } = await supabase
          .from('posts')
          .update({
            title: newTitle,
            summary: newSummary,
            recipe_json: updatedRj,
          })
          .eq('id', recipe.id)

        if (updateErr) {
          console.error(`  ✗ Failed to update ${recipe.slug}: ${updateErr.message}`)
          failed++
        } else {
          translated++
          translatedSet.add(recipe.id)
          const shortTitle = (newTitle || '').slice(0, 50)
          process.stdout.write(`  ✓ ${translated}/${count} ${recipe.slug} → "${shortTitle}"\n`)
        }

        // Save progress every 10 recipes
        if (translated % 10 === 0) {
          saveProgress({
            translatedIds: [...translatedSet],
            lastOffset: offset,
            stats: { total: count, translated, failed, skipped }
          })
        }

        await sleep(DELAY_BETWEEN_RECIPES)
      } catch (err) {
        console.error(`  ✗ Error translating ${recipe.slug}:`, err.message || err)
        failed++
      }
    }

    offset += BATCH_SIZE
  }

  // Final save
  saveProgress({
    translatedIds: [...translatedSet],
    lastOffset: offset,
    stats: { total: count, translated, failed, skipped }
  })

  console.log()
  console.log('=== Translation Complete ===')
  console.log(`Total: ${count}`)
  console.log(`Translated: ${translated}`)
  console.log(`Failed: ${failed}`)
  console.log(`Skipped (already done): ${skipped}`)
  console.log()
  console.log(`Progress saved to ${PROGRESS_FILE}`)
  console.log('Run again to retry failed recipes or continue from where you left off.')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
