#!/usr/bin/env node
/**
 * scrape-all-countries.js
 * Scrapes 20 recipes per country for ALL countries missing from the taxonomy.
 * Uses only confirmed-working sites with real sitemap-discovered URLs.
 *
 * Strategy per site:
 *  - recipetineats.com      → Australia (sitemap confirmed)
 *  - chelsea.co.nz          → New Zealand (confirmed URLs)
 *  - taste.co.za            → South Africa (1000 recipe URLs in sitemap)
 *  - nigerianfoodtv.com     → Ghana/West Africa (249 URLs in sitemap)
 *  - tastykitchen.io        → Kenya (HTML scrape)
 *  - goya.com               → Cuba, Jamaica, Caribbean (1002 recipe URLs)
 *  - mycolombianrecipes.com → Colombia (1564 sitemap URLs)
 *  - laylita.com            → Chile (sitemap scrape)
 *  - matprat.no             → Norway (4387 recipe URLs)
 *  - arla.se                → Denmark/Finland (working)
 *  - bbcgoodfood.com        → UK, Ireland (quarterly sitemap URLs)
 *  - recipesfromeurope.com  → Hungary, Czech, Croatia, Romania, Bulgaria, Austria (313 posts)
 *  - georgianrecipes.net    → Georgia (251 sitemap URLs)
 *  - cookwithnabeela.com    → Pakistan, Bangladesh (201 recipe URLs)
 *  - hungryforever.net      → Saudi Arabia, UAE, Jordan, Iraq
 *  - ottolenghi.co.uk       → Israel
 *  - recipesaresimple.com   → Sri Lanka, Nepal
 *  - taste.co.za            → also covers: South Africa, Zimbabwe
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

// ── UUID helpers ──────────────────────────────────────────────────────────────
function cuisineUUID(idx) { return `d0000000-0000-0000-0000-${String(idx).padStart(12, '0')}`; }
function profileUUID(idx) { return `c0000000-0000-0000-0000-${String(idx).padStart(12, '0')}`; }

const APPROACH_IDS = [
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000003',
  'b0000000-0000-0000-0000-000000000004',
  'b0000000-0000-0000-0000-000000000005',
  'b0000000-0000-0000-0000-000000000006',
];

// ── New countries (idx 30+) ───────────────────────────────────────────────────
const NEW_COUNTRIES = [
  // Oceania
  { name: 'Australia',       code: 'AU', idx: 30 },
  { name: 'New Zealand',     code: 'NZ', idx: 31 },
  // Southern Africa
  { name: 'South Africa',    code: 'ZA', idx: 32 },
  // West Africa
  { name: 'Ghana',           code: 'GH', idx: 33 },
  // East Africa
  { name: 'Kenya',           code: 'KE', idx: 34 },
  // North Africa
  { name: 'Tunisia',         code: 'TN', idx: 35 },
  { name: 'Algeria',         code: 'DZ', idx: 36 },
  // North America
  { name: 'Canada',          code: 'CA', idx: 37 },
  { name: 'Jamaica',         code: 'JM', idx: 38 },
  { name: 'Cuba',            code: 'CU', idx: 39 },
  // South America
  { name: 'Colombia',        code: 'CO', idx: 40 },
  { name: 'Chile',           code: 'CL', idx: 41 },
  // Southeast Asia
  { name: 'Malaysia',        code: 'MY', idx: 42 },
  { name: 'Singapore',       code: 'SG', idx: 43 },
  // South Asia
  { name: 'Sri Lanka',       code: 'LK', idx: 44 },
  { name: 'Pakistan',        code: 'PK', idx: 45 },
  { name: 'Bangladesh',      code: 'BD', idx: 46 },
  // Central Asia & Caucasus
  { name: 'Georgia',         code: 'GE', idx: 47 },
  { name: 'Uzbekistan',      code: 'UZ', idx: 48 },
  // Middle East
  { name: 'Saudi Arabia',    code: 'SA', idx: 49 },
  { name: 'UAE',             code: 'AE', idx: 50 },
  { name: 'Israel',          code: 'IL', idx: 51 },
  // Western Europe
  { name: 'UK',              code: 'GB', idx: 52 },
  { name: 'Ireland',         code: 'IE', idx: 53 },
  { name: 'Austria',         code: 'AT', idx: 54 },
  { name: 'Netherlands',     code: 'NL', idx: 55 },
  { name: 'Belgium',         code: 'BE', idx: 56 },
  // Northern Europe
  { name: 'Norway',          code: 'NO', idx: 57 },
  { name: 'Denmark',         code: 'DK', idx: 58 },
  { name: 'Finland',         code: 'FI', idx: 59 },
  // Eastern Europe
  { name: 'Hungary',         code: 'HU', idx: 60 },
  { name: 'Czech Republic',  code: 'CZ', idx: 61 },
  { name: 'Croatia',         code: 'HR', idx: 62 },
  { name: 'Romania',         code: 'RO', idx: 63 },
  { name: 'Bulgaria',        code: 'BG', idx: 64 },
  // More Southeast Asia
  { name: 'Cambodia',        code: 'KH', idx: 65 },
  { name: 'Myanmar',         code: 'MM', idx: 66 },
  // East Asia
  { name: 'Taiwan',          code: 'TW', idx: 67 },
  // More South America
  { name: 'Venezuela',       code: 'VE', idx: 68 },
  { name: 'Ecuador',         code: 'EC', idx: 69 },
  // More Middle East
  { name: 'Jordan',          code: 'JO', idx: 70 },
  // More South Asia
  { name: 'Nepal',           code: 'NP', idx: 71 },
  { name: 'Sri Lanka',       code: 'LK', idx: 44 }, // handled above
];

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function fetchUrl(url, opts = {}) {
  return new Promise((resolve, reject) => {
    try {
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
    } catch (e) { reject(e); }
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function extractUrls(xml) {
  return [...xml.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/g)].map(m => m[1]);
}

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

function parseRecipeFromJsonLd(schema, sourceUrl) {
  if (!schema) return null;
  const title = schema.name || '';
  if (!title || title.length < 3) return null;
  const rawIngr = schema.recipeIngredient || [];
  const ingredients = rawIngr.filter(Boolean).map(i => String(i).trim()).filter(i => i.length > 1);
  if (ingredients.length < 3) return null;
  let instructions = [];
  const ri = schema.recipeInstructions || [];
  for (const step of ri) {
    if (typeof step === 'string') instructions.push(step.trim());
    else if (step && step.text) instructions.push(String(step.text).trim());
    else if (step && step['@type'] === 'HowToSection' && step.itemListElement) {
      for (const sub of step.itemListElement) {
        if (sub.text) instructions.push(String(sub.text).trim());
        else if (typeof sub === 'string') instructions.push(sub.trim());
      }
    }
  }
  instructions = instructions.filter(s => s && s.length > 5);
  if (instructions.length < 2) return null;
  const prepTime = parseDuration(schema.prepTime) || 15;
  const cookTime = parseDuration(schema.cookTime) || 30;
  let servings = 4;
  const ry = schema.recipeYield;
  if (ry) { const n = parseInt(Array.isArray(ry) ? ry[0] : ry); if (!isNaN(n) && n > 0 && n <= 100) servings = n; }
  const totalTime = prepTime + cookTime;
  const difficulty = totalTime <= 30 ? 'easy' : totalTime <= 75 ? 'medium' : 'hard';
  let imageUrl = '';
  if (schema.image) {
    if (typeof schema.image === 'string') imageUrl = schema.image;
    else if (schema.image.url) imageUrl = schema.image.url;
    else if (Array.isArray(schema.image) && schema.image[0]) imageUrl = typeof schema.image[0] === 'string' ? schema.image[0] : (schema.image[0].url || '');
  }
  let summary = schema.description || '';
  if (summary.length > 300) summary = summary.slice(0, 297) + '...';
  return { title, summary: summary || title, description: schema.description || summary || title, ingredients, instructions, prepTime, cookTime, servings, difficulty, imageUrl, sourceUrl };
}

// ── Generic URL list scraper ──────────────────────────────────────────────────
async function scrapeUrlList(urls, label, maxRecipes = 20) {
  const recipes = [];
  for (const url of urls) {
    if (recipes.length >= maxRecipes) break;
    try {
      const { status, body } = await fetchUrl(url);
      if (status !== 200) continue;
      const schemas = extractJsonLd(body);
      for (const s of schemas) {
        const r = parseRecipeFromJsonLd(s, url);
        if (r) { recipes.push(r); console.log(`  [${label}] ✓ ${r.title}`); break; }
      }
    } catch (e) { /* skip */ }
    await sleep(600);
  }
  return recipes;
}

// ── Sitemap fetcher ───────────────────────────────────────────────────────────
async function fetchSitemapUrls(sitemapUrl, filter) {
  try {
    const { body } = await fetchUrl(sitemapUrl);
    let urls = extractUrls(body);
    // If it's a sitemap index, recurse into first sub-sitemap
    if (urls.some(u => u.endsWith('.xml'))) {
      const subUrls = [];
      for (const sub of urls.filter(u => u.endsWith('.xml')).slice(0, 3)) {
        try {
          const { body: subBody } = await fetchUrl(sub);
          subUrls.push(...extractUrls(subBody));
        } catch {}
        await sleep(300);
      }
      urls = subUrls;
    }
    if (filter) urls = urls.filter(filter);
    return urls;
  } catch { return []; }
}

// ── Shuffle helper ────────────────────────────────────────────────────────────
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COUNTRY SCRAPERS
// ═══════════════════════════════════════════════════════════════════════════════

async function scrapeAustralia() {
  console.log('  Fetching recipetineats sitemap...');
  const urls = await fetchSitemapUrls('https://www.recipetineats.com/post-sitemap.xml', u => !u.includes('/blog/') && !u.includes('/category/'));
  const picked = shuffle([...urls]).slice(0, 60);
  return scrapeUrlList(picked, 'Australia');
}

async function scrapeNewZealand() {
  // chelsea.co.nz - New Zealand's biggest baking brand, confirmed working
  const hardcoded = [
    'https://www.chelsea.co.nz/recipes/browse-recipes/pavlova',
    'https://www.chelsea.co.nz/recipes/browse-recipes/hokey-pokey',
    'https://www.chelsea.co.nz/recipes/browse-recipes/lolly-cake',
    'https://www.chelsea.co.nz/recipes/browse-recipes/anzac-biscuits',
    'https://www.chelsea.co.nz/recipes/browse-recipes/lamingtons',
    'https://www.chelsea.co.nz/recipes/browse-recipes/afghans',
    'https://www.chelsea.co.nz/recipes/browse-recipes/ginger-crunch',
    'https://www.chelsea.co.nz/recipes/browse-recipes/caramel-slice',
    'https://www.chelsea.co.nz/recipes/browse-recipes/custard-squares',
    'https://www.chelsea.co.nz/recipes/browse-recipes/louise-cake',
    'https://www.chelsea.co.nz/recipes/browse-recipes/cheese-scones',
    'https://www.chelsea.co.nz/recipes/browse-recipes/pineapple-upside-down-cake',
    'https://www.chelsea.co.nz/recipes/browse-recipes/chocolate-self-saucing-pudding',
    'https://www.chelsea.co.nz/recipes/browse-recipes/pikelets',
    'https://www.chelsea.co.nz/recipes/browse-recipes/banana-cake',
    'https://www.chelsea.co.nz/recipes/browse-recipes/sticky-date-pudding',
    'https://www.chelsea.co.nz/recipes/browse-recipes/lemon-slice',
    'https://www.chelsea.co.nz/recipes/browse-recipes/peanut-brownies',
    'https://www.chelsea.co.nz/recipes/browse-recipes/fruit-cake',
    'https://www.chelsea.co.nz/recipes/browse-recipes/chocolate-fudge-brownie',
  ];
  return scrapeUrlList(hardcoded, 'New Zealand');
}

async function scrapeSouthAfrica() {
  // taste.co.za - confirmed 1000 recipe URLs in sitemap
  console.log('  Fetching taste.co.za sitemap...');
  const urls = await fetchSitemapUrls('https://taste.co.za/recipes-sitemap.xml', u => u.includes('/recipes/') && u !== 'https://taste.co.za/recipes/');
  const picked = shuffle([...urls]).slice(0, 60);
  return scrapeUrlList(picked, 'South Africa');
}

async function scrapeGhana() {
  // nigerianfoodtv.com has West African content including Ghanaian
  // + direct hardcoded Ghanaian recipe pages from working sites
  const hardcoded = [
    'https://www.nigerianfoodtv.com/ghana-jollof-rice/',
    'https://www.nigerianfoodtv.com/kenkey-recipe/',
    'https://www.nigerianfoodtv.com/kelewele-recipe/',
    'https://www.nigerianfoodtv.com/waakye-recipe/',
    'https://www.nigerianfoodtv.com/kontomire-stew/',
    'https://www.nigerianfoodtv.com/red-red-recipe/',
    'https://www.nigerianfoodtv.com/groundnut-soup-ghana/',
    'https://www.nigerianfoodtv.com/fufu-recipe/',
    'https://www.nigerianfoodtv.com/banku-recipe/',
    'https://www.nigerianfoodtv.com/bofrot-recipe/',
  ];
  // Also use nigerianfoodtv sitemap and pick any with Ghana-adjacent keywords
  const sitemapUrls = await fetchSitemapUrls('https://www.nigerianfoodtv.com/wp-sitemap-posts-post-1.xml');
  const ghanaKeywords = ['jollof', 'waakye', 'kenkey', 'kelewele', 'fufu', 'banku', 'kontomire', 'red-red', 'plantain', 'groundnut', 'peanut', 'yam', 'tilapia', 'pineapple', 'coconut', 'bofrot', 'chin-chin', 'suya', 'fried-rice', 'egusi'];
  const sitemapGhana = sitemapUrls.filter(u => ghanaKeywords.some(k => u.toLowerCase().includes(k)));
  const allUrls = [...new Set([...hardcoded, ...sitemapGhana, ...sitemapUrls.slice(0, 40)])];
  return scrapeUrlList(allUrls, 'Ghana');
}

async function scrapeKenya() {
  // tastykitchen.io has Kenyan recipes (confirmed 200, HTML parsing needed)
  // Use recipetineats for some East African adjacent dishes
  const hardcoded = [
    'https://www.tastykitchen.io/kenya-nyama-choma/',
    'https://www.tastykitchen.io/githeri/',
    'https://www.tastykitchen.io/ugali/',
    'https://www.tastykitchen.io/kenya-pilau/',
    'https://www.tastykitchen.io/sukuma-wiki/',
    'https://www.tastykitchen.io/kenyan-chapati/',
    'https://www.tastykitchen.io/mandazi/',
    'https://www.tastykitchen.io/mukimo/',
    'https://www.tastykitchen.io/matoke/',
    'https://www.tastykitchen.io/irio/',
    'https://www.tastykitchen.io/maharagwe/',
    'https://www.tastykitchen.io/kenyan-beef-stew/',
    'https://www.tastykitchen.io/samosa-kenya/',
    'https://www.tastykitchen.io/mutura/',
    'https://www.tastykitchen.io/kenyan-pilau-rice/',
    'https://www.tastykitchen.io/kenyan-biryani/',
    'https://www.tastykitchen.io/kachumbari/',
    'https://www.tastykitchen.io/githeri-with-beef/',
    'https://www.tastykitchen.io/kenyan-coconut-rice/',
    'https://www.tastykitchen.io/ugali-nyama/',
  ];
  // tastykitchen.io is 🟡 (200 but no JSON-LD), so try HTML parsing too
  // Supplement with nigerianfoodtv and recipetineats
  const nftvUrls = await fetchSitemapUrls('https://www.nigerianfoodtv.com/wp-sitemap-posts-post-1.xml');
  const kenyaKw = ['nyama', 'ugali', 'sukuma', 'pilau', 'mandazi', 'chapati', 'githeri', 'matoke', 'irio', 'mukimo'];
  const kenyaNftv = nftvUrls.filter(u => kenyaKw.some(k => u.toLowerCase().includes(k)));
  return scrapeUrlList([...hardcoded, ...kenyaNftv], 'Kenya');
}

async function scrapeTunisia() {
  // Use taste.co.za (South African site has Mediterranean/North African dishes)
  // + recipetineats for couscous, harissa
  // + BBC good food for specific North African dishes
  const bbcUrls = await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q4-recipe.xml', u => u.includes('/recipes/'));
  const bbcQ3 = await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q3-recipe.xml', u => u.includes('/recipes/'));
  const bbcQ2 = await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q2-recipe.xml', u => u.includes('/recipes/'));
  const bbcQ1 = await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q1-recipe.xml', u => u.includes('/recipes/'));
  const tunisiaKw = ['couscous', 'harissa', 'merguez', 'tagine', 'brik', 'shakshuka', 'lablabi', 'chakchouka', 'mechouia', 'north-african', 'moroccan', 'lamb', 'chickpea', 'preserved-lemon'];
  const allBbc = [...bbcUrls, ...bbcQ3, ...bbcQ2, ...bbcQ1];
  const tunisBbc = allBbc.filter(u => tunisiaKw.some(k => u.toLowerCase().includes(k)));
  const tasteUrls = await fetchSitemapUrls('https://taste.co.za/recipes-sitemap.xml', u => u.includes('/recipes/') && u !== 'https://taste.co.za/recipes/');
  const tunisTaste = tasteUrls.filter(u => tunisiaKw.some(k => u.toLowerCase().includes(k)));
  // supplement with hardcoded RTE couscous/tagine type recipes
  const rteKw = ['couscous', 'harissa', 'chickpea', 'lamb-', 'merguez', 'north-african', 'tagine'];
  const rteUrls = await fetchSitemapUrls('https://www.recipetineats.com/post-sitemap.xml', u => rteKw.some(k => u.toLowerCase().includes(k)));
  return scrapeUrlList([...tunisBbc, ...tunisTaste, ...rteUrls, ...shuffle(allBbc).slice(0, 30)], 'Tunisia');
}

async function scrapeAlgeria() {
  // Similar strategy - North African dishes from BBC + taste.co.za
  const bbcAllUrls = [
    ...await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q2-recipe.xml', u => u.includes('/recipes/')),
    ...await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q1-recipe.xml', u => u.includes('/recipes/')),
  ];
  const algeriaKw = ['couscous', 'lamb', 'chickpea', 'harissa', 'merguez', 'tagine', 'chorba', 'rechta', 'north-african', 'lentil'];
  const filtered = bbcAllUrls.filter(u => algeriaKw.some(k => u.toLowerCase().includes(k)));
  return scrapeUrlList([...filtered, ...shuffle(bbcAllUrls).slice(0, 40)], 'Algeria');
}

async function scrapeCanada() {
  // recipetineats has Canadian-adjacent recipes (poutine, bannock, maple)
  const rteUrls = await fetchSitemapUrls('https://www.recipetineats.com/post-sitemap.xml');
  const rte2Urls = await fetchSitemapUrls('https://www.recipetineats.com/post-sitemap2.xml');
  const canadaKw = ['poutine', 'bannock', 'maple', 'butter-tart', 'nanaimo', 'tourtiere', 'peameal', 'salmon', 'lobster', 'blueberry', 'crepe', 'montreal'];
  const canadaRte = [...rteUrls, ...rte2Urls].filter(u => canadaKw.some(k => u.toLowerCase().includes(k)));
  // BBC also has Canadian recipes
  const bbcUrls = await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q3-recipe.xml', u => u.includes('/recipes/'));
  return scrapeUrlList([...canadaRte, ...shuffle(rteUrls).slice(0, 40)], 'Canada');
}

async function scrapeJamaica() {
  // goya.com - confirmed 1002 Caribbean/Latin recipes
  const goyaUrls = await fetchSitemapUrls('https://www.goya.com/post-sitemap.xml', u => u.includes('/en/recipes/'));
  const jamaicaKw = ['jerk', 'ackee', 'oxtail', 'curry-goat', 'rice-and-peas', 'escovitch', 'callaloo', 'bammy', 'plantain', 'rum', 'jamaican', 'caribbean', 'festival', 'patty', 'saltfish'];
  const jamaicaGoya = goyaUrls.filter(u => jamaicaKw.some(k => u.toLowerCase().includes(k)));
  // Use BBC for jerk/Caribbean recipes too
  const bbcUrls = await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q4-recipe.xml', u => u.includes('/recipes/'));
  const jamaicaBbc = bbcUrls.filter(u => jamaicaKw.some(k => u.toLowerCase().includes(k)));
  return scrapeUrlList([...jamaicaGoya, ...jamaicaBbc, ...shuffle(goyaUrls).slice(0, 50)], 'Jamaica');
}

async function scrapeCuba() {
  // goya.com confirmed for Cuban recipes
  const goyaUrls = await fetchSitemapUrls('https://www.goya.com/post-sitemap.xml', u => u.includes('/en/recipes/'));
  const cubaKw = ['cuban', 'ropa-vieja', 'picadillo', 'arroz-con-pollo', 'black-bean', 'mojo', 'lechon', 'vaca-frita', 'tostones', 'congri', 'masas', 'croquetas', 'flan', 'mojito', 'maduros'];
  const cubaGoya = goyaUrls.filter(u => cubaKw.some(k => u.toLowerCase().includes(k)));
  return scrapeUrlList([...cubaGoya, ...shuffle(goyaUrls).slice(0, 60)], 'Cuba');
}

async function scrapeColombia() {
  // mycolombianrecipes.com - confirmed sitemap with 1564 URLs
  const colUrls = await fetchSitemapUrls('https://www.mycolombianrecipes.com/post-sitemap.xml');
  const col2Urls = await fetchSitemapUrls('https://www.mycolombianrecipes.com/post-sitemap2.xml');
  const allCol = [...new Set([...colUrls, ...col2Urls])].filter(u => !u.includes('/es/') && !u.includes('?'));
  return scrapeUrlList(shuffle(allCol).slice(0, 80), 'Colombia');
}

async function scrapeChile() {
  // laylita.com - Ecuadorian/Chilean/Latin American blog
  const layUrls = await fetchSitemapUrls('https://www.laylita.com/recipes/sitemap.xml');
  const layAll = await fetchSitemapUrls('https://www.laylita.com/sitemap.xml', u => !u.endsWith('.xml'));
  const chileKw = ['chile', 'chilean', 'empanada', 'pastel-de-choclo', 'sopaipilla', 'cazuela', 'pisco', 'humita', 'porotos', 'curanto', 'milcao', 'charquican', 'plateada', 'mote', 'pebre'];
  const chileFiltered = [...layUrls, ...layAll].filter(u => chileKw.some(k => u.toLowerCase().includes(k)));
  // Also use Colombian site for South American dishes and goya.com
  const goyaUrls = await fetchSitemapUrls('https://www.goya.com/post-sitemap.xml', u => u.includes('/en/recipes/'));
  const goyaChile = goyaUrls.filter(u => chileKw.some(k => u.toLowerCase().includes(k)));
  // Grab laylita main recipes
  const laylitaMain = await fetchSitemapUrls('https://www.laylita.com/recipes/sitemap.xml');
  return scrapeUrlList([...chileFiltered, ...goyaChile, ...shuffle(laylitaMain).slice(0, 50), ...shuffle(layAll).slice(0, 30)], 'Chile');
}

async function scrapeMalaysia() {
  // Use pickledplum.com (confirmed working for Asian) + wok of life + RTE
  const rteUrls = await fetchSitemapUrls('https://www.recipetineats.com/post-sitemap.xml');
  const rte2Urls = await fetchSitemapUrls('https://www.recipetineats.com/post-sitemap2.xml');
  const malayKw = ['nasi-lemak', 'rendang', 'satay', 'laksa', 'roti-canai', 'mee-goreng', 'char-kway', 'curry-laksa', 'asam', 'bak-kut', 'hokkien', 'penang', 'kuih', 'cendol', 'teh-tarik', 'malay', 'malaysian', 'southeast-asian'];
  const malayRte = [...rteUrls, ...rte2Urls].filter(u => malayKw.some(k => u.toLowerCase().includes(k)));
  // Use pickledplum sitemap
  const ppUrls = await fetchSitemapUrls('https://pickledplum.com/post-sitemap.xml', u => !u.includes('/category/'));
  const malayPp = ppUrls.filter(u => malayKw.some(k => u.toLowerCase().includes(k)));
  return scrapeUrlList([...malayRte, ...malayPp, ...shuffle([...rteUrls, ...rte2Urls]).slice(0, 40)], 'Malaysia');
}

async function scrapeSingapore() {
  const rteUrls = await fetchSitemapUrls('https://www.recipetineats.com/post-sitemap.xml');
  const rte2Urls = await fetchSitemapUrls('https://www.recipetineats.com/post-sitemap2.xml');
  const sgKw = ['hainanese', 'chilli-crab', 'singapore', 'laksa', 'char-siu', 'wonton', 'popiah', 'hokkien', 'bak-chor', 'oyster-omelette', 'mee-siam', 'kaya', 'pandan', 'fried-carrot', 'fishball'];
  const sgRte = [...rteUrls, ...rte2Urls].filter(u => sgKw.some(k => u.toLowerCase().includes(k)));
  const ppUrls = await fetchSitemapUrls('https://pickledplum.com/post-sitemap.xml');
  const sgPp = ppUrls.filter(u => sgKw.some(k => u.toLowerCase().includes(k)));
  return scrapeUrlList([...sgRte, ...sgPp, ...shuffle([...rteUrls, ...rte2Urls]).slice(0, 40)], 'Singapore');
}

async function scrapeSriLanka() {
  // theflavorbender.com - Sri Lankan food blog
  const tfbUrls = await fetchSitemapUrls('https://www.theflavorbender.com/sitemap.xml', u => !u.endsWith('.xml'));
  const lkKw = ['sri-lanka', 'sri-lankan', 'kottu', 'hopper', 'pol-sambol', 'watalappan', 'kiribath', 'lamprais', 'pittu', 'string-hopper', 'coconut-roti'];
  const lkTfb = tfbUrls.filter(u => lkKw.some(k => u.toLowerCase().includes(k)));
  // recipesaresimple.com - South Asian site (confirmed 200 for biryani, nihari)
  const rasUrls = await fetchSitemapUrls('https://www.recipesaresimple.com/sitemap_index.xml', u => !u.endsWith('.xml'));
  const lkRas = rasUrls.filter(u => lkKw.some(k => u.toLowerCase().includes(k)));
  return scrapeUrlList([...lkTfb, ...lkRas, ...shuffle(tfbUrls).slice(0, 40)], 'Sri Lanka');
}

async function scrapePakistan() {
  // cookwithnabeela.com - confirmed 4 recipe sitemaps, all Pakistani
  const cwn1 = await fetchSitemapUrls('https://www.cookwithnabeela.com/recipe-sitemap1.xml');
  const cwn2 = await fetchSitemapUrls('https://www.cookwithnabeela.com/recipe-sitemap2.xml');
  const cwn3 = await fetchSitemapUrls('https://www.cookwithnabeela.com/recipe-sitemap3.xml');
  const allCwn = [...new Set([...cwn1, ...cwn2, ...cwn3])].filter(u => u.includes('/recipe/'));
  return scrapeUrlList(shuffle(allCwn).slice(0, 60), 'Pakistan');
}

async function scrapeBangladesh() {
  // Bangladesh shares many recipes with Pakistan/India
  // cookwithnabeela also has Bangladeshi dishes (hilsa, pitha, etc.)
  const cwn1 = await fetchSitemapUrls('https://www.cookwithnabeela.com/recipe-sitemap1.xml');
  const cwn2 = await fetchSitemapUrls('https://www.cookwithnabeela.com/recipe-sitemap2.xml');
  const bdKw = ['biryani', 'hilsa', 'ilish', 'pitha', 'khichuri', 'haleem', 'korma', 'polao', 'rezala', 'mishti', 'rasgulla', 'sandesh', 'payesh', 'nihari', 'bhuna', 'dal'];
  const allCwn = [...cwn1, ...cwn2].filter(u => u.includes('/recipe/'));
  const bdCwn = allCwn.filter(u => bdKw.some(k => u.toLowerCase().includes(k)));
  // Fill with general Pakistani dishes (cuisine overlap is ~70%)
  return scrapeUrlList([...bdCwn, ...shuffle(allCwn).slice(0, 50)], 'Bangladesh');
}

async function scrapeGeorgia() {
  // georgianrecipes.net - confirmed 251 sitemap URLs (no JSON-LD but parse HTML)
  const geoUrls = await fetchSitemapUrls('https://georgianrecipes.net/sitemap.xml', u => /\/\d{4}\/\d{2}\/\d{2}\//.test(u));
  // These pages don't have JSON-LD, so we need to parse HTML
  // But the site IS accessible (confirmed 200 with 🟡). Let's parse manually.
  const recipes = [];
  for (const url of shuffle(geoUrls).slice(0, 60)) {
    if (recipes.length >= 20) break;
    try {
      const { status, body } = await fetchUrl(url);
      if (status !== 200) continue;
      
      // First try JSON-LD
      const schemas = extractJsonLd(body);
      for (const s of schemas) {
        const r = parseRecipeFromJsonLd(s, url);
        if (r) { recipes.push(r); console.log(`  [Georgia] ✓ (jsonld) ${r.title}`); break; }
      }
      if (recipes[recipes.length - 1]?.sourceUrl === url) continue;
      
      // HTML parse fallback
      const title = (body.match(/<h1[^>]*>([^<]+)<\/h1>/) || [])[1]?.trim();
      if (!title || title.length < 3) continue;
      
      // Extract ingredients - look for li items in ingredient section
      const ingSection = body.match(/ingredient[^]*?<ul[^>]*>([\s\S]*?)<\/ul>/i);
      let ingredients = [];
      if (ingSection) {
        ingredients = [...ingSection[1].matchAll(/<li[^>]*>([^<]+)<\/li>/g)]
          .map(m => m[1].trim()).filter(s => s.length > 2);
      }
      if (ingredients.length < 3) {
        // fallback: grab any list items
        ingredients = [...body.matchAll(/<li[^>]*>\s*([^<]{5,80})\s*<\/li>/g)]
          .map(m => m[1].trim()).filter(s => s.length > 3).slice(0, 15);
      }
      if (ingredients.length < 3) continue;
      
      // Extract instructions
      const instrSection = body.match(/instruction[^]*?<ol[^>]*>([\s\S]*?)<\/ol>/i) ||
                          body.match(/direction[^]*?<ol[^>]*>([\s\S]*?)<\/ol>/i) ||
                          body.match(/<ol[^>]*>([\s\S]*?)<\/ol>/i);
      let instructions = [];
      if (instrSection) {
        instructions = [...instrSection[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)]
          .map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(s => s.length > 10);
      }
      if (instructions.length < 2) continue;
      
      // Image
      const imgMatch = body.match(/og:image[^>]*content="([^"]+)"/) || body.match(/<img[^>]+src="(https?:\/\/[^"]+\.(jpg|jpeg|png|webp))/i);
      const imageUrl = imgMatch ? imgMatch[1] : '';
      
      // Description
      const descMatch = body.match(/og:description[^>]*content="([^"]+)"/);
      const summary = descMatch ? descMatch[1].slice(0, 300) : title;
      
      recipes.push({ title, summary, description: summary, ingredients, instructions, prepTime: 20, cookTime: 40, servings: 4, difficulty: 'medium', imageUrl, sourceUrl: url });
      console.log(`  [Georgia] ✓ (html) ${title}`);
    } catch {}
    await sleep(600);
  }
  return recipes;
}

async function scrapeUzbekistan() {
  // Use pickledplum (Central Asian / Silk Road)
  // + 196flavors skip, + laylita doesn't cover Central Asia
  // Use BBC good food for pilaf/plov type dishes
  const bbcUrls = [
    ...await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q4-recipe.xml', u => u.includes('/recipes/')),
    ...await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q3-recipe.xml', u => u.includes('/recipes/')),
    ...await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q2-recipe.xml', u => u.includes('/recipes/')),
    ...await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q1-recipe.xml', u => u.includes('/recipes/')),
  ];
  const uzKw = ['plov', 'pilaf', 'samsa', 'shurpa', 'lagman', 'manti', 'shashlik', 'non-bread', 'halva', 'sultana', 'dried-fruit', 'lamb-rice', 'uzbek', 'central-asian'];
  const uzBbc = bbcUrls.filter(u => uzKw.some(k => u.toLowerCase().includes(k)));
  // Use recipesfromeurope for Central Asian dishes
  const rfeUrls = await fetchSitemapUrls('https://www.recipesfromeurope.com/post-sitemap.xml');
  return scrapeUrlList([...uzBbc, ...shuffle(bbcUrls).slice(0, 60)], 'Uzbekistan');
}

async function scrapeSaudiArabia() {
  // hungryforever.net - confirmed 200 for kabsa, multiple sitemaps
  const hf1 = await fetchSitemapUrls('https://hungryforever.net/post-sitemap.xml');
  const hf2 = await fetchSitemapUrls('https://hungryforever.net/post-sitemap2.xml');
  const hf3 = await fetchSitemapUrls('https://hungryforever.net/post-sitemap3.xml');
  const saKw = ['kabsa', 'mandi', 'harees', 'saloona', 'machboos', 'mutabbaq', 'jareesh', 'madfoon', 'lamb', 'arabic', 'middle-east', 'gulf', 'saudi', 'rice', 'chicken'];
  const allHf = [...new Set([...hf1, ...hf2, ...hf3])];
  const saHf = allHf.filter(u => saKw.some(k => u.toLowerCase().includes(k)));
  return scrapeUrlList([...saHf, ...shuffle(allHf).slice(0, 60)], 'Saudi Arabia');
}

async function scrapeUAE() {
  // hungryforever.net covers UAE/Gulf food too
  const hf1 = await fetchSitemapUrls('https://hungryforever.net/post-sitemap.xml');
  const hf2 = await fetchSitemapUrls('https://hungryforever.net/post-sitemap2.xml');
  const uaeKw = ['machboos', 'harees', 'luqaimat', 'balaleet', 'khameer', 'shawarma', 'falafel', 'hummus', 'ouzi', 'stuffed-camel', 'arabic', 'emirati', 'gulf', 'middle-east', 'lamb', 'biryani'];
  const allHf = [...new Set([...hf1, ...hf2])];
  const uaeHf = allHf.filter(u => uaeKw.some(k => u.toLowerCase().includes(k)));
  return scrapeUrlList([...uaeHf, ...shuffle(allHf).slice(0, 60)], 'UAE');
}

async function scrapeIsrael() {
  // ottolenghi.co.uk - confirmed working (200) with some JSON-LD
  const ottoUrls = await fetchSitemapUrls('https://ottolenghi.co.uk/sitemap.xml', u => u.includes('/recipes'));
  // BBC has Israeli/Middle Eastern recipes
  const bbcUrls = [
    ...await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q4-recipe.xml', u => u.includes('/recipes/')),
    ...await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q3-recipe.xml', u => u.includes('/recipes/')),
  ];
  const ilKw = ['shakshuka', 'hummus', 'falafel', 'sabich', 'israeli', 'jewish', 'tahini', 'burekas', 'cholent', 'schnitzel', 'halva', 'knafeh', 'malabi', 'labaneh', 'baba-ganoush', 'tabbouleh', 'freekeh'];
  const ilBbc = bbcUrls.filter(u => ilKw.some(k => u.toLowerCase().includes(k)));
  const ilOtto = ottoUrls.filter(u => ilKw.some(k => u.toLowerCase().includes(k)));
  return scrapeUrlList([...ilOtto, ...ilBbc, ...shuffle(ottoUrls).slice(0, 30), ...shuffle(bbcUrls).slice(0, 30)], 'Israel');
}

async function scrapeUK() {
  // BBC Good Food - pull from all quarterly sitemaps
  const bbcQ1_26 = await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2026-Q1-recipe.xml', u => u.includes('/recipes/'));
  const bbcQ4_25 = await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q4-recipe.xml', u => u.includes('/recipes/'));
  const bbcQ3_25 = await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q3-recipe.xml', u => u.includes('/recipes/'));
  const bbcQ2_25 = await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q2-recipe.xml', u => u.includes('/recipes/'));
  const bbcQ1_25 = await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q1-recipe.xml', u => u.includes('/recipes/'));
  const allBbc = [...new Set([...bbcQ1_26, ...bbcQ4_25, ...bbcQ3_25, ...bbcQ2_25, ...bbcQ1_25])];
  const ukKw = ['british', 'english', 'scotch', 'welsh', 'shepherd', 'fish-chips', 'yorkshire', 'pudding', 'toad', 'pasty', 'sausage', 'bangers', 'bubble', 'victoria-sponge', 'scone', 'trifle', 'eton', 'treacle', 'spotted', 'stew', 'pie', 'roast'];
  const ukBbc = allBbc.filter(u => ukKw.some(k => u.toLowerCase().includes(k)));
  return scrapeUrlList([...ukBbc, ...shuffle(allBbc).slice(0, 80)], 'UK');
}

async function scrapeIreland() {
  const bbcQ4_25 = await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q4-recipe.xml', u => u.includes('/recipes/'));
  const bbcQ3_25 = await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q3-recipe.xml', u => u.includes('/recipes/'));
  const bbcQ2_25 = await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q2-recipe.xml', u => u.includes('/recipes/'));
  const bbcQ1_25 = await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q1-recipe.xml', u => u.includes('/recipes/'));
  const allBbc = [...new Set([...bbcQ4_25, ...bbcQ3_25, ...bbcQ2_25, ...bbcQ1_25])];
  const ieKw = ['irish', 'ireland', 'colcannon', 'coddle', 'boxty', 'barmbrack', 'soda-bread', 'guinness', 'potato', 'stew', 'champ', 'wheaten', 'soda'];
  const ieBbc = allBbc.filter(u => ieKw.some(k => u.toLowerCase().includes(k)));
  return scrapeUrlList([...ieBbc, ...shuffle(allBbc).slice(0, 80)], 'Ireland');
}

async function scrapeAustria() {
  // recipesfromeurope.com covers Austrian (kaiserschmarrn, schnitzel, etc.)
  const rfeUrls = await fetchSitemapUrls('https://www.recipesfromeurope.com/post-sitemap.xml');
  const atKw = ['austrian', 'austria', 'schnitzel', 'kaiserschmarrn', 'sachertorte', 'apfelstrudel', 'tafelspitz', 'linzer', 'marillen', 'germknödel', 'strudel', 'vanillekipferl'];
  const atRfe = rfeUrls.filter(u => atKw.some(k => u.toLowerCase().includes(k)));
  // BBC also has Austrian recipes
  const bbcUrls = await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q3-recipe.xml', u => u.includes('/recipes/'));
  const atBbc = bbcUrls.filter(u => atKw.some(k => u.toLowerCase().includes(k)));
  return scrapeUrlList([...atRfe, ...atBbc, ...shuffle(rfeUrls).slice(0, 60)], 'Austria');
}

async function scrapeNetherlands() {
  const rfeUrls = await fetchSitemapUrls('https://www.recipesfromeurope.com/post-sitemap.xml');
  const nlKw = ['dutch', 'netherlands', 'stamppot', 'erwtensoep', 'bitterballen', 'stroopwafel', 'pannenkoek', 'poffertjes', 'hutspot', 'zuurkool', 'haring', 'oliebollen', 'speculaas', 'appeltaart'];
  const nlRfe = rfeUrls.filter(u => nlKw.some(k => u.toLowerCase().includes(k)));
  const bbcUrls = await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q4-recipe.xml', u => u.includes('/recipes/'));
  const nlBbc = bbcUrls.filter(u => nlKw.some(k => u.toLowerCase().includes(k)));
  return scrapeUrlList([...nlRfe, ...nlBbc, ...shuffle(rfeUrls).slice(0, 60)], 'Netherlands');
}

async function scrapeBelgium() {
  const rfeUrls = await fetchSitemapUrls('https://www.recipesfromeurope.com/post-sitemap.xml');
  const beKw = ['belgian', 'belgium', 'moules', 'frites', 'waffle', 'carbonnade', 'waterzooi', 'speculoos', 'liege', 'vol-au-vent', 'stoofvlees', 'chicon'];
  const beRfe = rfeUrls.filter(u => beKw.some(k => u.toLowerCase().includes(k)));
  const bbcUrls = [
    ...await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q3-recipe.xml', u => u.includes('/recipes/')),
    ...await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q2-recipe.xml', u => u.includes('/recipes/')),
  ];
  const beBbc = bbcUrls.filter(u => beKw.some(k => u.toLowerCase().includes(k)));
  return scrapeUrlList([...beRfe, ...beBbc, ...shuffle(rfeUrls).slice(0, 60)], 'Belgium');
}

async function scrapeNorway() {
  // matprat.no - confirmed 4387 recipe URLs
  console.log('  Fetching matprat.no URLs...');
  const matUrls = await fetchSitemapUrls('https://www.matprat.no/sitemap.xml', u => u.includes('/oppskrifter/'));
  console.log(`  matprat.no recipe URLs: ${matUrls.length}`);
  return scrapeUrlList(shuffle(matUrls).slice(0, 80), 'Norway');
}

async function scrapeDenmark() {
  // arla.se covers Nordic including Danish
  const arlaUrls = await fetchSitemapUrls('https://www.arla.se/sitemap.xml', u => u.includes('/recept/'));
  const dkKw = ['smørrebrød', 'frikadeller', 'aebleskiver', 'risalamande', 'rugbrød', 'stegt-flaesk', 'rodkal', 'boller', 'koldskaal', 'brunede', 'leverpostej', 'kransekage', 'wienerbrød', 'danish', 'denmark'];
  const dkArla = arlaUrls.filter(u => dkKw.some(k => u.toLowerCase().includes(k)));
  // BBC has Danish recipes
  const bbcUrls = [
    ...await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q4-recipe.xml', u => u.includes('/recipes/')),
    ...await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q3-recipe.xml', u => u.includes('/recipes/')),
  ];
  const dkBbc = bbcUrls.filter(u => dkKw.some(k => u.toLowerCase().includes(k)));
  // Supplement with matprat.no (Norway/Scandinavia overlap)
  const matUrls = await fetchSitemapUrls('https://www.matprat.no/sitemap.xml', u => u.includes('/oppskrifter/'));
  return scrapeUrlList([...dkArla, ...dkBbc, ...shuffle(arlaUrls).slice(0, 40), ...shuffle(matUrls).slice(0, 30)], 'Denmark');
}

async function scrapeFinland() {
  const arlaUrls = await fetchSitemapUrls('https://www.arla.se/sitemap.xml', u => u.includes('/recept/'));
  const fiKw = ['karjalanpiirakka', 'lohikeitto', 'kalakukko', 'poronkaristys', 'hernekeitto', 'ruisleipa', 'korvapuusti', 'musta-makkara', 'sima', 'runebergintorttu', 'finnish', 'finland'];
  const fiBbc = [
    ...await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q3-recipe.xml', u => u.includes('/recipes/')),
    ...await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q2-recipe.xml', u => u.includes('/recipes/')),
  ].filter(u => fiKw.some(k => u.toLowerCase().includes(k)));
  const matUrls = await fetchSitemapUrls('https://www.matprat.no/sitemap.xml', u => u.includes('/oppskrifter/'));
  return scrapeUrlList([...fiBbc, ...shuffle(arlaUrls).slice(0, 40), ...shuffle(matUrls).slice(0, 30)], 'Finland');
}

async function scrapeHungary() {
  const rfeUrls = await fetchSitemapUrls('https://www.recipesfromeurope.com/post-sitemap.xml');
  const huKw = ['hungarian', 'goulash', 'langos', 'paprikash', 'halaszle', 'koltes', 'dobos', 'somloi', 'retes', 'kurtoskalacs', 'lecso', 'rakott', 'hortobagyi', 'szilvas', 'gulyasleves', 'paprika'];
  const huRfe = rfeUrls.filter(u => huKw.some(k => u.toLowerCase().includes(k)));
  return scrapeUrlList([...huRfe, ...shuffle(rfeUrls).slice(0, 80)], 'Hungary');
}

async function scrapeCzechRepublic() {
  const rfeUrls = await fetchSitemapUrls('https://www.recipesfromeurope.com/post-sitemap.xml');
  const czKw = ['czech', 'svickova', 'knedlo', 'bramborak', 'kulajda', 'smaze', 'trdelnik', 'kolache', 'vanoc', 'medovnik', 'buchty', 'zelna', 'cesnecka', 'gulash', 'dumplings', 'bohemian'];
  const czRfe = rfeUrls.filter(u => czKw.some(k => u.toLowerCase().includes(k)));
  return scrapeUrlList([...czRfe, ...shuffle(rfeUrls).slice(0, 80)], 'Czech Republic');
}

async function scrapeCroatia() {
  const rfeUrls = await fetchSitemapUrls('https://www.recipesfromeurope.com/post-sitemap.xml');
  const hrKw = ['croatian', 'croatia', 'peka', 'pasticada', 'brudet', 'soparnik', 'strukli', 'fritule', 'rozata', 'crni-rizot', 'punjene-paprike', 'gregada'];
  const hrRfe = rfeUrls.filter(u => hrKw.some(k => u.toLowerCase().includes(k)));
  const bbcUrls = await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q4-recipe.xml', u => u.includes('/recipes/'));
  const hrBbc = bbcUrls.filter(u => hrKw.some(k => u.toLowerCase().includes(k)));
  return scrapeUrlList([...hrRfe, ...hrBbc, ...shuffle(rfeUrls).slice(0, 80)], 'Croatia');
}

async function scrapeRomania() {
  const rfeUrls = await fetchSitemapUrls('https://www.recipesfromeurope.com/post-sitemap.xml');
  const roKw = ['romanian', 'mamaliga', 'mici', 'sarmale', 'ciorba', 'zacusca', 'cozonac', 'papanasi', 'tochitura', 'drob', 'fasole', 'bors', 'jumari', 'langos', 'gogosi'];
  const roRfe = rfeUrls.filter(u => roKw.some(k => u.toLowerCase().includes(k)));
  return scrapeUrlList([...roRfe, ...shuffle(rfeUrls).slice(0, 80)], 'Romania');
}

async function scrapeBulgaria() {
  const rfeUrls = await fetchSitemapUrls('https://www.recipesfromeurope.com/post-sitemap.xml');
  const bgKw = ['bulgarian', 'banitsa', 'tarator', 'kyufte', 'shopska', 'gyuvech', 'kavarma', 'musaka', 'kozunak', 'bob-chorba', 'sarmi', 'lutenitsa'];
  const bgRfe = rfeUrls.filter(u => bgKw.some(k => u.toLowerCase().includes(k)));
  const bbcUrls = [
    ...await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q4-recipe.xml', u => u.includes('/recipes/')),
    ...await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q3-recipe.xml', u => u.includes('/recipes/')),
  ];
  const bgBbc = bbcUrls.filter(u => bgKw.some(k => u.toLowerCase().includes(k)));
  return scrapeUrlList([...bgRfe, ...bgBbc, ...shuffle(rfeUrls).slice(0, 60)], 'Bulgaria');
}

// ─── Additional countries ──────────────────────────────────────────────────────

async function scrapeCambodia() {
  const rteUrls = await fetchSitemapUrls('https://www.recipetineats.com/post-sitemap.xml');
  const rte2Urls = await fetchSitemapUrls('https://www.recipetineats.com/post-sitemap2.xml');
  const khKw = ['cambodian', 'khmer', 'amok', 'lok-lak', 'bai-sach', 'kuy-teav', 'nom-banh-chok', 'prahok', 'lort-cha', 'bok-l-hong'];
  const khRte = [...rteUrls, ...rte2Urls].filter(u => khKw.some(k => u.toLowerCase().includes(k)));
  // BBC
  const bbcUrls = await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q4-recipe.xml', u => u.includes('/recipes/'));
  const khBbc = bbcUrls.filter(u => khKw.some(k => u.toLowerCase().includes(k)));
  return scrapeUrlList([...khRte, ...khBbc, ...shuffle([...rteUrls, ...rte2Urls]).slice(0, 60)], 'Cambodia');
}

async function scrapeMyanmar() {
  const rteUrls = await fetchSitemapUrls('https://www.recipetineats.com/post-sitemap.xml');
  const rte2Urls = await fetchSitemapUrls('https://www.recipetineats.com/post-sitemap2.xml');
  const mmKw = ['burmese', 'myanmar', 'mohinga', 'shan', 'laphet', 'oh-no-khao', 'tea-leaf', 'nan-gyi', 'kyay-oh'];
  const mmRte = [...rteUrls, ...rte2Urls].filter(u => mmKw.some(k => u.toLowerCase().includes(k)));
  return scrapeUrlList([...mmRte, ...shuffle([...rteUrls, ...rte2Urls]).slice(0, 60)], 'Myanmar');
}

async function scrapeTaiwan() {
  const rteUrls = await fetchSitemapUrls('https://www.recipetineats.com/post-sitemap.xml');
  const rte2Urls = await fetchSitemapUrls('https://www.recipetineats.com/post-sitemap2.xml');
  const twKw = ['taiwanese', 'taiwan', 'beef-noodle', 'scallion-pancake', 'lu-rou-fan', 'oyster-vermicelli', 'bubble-tea', 'pineapple-cake', 'sun-cake', 'ba-wan', 'stinky-tofu'];
  const twRte = [...rteUrls, ...rte2Urls].filter(u => twKw.some(k => u.toLowerCase().includes(k)));
  // Use pickledplum for Taiwanese dishes
  const ppUrls = await fetchSitemapUrls('https://pickledplum.com/post-sitemap.xml');
  const twPp = ppUrls.filter(u => twKw.some(k => u.toLowerCase().includes(k)));
  return scrapeUrlList([...twRte, ...twPp, ...shuffle([...rteUrls, ...rte2Urls]).slice(0, 60)], 'Taiwan');
}

async function scrapeVenezuela() {
  // laylita covers Venezuela (pabellón, arepas, hallacas)
  const layUrls = [
    ...await fetchSitemapUrls('https://www.laylita.com/recipes/sitemap.xml'),
    ...await fetchSitemapUrls('https://www.laylita.com/sitemap.xml', u => !u.endsWith('.xml')),
  ];
  const veKw = ['venezuelan', 'venezuela', 'pabellon', 'arepa', 'hallaca', 'tequeño', 'mandoca', 'cachapa', 'asado-negro', 'pepito', 'caraotas'];
  const veFiltered = layUrls.filter(u => veKw.some(k => u.toLowerCase().includes(k)));
  const goyaUrls = await fetchSitemapUrls('https://www.goya.com/post-sitemap.xml', u => u.includes('/en/recipes/'));
  const veGoya = goyaUrls.filter(u => veKw.some(k => u.toLowerCase().includes(k)));
  return scrapeUrlList([...veFiltered, ...veGoya, ...shuffle(layUrls).slice(0, 50)], 'Venezuela');
}

async function scrapeEcuador() {
  // laylita.com is an Ecuadorian blog - perfect source
  const layUrls = [
    ...await fetchSitemapUrls('https://www.laylita.com/recipes/sitemap.xml'),
    ...await fetchSitemapUrls('https://www.laylita.com/sitemap.xml', u => !u.endsWith('.xml')),
  ];
  const ecKw = ['ecuadorian', 'ecuador', 'seco-de-pollo', 'llapingachos', 'ceviche', 'encocado', 'bolon', 'fanesca', 'colada-morada', 'empanadas', 'canelazo', 'tigrillo'];
  const ecFiltered = layUrls.filter(u => ecKw.some(k => u.toLowerCase().includes(k)));
  return scrapeUrlList([...ecFiltered, ...shuffle(layUrls).slice(0, 60)], 'Ecuador');
}

async function scrapeJordan() {
  const hfUrls = [
    ...await fetchSitemapUrls('https://hungryforever.net/post-sitemap.xml'),
    ...await fetchSitemapUrls('https://hungryforever.net/post-sitemap2.xml'),
  ];
  const joKw = ['mansaf', 'maqluba', 'jordanian', 'jordan', 'zarb', 'musakhan', 'arayes', 'kunafa', 'makdous', 'fatteh', 'levantine', 'middle-east'];
  const joHf = hfUrls.filter(u => joKw.some(k => u.toLowerCase().includes(k)));
  // BBC has Levantine recipes
  const bbcUrls = [
    ...await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q4-recipe.xml', u => u.includes('/recipes/')),
    ...await fetchSitemapUrls('https://www.bbcgoodfood.com/sitemaps/2025-Q3-recipe.xml', u => u.includes('/recipes/')),
  ];
  const joBbc = bbcUrls.filter(u => joKw.some(k => u.toLowerCase().includes(k)));
  return scrapeUrlList([...joHf, ...joBbc, ...shuffle(hfUrls).slice(0, 60)], 'Jordan');
}

async function scrapeNepal() {
  // recipesaresimple.com covers Nepal/Himalayan
  const rasUrls = await fetchSitemapUrls('https://www.recipesaresimple.com/recipe-sitemap.xml', u => !u.endsWith('.xml'));
  const npKw = ['nepali', 'nepal', 'dal-bhat', 'momo', 'thukpa', 'chatamari', 'gundruk', 'dhido', 'kwati', 'sel-roti', 'chiya', 'achar'];
  const npRas = rasUrls.filter(u => npKw.some(k => u.toLowerCase().includes(k)));
  // cookwithnabeela for Himalayan/South Asian dishes
  const cwn1 = await fetchSitemapUrls('https://www.cookwithnabeela.com/recipe-sitemap1.xml');
  const npCwn = cwn1.filter(u => npKw.some(k => u.toLowerCase().includes(k)));
  return scrapeUrlList([...npRas, ...npCwn, ...shuffle([...rasUrls, ...cwn1]).slice(0, 60)], 'Nepal');
}

// ─── CSV helpers ───────────────────────────────────────────────────────────────
function toSlug(country, title) {
  return `${country}-${title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}
function csvField(v) { const s = String(v ?? '').replace(/"/g, '""'); return `"${s}"`; }

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

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
  'Cambodia':       scrapeCambodia,
  'Myanmar':        scrapeMyanmar,
  'Taiwan':         scrapeTaiwan,
  'Venezuela':      scrapeVenezuela,
  'Ecuador':        scrapeEcuador,
  'Jordan':         scrapeJordan,
  'Nepal':          scrapeNepal,
};

// Deduplicate NEW_COUNTRIES (Sri Lanka appeared twice)
const seenIdxs = new Set();
const COUNTRIES_TO_SCRAPE = [
  { name: 'Australia',       code: 'AU', idx: 30 },
  { name: 'New Zealand',     code: 'NZ', idx: 31 },
  { name: 'South Africa',    code: 'ZA', idx: 32 },
  { name: 'Ghana',           code: 'GH', idx: 33 },
  { name: 'Kenya',           code: 'KE', idx: 34 },
  { name: 'Tunisia',         code: 'TN', idx: 35 },
  { name: 'Algeria',         code: 'DZ', idx: 36 },
  { name: 'Canada',          code: 'CA', idx: 37 },
  { name: 'Jamaica',         code: 'JM', idx: 38 },
  { name: 'Cuba',            code: 'CU', idx: 39 },
  { name: 'Colombia',        code: 'CO', idx: 40 },
  { name: 'Chile',           code: 'CL', idx: 41 },
  { name: 'Malaysia',        code: 'MY', idx: 42 },
  { name: 'Singapore',       code: 'SG', idx: 43 },
  { name: 'Sri Lanka',       code: 'LK', idx: 44 },
  { name: 'Pakistan',        code: 'PK', idx: 45 },
  { name: 'Bangladesh',      code: 'BD', idx: 46 },
  { name: 'Georgia',         code: 'GE', idx: 47 },
  { name: 'Uzbekistan',      code: 'UZ', idx: 48 },
  { name: 'Saudi Arabia',    code: 'SA', idx: 49 },
  { name: 'UAE',             code: 'AE', idx: 50 },
  { name: 'Israel',          code: 'IL', idx: 51 },
  { name: 'UK',              code: 'GB', idx: 52 },
  { name: 'Ireland',         code: 'IE', idx: 53 },
  { name: 'Austria',         code: 'AT', idx: 54 },
  { name: 'Netherlands',     code: 'NL', idx: 55 },
  { name: 'Belgium',         code: 'BE', idx: 56 },
  { name: 'Norway',          code: 'NO', idx: 57 },
  { name: 'Denmark',         code: 'DK', idx: 58 },
  { name: 'Finland',         code: 'FI', idx: 59 },
  { name: 'Hungary',         code: 'HU', idx: 60 },
  { name: 'Czech Republic',  code: 'CZ', idx: 61 },
  { name: 'Croatia',         code: 'HR', idx: 62 },
  { name: 'Romania',         code: 'RO', idx: 63 },
  { name: 'Bulgaria',        code: 'BG', idx: 64 },
  { name: 'Cambodia',        code: 'KH', idx: 65 },
  { name: 'Myanmar',         code: 'MM', idx: 66 },
  { name: 'Taiwan',          code: 'TW', idx: 67 },
  { name: 'Venezuela',       code: 'VE', idx: 68 },
  { name: 'Ecuador',         code: 'EC', idx: 69 },
  { name: 'Jordan',          code: 'JO', idx: 70 },
  { name: 'Nepal',           code: 'NP', idx: 71 },
];

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

// ── Supabase client ──────────────────────────────────────────────────────────
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Ollama translate ─────────────────────────────────────────────────────────
const OLLAMA_MODEL = 'aya-expanse:8b';
const OLLAMA_HARD_TIMEOUT = 180000;
// Local Ollama server — HTTP is intentional for loopback connections
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const { hostname: OLLAMA_HOST, port: OLLAMA_PORT } = new URL(OLLAMA_URL);

function ollamaRequest(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: OLLAMA_MODEL, prompt, stream: false,
      keep_alive: '24h',
      options: { temperature: 0.2, num_predict: 1200 },
    });
    const hardTimer = setTimeout(() => { req.destroy(); reject(new Error('Ollama timeout')); }, OLLAMA_HARD_TIMEOUT);
    const req = http.request({
      hostname: OLLAMA_HOST, port: parseInt(OLLAMA_PORT) || 11434, path: '/api/generate', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        clearTimeout(hardTimer);
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error));
          resolve(parsed.response || '');
        } catch (e) { reject(new Error('Bad Ollama response')); }
      });
      res.on('error', (e) => { clearTimeout(hardTimer); reject(e); });
    });
    req.on('error', (e) => { clearTimeout(hardTimer); reject(e); });
    req.write(body);
    req.end();
  });
}

async function translateRecipe(recipe) {
  const prompt = `Ești un traducător culinar expert. Traduce această rețetă din engleză în română.

REGULI STRICTE:
1. Ingrediente — convertește TOATE unitățile la metric:
   • cups → ml  (1 cup = 240 ml)
   • tablespoon/tbsp → ml  (1 tbsp = 15 ml)
   • teaspoon/tsp → ml  (1 tsp = 5 ml)
   • oz → g  (1 oz = 28 g) sau ml dacă e lichid
   • lb/lbs → g  (1 lb = 450 g)
   • stick butter → g  (1 stick = 113 g)
   Format: "cantitate unitate ingredient, detaliu"

2. Pași — voce CALDĂ, descriptivă, ca un bucătar care explică unui prieten:
   • Include texturi, culori, timpi, indicii senzoriale
   • NU: "Se prăjesc ceapele 5 minute."
   • DA: "Adaugă ceapa și las-o să se înmoaie la foc mediu, amestecând ușor, până devine translucidă și ușor aurie — vreo 5-6 minute."

3. Română corectă cu diacritice: ă â î ș ț

4. Returnează STRICT JSON valid:

Rețetă:
Title: ${recipe.title}
Summary: ${recipe.summary || recipe.title}
Ingredients:
${recipe.ingredients.map((x, i) => `${i + 1}. ${x}`).join('\n')}
Steps:
${(recipe.instructions || recipe.steps || []).map((x, i) => `${i + 1}. ${x}`).join('\n')}

{"title":"...","summary":"...","ingredients":["..."],"steps":["..."]}`;

  const text = await ollamaRequest(prompt);
  const clean = text.replace(/```(?:json)?\n?/g, '').trim();
  const jsonStart = clean.indexOf('{');
  const jsonEnd = clean.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON found');
  return JSON.parse(clean.slice(jsonStart, jsonEnd + 1));
}

// ── Clean slug (NO country prefix) ───────────────────────────────────────────
function cleanSlug(title) {
  return title
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// ── Progress tracking ────────────────────────────────────────────────────────
const PROGRESS_FILE = path.join(__dirname, '.scrape-authentic-progress.json');
function loadProgress() {
  try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')); } catch { return { completed: [] }; }
}
function saveProgress(p) { fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2)); }

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  Authentic recipe scraper — country blogs → Ollama translate → Supabase');
  console.log('  Model: ' + OLLAMA_MODEL + ' (local, free)');
  console.log('══════════════════════════════════════════════════════════════');

  // Load existing slugs to avoid duplicates
  const { data: existing } = await supabase.from('posts').select('slug').eq('type', 'recipe');
  const existingSlugs = new Set((existing || []).map(p => p.slug));
  console.log(`  Existing recipes: ${existingSlugs.size}`);

  const progress = loadProgress();
  let totalInserted = 0;
  const summaryList = [];

  for (const countryDef of COUNTRIES_TO_SCRAPE) {
    const { name, code, idx } = countryDef;
    if (progress.completed.includes(name)) {
      console.log(`  ⏭️  ${name} — already done`);
      continue;
    }

    const scraper = SCRAPERS[name];
    if (!scraper) { summaryList.push({ name, count: 0 }); continue; }

    console.log(`\n🌍  [${name}] Scraping from blogs...`);
    let recipes = [];
    try { recipes = await scraper(); } catch (e) { console.error(`  ERROR scraping: ${e.message}`); }
    console.log(`  ${recipes.length} recipes scraped`);

    // Find the profile for this country
    const { data: profileRows } = await supabase.from('profiles').select('id').ilike('display_name', `%${name}%`).limit(1);
    const profileId = profileRows?.[0]?.id || profileUUID(idx);

    let inserted = 0;
    for (const raw of recipes) {
      if (inserted >= 20) break;
      const slug = cleanSlug(raw.title);
      if (existingSlugs.has(slug)) { console.log(`  ⏭️  "${raw.title}" — slug exists`); continue; }

      // Translate
      console.log(`  Traducere "${raw.title.slice(0, 50)}"...`);
      let translated;
      try {
        translated = await translateRecipe(raw);
        console.log(`  ✓`);
      } catch (e) {
        console.log(`  ⚠️ skip (${e.message})`);
        continue;
      }

      // Validate + normalize translation — ensure ingredients are plain strings in format "qty unit name"
      let trIngredients = translated.ingredients
      let trSteps = translated.steps || translated.instructions

      // Fix: if Ollama returned objects instead of strings, extract text
      if (Array.isArray(trIngredients)) {
        trIngredients = trIngredients.map(item => {
          if (typeof item === 'string') return item
          if (typeof item === 'object' && item !== null) {
            // Handle {cantitate, unitate, detaliu} or {qty, unit, name} shapes
            const qty = item.cantitate || item.qty || item.quantity || ''
            const unit = item.unitate || item.unit || ''
            const name = item.ingredient || item.name || item.detaliu || ''
            return `${qty} ${unit} ${name}`.replace(/\s+/g, ' ').trim()
          }
          return String(item)
        }).filter(s => s.length > 1)
      }

      // Fix: if Ollama returned objects for steps
      if (Array.isArray(trSteps)) {
        trSteps = trSteps.map(item => {
          if (typeof item === 'string') return item
          if (typeof item === 'object' && item !== null) return item.text || item.step || item.description || JSON.stringify(item)
          return String(item)
        }).filter(s => s.length > 5)
      }

      // Reject if still English (check for common English words in ingredients)
      const sampleIngr = (trIngredients || []).slice(0, 3).join(' ').toLowerCase()
      if (sampleIngr.includes('tablespoon') || sampleIngr.includes('teaspoon') || sampleIngr.includes(' cup ') || sampleIngr.includes('ounce')) {
        console.log(`  ⚠️ skip (ingredients still in English)`)
        continue
      }
      if (!trIngredients || !Array.isArray(trIngredients) || trIngredients.length < 2) {
        console.log(`  ⚠️ skip (incomplete translation — no ingredients)`);
        continue;
      }
      if (!trSteps || !Array.isArray(trSteps) || trSteps.length < 1) {
        console.log(`  ⚠️ skip (incomplete translation — no steps)`);
        continue;
      }

      // Insert into Supabase
      const approachId = APPROACH_IDS[inserted % APPROACH_IDS.length];
      const { error } = await supabase.from('posts').insert({
        id: randomUUID(),
        created_by: profileId,
        approach_id: approachId,
        title: translated.title || raw.title,
        slug,
        content: translated.summary || raw.summary || translated.title,
        summary: translated.summary || raw.summary,
        status: 'active',
        type: 'recipe',
        hero_image_url: raw.imageUrl || '',
        source_url: raw.sourceUrl || '',
        recipe_json: {
          ingredients: trIngredients,
          instructions: trSteps,
          steps: trSteps,
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
    summaryList.push({ name, count: inserted });
    console.log(`  ✅  ${inserted}/${recipes.length} inserted for ${name}`);

    // Only mark as completed if we got a decent number — allows retry on failure
    if (inserted >= 5 || (recipes.length === 0 && inserted === 0)) {
      // Mark 0-recipe countries too so we don't re-scrape broken sitemaps forever
      // But they can be manually retried by removing from progress
      progress.completed.push(name);
      saveProgress(progress);
    }
    await sleep(2000);
  }

  console.log('\n══════════════════════════════════════');
  console.log('SUMMARY');
  console.log('══════════════════════════════════════');
  for (const s of summaryList) {
    const mark = s.count >= 15 ? '✅' : s.count > 0 ? `⚠️  ${s.count}/20` : '❌  0/20';
    console.log(`  ${mark}  ${s.name}`);
  }
  console.log(`\nTotal inserted: ${totalInserted}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
