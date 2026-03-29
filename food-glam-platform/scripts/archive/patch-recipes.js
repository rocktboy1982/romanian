'use strict';

/**
 * Patch script — fills up under-performing countries to 20 recipes each.
 * Reads current CSV, determines what's needed per country, then scrapes the gaps.
 * Writes a fresh complete CSV.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const ax = axios.create({
  timeout: 25000,
  maxRedirects: 5,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
  },
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function get(url, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await ax.get(url, { responseType: 'text' });
      return r.data;
    } catch (e) {
      if (i === retries) throw e;
      await sleep(2000 * (i + 1));
    }
  }
}

function extractJsonLd(html, sourceUrl) {
  const $ = cheerio.load(html);
  const blocks = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try { blocks.push(JSON.parse($(el).html())); } catch (_) {}
  });
  for (const block of blocks) {
    const candidates = [];
    if (block && block['@type'] === 'Recipe') candidates.push(block);
    if (block && Array.isArray(block['@graph'])) {
      block['@graph'].forEach(n => { if (n && n['@type'] === 'Recipe') candidates.push(n); });
    }
    if (Array.isArray(block)) {
      block.forEach(n => { if (n && n['@type'] === 'Recipe') candidates.push(n); });
    }
    if (candidates.length > 0) return parseRecipe(candidates[0], sourceUrl);
  }
  return null;
}

function parseRecipe(r, sourceUrl) {
  const title = r.name || '';
  if (!title) return null;
  let ingredients = [];
  if (Array.isArray(r.recipeIngredient)) {
    ingredients = r.recipeIngredient.map(s => String(s).trim()).filter(Boolean);
  }
  let instructions = [];
  if (Array.isArray(r.recipeInstructions)) {
    r.recipeInstructions.forEach(step => {
      if (typeof step === 'string') instructions.push(step.trim());
      else if (step && step.text) instructions.push(String(step.text).trim());
      else if (step && step['@type'] === 'HowToSection' && Array.isArray(step.itemListElement)) {
        step.itemListElement.forEach(s => { if (s && s.text) instructions.push(String(s.text).trim()); });
      }
    });
  }
  instructions = instructions.filter(s => s.length > 3);
  const prepTime = parseDuration(r.prepTime || '');
  const cookTime = parseDuration(r.cookTime || r.totalTime || '');
  const servings = parseInt(typeof r.recipeYield === 'string' ? r.recipeYield : Array.isArray(r.recipeYield) ? r.recipeYield[0] : '4') || 4;
  let imageUrl = '';
  if (typeof r.image === 'string') imageUrl = r.image;
  else if (r.image && r.image.url) imageUrl = r.image.url;
  else if (Array.isArray(r.image) && r.image[0]) {
    imageUrl = typeof r.image[0] === 'string' ? r.image[0] : r.image[0].url || '';
  }
  const description = String(r.description || '').trim().slice(0, 500);
  return { title, summary: description || title, ingredients, instructions, prepTime, cookTime, servings, difficulty: 'medium', imageUrl, sourceUrl: sourceUrl || '' };
}

function parseDuration(iso) {
  if (!iso) return 0;
  const s = String(iso);
  let mins = 0;
  const h = s.match(/(\d+)H/i); const m = s.match(/(\d+)M/i);
  if (h) mins += parseInt(h[1]) * 60;
  if (m) mins += parseInt(m[1]);
  return mins || 0;
}

const slugSet = new Set();
function makeSlug(country, title) {
  const base = (country + '-' + title).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  let slug = base; let n = 2;
  while (slugSet.has(slug)) slug = base + '-' + n++;
  slugSet.add(slug);
  return slug;
}

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v).replace(/\r?\n/g, ' ').replace(/\r/g, ' ');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function csvRow(arr) { return arr.map(csvCell).join(','); }

const IMG_POOL = [
  'photo-1504674900247-0877df9cc836','photo-1476224203421-9ac39bcb3b28',
  'photo-1547592180-85f173990554','photo-1568901346375-23c9450c58cd',
  'photo-1601050690597-df0568f70950','photo-1606491956689-2ea866880c84',
  'photo-1414235077428-338989a2e8c0','photo-1555507036-ab1f4038808a',
];
function fallbackImg(i) { return `https://images.unsplash.com/${IMG_POOL[i % IMG_POOL.length]}?auto=format&fit=crop&w=800&q=80`; }

const APPROACH = {
  Italy: 'b0000000-0000-0000-0000-000000000001',
  France: 'b0000000-0000-0000-0000-000000000004',
  Mexico: 'b0000000-0000-0000-0000-000000000003',
};
function countryIds(idx) {
  return { profileId: `c${idx}000000-0000-0000-0000-000000000001`, cuisineId: `d${idx}000000-0000-0000-0000-000000000001` };
}

const COUNTRY_META = {
  Italy:      { idx: 1,  code: 'IT', approachId: APPROACH.Italy  },
  France:     { idx: 2,  code: 'FR', approachId: APPROACH.France },
  Japan:      { idx: 5,  code: 'JP', approachId: null },
  Mexico:     { idx: 6,  code: 'MX', approachId: APPROACH.Mexico },
  Greece:     { idx: 8,  code: 'GR', approachId: null },
  Morocco:    { idx: 9,  code: 'MA', approachId: null },
  Poland:     { idx: 14, code: 'PL', approachId: null },
  Nigeria:    { idx: 22, code: 'NG', approachId: null },
  Lebanon:    { idx: 25, code: 'LB', approachId: null },
  Vietnam:    { idx: 26, code: 'VN', approachId: null },
  Egypt:      { idx: 28, code: 'EG', approachId: null },
  Ukraine:    { idx: 29, code: 'UA', approachId: null },
};

// Per-country supplement URLs (only what's needed)
const SUPPLEMENTS = {
  Italy: [
    'https://ricette.giallozafferano.it/Limoncello.html',
    'https://ricette.giallozafferano.it/Baccalà-alla-vicentina.html',
    'https://ricette.giallozafferano.it/Stracciatella-alla-romana.html',
    'https://ricette.giallozafferano.it/Vitello-tonnato.html',
    'https://ricette.giallozafferano.it/Acquacotta.html',
    'https://ricette.giallozafferano.it/Frittata.html',
    'https://ricette.giallozafferano.it/Spaghetti-alle-vongole.html',
    'https://ricette.giallozafferano.it/Tortellini-in-brodo.html',
    'https://www.food.com/recipe/arancini-di-riso-sicilian-fried-rice-balls-157700',
  ],
  France: [
    'https://www.food.com/recipe/crepes-suzette-47072',
    'https://www.food.com/recipe/french-onion-soup-23979',
    'https://www.food.com/recipe/croque-monsieur-73729',
    'https://www.food.com/recipe/chocolate-mousse-french-classic-61892',
    'https://www.food.com/recipe/nicoise-salad-11400',
    'https://www.food.com/recipe/quiche-lorraine-56060',
    'https://www.food.com/recipe/blanquette-de-veau-french-veal-stew-47672',
    'https://www.food.com/recipe/madeleine-cookies-48572',
    'https://www.food.com/recipe/clafoutis-french-cherry-pudding-47872',
  ],
  Japan: [
    'https://www.justonecookbook.com/oden/',
    'https://www.justonecookbook.com/yakisoba/',
    'https://www.justonecookbook.com/japanese-milk-bread/',
  ],
  Mexico: [
    'https://www.food.com/recipe/authentic-mexican-rice-36237',
    'https://www.food.com/recipe/chile-con-carne-30707',
    'https://www.food.com/recipe/tamales-de-rajas-con-queso-55459',
    'https://www.food.com/recipe/mexican-hot-chocolate-92012',
    'https://www.food.com/recipe/enchiladas-rojas-137262',
    'https://www.food.com/recipe/pozole-rojo-203662',
    'https://www.food.com/recipe/mexican-tamales-166562',
    'https://www.food.com/recipe/tres-leches-cake-78362',
    'https://www.food.com/recipe/guacamole-162162',
    'https://www.food.com/recipe/the-best-mexican-black-beans-300592',
    'https://www.food.com/recipe/arroz-con-leche-mexican-style-rice-pudding-53838',
    'https://www.food.com/recipe/chiles-en-nogada-72562',
    'https://www.food.com/recipe/agua-fresca-de-sandia-watermelon-drink-249062',
  ],
  Greece: [
    'https://www.food.com/recipe/pastitsio-greek-pasta-bake-97964',
    'https://www.food.com/recipe/tzatziki-sauce-49464',
    'https://www.food.com/recipe/greek-lemon-chicken-soup-avgolemono-55764',
    'https://www.food.com/recipe/greek-spanakopita-spinach-and-feta-pie-140764',
    'https://www.food.com/recipe/authentic-greek-moussaka-68064',
    'https://www.food.com/recipe/greek-souvlaki-chicken-48564',
  ],
  Morocco: [
    'https://www.food.com/recipe/moroccan-spiced-lamb-chops-236719',
  ],
  Poland: [
    'https://www.food.com/recipe/bigos-polish-hunters-stew-30264',
    'https://www.food.com/recipe/zurek-polish-sour-rye-soup-211764',
    'https://www.food.com/recipe/polish-kielbasa-sausage-soup-37064',
    'https://eatingeuropean.com/zapiekanka-polish-baguette-pizza/',
    'https://eatingeuropean.com/polish-cheesecake-sernik-recipe/',
    'https://eatingeuropean.com/polish-makowiec-poppy-seed-roll/',
  ],
  Nigeria: [
    'https://www.food.com/recipe/nigerian-jollof-rice-188934',
    'https://www.food.com/recipe/nigerian-pepper-soup-189234',
    'https://www.food.com/recipe/puff-puff-nigerian-fried-dough-189534',
    'https://www.food.com/recipe/nigerian-egusi-soup-188734',
    'https://www.food.com/recipe/nigerian-fried-rice-192334',
    'https://www.food.com/recipe/nigerian-moi-moi-bean-pudding-190134',
  ],
  Lebanon: [
    'https://www.food.com/recipe/hummus-from-scratch-45054',
    'https://www.food.com/recipe/tabbouleh-31070',
    'https://www.food.com/recipe/chicken-shawarma-80835',
    'https://www.food.com/recipe/baba-ghanoush-15682',
    'https://www.food.com/recipe/kibbeh-baked-60349',
    'https://www.food.com/recipe/lebanese-fattoush-salad-47354',
    'https://www.food.com/recipe/lebanese-garlic-sauce-toum-124254',
    'https://www.food.com/recipe/labneh-lebanese-yogurt-cheese-80654',
    'https://www.food.com/recipe/lebanese-lentil-soup-with-lemon-102454',
    'https://www.food.com/recipe/lebanese-chicken-with-garlic-47154',
    'https://www.food.com/recipe/maakroun-lebanese-sweet-pasta-196254',
    'https://www.food.com/recipe/arayes-lebanese-meat-stuffed-pita-216554',
    'https://www.food.com/recipe/mujadara-lentils-and-rice-47954',
    'https://www.food.com/recipe/kafta-lebanese-ground-meat-skewers-56754',
    'https://www.food.com/recipe/sfoof-lebanese-turmeric-cake-165154',
    'https://www.food.com/recipe/ma-amoul-date-filled-cookies-168054',
    'https://www.food.com/recipe/jallab-lebanese-fruit-punch-drink-246054',
    'https://www.food.com/recipe/warak-dawali-lebanese-stuffed-grape-leaves-78054',
    'https://www.food.com/recipe/lebanese-rice-82554',
    'https://www.food.com/recipe/fatteh-lebanese-chickpea-bread-casserole-116954',
  ],
  Vietnam: [
    'https://www.hungryhuy.com/bun-bo-hue/',
    'https://www.hungryhuy.com/ca-kho-to/',
    'https://www.hungryhuy.com/banh-xeo/',
    'https://www.hungryhuy.com/bun-bo-hue-recipe/',
    'https://www.hungryhuy.com/chicken-pho/',
    'https://www.hungryhuy.com/che-ba-mau/',
    // food.com Vietnamese
    'https://www.food.com/recipe/vietnamese-pho-bo-beef-noodle-soup-88234',
    'https://www.food.com/recipe/vietnamese-spring-rolls-goi-cuon-72034',
    'https://www.food.com/recipe/banh-mi-vietnamese-sandwich-135034',
    'https://www.food.com/recipe/vietnamese-caramel-chicken-thit-ga-kho-gung-157234',
    'https://www.food.com/recipe/vietnamese-broken-rice-com-tam-244934',
    'https://www.food.com/recipe/vietnamese-lemongrass-chicken-240234',
    'https://www.food.com/recipe/vietnamese-salted-caramel-pork-thit-kho-trung-198534',
    'https://www.food.com/recipe/pho-ga-vietnamese-chicken-noodle-soup-110934',
    'https://www.food.com/recipe/vietnamese-green-papaya-salad-goi-du-du-224434',
    'https://www.food.com/recipe/bun-cha-vietnamese-grilled-pork-with-noodles-232534',
    'https://www.food.com/recipe/banh-cuon-vietnamese-steamed-rice-rolls-260134',
    'https://www.food.com/recipe/vietnamese-iced-coffee-ca-phe-sua-da-182234',
    'https://www.food.com/recipe/che-troi-nuoc-vietnamese-sweet-soup-210134',
    'https://www.food.com/recipe/banh-bo-vietnamese-steamed-rice-cake-237834',
  ],
  Egypt: [
    'https://www.food.com/recipe/bamia-egyptian-okra-stew-79340',
  ],
  Ukraine: [
    'https://www.food.com/recipe/ukrainian-borscht-68934',
    'https://www.food.com/recipe/ukrainian-honey-cake-medivnyk-163034',
    'https://www.food.com/recipe/ukrainian-holubtsi-stuffed-cabbage-rolls-78034',
    'https://www.food.com/recipe/varenyky-ukrainian-dumplings-157834',
    'https://www.food.com/recipe/ukrainian-salo-cured-pork-fatback-226834',
    'https://www.food.com/recipe/ukrainian-chicken-soup-with-homemade-noodles-163434',
    'https://www.food.com/recipe/ukrainian-honey-bread-medivnyk-simple-203934',
  ],
};

async function scrapeUrls(urls, needed) {
  const results = [];
  for (const url of urls) {
    if (results.length >= needed) break;
    try {
      const html = await get(url);
      const rec = extractJsonLd(html, url);
      if (rec && rec.ingredients.length >= 2 && rec.instructions.length >= 1) {
        results.push(rec);
        process.stdout.write('.');
      } else { process.stdout.write('x'); }
    } catch (e) { process.stdout.write('x'); }
    await sleep(700);
  }
  return results;
}

async function main() {
  const outPath = path.join(__dirname, '..', 'data', 'recipes-seed.csv');
  const rawCsv = fs.readFileSync(outPath, 'utf8');
  const lines = rawCsv.split('\n');
  const header = lines[0];

  // Pre-populate slugSet from existing CSV to avoid slug collisions
  for (const line of lines.slice(1)) {
    const m = line.match(/^[^,]+,[^,]+,[^,]+,[^,]+,[^,]+,[^,]+,(?:"[^"]*"|[^,]*),([^,]+)/);
    if (m) slugSet.add(m[1]);
  }

  // Count existing rows per country (only valid rows where first column is a known country)
  const VALID_COUNTRIES = new Set(Object.keys(COUNTRY_META).concat([
    'Spain','Germany','India','China','Brazil','Argentina','Philippines','South Korea','Indonesia',
    'Portugal','Sweden','Ethiopia','Peru','Iran','Russia','Turkey'
  ]));

  const existing = {};
  const validLines = [header];

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    // Parse first column
    const firstComma = line.indexOf(',');
    if (firstComma === -1) continue;
    const country = line.slice(0, firstComma).replace(/^"|"$/g, '');
    if (VALID_COUNTRIES.has(country)) {
      existing[country] = (existing[country] || 0) + 1;
      validLines.push(line);
    }
  }

  console.log('Current counts:', JSON.stringify(existing, null, 2));

  // Patch under-performing countries
  for (const [country, urls] of Object.entries(SUPPLEMENTS)) {
    const have = existing[country] || 0;
    const need = 20 - have;
    if (need <= 0) {
      console.log(`\n✓ ${country} already has ${have} recipes, skipping.`);
      continue;
    }
    console.log(`\n▶ Patching ${country} (have ${have}, need ${need} more)...`);
    const meta = COUNTRY_META[country];
    const { profileId, cuisineId } = countryIds(meta.idx);

    const recipes = await scrapeUrls(urls, need);
    console.log(`\n  → Got ${recipes.length} new recipes for ${country}`);

    for (let i = 0; i < recipes.length; i++) {
      const rec = recipes[i];
      const recipeUuid = uuidv4();
      const postUuid = uuidv4();
      const slug = makeSlug(country, rec.title);
      const summary = (rec.summary || rec.title).slice(0, 300).replace(/\r?\n/g, ' ');
      const ingredientsCell = rec.ingredients.slice(0, 30).map(s => s.replace(/\|/g, '-').replace(/\r?\n/g, ' ').trim()).join('|');
      const instructionsCell = rec.instructions.slice(0, 15).map(s => s.replace(/\|/g, '-').replace(/\r?\n/g, ' ').trim()).join('|');
      const img = rec.imageUrl || fallbackImg(i);

      const row = [
        country, meta.code, cuisineId, profileId,
        recipeUuid, postUuid,
        rec.title, slug, summary, summary,
        ingredientsCell, instructionsCell,
        rec.prepTime || 15, rec.cookTime || 30, rec.servings || 4, 'medium',
        img, meta.approachId || '', rec.sourceUrl || '',
      ];
      validLines.push(csvRow(row));
    }

    // Write after each country
    fs.writeFileSync(outPath, validLines.join('\n'), 'utf8');
    await sleep(1000);
  }

  // Final count
  const finalLines = fs.readFileSync(outPath, 'utf8').split('\n').filter(l => l.trim());
  console.log(`\n✅ Done! ${finalLines.length - 1} total rows in CSV`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
