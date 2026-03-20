#!/usr/bin/env node
'use strict';

/**
 * seed-google-v3.js — Google Search → JSON-LD extract → Ollama translate → Supabase
 *
 * Strategy: For each country, Google for "authentic {country} recipes site:*.com"
 * targeting food blogs (not mainstream BBC/allrecipes), extract JSON-LD Recipe
 * schema, translate to Romanian, insert to Supabase.
 *
 * Usage:
 *   node scripts/seed-google-v3.js                    # all missing countries
 *   node scripts/seed-google-v3.js --only japan       # single country
 *   node scripts/seed-google-v3.js --min 10           # only countries with <10 recipes
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');

// ── Load .env.local ──────────────────────────────────────────────────────────
try {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
} catch {}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ── Config ───────────────────────────────────────────────────────────────────
const TARGET_PER_COUNTRY = 15;
const OLLAMA_MODEL = 'aya-expanse:8b';
const OLLAMA_HARD_TIMEOUT = 180000;
const PROGRESS_FILE = path.join(__dirname, '.seed-google-v3-progress.json');

const APPROACH_IDS = [
  'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000004',
  'b0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000006',
];

// Mainstream sites to EXCLUDE (we want obscure blogs)
const EXCLUDED_DOMAINS = new Set([
  'bbcgoodfood.com', 'allrecipes.com', 'foodnetwork.com', 'epicurious.com',
  'delish.com', 'tasty.co', 'simplyrecipes.com', 'bonappetit.com',
  'food52.com', 'cookinglight.com', 'eatingwell.com', 'taste.com.au',
  'youtube.com', 'pinterest.com', 'instagram.com', 'facebook.com',
  'amazon.com', 'wikipedia.org', 'reddit.com',
]);

// ── HTTP helper ──────────────────────────────────────────────────────────────
function fetchUrl(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.get({
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        timeout,
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const loc = res.headers.location.startsWith('http')
            ? res.headers.location
            : `${parsed.protocol}//${parsed.hostname}${res.headers.location}`;
          return fetchUrl(loc, timeout).then(resolve).catch(reject);
        }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
        res.on('error', reject);
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    } catch (e) { reject(e); }
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Recipe URL discovery via reliable sitemaps + keyword matching ─────────────
// These sites have working sitemaps with JSON-LD Recipe schema

const RECIPE_SOURCES = [
  // Large international recipe blogs with diverse cuisines
  { name: 'recipetineats', sitemaps: ['https://www.recipetineats.com/post-sitemap.xml', 'https://www.recipetineats.com/post-sitemap2.xml'] },
  { name: 'pickledplum', sitemaps: ['https://pickledplum.com/post-sitemap.xml'] },
  { name: 'rainbowplantlife', sitemaps: ['https://rainbowplantlife.com/post-sitemap.xml'] },
  { name: 'cookwithnabeela', sitemaps: ['https://www.cookwithnabeela.com/post-sitemap.xml'] },
  { name: 'mycolombianrecipes', sitemaps: ['https://www.mycolombianrecipes.com/post-sitemap.xml'] },
  { name: 'laylita', sitemaps: ['https://www.laylita.com/recipes/sitemap.xml'] },
  { name: 'recipesfromeurope', sitemaps: ['https://www.recipesfromeurope.com/post-sitemap.xml'] },
  { name: 'nigerianfoodtv', sitemaps: ['https://www.nigerianfoodtv.com/wp-sitemap-posts-post-1.xml'] },
  { name: 'greatbritishchefs', sitemaps: ['https://www.greatbritishchefs.com/recipes.xml'] },
  { name: 'internationalcuisine', sitemaps: ['https://www.internationalcuisine.com/post-sitemap.xml'] },
  { name: 'daringgourmet', sitemaps: ['https://www.daringgourmet.com/post-sitemap.xml', 'https://www.daringgourmet.com/post-sitemap2.xml'] },
  { name: 'globalkitchentravels', sitemaps: ['https://www.globalkitchentravels.com/post-sitemap.xml'] },
  { name: '196flavors', sitemaps: ['https://www.196flavors.com/post-sitemap.xml'] },
  { name: 'whiskaffair', sitemaps: ['https://www.whiskaffair.com/post-sitemap.xml'] },
  { name: 'wandercooks', sitemaps: ['https://www.wandercooks.com/post-sitemap.xml'] },
];

// Country → search keywords for URL matching
const COUNTRY_KEYWORDS = {
  'France': ['french', 'france', 'provencal', 'bouillabaisse', 'ratatouille', 'coq-au-vin', 'crepe', 'quiche', 'boeuf-bourguignon', 'croissant'],
  'Japan': ['japanese', 'japan', 'ramen', 'sushi', 'teriyaki', 'gyoza', 'tempura', 'udon', 'miso', 'tonkatsu', 'yakitori'],
  'Mexico': ['mexican', 'mexico', 'taco', 'enchilada', 'guacamole', 'tamale', 'burrito', 'pozole', 'mole', 'churro', 'elote'],
  'Spain': ['spanish', 'spain', 'paella', 'gazpacho', 'tapas', 'churros', 'tortilla-espanola', 'patatas-bravas', 'jamon', 'croquetas'],
  'Thailand': ['thai', 'thailand', 'pad-thai', 'curry', 'tom-yum', 'satay', 'green-curry', 'massaman', 'som-tam', 'larb'],
  'Turkey': ['turkish', 'turkey', 'kebab', 'baklava', 'pide', 'lahmacun', 'borek', 'dolma', 'kofte', 'menemen'],
  'South Korea': ['korean', 'korea', 'kimchi', 'bibimbap', 'bulgogi', 'japchae', 'tteokbokki', 'gochujang', 'samgyeopsal', 'jjigae'],
  'Vietnam': ['vietnamese', 'vietnam', 'pho', 'banh-mi', 'spring-roll', 'bun-cha', 'com-tam', 'cao-lau', 'goi-cuon'],
  'Peru': ['peruvian', 'peru', 'ceviche', 'lomo-saltado', 'aji-de-gallina', 'anticucho', 'causa', 'papa-a-la-huancaina'],
  'Lebanon': ['lebanese', 'lebanon', 'hummus', 'falafel', 'tabbouleh', 'kibbeh', 'fattoush', 'shawarma', 'manakish'],
  'Ethiopia': ['ethiopian', 'ethiopia', 'injera', 'doro-wot', 'kitfo', 'tibs', 'shiro', 'berbere', 'misir-wot'],
  'Morocco': ['moroccan', 'morocco', 'tagine', 'couscous', 'harira', 'pastilla', 'rfissa', 'msemen', 'zaalouk'],
  'Nigeria': ['nigerian', 'nigeria', 'jollof', 'egusi', 'suya', 'puff-puff', 'chin-chin', 'ogbono', 'pepper-soup'],
  'Ghana': ['ghanaian', 'ghana', 'jollof', 'waakye', 'kenkey', 'kelewele', 'fufu', 'banku', 'red-red', 'groundnut'],
  'Kenya': ['kenyan', 'kenya', 'nyama-choma', 'ugali', 'sukuma-wiki', 'chapati', 'mandazi', 'pilau', 'githeri'],
  'South Africa': ['south-african', 'south-africa', 'bobotie', 'biltong', 'bunny-chow', 'sosatie', 'potjiekos', 'chakalaka', 'boerewors'],
  'Jamaica': ['jamaican', 'jamaica', 'jerk', 'ackee', 'oxtail', 'curry-goat', 'patty', 'festival', 'escovitch', 'bammy'],
  'Philippines': ['filipino', 'philippines', 'adobo', 'sinigang', 'lumpia', 'lechon', 'kare-kare', 'pancit', 'halo-halo'],
  'Poland': ['polish', 'poland', 'pierogi', 'bigos', 'zurek', 'placki', 'kotlet', 'gołąbki', 'sernik'],
  'Portugal': ['portuguese', 'portugal', 'bacalhau', 'pastel-de-nata', 'caldo-verde', 'francesinha', 'arroz-de-marisco'],
  'Russia': ['russian', 'russia', 'borscht', 'pelmeni', 'blini', 'beef-stroganoff', 'piroshki', 'shchi', 'pirozhki'],
  'Sweden': ['swedish', 'sweden', 'meatball', 'kanelbulle', 'smorgasbord', 'gravlax', 'raggmunk', 'janssons'],
  'Germany': ['german', 'germany', 'schnitzel', 'bratwurst', 'pretzel', 'strudel', 'spaetzle', 'sauerbraten', 'black-forest'],
  'Greece': ['greek', 'greece', 'moussaka', 'souvlaki', 'spanakopita', 'gyro', 'baklava', 'tzatziki', 'pastitsio'],
  'UK': ['british', 'english', 'scone', 'shepherd-pie', 'fish-and-chips', 'cornish-pasty', 'sticky-toffee', 'bangers-and-mash', 'trifle'],
  'Ireland': ['irish', 'ireland', 'colcannon', 'soda-bread', 'boxty', 'coddle', 'champ', 'black-pudding'],
  'China': ['chinese', 'china', 'kung-pao', 'dim-sum', 'mapo-tofu', 'dan-dan', 'char-siu', 'congee', 'wonton', 'peking-duck'],
  'India': ['indian', 'india', 'butter-chicken', 'biryani', 'dal', 'paneer', 'tikka', 'samosa', 'naan', 'korma', 'vindaloo', 'dosa'],
  'Cuba': ['cuban', 'cuba', 'ropa-vieja', 'moros-y-cristianos', 'tostones', 'vaca-frita', 'picadillo', 'platano', 'flan'],
  'Iran': ['persian', 'iranian', 'iran', 'tahdig', 'ghormeh-sabzi', 'fesenjan', 'joojeh', 'ash-reshteh', 'zereshk'],
  'Iraq': ['iraqi', 'iraq', 'masgouf', 'tepsi', 'biryani', 'dolma', 'kubba', 'quzi'],
  'Jordan': ['jordanian', 'jordan', 'mansaf', 'maqluba', 'knafeh', 'fattet-hummus', 'zarb'],
  'Saudi Arabia': ['saudi', 'arabian', 'kabsa', 'jareesh', 'harees', 'mandi', 'mutabbaq', 'saleeg'],
  'UAE': ['emirati', 'uae', 'harees', 'machbous', 'luqaimat', 'balaleet', 'thareed'],
  'Egypt': ['egyptian', 'egypt', 'koshari', 'ful-medames', 'molokhia', 'feteer', 'shakshuka', 'hawawshi'],
  'Sri Lanka': ['sri-lankan', 'sri-lanka', 'hoppers', 'kottu', 'lamprais', 'pol-sambol', 'dhal-curry', 'kiribath'],
  'New Zealand': ['new-zealand', 'kiwi', 'pavlova', 'lamington', 'hangi', 'hokey-pokey', 'anzac', 'kumara'],
  'Iceland': ['icelandic', 'iceland', 'plokkfiskur', 'hangikjot', 'kleinur', 'hardfiskur', 'skyr', 'pylsur'],
  'Georgia': ['georgian', 'georgia', 'khachapuri', 'khinkali', 'chakhokhbili', 'lobio', 'pkhali', 'churchkhela'],
  'Uzbekistan': ['uzbek', 'uzbekistan', 'plov', 'manti', 'samsa', 'shashlik', 'lagman', 'chuchvara'],
  'Senegal': ['senegalese', 'senegal', 'thieboudienne', 'yassa', 'mafe', 'dibi', 'fataya'],
  'Tanzania': ['tanzanian', 'tanzania', 'ugali', 'pilau', 'nyama-choma', 'chipsi-mayai', 'mishkaki', 'wali-wa-nazi'],
  'Uganda': ['ugandan', 'uganda', 'rolex', 'luwombo', 'posho', 'matoke', 'groundnut-stew'],
  'Syria': ['syrian', 'syria', 'kibbeh', 'fattoush', 'muhammara', 'shawarma', 'shanklish'],
  'Malaysia': ['malaysian', 'malaysia', 'nasi-lemak', 'rendang', 'satay', 'laksa', 'char-kuey-teow', 'roti-canai'],
  'Singapore': ['singaporean', 'singapore', 'hainanese', 'laksa', 'chilli-crab', 'kaya-toast', 'char-kway-teow'],
  'Indonesia': ['indonesian', 'indonesia', 'nasi-goreng', 'rendang', 'satay', 'gado-gado', 'soto', 'bakso', 'tempeh'],
};

function extractSitemapUrls(xml) {
  return [...xml.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/g)].map(m => m[1]);
}

// Cache for sitemaps so we don't refetch per country
const sitemapCache = new Map();

async function fetchSitemapCached(url) {
  if (sitemapCache.has(url)) return sitemapCache.get(url);
  try {
    console.log(`      ↳ fetching sitemap: ${url.slice(0, 60)}...`);
    const { body } = await fetchUrl(url, 25000);
    let urls = extractSitemapUrls(body);
    // Handle sitemap index
    if (urls.some(u => u.endsWith('.xml'))) {
      const subUrls = [];
      for (const sub of urls.filter(u => u.endsWith('.xml')).slice(0, 5)) {
        try {
          const { body: sb } = await fetchUrl(sub, 20000);
          subUrls.push(...extractSitemapUrls(sb));
        } catch (e) { console.log(`      ↳ sub-sitemap failed: ${e.message}`); }
        await sleep(500);
      }
      urls = subUrls;
    }
    console.log(`      ↳ got ${urls.length} URLs from ${url.split('/')[2]}`);
    sitemapCache.set(url, urls);
    return urls;
  } catch (e) {
    console.log(`      ↳ sitemap FAILED: ${e.message}`);
    sitemapCache.set(url, []);
    return [];
  }
}

async function searchForRecipes(countryName, numResults = 40) {
  // Generate keywords: explicit map + auto from country name
  const explicit = COUNTRY_KEYWORDS[countryName] || [];
  const autoKw = [
    countryName.toLowerCase(),
    countryName.toLowerCase().replace(/ /g, '-'),
    // Demonym guesses
    countryName.toLowerCase() + 'n',    // e.g., "egyptian"
    countryName.toLowerCase() + 'an',   // e.g., "peruvian"
    countryName.toLowerCase() + 'ese',  // e.g., "japanese"
    countryName.toLowerCase() + 'i',    // e.g., "iraqi"
    countryName.toLowerCase() + 'ian',  // e.g., "cambodian"
    countryName.toLowerCase().slice(0, -1) + 'ian', // e.g., "colombian"
  ];
  const keywords = [...new Set([...explicit, ...autoKw])];

  const matched = [];
  const seenUrls = new Set();

  // Phase 1: keyword match across all sitemaps
  console.log(`    Checking ${RECIPE_SOURCES.length} recipe sites for "${countryName}" keywords...`);
  for (const source of RECIPE_SOURCES) {
    for (const sitemap of source.sitemaps) {
      const urls = await fetchSitemapCached(sitemap);
      for (const url of urls) {
        if (seenUrls.has(url)) continue;
        const urlLower = url.toLowerCase();
        if (keywords.some(k => urlLower.includes(k))) {
          seenUrls.add(url);
          matched.push(url);
        }
      }
    }
  }
  console.log(`    Phase 1 (keyword): ${matched.length} URLs`);

  // Phase 2: if too few, use 196flavors and internationalcuisine (they have per-country pages)
  if (matched.length < 10) {
    const specialSources = ['196flavors', 'internationalcuisine', 'globalkitchentravels', 'daringgourmet'];
    for (const srcName of specialSources) {
      const src = RECIPE_SOURCES.find(s => s.name === srcName);
      if (!src) continue;
      for (const sitemap of src.sitemaps) {
        const urls = await fetchSitemapCached(sitemap);
        const shuffled = [...urls].sort(() => Math.random() - 0.5);
        for (const url of shuffled.slice(0, 30)) {
          if (!seenUrls.has(url)) {
            seenUrls.add(url);
            matched.push(url);
          }
          if (matched.length >= numResults) break;
        }
      }
    }
    console.log(`    Phase 2 (broad): ${matched.length} URLs`);
  }

  // Phase 3: still short? grab from recipetineats (largest source, diverse cuisines)
  if (matched.length < 10) {
    for (const sitemap of RECIPE_SOURCES[0].sitemaps) { // recipetineats
      const urls = await fetchSitemapCached(sitemap);
      const shuffled = [...urls].sort(() => Math.random() - 0.5);
      for (const url of shuffled.slice(0, 40)) {
        if (!seenUrls.has(url)) {
          seenUrls.add(url);
          matched.push(url);
        }
        if (matched.length >= numResults) break;
      }
    }
    console.log(`    Phase 3 (fallback): ${matched.length} URLs`);
  }

  return matched.slice(0, numResults);
}

// ── JSON-LD Recipe extraction ────────────────────────────────────────────────
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
          for (const g of item['@graph']) if (g['@type'] === 'Recipe') results.push(g);
        }
      }
    } catch {}
  }
  return results;
}

function parseDuration(d) {
  if (!d) return 0;
  const h = d.match(/(\d+)H/i); const mn = d.match(/(\d+)M/i);
  return (h ? parseInt(h[1]) * 60 : 0) + (mn ? parseInt(mn[1]) : 0);
}

function parseRecipe(schema, sourceUrl) {
  if (!schema) return null;
  const title = schema.name || '';
  if (!title || title.length < 3) return null;
  const rawIngr = schema.recipeIngredient || [];
  const ingredients = rawIngr.filter(Boolean).map(i => String(i).trim()).filter(i => i.length > 1);
  if (ingredients.length < 3) return null;
  let steps = [];
  const ri = schema.recipeInstructions || [];
  for (const step of ri) {
    if (typeof step === 'string') steps.push(step.trim());
    else if (step && step.text) steps.push(String(step.text).trim());
    else if (step && step['@type'] === 'HowToSection' && step.itemListElement) {
      for (const sub of step.itemListElement) {
        if (sub.text) steps.push(String(sub.text).trim());
      }
    }
  }
  steps = steps.filter(s => s && s.length > 5);
  if (steps.length < 2) return null;

  const prepTime = parseDuration(schema.prepTime) || 15;
  const cookTime = parseDuration(schema.cookTime) || 30;
  let servings = 4;
  const ry = schema.recipeYield;
  if (ry) { const n = parseInt(Array.isArray(ry) ? ry[0] : ry); if (!isNaN(n) && n > 0 && n <= 100) servings = n; }
  const difficulty = (prepTime + cookTime) <= 30 ? 'easy' : (prepTime + cookTime) <= 75 ? 'medium' : 'hard';

  let imageUrl = '';
  if (schema.image) {
    if (typeof schema.image === 'string') imageUrl = schema.image;
    else if (schema.image.url) imageUrl = schema.image.url;
    else if (Array.isArray(schema.image) && schema.image[0]) {
      imageUrl = typeof schema.image[0] === 'string' ? schema.image[0] : (schema.image[0].url || '');
    }
  }

  let summary = schema.description || '';
  if (summary.length > 300) summary = summary.slice(0, 297) + '...';

  return { title, summary, ingredients, steps, prepTime, cookTime, servings, difficulty, imageUrl, sourceUrl };
}

// ── Scrape recipes from a list of URLs ───────────────────────────────────────
async function scrapeUrls(urls, label, max = 20) {
  const recipes = [];
  const seenTitles = new Set();
  for (const url of urls) {
    if (recipes.length >= max) break;
    try {
      const { status, body } = await fetchUrl(url);
      if (status !== 200) continue;
      const schemas = extractJsonLd(body);
      for (const s of schemas) {
        const r = parseRecipe(s, url);
        if (r && !seenTitles.has(r.title.toLowerCase())) {
          seenTitles.add(r.title.toLowerCase());
          recipes.push(r);
          process.stdout.write(`  [${label}] ✓ ${r.title.slice(0, 50)}\n`);
          break;
        }
      }
    } catch {}
    await sleep(800);
  }
  return recipes;
}

// ── Ollama translate ─────────────────────────────────────────────────────────
function ollamaRequest(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: OLLAMA_MODEL, prompt, stream: false,
      keep_alive: '24h',
      options: { temperature: 0.2, num_predict: 1500 },
    });
    const timer = setTimeout(() => { req.destroy(); reject(new Error('Ollama timeout')); }, OLLAMA_HARD_TIMEOUT);
    const req = http.request({
      hostname: '127.0.0.1', port: 11434, path: '/api/generate', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        clearTimeout(timer);
        try {
          const p = JSON.parse(data);
          if (p.error) return reject(new Error(p.error));
          resolve(p.response || '');
        } catch (e) { reject(new Error('Bad Ollama JSON')); }
      });
      res.on('error', e => { clearTimeout(timer); reject(e); });
    });
    req.on('error', e => { clearTimeout(timer); reject(e); });
    req.write(body);
    req.end();
  });
}

async function translateRecipe(recipe) {
  const prompt = `Ești un traducător culinar expert. Traduce această rețetă din engleză în română.

REGULI STRICTE:
1. Ingrediente — FIECARE ingredient pe un rând separat ca string simplu:
   Format: "cantitate unitate ingredient, detaliu opțional"
   Exemple: "450 g piept de pui, tăiat cuburi", "240 ml lapte", "15 ml ulei de măsline", "2 ouă"
   Convertește: cups→ml, tbsp→ml, tsp→ml, oz→g, lb→g, stick butter→113g
   NU returna obiecte, doar stringuri simple!

2. Pași — voce CALDĂ, descriptivă, ca un bucătar care explică unui prieten:
   Include texturi, culori, timpi, indicii senzoriale
   DA: "Adaugă ceapa și las-o să se înmoaie la foc mediu, amestecând ușor, până devine translucidă — vreo 5-6 minute."

3. Română corectă cu diacritice: ă â î ș ț

4. Returnează STRICT JSON valid cu arrays de stringuri:

Rețetă:
Title: ${recipe.title}
Summary: ${recipe.summary || recipe.title}
Ingredients:
${recipe.ingredients.map((x, i) => `${i + 1}. ${x}`).join('\n')}
Steps:
${recipe.steps.map((x, i) => `${i + 1}. ${x}`).join('\n')}

{"title":"titlu în română","summary":"rezumat scurt","ingredients":["cantitate unitate ingredient","..."],"steps":["pas detaliat","..."]}`;

  const text = await ollamaRequest(prompt);
  const clean = text.replace(/```(?:json)?\n?/g, '').trim();
  const i = clean.indexOf('{');
  const j = clean.lastIndexOf('}');
  if (i === -1 || j === -1) throw new Error('No JSON');
  const parsed = JSON.parse(clean.slice(i, j + 1));

  // Validate: ingredients must be array of strings
  if (!Array.isArray(parsed.ingredients) || parsed.ingredients.length < 2) throw new Error('No ingredients');
  parsed.ingredients = parsed.ingredients.map(item => {
    if (typeof item === 'string') return item;
    if (typeof item === 'object') {
      const q = item.cantitate || item.qty || '';
      const u = item.unitate || item.unit || '';
      const n = item.ingredient || item.name || '';
      return `${q} ${u} ${n}`.trim();
    }
    return String(item);
  }).filter(s => s.length > 1);

  if (!Array.isArray(parsed.steps) || parsed.steps.length < 1) throw new Error('No steps');
  parsed.steps = parsed.steps.map(s => typeof s === 'string' ? s : (s.text || s.step || String(s))).filter(s => s.length > 5);

  // Reject if still English
  const sample = parsed.ingredients.slice(0, 3).join(' ').toLowerCase();
  if (sample.includes('tablespoon') || sample.includes('teaspoon') || sample.includes(' cups ')) throw new Error('Still English');

  return parsed;
}

// ── Slug ─────────────────────────────────────────────────────────────────────
function cleanSlug(title) {
  return title.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

// ── Progress ─────────────────────────────────────────────────────────────────
function loadProgress() { try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')); } catch { return { done: {} }; } }
function saveProgress(p) { fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2)); }

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const onlyCountry = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
  const minThreshold = args.includes('--min') ? parseInt(args[args.indexOf('--min') + 1]) : 15;

  console.log('══════════════════════════════════════════════════════════════');
  console.log('  seed-google-v3 — Google Search → JSON-LD → Ollama → Supabase');
  console.log('  Target: ' + TARGET_PER_COUNTRY + ' per country, Model: ' + OLLAMA_MODEL);
  console.log('══════════════════════════════════════════════════════════════');

  // Get all chef profiles and their recipe counts
  const { data: profiles } = await supabase.from('profiles').select('id, display_name').like('display_name', 'Chef %');
  const { data: recipeCounts } = await supabase.from('posts').select('created_by').eq('type', 'recipe');

  const countMap = {};
  for (const r of (recipeCounts || [])) {
    countMap[r.created_by] = (countMap[r.created_by] || 0) + 1;
  }

  // Load existing slugs
  const { data: existingPosts } = await supabase.from('posts').select('slug').eq('type', 'recipe');
  const existingSlugs = new Set((existingPosts || []).map(p => p.slug));
  console.log(`  Existing recipes: ${existingSlugs.size}, Profiles: ${(profiles || []).length}`);

  const progress = loadProgress();
  let totalInserted = 0;

  // Build country list: profiles that need recipes
  const countries = (profiles || [])
    .map(p => ({
      name: p.display_name.replace('Chef ', ''),
      profileId: p.id,
      current: countMap[p.id] || 0,
    }))
    .filter(c => {
      if (c.name === 'Anna' || c.name === 'Dan') return false; // skip demo/admin profiles
      if (c.name.includes(' US') || c.name === 'Tex-Mex') return false; // skip US regions
      if (onlyCountry) return c.name.toLowerCase() === onlyCountry.toLowerCase();
      if (c.current >= minThreshold) return false;
      if (progress.done[c.name] && progress.done[c.name] >= minThreshold) return false;
      return true;
    })
    .sort((a, b) => a.current - b.current); // Prioritize countries with fewest recipes

  console.log(`  Countries to process: ${countries.length}\n`);

  for (const country of countries) {
    const need = TARGET_PER_COUNTRY - country.current;
    if (need <= 0) continue;

    console.log(`\n🌍  [${country.name}] (has ${country.current}, need ${need} more)`);

    // Search for authentic recipes via DuckDuckGo
    console.log(`  🔍 Searching for ${country.name} recipes...`);
    const allUrls = await searchForRecipes(country.name, 40);
    console.log(`  📎 ${allUrls.length} unique URLs to scrape`);

    if (allUrls.length === 0) {
      console.log(`  ❌ No URLs found for ${country.name}`);
      progress.done[country.name] = country.current;
      saveProgress(progress);
      continue;
    }

    // Scrape recipes from found URLs
    const recipes = await scrapeUrls(allUrls, country.name, need + 5);
    console.log(`  📖 ${recipes.length} recipes extracted`);

    let inserted = 0;
    for (const raw of recipes) {
      if (inserted >= need) break;
      const slug = cleanSlug(raw.title);
      if (existingSlugs.has(slug)) { continue; }

      // Translate
      process.stdout.write(`  Traducere "${raw.title.slice(0, 50)}"... `);
      let translated;
      try {
        translated = await translateRecipe(raw);
        process.stdout.write('✓\n');
      } catch (e) {
        process.stdout.write(`⚠️ skip (${e.message})\n`);
        continue;
      }

      // Insert
      const { error } = await supabase.from('posts').insert({
        id: randomUUID(),
        created_by: country.profileId,
        approach_id: APPROACH_IDS[inserted % APPROACH_IDS.length],
        title: translated.title || raw.title,
        slug,
        content: translated.summary || raw.summary || translated.title,
        summary: translated.summary || raw.summary,
        status: 'active',
        type: 'recipe',
        hero_image_url: raw.imageUrl || '',
        source_url: raw.sourceUrl || '',
        recipe_json: {
          ingredients: translated.ingredients,
          instructions: translated.steps,
          steps: translated.steps,
          prep_time_minutes: raw.prepTime || 15,
          cook_time_minutes: raw.cookTime || 30,
          servings: raw.servings || 4,
          difficulty_level: raw.difficulty || 'medium',
        },
      });

      if (error) {
        console.log(`  ✗ ${error.code} — ${error.message.slice(0, 60)}`);
      } else {
        existingSlugs.add(slug);
        inserted++;
      }
    }

    totalInserted += inserted;
    progress.done[country.name] = country.current + inserted;
    saveProgress(progress);
    console.log(`  ✅ ${inserted} new recipes for ${country.name} (total: ${country.current + inserted})`);
    await sleep(5000); // Respect Google between countries
  }

  console.log('\n══════════════════════════════════════');
  console.log(`DONE — ${totalInserted} new recipes inserted`);
  console.log('══════════════════════════════════════');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
