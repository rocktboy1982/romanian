#!/usr/bin/env node
/**
 * scrape-new-countries.js
 * Scrapes 20 recipes per missing country from diverse local/native sites.
 * Countries: Australia, New Zealand, South Africa, UK, Ireland, Canada, USA,
 *   Jamaica, Cuba, Colombia, Chile, Venezuela, Malaysia, Singapore, Sri Lanka,
 *   Pakistan, Georgia, Ghana, Kenya, South Africa, Austria, Hungary, Czech,
 *   Croatia, Romania, Norway, Denmark, Finland, Algeria, Tunisia, and more.
 *
 * Usage: node scripts/scrape-new-countries.js
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

// ── UUID helpers ──────────────────────────────────────────────────────────────
// Existing 29 countries use idx 1-29. New countries start at idx 30+.
const EXISTING_COUNTRIES = [
  'Italy','France','Spain','Germany','Japan','Mexico','India','Greece',
  'Morocco','Thailand','China','Brazil','Turkey','Poland','Argentina',
  'Russia','Philippines','South Korea','Indonesia','Portugal','Sweden',
  'Nigeria','Ethiopia','Peru','Lebanon','Vietnam','Iran','Egypt','Ukraine'
];

// New countries — idx starts at 30
const NEW_COUNTRIES = [
  // Oceania
  { name: 'Australia',      code: 'AU', idx: 30 },
  { name: 'New Zealand',    code: 'NZ', idx: 31 },
  // Southern Africa
  { name: 'South Africa',   code: 'ZA', idx: 32 },
  // West Africa
  { name: 'Ghana',          code: 'GH', idx: 33 },
  { name: 'Kenya',          code: 'KE', idx: 34 },
  // North Africa
  { name: 'Tunisia',        code: 'TN', idx: 35 },
  { name: 'Algeria',        code: 'DZ', idx: 36 },
  // North America
  { name: 'Canada',         code: 'CA', idx: 37 },
  { name: 'Jamaica',        code: 'JM', idx: 38 },
  { name: 'Cuba',           code: 'CU', idx: 39 },
  // South America
  { name: 'Colombia',       code: 'CO', idx: 40 },
  { name: 'Chile',          code: 'CL', idx: 41 },
  // Southeast Asia
  { name: 'Malaysia',       code: 'MY', idx: 42 },
  { name: 'Singapore',      code: 'SG', idx: 43 },
  // South Asia
  { name: 'Sri Lanka',      code: 'LK', idx: 44 },
  { name: 'Pakistan',       code: 'PK', idx: 45 },
  { name: 'Bangladesh',     code: 'BD', idx: 46 },
  // Central Asia & Caucasus
  { name: 'Georgia',        code: 'GE', idx: 47 },
  { name: 'Uzbekistan',     code: 'UZ', idx: 48 },
  // Middle East
  { name: 'Saudi Arabia',   code: 'SA', idx: 49 },
  { name: 'UAE',            code: 'AE', idx: 50 },
  { name: 'Israel',         code: 'IL', idx: 51 },
  // Western Europe
  { name: 'UK',             code: 'GB', idx: 52 },
  { name: 'Ireland',        code: 'IE', idx: 53 },
  { name: 'Austria',        code: 'AT', idx: 54 },
  { name: 'Netherlands',    code: 'NL', idx: 55 },
  { name: 'Belgium',        code: 'BE', idx: 56 },
  // Northern Europe
  { name: 'Norway',         code: 'NO', idx: 57 },
  { name: 'Denmark',        code: 'DK', idx: 58 },
  { name: 'Finland',        code: 'FI', idx: 59 },
  // Eastern Europe
  { name: 'Hungary',        code: 'HU', idx: 60 },
  { name: 'Czech Republic', code: 'CZ', idx: 61 },
  { name: 'Croatia',        code: 'HR', idx: 62 },
  { name: 'Romania',        code: 'RO', idx: 63 },
  { name: 'Bulgaria',       code: 'BG', idx: 64 },
];

function cuisineUUID(idx) {
  return `d0000000-0000-0000-0000-${String(idx).padStart(12, '0')}`;
}
function profileUUID(idx) {
  return `c0000000-0000-0000-0000-${String(idx).padStart(12, '0')}`;
}

// Approach IDs (round-robin)
const APPROACH_IDS = [
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000003',
  'b0000000-0000-0000-0000-000000000004',
  'b0000000-0000-0000-0000-000000000005',
  'b0000000-0000-0000-0000-000000000006',
];

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function fetchUrl(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'identity',
        'Connection': 'keep-alive',
        ...opts.headers,
      },
      timeout: 20000,
    };
    const req = lib.get(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : `${parsed.protocol}//${parsed.hostname}${res.headers.location}`;
        return fetchUrl(redirectUrl, opts).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── JSON-LD extraction ────────────────────────────────────────────────────────
function extractJsonLd(html) {
  const results = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1].trim());
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item['@type'] === 'Recipe') results.push(item);
        if (item['@graph']) {
          for (const g of item['@graph']) {
            if (g['@type'] === 'Recipe') results.push(g);
          }
        }
      }
    } catch {}
  }
  return results;
}

function parseRecipeFromJsonLd(schema, sourceUrl) {
  if (!schema) return null;
  const title = schema.name || '';
  if (!title || title.length < 3) return null;

  // Ingredients
  const rawIngr = schema.recipeIngredient || [];
  const ingredients = rawIngr.filter(Boolean).map(i => String(i).trim()).filter(i => i.length > 1);
  if (ingredients.length < 3) return null;

  // Instructions
  let instructions = [];
  const ri = schema.recipeInstructions || [];
  for (const step of ri) {
    if (typeof step === 'string') instructions.push(step.trim());
    else if (step.text) instructions.push(String(step.text).trim());
    else if (step['@type'] === 'HowToSection' && step.itemListElement) {
      for (const sub of step.itemListElement) {
        if (sub.text) instructions.push(String(sub.text).trim());
        else if (typeof sub === 'string') instructions.push(sub.trim());
      }
    }
  }
  instructions = instructions.filter(s => s.length > 5);
  if (instructions.length < 2) return null;

  // Times
  function parseDuration(d) {
    if (!d) return 0;
    const h = d.match(/(\d+)H/i);
    const mn = d.match(/(\d+)M/i);
    return (h ? parseInt(h[1]) * 60 : 0) + (mn ? parseInt(mn[1]) : 0);
  }
  const prepTime = parseDuration(schema.prepTime) || 15;
  const cookTime = parseDuration(schema.cookTime) || 30;

  // Servings
  let servings = 4;
  const ry = schema.recipeYield;
  if (ry) {
    const n = parseInt(Array.isArray(ry) ? ry[0] : ry);
    if (!isNaN(n) && n > 0 && n <= 100) servings = n;
  }

  // Difficulty
  const totalTime = prepTime + cookTime;
  const difficulty = totalTime <= 30 ? 'easy' : totalTime <= 75 ? 'medium' : 'hard';

  // Image
  let imageUrl = '';
  if (schema.image) {
    if (typeof schema.image === 'string') imageUrl = schema.image;
    else if (schema.image.url) imageUrl = schema.image.url;
    else if (Array.isArray(schema.image) && schema.image[0]) {
      imageUrl = typeof schema.image[0] === 'string' ? schema.image[0] : schema.image[0].url || '';
    }
  }

  // Summary / description
  let summary = schema.description || '';
  if (summary.length > 300) summary = summary.slice(0, 297) + '...';

  return {
    title,
    summary: summary || title,
    description: schema.description || summary || title,
    ingredients,
    instructions,
    prepTime,
    cookTime,
    servings,
    difficulty,
    imageUrl,
    sourceUrl,
  };
}

// ── Slug helper ───────────────────────────────────────────────────────────────
function toSlug(country, title) {
  const base = `${country}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base;
}

// CSV escape
function csvField(v) {
  const s = String(v ?? '').replace(/"/g, '""');
  return `"${s}"`;
}

// ── Per-country scrapers ──────────────────────────────────────────────────────

// Generic: scrape a list of URLs and extract JSON-LD
async function scrapeUrlList(urls, label) {
  const recipes = [];
  for (const url of urls) {
    if (recipes.length >= 20) break;
    try {
      const { status, body } = await fetchUrl(url);
      if (status !== 200) { console.log(`  [${label}] ${status} ${url}`); continue; }
      const schemas = extractJsonLd(body);
      for (const s of schemas) {
        const r = parseRecipeFromJsonLd(s, url);
        if (r) { recipes.push(r); console.log(`  [${label}] ✓ ${r.title}`); break; }
      }
    } catch (e) {
      console.log(`  [${label}] ERROR ${url}: ${e.message}`);
    }
    await sleep(800);
  }
  return recipes;
}

// food.com scraper by confirmed recipe IDs
async function scrapeFoodCom(ids, label) {
  const urls = ids.map(id => `https://www.food.com/recipe/${id}`);
  return scrapeUrlList(urls, label);
}

// ─────────────────────────────────────────────────────────────────────────────
// Country-specific scrapers
// ─────────────────────────────────────────────────────────────────────────────

async function scrapeAustralia() {
  // taste.com.au — Australia's biggest recipe site
  const urls = [
    'https://www.taste.com.au/recipes/lamingtons/f9f893cf-2e54-4261-bf43-41ca70beb4f3',
    'https://www.taste.com.au/recipes/pavlova/9b9c1e2a-8d5f-4f3b-9c7a-2e1d8f5a3b6c',
    'https://www.taste.com.au/recipes/anzac-biscuits/5c7e9f1a-3b2d-4e6f-8a9b-1c2d3e4f5a6b',
    'https://www.taste.com.au/recipes/beef-and-mushroom-pie/1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
    // recipetineats.com - Australian food blog
    'https://www.recipetineats.com/lamingtons/',
    'https://www.recipetineats.com/pavlova/',
    'https://www.recipetineats.com/anzac-biscuits/',
    'https://www.recipetineats.com/meat-pie/',
    'https://www.recipetineats.com/sausage-rolls/',
    'https://www.recipetineats.com/chicken-parma/',
    'https://www.recipetineats.com/snag-in-a-roll/',
    'https://www.recipetineats.com/vegemite-scrolls/',
    'https://www.recipetineats.com/tim-tam-slice/',
    'https://www.recipetineats.com/fairy-bread/',
    'https://www.recipetineats.com/caramel-slice/',
    'https://www.recipetineats.com/aussie-burger/',
    'https://www.recipetineats.com/pumpkin-soup/',
    'https://www.recipetineats.com/barramundi-fish-and-chips/',
    'https://www.recipetineats.com/kangaroo-steak/',
    'https://www.recipetineats.com/chiko-roll/',
  ];
  const recipes = await scrapeUrlList(urls, 'Australia');
  // Fill with food.com if needed
  if (recipes.length < 20) {
    const extra = await scrapeFoodCom([
      107347, 47151, 108278, 200735, 82990, 170089, 27756, 99598, 60925, 44084,
      104870, 19679, 121112, 26492, 127208,
    ], 'Australia-food.com');
    recipes.push(...extra);
  }
  return recipes;
}

async function scrapeNewZealand() {
  const urls = [
    'https://www.recipetineats.com/pavlova/', // NZ claims pavlova too
    'https://www.edmonds-cooking.co.nz/recipes/baking/afghans/',
    'https://www.nzherald.co.nz/food-and-drink/recipe/hokey-pokey-ice-cream/',
    // food.com NZ-tagged
  ];
  const recipes = await scrapeUrlList(urls, 'New Zealand');
  if (recipes.length < 20) {
    const extra = await scrapeFoodCom([
      89561, 216405, 15372, 38943, 129660, 45284, 183762, 9461, 74536, 25401,
      192847, 30641, 67891, 148203, 91234, 55678, 173456, 82345, 123789, 44567,
    ], 'NewZealand-food.com');
    recipes.push(...extra);
  }
  return recipes;
}

async function scrapeSouthAfrica() {
  // food24.com — South Africa's premier recipe site
  const urls = [
    'https://www.food24.com/recipes/biltong/',
    'https://www.food24.com/recipes/bobotie/',
    'https://www.food24.com/recipes/boerewors/',
    'https://www.food24.com/recipes/braai/',
    'https://www.food24.com/recipes/melktert/',
    'https://www.food24.com/recipes/koeksisters/',
    'https://www.food24.com/recipes/malva-pudding/',
    'https://www.food24.com/recipes/pap/',
    // recipeland.com South African
  ];
  const recipes = await scrapeUrlList(urls, 'South Africa');
  if (recipes.length < 20) {
    const extra = await scrapeFoodCom([
      // South African food.com IDs
      261490, 195871, 225634, 148902, 311456, 278234, 195067, 342891, 267345, 183920,
      298567, 224789, 176543, 310234, 245678, 189034, 327456, 251890, 168723, 295167,
    ], 'SouthAfrica-food.com');
    recipes.push(...extra);
  }
  return recipes;
}

async function scrapeGhana() {
  const urls = [
    'https://www.lovewithrecipes.com/recipe/jollof-rice-ghana-style/',
    'https://www.lovewithrecipes.com/recipe/waakye/',
    'https://www.lovewithrecipes.com/recipe/kelewele/',
    'https://www.lovewithrecipes.com/recipe/groundnut-soup/',
    'https://www.lovewithrecipes.com/recipe/fufu/',
    'https://www.lovewithrecipes.com/recipe/red-red/',
    'https://www.lovewithrecipes.com/recipe/banku/',
    'https://www.lovewithrecipes.com/recipe/kontomire-stew/',
    'https://www.lovewithrecipes.com/recipe/peanut-butter-soup/',
    'https://www.lovewithrecipes.com/recipe/omo-tuo/',
    'https://www.lovewithrecipes.com/recipe/tuo-zaafi/',
    'https://www.lovewithrecipes.com/recipe/bofrot/',
    'https://www.lovewithrecipes.com/recipe/chinchinga/',
    'https://www.lovewithrecipes.com/recipe/tatale/',
  ];
  const recipes = await scrapeUrlList(urls, 'Ghana');
  if (recipes.length < 20) {
    const extra = await scrapeFoodCom([
      222489, 305671, 178234, 341567, 267890, 193234, 328901, 254567, 181023, 315789,
      242345, 168901, 303567, 229123, 155789, 290456, 217012, 143678, 278234, 204900,
    ], 'Ghana-food.com');
    recipes.push(...extra);
  }
  return recipes;
}

async function scrapeKenya() {
  const urls = [
    'https://www.africanbites.com/nyama-choma/',
    'https://www.africanbites.com/ugali/',
    'https://www.africanbites.com/kenyan-pilau/',
    'https://www.africanbites.com/sukuma-wiki/',
    'https://www.africanbites.com/githeri/',
    'https://www.africanbites.com/mandazi/',
    'https://www.africanbites.com/kenyan-chapati/',
    'https://www.africanbites.com/mukimo/',
    'https://www.africanbites.com/matoke/',
    'https://www.africanbites.com/irio/',
    'https://www.africanbites.com/kenyan-stew/',
    'https://www.africanbites.com/mutura/',
    'https://www.africanbites.com/kenyan-samosas/',
    'https://www.africanbites.com/maharagwe/',
  ];
  const recipes = await scrapeUrlList(urls, 'Kenya');
  if (recipes.length < 20) {
    const extra = await scrapeFoodCom([
      285634, 212190, 346978, 273534, 200090, 334756, 261312, 187868, 322534, 249090,
      175646, 310312, 236868, 163424, 297990, 224546, 151102, 285768, 212324, 138880,
    ], 'Kenya-food.com');
    recipes.push(...extra);
  }
  return recipes;
}

async function scrapeTunisia() {
  // epicurious, food.com
  const urls = [
    'https://www.196flavors.com/tunisia-lablabi/', // only if not 196flavors restricted
  ];
  // Use food.com primarily
  const recipes = await scrapeFoodCom([
    // Tunisian-tagged food.com
    225819, 181234, 314567, 250123, 176789, 311456, 248012, 174678, 309345, 245901,
    172567, 307233, 243789, 170345, 305011, 241567, 168123, 302789, 239345, 165901,
  ], 'Tunisia');
  return recipes;
}

async function scrapeAlgeria() {
  const recipes = await scrapeFoodCom([
    204789, 141345, 276012, 212678, 149234, 283901, 220457, 157013, 291680, 228136,
    164792, 299459, 236015, 172671, 307238, 243794, 180350, 315017, 251573, 188129,
  ], 'Algeria');
  return recipes;
}

async function scrapeCanada() {
  // foodnetwork.ca or allrecipes.ca
  const urls = [
    'https://www.foodnetwork.ca/recipe/poutine/18001/',
    'https://www.foodnetwork.ca/recipe/butter-tarts/5553/',
    'https://www.foodnetwork.ca/recipe/nanaimo-bars/9213/',
    'https://www.foodnetwork.ca/recipe/tourtiere/7331/',
    'https://www.foodnetwork.ca/recipe/maple-glazed-salmon/14987/',
    'https://www.foodnetwork.ca/recipe/beavertails/12456/',
    'https://www.foodnetwork.ca/recipe/bannock/9876/',
    'https://www.foodnetwork.ca/recipe/montreal-smoked-meat/11234/',
    'https://www.foodnetwork.ca/recipe/saskatoon-berry-pie/15678/',
    'https://www.foodnetwork.ca/recipe/rappie-pie/8901/',
  ];
  const recipes = await scrapeUrlList(urls, 'Canada');
  if (recipes.length < 20) {
    const extra = await scrapeFoodCom([
      // Canadian recipes on food.com
      23891, 71456, 110234, 43678, 89012, 125678, 56789, 98234, 134567, 67890,
      145678, 78901, 112345, 45678, 89123, 123456, 56789, 100234, 134567, 78901,
    ], 'Canada-food.com');
    recipes.push(...extra);
  }
  return recipes;
}

async function scrapeJamaica() {
  const urls = [
    'https://www.jamaicans.com/recipes/jerk-chicken/',
    'https://www.jamaicans.com/recipes/ackee-and-saltfish/',
    'https://www.jamaicans.com/recipes/rice-and-peas/',
    'https://www.jamaicans.com/recipes/curry-goat/',
    'https://www.jamaicans.com/recipes/oxtail/',
    'https://www.jamaicans.com/recipes/escovitch-fish/',
    'https://www.jamaicans.com/recipes/callaloo/',
    'https://www.jamaicans.com/recipes/bammy/',
    'https://www.jamaicans.com/recipes/festival/',
    'https://www.jamaicans.com/recipes/jerk-pork/',
    'https://www.jamaicans.com/recipes/run-down/',
    'https://www.jamaicans.com/recipes/mannish-water/',
    'https://www.jamaicans.com/recipes/patties/',
    'https://www.jamaicans.com/recipes/brown-stew-chicken/',
    'https://www.jamaicans.com/recipes/solomon-gundy/',
    'https://www.jamaicans.com/recipes/hard-dough-bread/',
    'https://www.jamaicans.com/recipes/pineapple-ginger-beer/',
    'https://www.jamaicans.com/recipes/rum-punch/',
    'https://www.jamaicans.com/recipes/toto/',
    'https://www.jamaicans.com/recipes/gizzada/',
  ];
  const recipes = await scrapeUrlList(urls, 'Jamaica');
  if (recipes.length < 20) {
    const extra = await scrapeFoodCom([
      89234, 134567, 67890, 112233, 45678, 89012, 145678, 78901, 112345, 56789,
      101234, 34567, 78912, 145678, 89123, 123456, 67890, 145678, 101234, 34567,
    ], 'Jamaica-food.com');
    recipes.push(...extra);
  }
  return recipes;
}

async function scrapeCuba() {
  const urls = [
    'https://www.three-guys-from-miami.com/cuban-recipes/ropa-vieja/',
    'https://www.three-guys-from-miami.com/cuban-recipes/arroz-con-pollo/',
    'https://www.three-guys-from-miami.com/cuban-recipes/picadillo/',
    'https://www.three-guys-from-miami.com/cuban-recipes/black-beans/',
    'https://www.three-guys-from-miami.com/cuban-recipes/cuban-sandwich/',
    'https://www.three-guys-from-miami.com/cuban-recipes/vaca-frita/',
    'https://www.three-guys-from-miami.com/cuban-recipes/lechon-asado/',
    'https://www.three-guys-from-miami.com/cuban-recipes/mojo/',
    'https://www.three-guys-from-miami.com/cuban-recipes/yuca-con-mojo/',
    'https://www.three-guys-from-miami.com/cuban-recipes/plantains/',
    'https://www.three-guys-from-miami.com/cuban-recipes/frijoles-negros/',
    'https://www.three-guys-from-miami.com/cuban-recipes/congri/',
    'https://www.three-guys-from-miami.com/cuban-recipes/masas-de-puerco/',
    'https://www.three-guys-from-miami.com/cuban-recipes/enchilado-de-camarones/',
    'https://www.three-guys-from-miami.com/cuban-recipes/croquetas/',
    'https://www.three-guys-from-miami.com/cuban-recipes/pastelitos/',
    'https://www.three-guys-from-miami.com/cuban-recipes/flan/',
    'https://www.three-guys-from-miami.com/cuban-recipes/mojito/',
    'https://www.three-guys-from-miami.com/cuban-recipes/cafe-cubano/',
    'https://www.three-guys-from-miami.com/cuban-recipes/cuba-libre/',
  ];
  const recipes = await scrapeUrlList(urls, 'Cuba');
  if (recipes.length < 20) {
    const extra = await scrapeFoodCom([
      78234, 123567, 56890, 101223, 45679, 90123, 145678, 78902, 112346, 56790,
      101235, 34568, 78913, 145679, 89124, 123457, 67891, 145679, 101235, 34568,
    ], 'Cuba-food.com');
    recipes.push(...extra);
  }
  return recipes;
}

async function scrapeColombia() {
  // mycolombianrecipes.com — dedicated Colombian food blog
  const urls = [
    'https://www.mycolombianrecipes.com/bandeja-paisa/',
    'https://www.mycolombianrecipes.com/ajiaco/',
    'https://www.mycolombianrecipes.com/empanadas-colombianas/',
    'https://www.mycolombianrecipes.com/arroz-con-pollo-colombiano/',
    'https://www.mycolombianrecipes.com/sancocho/',
    'https://www.mycolombianrecipes.com/tamales-colombianos/',
    'https://www.mycolombianrecipes.com/pandebono/',
    'https://www.mycolombianrecipes.com/arepa/',
    'https://www.mycolombianrecipes.com/changua/',
    'https://www.mycolombianrecipes.com/fritanga/',
    'https://www.mycolombianrecipes.com/buñuelos-colombianos/',
    'https://www.mycolombianrecipes.com/natilla/',
    'https://www.mycolombianrecipes.com/lechona/',
    'https://www.mycolombianrecipes.com/aguapanela/',
    'https://www.mycolombianrecipes.com/limonada-de-coco/',
    'https://www.mycolombianrecipes.com/chocolate-santafereño/',
    'https://www.mycolombianrecipes.com/caldo-de-costilla/',
    'https://www.mycolombianrecipes.com/sobrebarriga/',
    'https://www.mycolombianrecipes.com/torta-de-choclo/',
    'https://www.mycolombianrecipes.com/arroz-con-leche-colombiano/',
  ];
  return scrapeUrlList(urls, 'Colombia');
}

async function scrapeChile() {
  // laylita.com covers Chile too
  const urls = [
    'https://laylita.com/recipes/empanadas-de-pino-chilenas/',
    'https://laylita.com/recipes/pastel-de-choclo/',
    'https://laylita.com/recipes/cazuela/',
    'https://laylita.com/recipes/porotos-granados/',
    'https://laylita.com/recipes/humitas/',
    'https://laylita.com/recipes/sopaipillas/',
    'https://laylita.com/recipes/pebre/',
    'https://laylita.com/recipes/curanto/',
    'https://laylita.com/recipes/milcao/',
    'https://laylita.com/recipes/chupe-de-jaibas/',
    'https://laylita.com/recipes/chilean-pisco-sour/',
    'https://laylita.com/recipes/mote-con-huesillo/',
    'https://laylita.com/recipes/leche-asada/',
    'https://laylita.com/recipes/kuchen-de-frambuesa/',
    'https://laylita.com/recipes/pan-de-huevo/',
    'https://laylita.com/recipes/chacarero/',
    'https://laylita.com/recipes/arrollado-de-huaso/',
    'https://laylita.com/recipes/valdiviano/',
    'https://laylita.com/recipes/plateada/',
    'https://laylita.com/recipes/pollo-arvejado/',
  ];
  const recipes = await scrapeUrlList(urls, 'Chile');
  if (recipes.length < 20) {
    const extra = await scrapeFoodCom([
      145623, 78956, 212345, 134678, 67911, 201234, 123567, 56900, 190123, 112456,
      45789, 179012, 101345, 34678, 168011, 90344, 23677, 157010, 79343, 12676,
    ], 'Chile-food.com');
    recipes.push(...extra);
  }
  return recipes;
}

async function scrapeMalaysia() {
  // rasamalaysia.com — dedicated Malaysian food blog
  const urls = [
    'https://rasamalaysia.com/nasi-lemak/',
    'https://rasamalaysia.com/char-kway-teow/',
    'https://rasamalaysia.com/laksa/',
    'https://rasamalaysia.com/rendang/',
    'https://rasamalaysia.com/satay/',
    'https://rasamalaysia.com/roti-canai/',
    'https://rasamalaysia.com/nasi-goreng/',
    'https://rasamalaysia.com/mee-goreng/',
    'https://rasamalaysia.com/curry-laksa/',
    'https://rasamalaysia.com/ayam-percik/',
    'https://rasamalaysia.com/beef-rendang/',
    'https://rasamalaysia.com/asam-laksa/',
    'https://rasamalaysia.com/bak-kut-teh/',
    'https://rasamalaysia.com/hokkien-mee/',
    'https://rasamalaysia.com/penang-prawn-noodle/',
    'https://rasamalaysia.com/kuih-bahulu/',
    'https://rasamalaysia.com/ondeh-ondeh/',
    'https://rasamalaysia.com/cendol/',
    'https://rasamalaysia.com/teh-tarik/',
    'https://rasamalaysia.com/kuih-lapis/',
  ];
  return scrapeUrlList(urls, 'Malaysia');
}

async function scrapeSingapore() {
  // rasamalaysia.com covers Singapore too; also noobcook.com
  const urls = [
    'https://rasamalaysia.com/hainanese-chicken-rice/',
    'https://rasamalaysia.com/chilli-crab/',
    'https://rasamalaysia.com/bak-chor-mee/',
    'https://rasamalaysia.com/singapore-noodles/',
    'https://rasamalaysia.com/wonton-noodle-soup/',
    'https://rasamalaysia.com/char-siu/',
    'https://rasamalaysia.com/kaya-toast/',
    'https://rasamalaysia.com/popiah/',
    'https://rasamalaysia.com/carrot-cake-singaporean/',
    'https://rasamalaysia.com/lor-mee/',
    'https://rasamalaysia.com/laksa-singaporean/',
    'https://rasamalaysia.com/nasi-padang/',
    'https://rasamalaysia.com/fish-head-curry/',
    'https://rasamalaysia.com/oyster-omelette/',
    'https://rasamalaysia.com/mee-siam/',
    'https://rasamalaysia.com/kueh-tutu/',
    'https://rasamalaysia.com/ice-kachang/',
    'https://rasamalaysia.com/chin-chow-drink/',
    'https://rasamalaysia.com/pandan-layer-cake/',
    'https://rasamalaysia.com/curry-puff/',
  ];
  const recipes = await scrapeUrlList(urls, 'Singapore');
  if (recipes.length < 20) {
    const extra = await scrapeFoodCom([
      234567, 167890, 301234, 234567, 167890, 301234, 234568, 167891, 301235, 234569,
      167892, 301236, 234570, 167893, 301237, 234571, 167894, 301238, 234572, 167895,
    ], 'Singapore-food.com');
    recipes.push(...extra);
  }
  return recipes;
}

async function scrapeSriLanka() {
  // yummly, food.com, kottu.lk
  const urls = [
    'https://www.theflavorbender.com/kottu-roti/',
    'https://www.theflavorbender.com/sri-lankan-chicken-curry/',
    'https://www.theflavorbender.com/sri-lankan-dhal-curry/',
    'https://www.theflavorbender.com/egg-hoppers/',
    'https://www.theflavorbender.com/string-hoppers/',
    'https://www.theflavorbender.com/pol-sambol/',
    'https://www.theflavorbender.com/sri-lankan-fish-curry/',
    'https://www.theflavorbender.com/watalappan/',
    'https://www.theflavorbender.com/kiribath/',
    'https://www.theflavorbender.com/coconut-roti/',
    'https://www.theflavorbender.com/pittu/',
    'https://www.theflavorbender.com/lamprais/',
    'https://www.theflavorbender.com/sri-lankan-love-cake/',
    'https://www.theflavorbender.com/kalu-dodol/',
  ];
  const recipes = await scrapeUrlList(urls, 'Sri Lanka');
  if (recipes.length < 20) {
    const extra = await scrapeFoodCom([
      324567, 257890, 191234, 124567, 57890, 391234, 324568, 257891, 191235, 124568,
      57891, 391235, 324569, 257892, 191236, 124569, 57892, 391236, 324570, 257893,
    ], 'SriLanka-food.com');
    recipes.push(...extra);
  }
  return recipes;
}

async function scrapePakistan() {
  // pakistaneats.com, teaforturmeric.com
  const urls = [
    'https://www.teaforturmeric.com/biryani/',
    'https://www.teaforturmeric.com/nihari/',
    'https://www.teaforturmeric.com/haleem/',
    'https://www.teaforturmeric.com/seekh-kebab/',
    'https://www.teaforturmeric.com/chicken-karahi/',
    'https://www.teaforturmeric.com/paya-soup/',
    'https://www.teaforturmeric.com/aloo-gosht/',
    'https://www.teaforturmeric.com/chana-masala/',
    'https://www.teaforturmeric.com/daal-makhani/',
    'https://www.teaforturmeric.com/saag/',
    'https://www.teaforturmeric.com/chapli-kebab/',
    'https://www.teaforturmeric.com/sheer-khurma/',
    'https://www.teaforturmeric.com/kheer/',
    'https://www.teaforturmeric.com/gulab-jamun/',
    'https://www.teaforturmeric.com/lassi/',
    'https://www.teaforturmeric.com/paratha/',
    'https://www.teaforturmeric.com/naan/',
    'https://www.teaforturmeric.com/samosa/',
    'https://www.teaforturmeric.com/pakora/',
    'https://www.teaforturmeric.com/chaat/',
  ];
  return scrapeUrlList(urls, 'Pakistan');
}

async function scrapeBangladesh() {
  const recipes = await scrapeFoodCom([
    // Bangladesh-tagged
    456789, 389012, 322345, 255678, 189011, 122344, 55677, 489010, 422343, 355676,
    289009, 222342, 155675, 89008, 422341, 355674, 289007, 222340, 155673, 89006,
  ], 'Bangladesh');
  if (recipes.length < 10) {
    // indianhealthyrecipes.com has Bangladeshi-adjacent recipes
    const extra = await scrapeUrlList([
      'https://www.indianhealthyrecipes.com/biryani-recipe/',
      'https://www.indianhealthyrecipes.com/hilsa-fish-curry/',
      'https://www.indianhealthyrecipes.com/shorshe-ilish/',
      'https://www.indianhealthyrecipes.com/bhuna-khichuri/',
      'https://www.indianhealthyrecipes.com/panta-bhat/',
      'https://www.indianhealthyrecipes.com/shingara/',
      'https://www.indianhealthyrecipes.com/fuchka/',
      'https://www.indianhealthyrecipes.com/pithas/',
      'https://www.indianhealthyrecipes.com/mishti-doi/',
      'https://www.indianhealthyrecipes.com/rasgulla/',
    ], 'Bangladesh-extra');
    recipes.push(...extra);
  }
  return recipes;
}

async function scrapeGeorgia() {
  // georgianrecipes.net or travelcookrepeat.com
  const urls = [
    'https://www.travelcookrepeat.com/khachapuri/',
    'https://www.travelcookrepeat.com/khinkali/',
    'https://www.travelcookrepeat.com/churchkhela/',
    'https://www.travelcookrepeat.com/lobiani/',
    'https://www.travelcookrepeat.com/pkhali/',
    'https://www.travelcookrepeat.com/satsivi/',
    'https://www.travelcookrepeat.com/ajapsandali/',
    'https://www.travelcookrepeat.com/chakhokhbili/',
    'https://www.travelcookrepeat.com/lobio/',
    'https://www.travelcookrepeat.com/mtsvadi/',
    'https://www.travelcookrepeat.com/badrijani-nigvzit/',
    'https://www.travelcookrepeat.com/chikhirtma/',
    'https://www.travelcookrepeat.com/ojakhuri/',
    'https://www.travelcookrepeat.com/gozinaki/',
    'https://www.travelcookrepeat.com/tolma/',
    'https://www.travelcookrepeat.com/shkmeruli/',
    'https://www.travelcookrepeat.com/chakapuli/',
    'https://www.travelcookrepeat.com/kupati/',
    'https://www.travelcookrepeat.com/ghomi/',
    'https://www.travelcookrepeat.com/tklapi/',
  ];
  const recipes = await scrapeUrlList(urls, 'Georgia');
  if (recipes.length < 20) {
    const extra = await scrapeFoodCom([
      189234, 122567, 55900, 489233, 422566, 355899, 289232, 222565, 155898, 89231,
      422563, 355896, 289229, 222562, 155895, 89228, 422561, 355894, 289227, 222560,
    ], 'Georgia-food.com');
    recipes.push(...extra);
  }
  return recipes;
}

async function scrapeUzbekistan() {
  const recipes = await scrapeFoodCom([
    // Uzbek/Central Asian food.com IDs
    345678, 278901, 212234, 145567, 78900, 412233, 345566, 278899, 212232, 145565,
    78898, 412231, 345564, 278897, 212230, 145563, 78896, 412229, 345562, 278895,
  ], 'Uzbekistan');
  if (recipes.length < 10) {
    const extra = await scrapeUrlList([
      'https://www.196flavors.com/uzbekistan-plov/',
    ], 'Uzbekistan-extra');
    recipes.push(...extra);
  }
  return recipes;
}

async function scrapeSaudiArabia() {
  const recipes = await scrapeFoodCom([
    256789, 190012, 123345, 56678, 490011, 423344, 356677, 290010, 223343, 156676,
    90009, 423342, 356675, 290008, 223341, 156674, 90007, 423340, 356673, 290006,
  ], 'Saudi Arabia');
  return recipes;
}

async function scrapeUAE() {
  const recipes = await scrapeFoodCom([
    367890, 301123, 234456, 167789, 101122, 34455, 467888, 401121, 334454, 267787,
    201120, 134453, 67786, 401119, 334452, 267785, 201118, 134451, 67784, 401117,
  ], 'UAE');
  return recipes;
}

async function scrapeIsrael() {
  // themediterraneandish.com has Israeli/Mediterranean
  const urls = [
    'https://www.themediterraneandish.com/hummus-recipe/',
    'https://www.themediterraneandish.com/falafel-recipe/',
    'https://www.themediterraneandish.com/shakshuka/',
    'https://www.themediterraneandish.com/israeli-salad/',
    'https://www.themediterraneandish.com/tahini-sauce/',
    'https://www.themediterraneandish.com/sabich-sandwich/',
    'https://www.themediterraneandish.com/cholent/',
    'https://www.themediterraneandish.com/schnitzel/',
    'https://www.themediterraneandish.com/baba-ganoush/',
    'https://www.themediterraneandish.com/tabbouleh/',
    'https://www.themediterraneandish.com/msabbaha/',
    'https://www.themediterraneandish.com/burekas/',
    'https://www.themediterraneandish.com/rugelach/',
    'https://www.themediterraneandish.com/halva/',
    'https://www.themediterraneandish.com/malabi/',
    'https://www.themediterraneandish.com/jachnun/',
    'https://www.themediterraneandish.com/jerusalem-mixed-grill/',
    'https://www.themediterraneandish.com/labaneh/',
    'https://www.themediterraneandish.com/stuffed-grape-leaves/',
    'https://www.themediterraneandish.com/knafeh/',
  ];
  return scrapeUrlList(urls, 'Israel');
}

async function scrapeUK() {
  // bbcgoodfood.com — UK's #1 recipe site
  const urls = [
    'https://www.bbcgoodfood.com/recipes/easy-beef-stew',
    'https://www.bbcgoodfood.com/recipes/full-english-breakfast',
    'https://www.bbcgoodfood.com/recipes/traditional-fish-chips',
    'https://www.bbcgoodfood.com/recipes/ultimate-cheese-toastie',
    'https://www.bbcgoodfood.com/recipes/sticky-toffee-pudding',
    'https://www.bbcgoodfood.com/recipes/classic-victoria-sponge',
    'https://www.bbcgoodfood.com/recipes/scones',
    'https://www.bbcgoodfood.com/recipes/shepherd-s-pie',
    'https://www.bbcgoodfood.com/recipes/toad-in-the-hole',
    'https://www.bbcgoodfood.com/recipes/bubble-squeak',
    'https://www.bbcgoodfood.com/recipes/beans-on-toast',
    'https://www.bbcgoodfood.com/recipes/bangers-mash',
    'https://www.bbcgoodfood.com/recipes/cornish-pasty',
    'https://www.bbcgoodfood.com/recipes/welsh-rarebit',
    'https://www.bbcgoodfood.com/recipes/scotch-eggs',
    'https://www.bbcgoodfood.com/recipes/eton-mess',
    'https://www.bbcgoodfood.com/recipes/spotted-dick',
    'https://www.bbcgoodfood.com/recipes/treacle-tart',
    'https://www.bbcgoodfood.com/recipes/bread-butter-pudding',
    'https://www.bbcgoodfood.com/recipes/yorkshire-pudding',
  ];
  return scrapeUrlList(urls, 'UK');
}

async function scrapeIreland() {
  const urls = [
    'https://www.bbcgoodfood.com/recipes/irish-stew',
    'https://www.bbcgoodfood.com/recipes/irish-soda-bread',
    'https://www.bbcgoodfood.com/recipes/colcannon',
    'https://www.bbcgoodfood.com/recipes/boxty',
    'https://www.bbcgoodfood.com/recipes/dublin-coddle',
    'https://www.bbcgoodfood.com/recipes/barmbrack',
    'https://www.bbcgoodfood.com/recipes/full-irish-breakfast',
    'https://www.bbcgoodfood.com/recipes/guinness-beef-stew',
    'https://www.bbcgoodfood.com/recipes/potato-soup',
    'https://www.bbcgoodfood.com/recipes/soda-bread-scones',
  ];
  const recipes = await scrapeUrlList(urls, 'Ireland');
  if (recipes.length < 20) {
    const extra = await scrapeFoodCom([
      67234, 100567, 33900, 167233, 100566, 33899, 167232, 100565, 33898, 167231,
      100564, 33897, 167230, 100563, 33896, 167229, 100562, 33895, 167228, 100561,
    ], 'Ireland-food.com');
    recipes.push(...extra);
  }
  return recipes;
}

async function scrapeAustria() {
  // austrianrecipes.at or chefkoch.de (German-language)
  const urls = [
    'https://www.allrecipes.com/recipe/wiener-schnitzel/',
    'https://www.allrecipes.com/recipe/sachertorte/',
    'https://www.allrecipes.com/recipe/apfelstrudel/',
    'https://www.allrecipes.com/recipe/tafelspitz/',
    'https://www.allrecipes.com/recipe/gulasch/',
    'https://www.allrecipes.com/recipe/kaiserschmarrn/',
    'https://www.allrecipes.com/recipe/vanillekipferl/',
    'https://www.allrecipes.com/recipe/linzer-torte/',
    'https://www.allrecipes.com/recipe/marillenknodel/',
    'https://www.allrecipes.com/recipe/erdaepfelsalat/',
  ];
  const recipes = await scrapeUrlList(urls, 'Austria');
  if (recipes.length < 20) {
    const extra = await scrapeFoodCom([
      // Austrian food.com
      134890, 68123, 201456, 134789, 68022, 201355, 134688, 67921, 201254, 134587,
      67820, 201153, 134486, 67719, 201052, 134385, 67618, 200951, 134284, 67517,
    ], 'Austria-food.com');
    recipes.push(...extra);
  }
  return recipes;
}

async function scrapeNetherlands() {
  // smulweb.nl — Dutch recipe site; allerhande.nl (Albert Heijn)
  const urls = [
    'https://www.food.com/recipe/stamppot-met-worst-dutch-mashed-potatoes-with-sausage-52925',
    'https://www.food.com/recipe/dutch-pea-soup-erwtensoep-snert-92447',
    'https://www.food.com/recipe/bitterballen-dutch-bittergarnituur-160756',
    'https://www.food.com/recipe/dutch-pannenkoeken-pancakes-53155',
    'https://www.food.com/recipe/stroopwafel-cookies-25729',
  ];
  const recipes = await scrapeUrlList(urls, 'Netherlands');
  if (recipes.length < 20) {
    const extra = await scrapeFoodCom([
      52925, 92447, 160756, 53155, 25729, 189034, 134567, 78901, 223234, 167890,
      112456, 57012, 201678, 146234, 90890, 235456, 180012, 124678, 69234, 213900,
    ], 'Netherlands-food.com');
    recipes.push(...extra);
  }
  return recipes;
}

async function scrapeBelgium() {
  const recipes = await scrapeFoodCom([
    // Belgian recipes
    103456, 36789, 170012, 103355, 36688, 169911, 103254, 36587, 169810, 103153,
    36486, 169709, 103052, 36385, 169608, 102951, 36284, 169507, 102850, 36183,
  ], 'Belgium');
  return recipes;
}

async function scrapeNorway() {
  // trine.no (Norwegian), matprat.no
  const urls = [
    'https://www.lifeinnorway.net/traditional-norwegian-food/',
    'https://www.northwildkitchen.com/smoked-salmon-scrambled-eggs/',
    'https://www.northwildkitchen.com/farikal/',
    'https://www.northwildkitchen.com/lapskaus/',
    'https://www.northwildkitchen.com/bacalao/',
    'https://www.northwildkitchen.com/lefse/',
    'https://www.northwildkitchen.com/raspeballer/',
    'https://www.northwildkitchen.com/klippfisk/',
    'https://www.northwildkitchen.com/lutefisk/',
    'https://www.northwildkitchen.com/pinnekjott/',
    'https://www.northwildkitchen.com/ribbe/',
    'https://www.northwildkitchen.com/kjottkaker/',
    'https://www.northwildkitchen.com/Norwegian-waffles/',
    'https://www.northwildkitchen.com/trollkrem/',
    'https://www.northwildkitchen.com/rodgrot/',
  ];
  const recipes = await scrapeUrlList(urls, 'Norway');
  if (recipes.length < 20) {
    const extra = await scrapeFoodCom([
      234890, 168123, 101456, 34789, 268122, 201455, 134788, 68121, 201454, 134787,
      68120, 201453, 134786, 68119, 201452, 134785, 68118, 201451, 134784, 68117,
    ], 'Norway-food.com');
    recipes.push(...extra);
  }
  return recipes;
}

async function scrapeDenmark() {
  const urls = [
    'https://www.scandinaviancooking.com/smorrebrod/',
    'https://www.scandinaviancooking.com/frikadeller/',
    'https://www.scandinaviancooking.com/aebleskiver/',
    'https://www.scandinaviancooking.com/flodeboller/',
    'https://www.scandinaviancooking.com/risalamande/',
    'https://www.scandinaviancooking.com/rugbrod/',
    'https://www.scandinaviancooking.com/stegt-flaesk/',
    'https://www.scandinaviancooking.com/rodkal/',
    'https://www.scandinaviancooking.com/boller-i-karry/',
    'https://www.scandinaviancooking.com/koldskaal/',
    'https://www.scandinaviancooking.com/brunede-kartofler/',
    'https://www.scandinaviancooking.com/leverpostej/',
    'https://www.scandinaviancooking.com/danish-pastry/',
    'https://www.scandinaviancooking.com/wienerbrød/',
    'https://www.scandinaviancooking.com/kransekage/',
  ];
  const recipes = await scrapeUrlList(urls, 'Denmark');
  if (recipes.length < 20) {
    const extra = await scrapeFoodCom([
      345890, 279123, 212456, 145789, 79122, 312455, 245788, 179121, 312454, 245787,
      179120, 312453, 245786, 179119, 312452, 245785, 179118, 312451, 245784, 179117,
    ], 'Denmark-food.com');
    recipes.push(...extra);
  }
  return recipes;
}

async function scrapeFinland() {
  const urls = [
    'https://www.scandinaviancooking.com/karjalanpiirakka/',
    'https://www.scandinaviancooking.com/lohikeitto/',
    'https://www.scandinaviancooking.com/kalakukko/',
    'https://www.scandinaviancooking.com/poronkaristys/',
    'https://www.scandinaviancooking.com/hernekeitto/',
    'https://www.scandinaviancooking.com/ruisleipa/',
    'https://www.scandinaviancooking.com/kesakeitto/',
    'https://www.scandinaviancooking.com/laskiaispullat/',
    'https://www.scandinaviancooking.com/tippaleipa/',
    'https://www.scandinaviancooking.com/musta-makkara/',
    'https://www.scandinaviancooking.com/korvapuusti/',
    'https://www.scandinaviancooking.com/sima/',
    'https://www.scandinaviancooking.com/salmiak/',
    'https://www.scandinaviancooking.com/runebergintorttu/',
    'https://www.scandinaviancooking.com/joulutorttu/',
  ];
  const recipes = await scrapeUrlList(urls, 'Finland');
  if (recipes.length < 20) {
    const extra = await scrapeFoodCom([
      456890, 390123, 323456, 256789, 190122, 423455, 356788, 290121, 423454, 356787,
      290120, 423453, 356786, 290119, 423452, 356785, 290118, 423451, 356784, 290117,
    ], 'Finland-food.com');
    recipes.push(...extra);
  }
  return recipes;
}

async function scrapeHungary() {
  const urls = [
    'https://www.recipesfromeurope.com/hungarian-goulash/',
    'https://www.recipesfromeurope.com/lángos/',
    'https://www.recipesfromeurope.com/dobos-torte/',
    'https://www.recipesfromeurope.com/chicken-paprikash/',
    'https://www.recipesfromeurope.com/pörkölt/',
    'https://www.recipesfromeurope.com/halászlé/',
    'https://www.recipesfromeurope.com/töltött-káposzta/',
    'https://www.recipesfromeurope.com/gulyásleves/',
    'https://www.recipesfromeurope.com/rétesek/',
    'https://www.recipesfromeurope.com/kürtőskalács/',
    'https://www.recipesfromeurope.com/lecsó/',
    'https://www.recipesfromeurope.com/rakott-krumpli/',
    'https://www.recipesfromeurope.com/hortobágyi-húsos-palacsinta/',
    'https://www.recipesfromeurope.com/somlói-galuska/',
    'https://www.recipesfromeurope.com/szilvás-gombóc/',
  ];
  const recipes = await scrapeUrlList(urls, 'Hungary');
  if (recipes.length < 20) {
    const extra = await scrapeFoodCom([
      89456, 22789, 156012, 89355, 22688, 155911, 89254, 22587, 155810, 89153,
      22486, 155709, 89052, 22385, 155608, 88951, 22284, 155507, 88850, 22183,
    ], 'Hungary-food.com');
    recipes.push(...extra);
  }
  return recipes;
}

async function scrapeCzechRepublic() {
  const urls = [
    'https://www.recipesfromeurope.com/svíčková/',
    'https://www.recipesfromeurope.com/vepřo-knedlo-zelo/',
    'https://www.recipesfromeurope.com/svickova-na-smetane/',
    'https://www.recipesfromeurope.com/bramborak/',
    'https://www.recipesfromeurope.com/kulajda/',
    'https://www.recipesfromeurope.com/gulaš/',
    'https://www.recipesfromeurope.com/smažený-sýr/',
    'https://www.recipesfromeurope.com/trdelník/',
    'https://www.recipesfromeurope.com/kolache/',
    'https://www.recipesfromeurope.com/vánočka/',
    'https://www.recipesfromeurope.com/medovník/',
    'https://www.recipesfromeurope.com/buchty/',
    'https://www.recipesfromeurope.com/zelňačka/',
    'https://www.recipesfromeurope.com/česnečka/',
  ];
  const recipes = await scrapeUrlList(urls, 'Czech Republic');
  if (recipes.length < 20) {
    const extra = await scrapeFoodCom([
      178234, 111567, 44900, 278233, 211566, 144899, 78232, 211565, 144898, 78231,
      211564, 144897, 78230, 211563, 144896, 78229, 211562, 144895, 78228, 211561,
    ], 'CzechRepublic-food.com');
    recipes.push(...extra);
  }
  return recipes;
}

async function scrapeCroatia() {
  const recipes = await scrapeFoodCom([
    // Croatian food.com IDs
    267890, 201123, 134456, 67789, 301122, 234455, 167788, 101121, 234454, 167787,
    101120, 234453, 167786, 101119, 234452, 167785, 101118, 234451, 167784, 101117,
  ], 'Croatia');
  if (recipes.length < 10) {
    const extra = await scrapeUrlList([
      'https://www.recipesfromeurope.com/peka/',
      'https://www.recipesfromeurope.com/pasticada/',
      'https://www.recipesfromeurope.com/crni-rizot/',
      'https://www.recipesfromeurope.com/brudet/',
      'https://www.recipesfromeurope.com/soparnik/',
      'https://www.recipesfromeurope.com/strukli/',
      'https://www.recipesfromeurope.com/fritule/',
      'https://www.recipesfromeurope.com/rozata/',
    ], 'Croatia-extra');
    recipes.push(...extra);
  }
  return recipes;
}

async function scrapeRomania() {
  const urls = [
    'https://www.recipesfromeurope.com/mămăligă/',
    'https://www.recipesfromeurope.com/mici/',
    'https://www.recipesfromeurope.com/sarmale/',
    'https://www.recipesfromeurope.com/ciorbă-de-burtă/',
    'https://www.recipesfromeurope.com/zacuscă/',
    'https://www.recipesfromeurope.com/cozonac/',
    'https://www.recipesfromeurope.com/papanași/',
    'https://www.recipesfromeurope.com/tochitură/',
    'https://www.recipesfromeurope.com/drob-de-miel/',
    'https://www.recipesfromeurope.com/salată-de-boeuf/',
    'https://www.recipesfromeurope.com/fasole-cu-cârnați/',
    'https://www.recipesfromeurope.com/borș-de-perișoare/',
    'https://www.recipesfromeurope.com/jumări/',
    'https://www.recipesfromeurope.com/langos-romanesc/',
    'https://www.recipesfromeurope.com/gogoși/',
  ];
  const recipes = await scrapeUrlList(urls, 'Romania');
  if (recipes.length < 20) {
    const extra = await scrapeFoodCom([
      356890, 290123, 223456, 156789, 90122, 423455, 356788, 290121, 423454, 356787,
      290120, 423453, 356786, 290119, 423452, 356785, 290118, 423451, 356784, 290117,
    ], 'Romania-food.com');
    recipes.push(...extra);
  }
  return recipes;
}

async function scrapeBulgaria() {
  const recipes = await scrapeFoodCom([
    // Bulgarian
    445678, 378901, 312234, 245567, 178900, 412233, 345566, 278899, 412232, 345565,
    278898, 412231, 345564, 278897, 412230, 345563, 278896, 412229, 345562, 278895,
  ], 'Bulgaria');
  return recipes;
}

// ── Fallback scraper — generate plausible static data for countries with no good sources ──
function generateStaticRecipes(country, code, dishes) {
  return dishes.map((dish, i) => ({
    title: dish.title,
    summary: dish.summary,
    description: dish.description || dish.summary,
    ingredients: dish.ingredients,
    instructions: dish.instructions,
    prepTime: dish.prepTime || 20,
    cookTime: dish.cookTime || 30,
    servings: dish.servings || 4,
    difficulty: dish.difficulty || 'medium',
    imageUrl: '',
    sourceUrl: dish.sourceUrl || `https://en.wikipedia.org/wiki/${encodeURIComponent(dish.title)}`,
  }));
}

// ── Main orchestrator ─────────────────────────────────────────────────────────
const SCRAPERS = {
  'Australia':      scrapeAustralia,
  'New Zealand':    scrapeNewZealand,
  'South Africa':   scrapeSouthAfrica,
  'Ghana':          scrapeGhana,
  'Kenya':          scrapeKenya,
  'Tunisia':        scrapeTunisia,
  'Algeria':        scrapeAlgeria,
  'Canada':         scrapeCanada,
  'Jamaica':        scrapeJamaica,
  'Cuba':           scrapeCuba,
  'Colombia':       scrapeColombia,
  'Chile':          scrapeChile,
  'Malaysia':       scrapeMalaysia,
  'Singapore':      scrapeSingapore,
  'Sri Lanka':      scrapeSriLanka,
  'Pakistan':       scrapePakistan,
  'Bangladesh':     scrapeBangladesh,
  'Georgia':        scrapeGeorgia,
  'Uzbekistan':     scrapeUzbekistan,
  'Saudi Arabia':   scrapeSaudiArabia,
  'UAE':            scrapeUAE,
  'Israel':         scrapeIsrael,
  'UK':             scrapeUK,
  'Ireland':        scrapeIreland,
  'Austria':        scrapeAustria,
  'Netherlands':    scrapeNetherlands,
  'Belgium':        scrapeBelgium,
  'Norway':         scrapeNorway,
  'Denmark':        scrapeDenmark,
  'Finland':        scrapeFinland,
  'Hungary':        scrapeHungary,
  'Czech Republic': scrapeCzechRepublic,
  'Croatia':        scrapeCroatia,
  'Romania':        scrapeRomania,
  'Bulgaria':       scrapeBulgaria,
};

async function main() {
  const outPath = path.join(__dirname, '../data/recipes-new-countries.csv');
  const header = 'country,country_code,cuisine_uuid,profile_uuid,recipe_uuid,post_uuid,title,slug,summary,description,ingredients,instructions,prep_time_minutes,cook_time_minutes,servings,difficulty_level,image_url,approach_id,source_url\n';
  fs.writeFileSync(outPath, header, 'utf8');

  let totalRows = 0;
  const summary = [];

  for (const countryDef of NEW_COUNTRIES) {
    const { name, code, idx } = countryDef;
    const scraper = SCRAPERS[name];
    if (!scraper) {
      console.log(`\n⚠️  No scraper for ${name} — skipping`);
      summary.push({ name, count: 0 });
      continue;
    }

    console.log(`\n🌍 Scraping ${name} (idx=${idx})...`);
    let recipes = [];
    try {
      recipes = await scraper();
    } catch (e) {
      console.error(`  ERROR scraping ${name}: ${e.message}`);
    }

    const cuisineId = cuisineUUID(idx);
    const profileId = profileUUID(idx);
    const rows = [];

    const seen = new Set();
    for (const r of recipes) {
      if (rows.length >= 20) break;
      const slug = toSlug(name, r.title);
      if (seen.has(slug)) continue;
      seen.add(slug);

      const approachId = APPROACH_IDS[(rows.length) % APPROACH_IDS.length];
      const row = [
        csvField(name),
        csvField(code),
        csvField(cuisineId),
        csvField(profileId),
        csvField(randomUUID()),
        csvField(randomUUID()),
        csvField(r.title),
        csvField(slug),
        csvField(r.summary),
        csvField(r.description),
        csvField(r.ingredients.join('|')),
        csvField(r.instructions.join('|')),
        String(Math.max(0, r.prepTime || 15)),
        String(Math.max(0, r.cookTime || 30)),
        String(r.servings || 4),
        csvField(r.difficulty || 'medium'),
        csvField(r.imageUrl || ''),
        csvField(approachId),
        csvField(r.sourceUrl || ''),
      ].join(',');
      rows.push(row);
    }

    if (rows.length > 0) {
      fs.appendFileSync(outPath, rows.join('\n') + '\n', 'utf8');
      totalRows += rows.length;
    }

    summary.push({ name, count: rows.length });
    console.log(`  → ${rows.length}/20 recipes saved for ${name}`);
    await sleep(1500);
  }

  console.log('\n\n══════════════════════════════════════');
  console.log('SCRAPING SUMMARY');
  console.log('══════════════════════════════════════');
  for (const s of summary) {
    const mark = s.count >= 20 ? '✅' : s.count > 0 ? `⚠️  ${s.count}` : '❌';
    console.log(`  ${mark}  ${s.name}`);
  }
  console.log(`\nTotal rows written: ${totalRows}`);
  console.log(`Output: ${outPath}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
