#!/usr/bin/env node
/**
 * upgrade-cocktail-images.js — Upgrade cocktail images using lib/image-search.js
 * Run once: node scripts/upgrade-cocktail-images.js
 */
const { Pool } = require('pg')
const { createImageSearchClient } = require('../lib/image-search')

const pool = new Pool({
  host: '127.0.0.1', port: 54322,
  user: 'postgres', password: 'postgres', database: 'postgres',
})

const client = createImageSearchClient({
  pexels: { apiKey: process.env.PEXELS_API_KEY },
  unsplash: { accessKey: process.env.UNSPLASH_ACCESS_KEY },
  pixabay: { apiKey: process.env.PIXABAY_API_KEY || '54937602-4ed5967a8ec70101779291c1a' },
})

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  const { rows } = await pool.query(
    "SELECT id, slug, title FROM posts WHERE type='cocktail' ORDER BY slug"
  )

  console.log(`Upgrading images for ${rows.length} cocktails...`)
  let upgraded = 0

  for (const c of rows) {
    const query = `${c.title} cocktail drink`
    process.stdout.write(`${c.title} ... `)

    try {
      const result = await client.search(query, { strategy: 'fallback' })

      if (result && result.url) {
        if (result.source === 'unsplash') {
          await client.triggerDownload(result)
        }

        await pool.query(
          'UPDATE posts SET hero_image_url = $1, image_attribution = $2 WHERE id = $3',
          [result.url, JSON.stringify(result.attribution), c.id]
        )
        upgraded++
        console.log(`OK - ${result.source} - ${result.photographer}`)
      } else {
        console.log('no match (keeping existing)')
      }
    } catch (err) {
      console.log(`ERROR: ${err.message}`)
    }

    await sleep(3000)
  }

  console.log(`\nDone! ${upgraded}/${rows.length} upgraded`)
  console.log('Rate limits:', client.getRateLimits())
  await pool.end()
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
