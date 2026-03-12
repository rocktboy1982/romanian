#!/usr/bin/env node
/**
 * fix-images.mjs — Replace broken Pixabay hero images with Pexels photos.
 *
 * Strategy:
 *   1. Query all posts with broken pixabay.com/get/ URLs
 *   2. Extract English dish name from slug (strip country prefix)
 *   3. Search Pexels API with "{dish name} food dish" + landscape orientation
 *   4. If no result, try Pixabay API as fallback (download to Supabase Storage)
 *   5. Update hero_image_url + image_attribution in DB
 *
 * Usage:
 *   node scripts/fix-images.mjs                  # Full run
 *   node scripts/fix-images.mjs --dry-run        # Preview without updating DB
 *   node scripts/fix-images.mjs --test 10        # Process only first N recipes
 *   node scripts/fix-images.mjs --offset 500     # Start from offset
 *
 * Pexels: URLs are permanent, hotlinkable. Use src.landscape (1200x627).
 * Pixabay: URLs expire — must download to Supabase Storage.
 */

import { createClient } from '@supabase/supabase-js';

// ─── Config ────────────────────────────────────────────────────────
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY || '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const PEXELS_DELAY_MS = 18500; // 200 req/hr = 1 per 18s; use 18.5s to stay safe
const PIXABAY_DELAY_MS = 700;  // 100 req/60s = 1 per 600ms
const STORAGE_BUCKET = 'recipe-images';

// ─── Parse CLI args ────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const testIdx = args.indexOf('--test');
const TEST_LIMIT = testIdx !== -1 ? parseInt(args[testIdx + 1], 10) : 0;
const offsetIdx = args.indexOf('--offset');
const OFFSET = offsetIdx !== -1 ? parseInt(args[offsetIdx + 1], 10) : 0;

// ─── Supabase client ───────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Stats ─────────────────────────────────────────────────────────
const stats = {
  total: 0,
  pexelsFound: 0,
  pixabayFound: 0,
  notFound: 0,
  errors: 0,
  updated: 0,
  skipped: 0,
};

// ─── Helpers ───────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract English dish name from slug.
 * Slugs are formatted as: "country-dish-name-words"
 * e.g. "mongolia-budaatai-huurga" → "budaatai huurga"
 *      "uruguay-revuelto-gramajo" → "revuelto gramajo"
 *      "white-negroni"            → "white negroni" (no country prefix for cocktails)
 */
function slugToDishName(slug) {
  // Known country prefixes (first segment of slug)
  const parts = slug.split('-');

  // If slug has 2+ parts and first part looks like a country, strip it
  // Countries are typically single words; some recipes have no country prefix
  const knownCountries = new Set([
    'afghanistan', 'albania', 'algeria', 'andorra', 'angola', 'argentina',
    'armenia', 'australia', 'austria', 'azerbaijan', 'bahamas', 'bahrain',
    'bangladesh', 'barbados', 'belarus', 'belgium', 'belize', 'benin',
    'bhutan', 'bolivia', 'bosnia', 'botswana', 'brazil', 'brunei',
    'bulgaria', 'burkina', 'burundi', 'cambodia', 'cameroon', 'canada',
    'chad', 'chile', 'china', 'colombia', 'comoros', 'congo', 'costa',
    'croatia', 'cuba', 'cyprus', 'czech', 'denmark', 'djibouti', 'dominica',
    'dominican', 'ecuador', 'egypt', 'el', 'equatorial', 'eritrea',
    'estonia', 'eswatini', 'ethiopia', 'fiji', 'finland', 'france',
    'gabon', 'gambia', 'georgia', 'germany', 'ghana', 'greece', 'grenada',
    'guatemala', 'guinea', 'guyana', 'haiti', 'honduras', 'hungary',
    'iceland', 'india', 'indonesia', 'iran', 'iraq', 'ireland', 'israel',
    'italy', 'ivory', 'jamaica', 'japan', 'jordan', 'kazakhstan', 'kenya',
    'kiribati', 'korea', 'kosovo', 'kuwait', 'kyrgyzstan', 'laos',
    'latvia', 'lebanon', 'lesotho', 'liberia', 'libya', 'liechtenstein',
    'lithuania', 'luxembourg', 'madagascar', 'malawi', 'malaysia',
    'maldives', 'mali', 'malta', 'marshall', 'mauritania', 'mauritius',
    'mexico', 'micronesia', 'moldova', 'monaco', 'mongolia', 'montenegro',
    'morocco', 'mozambique', 'myanmar', 'namibia', 'nauru', 'nepal',
    'netherlands', 'new', 'nicaragua', 'niger', 'nigeria', 'north',
    'norway', 'oaxaca', 'oman', 'pakistan', 'palau', 'palestine', 'panama',
    'papua', 'paraguay', 'peru', 'philippines', 'poland', 'portugal',
    'qatar', 'romania', 'russia', 'rwanda', 'samoa', 'saudi', 'senegal',
    'serbia', 'seychelles', 'sierra', 'singapore', 'slovakia', 'slovenia',
    'solomon', 'somalia', 'south', 'spain', 'sri', 'sudan', 'suriname',
    'sweden', 'switzerland', 'syria', 'taiwan', 'tajikistan', 'tanzania',
    'thailand', 'togo', 'tonga', 'trinidad', 'tunisia', 'turkey',
    'turkmenistan', 'tuvalu', 'uganda', 'ukraine', 'united', 'uruguay',
    'uzbekistan', 'vanuatu', 'vatican', 'venezuela', 'vietnam', 'yemen',
    'zambia', 'zimbabwe',
  ]);

  if (parts.length > 1 && knownCountries.has(parts[0])) {
    return parts.slice(1).join(' ');
  }

  return parts.join(' ');
}

/**
 * Search Pexels API for a food photo matching the dish name.
 * Returns { url, photographer, photographerUrl, pexelsUrl, avgColor } or null.
 */
async function searchPexels(dishName) {
  const query = encodeURIComponent(`${dishName} food dish`);
  const url = `https://api.pexels.com/v1/search?query=${query}&per_page=1&orientation=landscape`;

  const res = await fetch(url, {
    headers: { Authorization: PEXELS_API_KEY },
  });

  if (!res.ok) {
    if (res.status === 429) {
      console.warn('  ⚠ Pexels rate limited — waiting 60s...');
      await sleep(60000);
      return searchPexels(dishName); // retry once
    }
    console.error(`  ✗ Pexels HTTP ${res.status} for "${dishName}"`);
    return null;
  }

  const data = await res.json();

  if (!data.photos || data.photos.length === 0) {
    return null;
  }

  const photo = data.photos[0];
  return {
    url: photo.src.landscape, // 1200x627, permanent
    photographer: photo.photographer,
    photographerUrl: photo.photographer_url,
    pexelsUrl: photo.url,
    avgColor: photo.avg_color,
    alt: photo.alt || '',
    source: 'pexels',
  };
}

/**
 * Search Pixabay API as fallback. Returns image info or null.
 * Pixabay URLs expire — we'd need to download, but for now just log.
 */
async function searchPixabay(dishName) {
  const query = encodeURIComponent(`${dishName} food`);
  const url = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${query}&image_type=photo&category=food&per_page=3&safesearch=true`;

  const res = await fetch(url);

  if (!res.ok) {
    if (res.status === 429) {
      console.warn('  ⚠ Pixabay rate limited — waiting 60s...');
      await sleep(60000);
      return searchPixabay(dishName);
    }
    console.error(`  ✗ Pixabay HTTP ${res.status} for "${dishName}"`);
    return null;
  }

  const data = await res.json();

  if (!data.hits || data.hits.length === 0) {
    return null;
  }

  const hit = data.hits[0];

  // Pixabay: previewURL (cdn.pixabay.com) is permanent but only 150px
  // webformatURL/largeImageURL are temporary (24h)
  // For now, we'll use previewURL and note that full download is needed
  // TODO: Download to Supabase Storage for production use
  return {
    url: hit.previewURL, // 150px — placeholder; need download for real use
    webformatURL: hit.webformatURL, // 640px — expires in 24h
    largeImageURL: hit.largeImageURL, // 1280px — expires in 24h
    pageURL: hit.pageURL,
    user: hit.user,
    source: 'pixabay',
    needsDownload: true,
  };
}

/**
 * Download an image from URL and upload to Supabase Storage.
 * Returns the public URL or null on failure.
 */
async function downloadToSupabase(imageUrl, slug) {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const path = `heroes/${slug}.${ext}`;

    // Ensure bucket exists
    const { error: bucketError } = await supabase.storage.createBucket(STORAGE_BUCKET, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024, // 5MB
    });
    // Ignore "already exists" error
    if (bucketError && !bucketError.message?.includes('already exists')) {
      console.error(`  ✗ Bucket error: ${bucketError.message}`);
    }

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, new Uint8Array(buffer), {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error(`  ✗ Upload error for ${slug}: ${uploadError.message}`);
      return null;
    }

    const { data: publicData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(path);

    return publicData?.publicUrl || null;
  } catch (err) {
    console.error(`  ✗ Download error for ${slug}: ${err.message}`);
    return null;
  }
}

// ─── Main ──────────────────────────────────────────────────────────

async function main() {
  console.log('🍽️  MareChef.ro — Image Fix Pipeline');
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`   Offset: ${OFFSET}, Limit: ${TEST_LIMIT || 'ALL'}`);
  console.log('');

  // 1. Fetch broken recipes
  let query = supabase
    .from('posts')
    .select('id, title, slug, hero_image_url, source_url, type')
    .like('hero_image_url', '%pixabay.com/get/%')
    .eq('status', 'active')
    .order('id', { ascending: true });

  if (OFFSET > 0) {
    query = query.range(OFFSET, OFFSET + (TEST_LIMIT || 10000) - 1);
  } else if (TEST_LIMIT > 0) {
    query = query.limit(TEST_LIMIT);
  }

  const { data: recipes, error } = await query;

  if (error) {
    console.error('Failed to fetch recipes:', error.message);
    process.exit(1);
  }

  stats.total = recipes.length;
  console.log(`📋 Found ${stats.total} recipes with broken images\n`);

  const failures = [];

  for (let i = 0; i < recipes.length; i++) {
    const recipe = recipes[i];
    const dishName = slugToDishName(recipe.slug);
    const progress = `[${i + 1}/${stats.total}]`;

    console.log(`${progress} "${recipe.title}" → search: "${dishName}"`);

    // Step 1: Try Pexels
    let result = null;
    try {
      result = await searchPexels(dishName);
      if (result) {
        stats.pexelsFound++;
        console.log(`  ✓ Pexels: ${result.url.substring(0, 80)}...`);
      }
    } catch (err) {
      console.error(`  ✗ Pexels error: ${err.message}`);
    }

    await sleep(PEXELS_DELAY_MS);

    // Step 2: Try Pixabay as fallback (only if Pexels returned nothing)
    if (!result) {
      try {
        const pixabayResult = await searchPixabay(dishName);
        if (pixabayResult) {
          // Download the large image to Supabase Storage (it expires in 24h)
          console.log(`  ↓ Pixabay found — downloading to Supabase Storage...`);
          if (!DRY_RUN) {
            const publicUrl = await downloadToSupabase(pixabayResult.largeImageURL, recipe.slug);
            if (publicUrl) {
              result = {
                url: publicUrl,
                photographer: pixabayResult.user,
                photographerUrl: pixabayResult.pageURL,
                pexelsUrl: null,
                avgColor: null,
                alt: '',
                source: 'pixabay',
              };
              stats.pixabayFound++;
              console.log(`  ✓ Pixabay → Storage: ${publicUrl.substring(0, 80)}...`);
            } else {
              console.log(`  ✗ Pixabay download failed`);
            }
          } else {
            stats.pixabayFound++;
            console.log(`  ✓ Pixabay (dry-run): would download ${pixabayResult.largeImageURL.substring(0, 60)}...`);
          }
        }
      } catch (err) {
        console.error(`  ✗ Pixabay error: ${err.message}`);
      }
      await sleep(PIXABAY_DELAY_MS);
    }

    // Step 4: Update DB
    if (result && !DRY_RUN) {
      const attribution = {
        source: result.source,
        photographer: result.photographer || null,
        photographerUrl: result.photographerUrl || null,
        sourceUrl: result.pexelsUrl || null,
        avgColor: result.avgColor || null,
      };

      const { error: updateError } = await supabase
        .from('posts')
        .update({
          hero_image_url: result.url,
          image_attribution: attribution,
        })
        .eq('id', recipe.id);

      if (updateError) {
        console.error(`  ✗ DB update error: ${updateError.message}`);
        stats.errors++;
      } else {
        stats.updated++;
      }
    } else if (!result) {
      stats.notFound++;
      failures.push({ id: recipe.id, title: recipe.title, slug: recipe.slug, dishName });
      console.log(`  ✗ No image found`);
    } else {
      stats.skipped++;
    }
  }

  // ─── Summary ───────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('📊 Results:');
  console.log(`   Total processed:  ${stats.total}`);
  console.log(`   Pexels found:     ${stats.pexelsFound}`);
  console.log(`   Pixabay found:    ${stats.pixabayFound}`);
  console.log(`   Not found:        ${stats.notFound}`);
  console.log(`   DB updated:       ${stats.updated}`);
  console.log(`   Errors:           ${stats.errors}`);
  console.log(`   Skipped (dry):    ${stats.skipped}`);
  console.log(`   Success rate:     ${(((stats.pexelsFound + stats.pixabayFound) / stats.total) * 100).toFixed(1)}%`);
  console.log('═'.repeat(60));

  if (failures.length > 0) {
    console.log(`\n❌ ${failures.length} recipes with no image found:`);
    for (const f of failures) {
      console.log(`   - [${f.id}] "${f.title}" (search: "${f.dishName}")`);
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
