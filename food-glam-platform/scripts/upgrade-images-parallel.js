#!/usr/bin/env node
/**
 * upgrade-images-parallel.js
 *
 * Runs multiple image upgrade batches in parallel using lib/image-search.js.
 * Each batch processes a slice of recipes with staggered delays.
 *
 * Strategy:
 *   - Split remaining recipes into N concurrent workers
 *   - Each worker uses the same client (shared rate limits via API headers)
 *   - Stagger starts by 5s so they don't all hit the same API simultaneously
 *   - Each worker waits 5s between requests (safe with 3 providers × N workers)
 *   - Pexels: 200/hr, Pixabay: ~100/min, Unsplash: 50/hr
 *   - With 4 workers × 5s delay = ~720 requests/hr across 3 providers = safe
 *
 * Usage: node scripts/upgrade-images-parallel.js [workers]
 *   workers: number of parallel batches (default: 4, max: 6)
 */

const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')
const { createImageSearchClient } = require('../lib/image-search')

// ── Config ──────────────────────────────────────────────
const DB = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '54322'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'postgres',
}

const NUM_WORKERS = Math.min(6, Math.max(1, parseInt(process.argv[2] || '4', 10)))
const WORKER_DELAY_MS = 5000    // 5s between requests per worker
const STAGGER_MS = 5000         // 5s stagger between worker starts
const RATE_LIMIT_PAUSE_MS = 600000 // 10 min pause when all providers exhausted
const PROGRESS_FILE = path.join(__dirname, '.parallel-upgrade-progress.json')

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'))
    }
  } catch {}
  return { processedIds: [], stats: { upgraded: 0, skipped: 0, errors: 0 } }
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2))
}

function extractDishName(slug) {
  const parts = slug.split('-')
  const countryPrefixes = new Set([
    'afghanistan','albania','algeria','andorra','angola','antigua','argentina','armenia',
    'australia','austria','azerbaijan','bahamas','bahrain','bangladesh','barbados','belarus',
    'belgium','belize','benin','bhutan','bolivia','bosnia','botswana','brazil','brunei',
    'bulgaria','burkina','burundi','cabo','cambodia','cameroon','canada','central','chad',
    'chile','china','colombia','comoros','congo','costa','croatia','cuba','cyprus','czech',
    'denmark','djibouti','dominica','dominican','ecuador','egypt','el','equatorial','eritrea',
    'estonia','eswatini','ethiopia','fiji','finland','france','gabon','gambia','georgia',
    'germany','ghana','greece','grenada','guatemala','guinea','guyana','haiti','hawaii',
    'honduras','hungary','iceland','india','indonesia','iran','iraq','ireland','israel',
    'italy','ivory','jamaica','japan','jordan','kazakhstan','kenya','kiribati','korea',
    'kosovo','kuwait','kyrgyzstan','laos','latvia','lebanon','lesotho','liberia','libya',
    'liechtenstein','lithuania','luxembourg','macedonia','madagascar','malawi','malaysia',
    'maldives','mali','malta','marshall','mauritania','mauritius','mexico','micronesia',
    'moldova','monaco','mongolia','montenegro','morocco','mozambique','myanmar','namibia',
    'nauru','nepal','netherlands','new','nicaragua','niger','nigeria','north','norway',
    'oman','pakistan','palau','palestine','panama','papua','paraguay','peru','philippines',
    'poland','portugal','puerto','qatar','rico','romania','russia','rwanda','saint','samoa',
    'san','sao','saudi','senegal','serbia','seychelles','sierra','singapore','slovakia',
    'slovenia','solomon','somalia','south','southern','spain','sri','sudan','suriname',
    'sweden','switzerland','syria','taiwan','tajikistan','tanzania','thailand','togo',
    'tonga','trinidad','tunisia','turkey','turkmenistan','tuvalu','uganda','ukraine',
    'united','uruguay','us','uzbekistan','vanuatu','vatican','venezuela','verde','vietnam',
    'yemen','zambia','zimbabwe','zealand','leone','tome','principe','kitts','nevis','lucia',
    'vincent','grenadines','marino','arabia','africa','lanka','east','timor','guinea','bissau',
    'faso','coast','rep','islands','kingdom','states','arab','emirates','hong','kong',
    'tex','mex','northeastern','midwestern','western','republic'
  ])
  let startIdx = 0
  for (let i = 0; i < parts.length; i++) {
    if (countryPrefixes.has(parts[i])) { startIdx = i + 1 } else { break }
  }
  if (startIdx >= parts.length) startIdx = Math.max(0, parts.length - 3)
  let endIdx = parts.length
  for (let i = parts.length - 1; i >= startIdx; i--) {
    if (/^[0-9a-f]{6,}$/.test(parts[i])) { endIdx = i } else { break }
  }
  return parts.slice(startIdx, endIdx).join(' ')
}

// ── Worker ──────────────────────────────────────────────

async function worker(workerId, recipes, client, pool, progress, typeFilter, mode) {
  const tag = `[W${workerId}]`
  let upgraded = 0, skipped = 0, errors = 0

  for (let i = 0; i < recipes.length; i++) {
    const recipe = recipes[i]

    // Skip if already processed (by another worker or previous run)
    if (progress.processedIds.includes(recipe.id)) continue

    // Use title (preserves proper dish name) instead of slug (loses diacritics/context)
    const dishName = recipe.title
      ? recipe.title.replace(/\s*\(.*?\)\s*/g, '').replace(/[^\w\s'-]/g, '').trim()
      : extractDishName(recipe.slug)
    const num = `${tag} [${i + 1}/${recipes.length}]`

    process.stdout.write(`${num} "${dishName}" ... `)

    try {
      const searchSuffix = typeFilter === 'cocktail' ? ' cocktail drink' : ' food recipe'
      const searchOpts = { strategy: 'fallback' }
      if (mode === 'broken-pixabay') {
        searchOpts.providerOrder = ['pexels', 'unsplash']
      }
      const result = await client.search(dishName + searchSuffix, searchOpts)

      if (!result && !client.hasCapacity()) {
        console.log(`\n${tag} All APIs limited. Pausing 10 min...`)
        await sleep(RATE_LIMIT_PAUSE_MS)
        i-- // Retry this recipe
        continue
      }

      if (result && result.url) {
        if (result.source === 'unsplash') {
          await client.triggerDownload(result)
        }

        await pool.query(
          'UPDATE posts SET hero_image_url = $1, image_attribution = $2 WHERE id = $3',
          [result.url, JSON.stringify(result.attribution), recipe.id]
        )

        progress.processedIds.push(recipe.id)
        progress.stats.upgraded++
        upgraded++
        console.log(`✅ ${result.source} — ${result.photographer}`)
      } else {
        progress.processedIds.push(recipe.id)
        progress.stats.skipped++
        skipped++
        console.log('⏭️ no match')
      }
    } catch (err) {
      progress.stats.errors++
      errors++
      console.log(`❌ ${err.message}`)
    }

    // Save progress every 10 recipes
    if ((upgraded + skipped + errors) % 10 === 0) {
      saveProgress(progress)
    }

    await sleep(WORKER_DELAY_MS)
  }

  console.log(`\n${tag} DONE — ✅ ${upgraded} upgraded | ⏭️ ${skipped} skipped | ❌ ${errors} errors`)
  return { upgraded, skipped, errors }
}

// ── Main ────────────────────────────────────────────────

async function main() {
  console.log(`🖼️  Parallel Image Upgrade — ${NUM_WORKERS} workers`)
  console.log('═══════════════════════════════════════════════════════')
  console.log()

  const pool = new Pool(DB)
  const progress = loadProgress()

  // Mode: 'missing' = only posts without any image, 'mismatch' = re-upgrade existing bad images
  // Type filter: defaults to 'recipe', pass 'cocktail' or 'all' via argv[4]
  const mode = process.argv[3] || 'missing'
  const rawTypeFilter = process.argv[4] || 'recipe'
  const ALLOWED_TYPES = ['recipe', 'cocktail', 'all']
  const typeFilter = ALLOWED_TYPES.includes(rawTypeFilter) ? rawTypeFilter : 'recipe'
  const typeClause = typeFilter === 'all' ? "type IN ('recipe','cocktail')" : `type = '${typeFilter}'`
  let query
  if (mode === 'mismatch') {
    query = `
      SELECT id, slug, title FROM posts
      WHERE ${typeClause} AND status = 'active'
        AND image_attribution IS NULL
        AND hero_image_url IS NOT NULL AND hero_image_url != ''
      ORDER BY slug
    `
  } else if (mode === 'broken-pixabay') {
    query = `
      SELECT id, slug, title FROM posts
      WHERE ${typeClause} AND status = 'active'
        AND hero_image_url LIKE '%pixabay.com/get/%'
      ORDER BY slug
    `
  } else {
    query = `
      SELECT id, slug, title FROM posts
      WHERE ${typeClause} AND status = 'active'
        AND (hero_image_url IS NULL OR hero_image_url = '')
      ORDER BY slug
    `
  }
  const { rows: recipes } = await pool.query(query)

  const remaining = recipes.filter(r => !progress.processedIds.includes(r.id))

  console.log(`📋 Total needing upgrade: ${recipes.length}`)
  console.log(`✅ Already processed: ${progress.processedIds.length}`)
  console.log(`🔄 Remaining: ${remaining.length}`)
  console.log(`👷 Workers: ${NUM_WORKERS}`)
  console.log()

  if (remaining.length === 0) {
    console.log('Nothing to do!')
    await pool.end()
    return
  }

  // Split recipes into batches for each worker
  const batchSize = Math.ceil(remaining.length / NUM_WORKERS)
  const batches = []
  for (let i = 0; i < NUM_WORKERS; i++) {
    batches.push(remaining.slice(i * batchSize, (i + 1) * batchSize))
  }

  // Each worker gets its own client instance for independent rate tracking
  const workers = batches.map((batch, i) => {
    const client = createImageSearchClient({
      pexels:   { apiKey: process.env.PEXELS_API_KEY },
      unsplash: { accessKey: process.env.UNSPLASH_ACCESS_KEY },
      pixabay:  { apiKey: process.env.PIXABAY_API_KEY },
    })
    return { batch, client, workerId: i + 1 }
  })

  console.log(`Batch sizes: ${batches.map((b, i) => `W${i + 1}=${b.length}`).join(', ')}`)
  console.log(`Starting with ${STAGGER_MS / 1000}s stagger...\n`)

  const startTime = Date.now()

  // Launch workers with staggered starts
  const promises = workers.map(async ({ batch, client, workerId }, idx) => {
    await sleep(idx * STAGGER_MS) // Stagger starts
    return worker(workerId, batch, client, pool, progress, typeFilter, mode)
  })

  const results = await Promise.all(promises)

  saveProgress(progress)

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
  const totalUpgraded = results.reduce((s, r) => s + r.upgraded, 0)
  const totalSkipped = results.reduce((s, r) => s + r.skipped, 0)
  const totalErrors = results.reduce((s, r) => s + r.errors, 0)

  console.log('\n═══════════════════════════════════════════════════════')
  console.log('🏁 ALL WORKERS COMPLETE')
  console.log(`   ⏱️  Elapsed:     ${elapsed} min`)
  console.log(`   ✅ Upgraded:     ${totalUpgraded}`)
  console.log(`   ⏭️  Skipped:      ${totalSkipped}`)
  console.log(`   ❌ Errors:       ${totalErrors}`)
  console.log(`   📊 Total done:   ${progress.processedIds.length}`)
  console.log()

  await pool.end()
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
