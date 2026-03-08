#!/usr/bin/env node
/**
 * upgrade-images-unsplash.js
 *
 * Upgrades recipe images from generic category-fallback photos
 * to per-recipe specific photos using Pexels + Pixabay + Unsplash APIs.
 *
 * API compliance:
 *   Pexels:
 *     - Hotlinks to images.pexels.com
 *     - Attribution: "Photo by {Name} on Pexels" with links
 *   Pixabay:
 *     - Hotlinks to pixabay.com
 *     - Attribution: "Photo by {Name} on Pixabay" with links
 *   Unsplash:
 *     - Hotlinks to images.unsplash.com (no self-hosting)
 *     - Triggers download_location endpoint when photo is used
 *     - Attribution: "Photo by {Name} on Unsplash" with links
 *
 * Combined rate: Pexels 200/hr + Pixabay ~100/min + Unsplash 50/hr
 * Strategy: Pexels first (200/hr) → Pixabay (fast) → Unsplash fallback (50/hr)
 * Fully resumable via .unsplash-upgrade-progress.json
 *
 * Usage: node scripts/upgrade-images-unsplash.js
 */

const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')
const { createImageSearchClient } = require('../lib/image-search')

// ── Config ──────────────────────────────────────────────
const DB = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '54322'),
  user: 'postgres',
  password: 'postgres',
  database: 'postgres',
}

const PROGRESS_FILE = path.join(__dirname, '.unsplash-upgrade-progress.json')

const REQUEST_DELAY_MS = 15000   // 15s between requests (safe for combined rate)
const RATE_LIMIT_PAUSE_MS = 3700000 // ~62 min wait when all providers exhausted

// ── Helpers ─────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'))
    }
  } catch {}
  return {
    upgradedIds: [],
    skippedIds: [],
    stats: { upgraded: 0, skipped: 0, errors: 0, apiCalls: 0, downloads: 0 }
  }
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
    if (countryPrefixes.has(parts[i])) {
      startIdx = i + 1
    } else {
      break
    }
  }
  if (startIdx >= parts.length) startIdx = Math.max(0, parts.length - 3)

  let endIdx = parts.length
  for (let i = parts.length - 1; i >= startIdx; i--) {
    if (/^[0-9a-f]{6,}$/.test(parts[i])) {
      endIdx = i
    } else {
      break
    }
  }

  return parts.slice(startIdx, endIdx).join(' ')
}

// ── Image Search Client ────────────────────────────────

const client = createImageSearchClient({
  pexels:   { apiKey: process.env.PEXELS_API_KEY || 'w5BWKtwPXSEiI5mpERpQgmRQjCrGwjnfls1fhLbxl38BVve7jQVbtisq' },
  unsplash: { accessKey: process.env.UNSPLASH_ACCESS_KEY || 'YhYMVL4KtEoFJZqsnPNujIrg_XBArEMq4M6vvRVbAF8' },
  pixabay:  { apiKey: process.env.PIXABAY_API_KEY || '54937602-4ed5967a8ec70101779291c1a' },
})

// ── Main ────────────────────────────────────────────────

async function main() {
  console.log('🖼️  Recipe Image Upgrade (Pexels + Pixabay + Unsplash)')
  console.log('═══════════════════════════════════════════════════════')
  console.log()
  console.log('API Compliance:')
  console.log('  Pexels:   Hotlink images.pexels.com | "Photo by {Name} on Pexels"')
  console.log('  Pixabay:  Hotlink pixabay.com | "Photo by {Name} on Pixabay"')
  console.log('  Unsplash: Hotlink images.unsplash.com | download trigger | "Photo by {Name} on Unsplash"')
  console.log()
  console.log('Strategy: Pexels (200/hr) → Pixabay (fast) → Unsplash fallback (50/hr)')
  console.log()

  const pool = new Pool(DB)
  const progress = loadProgress()
  const processedSet = new Set([...progress.upgradedIds, ...progress.skippedIds])

  const { rows: recipes } = await pool.query(`
    SELECT id, slug, title
    FROM posts
    WHERE type = 'recipe'
      AND hero_image_url LIKE 'https://images.unsplash.com/photo-%'
      AND (image_attribution IS NULL)
    ORDER BY slug
  `)

  const remaining = recipes.filter(r => !processedSet.has(r.id))

  console.log(`📋 Category-fallback recipes: ${recipes.length}`)
  console.log(`✅ Upgraded: ${progress.stats.upgraded} | ⏭️ Skipped: ${progress.stats.skipped}`)
  console.log(`🔄 Remaining: ${remaining.length}`)
  console.log()

  if (remaining.length === 0) {
    console.log('Nothing to do!')
    await pool.end()
    return
  }

  let processed = 0

  for (const recipe of remaining) {
    processed++

    const dishName = extractDishName(recipe.slug)
    const num = `[${processed}/${remaining.length}]`

    process.stdout.write(`${num} "${dishName}" ... `)

    let result = null

    try {
      // ── Search with fallback strategy (Pexels → Pixabay → Unsplash) ──
      progress.stats.apiCalls++
      result = await client.search(dishName + ' food', { strategy: 'fallback' })

      // ── All providers exhausted — wait ──
      if (!result && !client.hasCapacity()) {
        console.log(`\n⏸️  All APIs limited. Waiting ~62 min...`)
        saveProgress(progress)
        await sleep(RATE_LIMIT_PAUSE_MS)
        console.log(`▶️  Resuming...\n`)
        processed--
        continue
      }

      if (result && result.url) {
        // Unsplash: trigger download endpoint (required by API guidelines)
        if (result.source === 'unsplash') {
          await sleep(2000)
          await client.triggerDownload(result)
          progress.stats.downloads++
        }

        // Store attribution directly from result.attribution
        await pool.query(
          'UPDATE posts SET hero_image_url = $1, image_attribution = $2 WHERE id = $3',
          [result.url, JSON.stringify(result.attribution), recipe.id]
        )

        progress.upgradedIds.push(recipe.id)
        progress.stats.upgraded++
        console.log(`✅ ${result.source} — ${result.photographer}`)
      } else {
        progress.skippedIds.push(recipe.id)
        progress.stats.skipped++
        console.log(`⏭️ no match`)
      }
    } catch (err) {
      progress.stats.errors++
      console.log(`❌ ${err.message}`)
    }

    if (processed % 5 === 0) saveProgress(progress)

    if (processed % 10 === 0) {
      const limits = client.getRateLimits()
      console.log(`\n   📊 ${progress.stats.upgraded} upgraded | ${progress.stats.skipped} skipped | ${progress.stats.errors} errors`)
      console.log(`   🔑 Pexels: ${limits.pexels || 0} | Pixabay: ${limits.pixabay || 0} | Unsplash: ${limits.unsplash || 0}`)
      console.log(`   ⏱️  ${new Date().toLocaleTimeString()}\n`)
    }

    await sleep(REQUEST_DELAY_MS)
  }

  saveProgress(progress)

  console.log('\n═══════════════════════════════════════════════════════')
  console.log('🏁 COMPLETE')
  console.log(`   ✅ Upgraded:       ${progress.stats.upgraded}`)
  console.log(`   ⏭️  Skipped:        ${progress.stats.skipped}`)
  console.log(`   ❌ Errors:         ${progress.stats.errors}`)
  console.log(`   📞 API calls:      ${progress.stats.apiCalls}`)
  console.log(`   📥 Downloads:      ${progress.stats.downloads}`)
  console.log()

  await pool.end()
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
