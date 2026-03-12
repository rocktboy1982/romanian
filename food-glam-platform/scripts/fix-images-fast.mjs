#!/usr/bin/env node
/**
 * fix-images-fast.mjs — Fast parallel image replacement using Pixabay API.
 *
 * Pixabay: 100 req/60s (shared across all batches).
 * With 10 batches: each batch gets ~10 req/60s = 1 req per 6s.
 *
 * Images are downloaded to Supabase Storage (Pixabay forbids hotlinking).
 *
 * Usage:
 *   node scripts/fix-images-fast.mjs --batch 0 --total-batches 10
 *   node scripts/fix-images-fast.mjs --batch 1 --total-batches 10
 *   ...
 *   node scripts/fix-images-fast.mjs --batch 9 --total-batches 10
 */

import { createClient } from '@supabase/supabase-js';

// ─── Config ────────────────────────────────────────────────────────
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY || '';
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const STORAGE_BUCKET = 'recipe-images';

// 10 batches sharing 100 req/60s = 10 req/60s per batch = 1 req per 6s
// Add buffer: 7s per request per batch
const DELAY_MS = 7000;

// ─── Parse CLI args ────────────────────────────────────────────────
const args = process.argv.slice(2);
const batchIdx = args.indexOf('--batch');
const BATCH = batchIdx !== -1 ? parseInt(args[batchIdx + 1], 10) : 0;
const totalIdx = args.indexOf('--total-batches');
const TOTAL_BATCHES = totalIdx !== -1 ? parseInt(args[totalIdx + 1], 10) : 1;
const DRY_RUN = args.includes('--dry-run');

// ─── Supabase client ───────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Stats ─────────────────────────────────────────────────────────
const stats = { total: 0, found: 0, notFound: 0, errors: 0, updated: 0 };

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Known country prefixes
const COUNTRIES = new Set([
  'afghanistan','albania','algeria','andorra','angola','argentina','armenia',
  'australia','austria','azerbaijan','bahamas','bahrain','bangladesh','barbados',
  'belarus','belgium','belize','benin','bhutan','bolivia','bosnia','botswana',
  'brazil','brunei','bulgaria','burkina','burundi','cambodia','cameroon','canada',
  'chad','chile','china','colombia','comoros','congo','costa','croatia','cuba',
  'cyprus','czech','denmark','djibouti','dominica','dominican','ecuador','egypt',
  'el','equatorial','eritrea','estonia','eswatini','ethiopia','fiji','finland',
  'france','gabon','gambia','georgia','germany','ghana','greece','grenada',
  'guatemala','guinea','guyana','haiti','honduras','hungary','iceland','india',
  'indonesia','iran','iraq','ireland','israel','italy','ivory','jamaica','japan',
  'jordan','kazakhstan','kenya','kiribati','korea','kosovo','kuwait','kyrgyzstan',
  'laos','latvia','lebanon','lesotho','liberia','libya','liechtenstein','lithuania',
  'luxembourg','madagascar','malawi','malaysia','maldives','mali','malta','marshall',
  'mauritania','mauritius','mexico','micronesia','moldova','monaco','mongolia',
  'montenegro','morocco','mozambique','myanmar','namibia','nauru','nepal',
  'netherlands','new','nicaragua','niger','nigeria','north','norway','oaxaca',
  'oman','pakistan','palau','palestine','panama','papua','paraguay','peru',
  'philippines','poland','portugal','qatar','romania','russia','rwanda','samoa',
  'saudi','senegal','serbia','seychelles','sierra','singapore','slovakia',
  'slovenia','solomon','somalia','south','spain','sri','sudan','suriname',
  'sweden','switzerland','syria','taiwan','tajikistan','tanzania','thailand',
  'togo','tonga','trinidad','tunisia','turkey','turkmenistan','tuvalu','uganda',
  'ukraine','united','uruguay','uzbekistan','vanuatu','vatican','venezuela',
  'vietnam','yemen','zambia','zimbabwe','hawaii','hong','east','puerto','western',
  'midwestern','northeastern','southern','tex','republic','rica','faso','coast',
  'salvador',
]);

function slugToDishName(slug) {
  const parts = slug.split('-');
  // Strip known country prefixes (may be 1-2 words)
  let start = 0;
  if (parts.length > 1 && COUNTRIES.has(parts[0])) {
    start = 1;
    // Handle two-word countries: "costa rica", "hong kong", "east timor", etc.
    if (parts.length > 2 && COUNTRIES.has(parts[1])) {
      start = 2;
    }
  }
  return parts.slice(start).join(' ');
}

/**
 * Search Pixabay for a food image. Returns hit object or null.
 */
async function searchPixabay(dishName) {
  const query = encodeURIComponent(`${dishName} food`);
  const url = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${query}&image_type=photo&category=food&per_page=3&safesearch=true&orientation=horizontal`;

  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 429) {
      console.log(`  [B${BATCH}] ⚠ Pixabay rate limited — waiting 65s...`);
      await sleep(65000);
      return searchPixabay(dishName);
    }
    return null;
  }
  const data = await res.json();
  if (!data.hits?.length) return null;
  return data.hits[0];
}

/**
 * Search Pexels as fallback. Returns photo object or null.
 */
async function searchPexels(dishName) {
  const query = encodeURIComponent(`${dishName} food dish`);
  const url = `https://api.pexels.com/v1/search?query=${query}&per_page=1&orientation=landscape`;
  const res = await fetch(url, { headers: { Authorization: PEXELS_API_KEY } });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.photos?.length) return null;
  return data.photos[0];
}

/**
 * Download image and upload to Supabase Storage.
 */
async function downloadToStorage(imageUrl, slug) {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const path = `heroes/${slug}.${ext}`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, new Uint8Array(buffer), { contentType, upsert: true });

    if (error) {
      console.error(`  [B${BATCH}] ✗ Upload: ${error.message}`);
      return null;
    }

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (err) {
    console.error(`  [B${BATCH}] ✗ Download: ${err.message}`);
    return null;
  }
}

// ─── Main ──────────────────────────────────────────────────────────
async function main() {
  console.log(`[B${BATCH}] Starting batch ${BATCH + 1}/${TOTAL_BATCHES} ${DRY_RUN ? '(DRY RUN)' : ''}`);

  // Fetch ALL broken recipe IDs first (direct SQL via supabase)
  // We use modulo to split: recipe goes to batch (index % TOTAL_BATCHES)
  const { data: allRecipes, error } = await supabase
    .from('posts')
    .select('id, title, slug, type')
    .like('hero_image_url', '%pixabay.com/get/%')
    .eq('status', 'active')
    .order('id', { ascending: true })
    .range(0, 999); // Supabase limit

  if (error) {
    console.error(`[B${BATCH}] Failed to fetch:`, error.message);
    process.exit(1);
  }

  // Filter to this batch's recipes using modulo
  const myRecipes = allRecipes.filter((_, i) => i % TOTAL_BATCHES === BATCH);
  stats.total = myRecipes.length;

  console.log(`[B${BATCH}] Processing ${stats.total} recipes (of ${allRecipes.length} total in page)\n`);

  for (let i = 0; i < myRecipes.length; i++) {
    const recipe = myRecipes[i];
    const dishName = slugToDishName(recipe.slug);
    const tag = `[B${BATCH} ${i + 1}/${stats.total}]`;

    // Try Pixabay first (fast rate limit)
    let newUrl = null;
    let attribution = null;

    try {
      const hit = await searchPixabay(dishName);
      if (hit) {
        // Download largeImageURL (1280px, expires 24h) to storage
        if (!DRY_RUN) {
          newUrl = await downloadToStorage(hit.largeImageURL, recipe.slug);
        }
        if (newUrl || DRY_RUN) {
          attribution = {
            source: 'pixabay',
            photographer: hit.user,
            photographerUrl: `https://pixabay.com/users/${hit.user}-${hit.user_id}/`,
            sourceUrl: hit.pageURL,
            avgColor: null,
          };
          stats.found++;
          console.log(`${tag} ✓ "${recipe.title}" → pixabay → ${DRY_RUN ? 'dry' : newUrl?.substring(0, 60) + '...'}`);
        }
      }
    } catch (err) {
      console.error(`${tag} ✗ Pixabay error: ${err.message}`);
    }

    // Fallback to Pexels if Pixabay found nothing
    if (!newUrl && !DRY_RUN) {
      try {
        const photo = await searchPexels(dishName);
        if (photo) {
          newUrl = photo.src.landscape; // Pexels URLs are permanent
          attribution = {
            source: 'pexels',
            photographer: photo.photographer,
            photographerUrl: photo.photographer_url,
            sourceUrl: photo.url,
            avgColor: photo.avg_color,
          };
          stats.found++;
          console.log(`${tag} ✓ "${recipe.title}" → pexels → ${newUrl.substring(0, 60)}...`);
        }
      } catch (err) {
        // ignore
      }
    }

    // Update DB
    if (newUrl && !DRY_RUN) {
      const { error: updateErr } = await supabase
        .from('posts')
        .update({ hero_image_url: newUrl, image_attribution: attribution })
        .eq('id', recipe.id);

      if (updateErr) {
        console.error(`${tag} ✗ DB: ${updateErr.message}`);
        stats.errors++;
      } else {
        stats.updated++;
      }
    } else if (!newUrl && !DRY_RUN) {
      stats.notFound++;
      console.log(`${tag} ✗ No image for "${recipe.title}" (search: "${dishName}")`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n[B${BATCH}] ═══ DONE ═══`);
  console.log(`[B${BATCH}] Processed: ${stats.total} | Found: ${stats.found} | Updated: ${stats.updated} | NotFound: ${stats.notFound} | Errors: ${stats.errors}`);
}

main().catch(err => { console.error(`[B${BATCH}] Fatal:`, err); process.exit(1); });
