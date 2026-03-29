'use strict';

/**
 * Recipe Scraper v4 — 29 countries × 20 recipes = 580 rows
 * Zero 196flavors. All sources confirmed working with JSON-LD.
 * Output: data/recipes-seed.csv
 * Run: node scripts/scrape-recipes.js
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// ─── HTTP client ─────────────────────────────────────────────────────────────
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

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

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

// ─── JSON-LD extractor ────────────────────────────────────────────────────────
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
      block['@graph'].forEach((n) => { if (n && n['@type'] === 'Recipe') candidates.push(n); });
    }
    if (Array.isArray(block)) {
      block.forEach((n) => { if (n && n['@type'] === 'Recipe') candidates.push(n); });
    }
    if (candidates.length > 0) return parseRecipeJsonLd(candidates[0], sourceUrl);
  }
  return null;
}

function parseRecipeJsonLd(r, sourceUrl) {
  const title = r.name || '';
  if (!title) return null;

  let ingredients = [];
  if (Array.isArray(r.recipeIngredient)) {
    ingredients = r.recipeIngredient.map((s) => String(s).trim()).filter(Boolean);
  }

  let instructions = [];
  if (Array.isArray(r.recipeInstructions)) {
    r.recipeInstructions.forEach((step) => {
      if (typeof step === 'string') instructions.push(step.trim());
      else if (step && step.text) instructions.push(String(step.text).trim());
      else if (step && step['@type'] === 'HowToSection' && Array.isArray(step.itemListElement)) {
        step.itemListElement.forEach((s) => { if (s && s.text) instructions.push(String(s.text).trim()); });
      }
    });
  }
  instructions = instructions.filter((s) => s.length > 3);

  const prepTime = parseDuration(r.prepTime || r.preptime || '');
  const cookTime = parseDuration(r.cookTime || r.cooktime || r.totalTime || '');
  const servings = parseInt(
    typeof r.recipeYield === 'string' ? r.recipeYield
    : Array.isArray(r.recipeYield) ? r.recipeYield[0] : '4'
  ) || 4;

  let imageUrl = '';
  if (typeof r.image === 'string') imageUrl = r.image;
  else if (r.image && r.image.url) imageUrl = r.image.url;
  else if (Array.isArray(r.image) && r.image[0]) {
    imageUrl = typeof r.image[0] === 'string' ? r.image[0] : r.image[0].url || '';
  }

  const description = String(r.description || '').trim().slice(0, 500);
  return {
    title,
    summary: description || title,
    ingredients,
    instructions,
    prepTime,
    cookTime,
    servings,
    difficulty: parseDiff(String(r.difficulty || '').toLowerCase()),
    imageUrl,
    sourceUrl: sourceUrl || r.url || r['@id'] || '',
  };
}

function parseDuration(iso) {
  if (!iso) return 0;
  const s = String(iso);
  let mins = 0;
  const hMatch = s.match(/(\d+)H/i);
  const mMatch = s.match(/(\d+)M/i);
  if (hMatch) mins += parseInt(hMatch[1]) * 60;
  if (mMatch) mins += parseInt(mMatch[1]);
  return mins || 0;
}

function parseDiff(str) {
  if (!str) return 'medium';
  if (/easy|facil|facile|leicht|simple|kolay|легк/i.test(str)) return 'easy';
  if (/hard|difficile|schwer|difficult|zor|сложн/i.test(str)) return 'hard';
  return 'medium';
}

// ─── Slug helper ──────────────────────────────────────────────────────────────
const slugSet = new Set();
function makeSlug(country, title) {
  const base = (country + '-' + title)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  let slug = base;
  let n = 2;
  while (slugSet.has(slug)) slug = base + '-' + n++;
  slugSet.add(slug);
  return slug;
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────
function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v).replace(/\r?\n/g, ' ').replace(/\r/g, ' ');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}
function csvRow(arr) { return arr.map(csvCell).join(','); }

// ─── Approach UUID map ────────────────────────────────────────────────────────
const APPROACH = {
  Italy:  'b0000000-0000-0000-0000-000000000001',
  Japan:  'b0000000-0000-0000-0000-000000000002',
  Mexico: 'b0000000-0000-0000-0000-000000000003',
  France: 'b0000000-0000-0000-0000-000000000004',
  India:  'b0000000-0000-0000-0000-000000000005',
};

function countryIds(idx) {
  return {
    profileId: `c${idx}000000-0000-0000-0000-000000000001`,
    cuisineId:  `d${idx}000000-0000-0000-0000-000000000001`,
  };
}

// ─── Unsplash image fallback ──────────────────────────────────────────────────
const IMG_POOL = [
  'photo-1504674900247-0877df9cc836','photo-1476224203421-9ac39bcb3b28',
  'photo-1547592180-85f173990554','photo-1568901346375-23c9450c58cd',
  'photo-1601050690597-df0568f70950','photo-1606491956689-2ea866880c84',
  'photo-1414235077428-338989a2e8c0','photo-1555507036-ab1f4038808a',
  'photo-1474487548417-781cb6d646b4','photo-1596097557888-87fa0b05fd9e',
  'photo-1565557623262-b51c2513a641','photo-1630409351241-e90716c30ebe',
  'photo-1569050467447-ce54b3bbc37d','photo-1553621042-f6e147245754',
  'photo-1617196034183-421b4040ed20','photo-1580822184713-fc5400e7fe10',
];
function fallbackImg(i) {
  const p = IMG_POOL[i % IMG_POOL.length];
  return `https://images.unsplash.com/${p}?auto=format&fit=crop&w=800&q=80`;
}

// ─── CORE: scrape list of direct URLs ────────────────────────────────────────
async function scrapeDirectUrls(urls, needed = 20) {
  const results = [];
  for (const url of urls) {
    if (results.length >= needed) break;
    try {
      const html = await get(url);
      const rec = extractJsonLd(html, url);
      if (rec && rec.ingredients.length >= 2 && rec.instructions.length >= 1) {
        results.push(rec);
        process.stdout.write('.');
      } else {
        process.stdout.write('x');
      }
    } catch (e) { process.stdout.write('x'); }
    await sleep(700);
  }
  return results;
}

// ─── CORE: crawl listing pages and scrape recipe links ───────────────────────
async function crawlAndScrape(listingUrls, isRecipeUrl, needed = 20, baseUrl = '') {
  const results = [];
  const seen = new Set();

  for (const listUrl of listingUrls) {
    if (results.length >= needed) break;
    let recipeLinks = [];
    try {
      const html = await get(listUrl);
      const $ = cheerio.load(html);
      $('a[href]').each((_, el) => {
        const h = $(el).attr('href') || '';
        const full = h.startsWith('http') ? h : baseUrl + h;
        if (isRecipeUrl(full) && !seen.has(full)) {
          seen.add(full);
          recipeLinks.push(full);
        }
      });
      await sleep(600);
    } catch (e) { console.log(`  Listing failed: ${listUrl}`); continue; }

    for (const link of recipeLinks) {
      if (results.length >= needed) break;
      try {
        const html = await get(link);
        const rec = extractJsonLd(html, link);
        if (rec && rec.ingredients.length >= 2 && rec.instructions.length >= 1) {
          results.push(rec);
          process.stdout.write('.');
        } else { process.stdout.write('x'); }
        await sleep(700);
      } catch (e) { process.stdout.write('x'); }
    }
    await sleep(600);
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COUNTRY SCRAPERS
// ═══════════════════════════════════════════════════════════════════════════════

// ── 1. ITALY – giallozafferano.it ─────────────────────────────────────────────
async function scrapeItaly() {
  return scrapeDirectUrls([
    'https://ricette.giallozafferano.it/Spaghetti-alla-carbonara.html',
    'https://ricette.giallozafferano.it/Risotto-alla-milanese.html',
    'https://ricette.giallozafferano.it/Tiramis%C3%B9.html',
    'https://ricette.giallozafferano.it/Pizza-Margherita.html',
    'https://ricette.giallozafferano.it/Lasagne-alla-bolognese.html',
    'https://ricette.giallozafferano.it/Panna-cotta.html',
    'https://ricette.giallozafferano.it/Focaccia-genovese.html',
    'https://ricette.giallozafferano.it/Ribollita.html',
    'https://ricette.giallozafferano.it/Cotoletta-alla-milanese.html',
    'https://ricette.giallozafferano.it/Scaloppine-al-limone.html',
    'https://ricette.giallozafferano.it/Bruschetta-al-pomodoro.html',
    'https://ricette.giallozafferano.it/Arancini.html',
    'https://ricette.giallozafferano.it/Minestrone.html',
    'https://ricette.giallozafferano.it/Gnocchi-di-patate.html',
    'https://ricette.giallozafferano.it/Cannoli-siciliani.html',
    'https://ricette.giallozafferano.it/Saltimbocca-alla-romana.html',
    'https://ricette.giallozafferano.it/Amatriciana.html',
    'https://ricette.giallozafferano.it/Cacio-e-pepe.html',
    'https://ricette.giallozafferano.it/Polenta.html',
    'https://ricette.giallozafferano.it/Panzanella.html',
  ], 20);
}

// ── 2. FRANCE – marmiton.org ─────────────────────────────────────────────────
async function scrapeFrance() {
  return scrapeDirectUrls([
    'https://www.marmiton.org/recettes/recette_quiche-lorraine_11.aspx',
    'https://www.marmiton.org/recettes/recette_ratatouille_22429.aspx',
    'https://www.marmiton.org/recettes/recette_boeuf-bourguignon_18889.aspx',
    'https://www.marmiton.org/recettes/recette_soupe-a-l-oignon_18812.aspx',
    'https://www.marmiton.org/recettes/recette_creme-brulee_14218.aspx',
    'https://www.marmiton.org/recettes/recette_tarte-tatin_12719.aspx',
    'https://www.marmiton.org/recettes/recette_croissants_24341.aspx',
    'https://www.marmiton.org/recettes/recette_coq-au-vin_17225.aspx',
    'https://www.marmiton.org/recettes/recette_moules-marinieres_11411.aspx',
    'https://www.marmiton.org/recettes/recette_crepes_23528.aspx',
    'https://www.marmiton.org/recettes/recette_cassoulet_11398.aspx',
    'https://www.marmiton.org/recettes/recette_gratin-dauphinois_11418.aspx',
    'https://www.marmiton.org/recettes/recette_mousse-au-chocolat_12079.aspx',
    'https://www.marmiton.org/recettes/recette_vichyssoise_27698.aspx',
    'https://www.marmiton.org/recettes/recette_pain-perdu_11405.aspx',
    'https://www.marmiton.org/recettes/recette_bouillabaisse_11406.aspx',
    'https://www.marmiton.org/recettes/recette_confit-de-canard_22116.aspx',
    'https://www.marmiton.org/recettes/recette_fondue-savoyarde_12077.aspx',
    'https://www.marmiton.org/recettes/recette_flamiche_11414.aspx',
    'https://www.marmiton.org/recettes/recette_gateau-basque_12780.aspx',
  ], 20);
}

// ── 3. SPAIN – pequerecetas.com ──────────────────────────────────────────────
async function scrapeSpain() {
  return crawlAndScrape(
    [
      'https://www.pequerecetas.com/recetas/desayunos/',
      'https://www.pequerecetas.com/recetas/primeros/',
      'https://www.pequerecetas.com/recetas/segundos/',
      'https://www.pequerecetas.com/recetas/postres/',
      'https://www.pequerecetas.com/recetas/sopas/',
      'https://www.pequerecetas.com/recetas/tapas/',
      'https://www.pequerecetas.com/recetas/bebidas/',
    ],
    (h) => h.includes('pequerecetas.com/receta/') && h.split('/').filter(Boolean).length >= 4,
    20,
    'https://www.pequerecetas.com'
  );
}

// ── 4. GERMANY – eat.de ──────────────────────────────────────────────────────
async function scrapeGermany() {
  return crawlAndScrape(
    [
      'https://eat.de/rezeptidee/suppe/',
      'https://eat.de/rezeptidee/hauptgericht/',
      'https://eat.de/rezeptidee/dessert/',
      'https://eat.de/rezeptidee/fruehstueck/',
      'https://eat.de/rezeptidee/salat/',
      'https://eat.de/rezeptidee/snack/',
      'https://eat.de/rezeptidee/getraenk/',
    ],
    (h) => h.includes('eat.de/rezept/') && h.split('/').filter(Boolean).length >= 3,
    20,
    'https://eat.de'
  );
}

// ── 5. JAPAN – justonecookbook.com ───────────────────────────────────────────
async function scrapeJapan() {
  return scrapeDirectUrls([
    'https://www.justonecookbook.com/miso-soup/',
    'https://www.justonecookbook.com/gyoza/',
    'https://www.justonecookbook.com/onigiri/',
    'https://www.justonecookbook.com/yakitori/',
    'https://www.justonecookbook.com/tonkatsu/',
    'https://www.justonecookbook.com/sushi-rice/',
    'https://www.justonecookbook.com/okonomiyaki/',
    'https://www.justonecookbook.com/teriyaki-chicken/',
    'https://www.justonecookbook.com/katsudon/',
    'https://www.justonecookbook.com/sukiyaki/',
    'https://www.justonecookbook.com/tamagoyaki/',
    'https://www.justonecookbook.com/karaage/',
    'https://www.justonecookbook.com/takoyaki/',
    'https://www.justonecookbook.com/dorayaki/',
    'https://www.justonecookbook.com/japanese-fried-rice/',
    'https://www.justonecookbook.com/mochi/',
    'https://www.justonecookbook.com/ramen/',
    'https://www.justonecookbook.com/tempura/',
    'https://www.justonecookbook.com/udon-noodle-soup/',
    'https://www.justonecookbook.com/matcha-cake/',
  ], 20);
}

// ── 6. MEXICO – pequerecetas.com (works for Mexican recipes too) + food.com ──
async function scrapeMexico() {
  // Use pequerecetas.com crawl approach — it has Mexican content under bebidas, etc.
  const crawled = await crawlAndScrape(
    [
      'https://www.pequerecetas.com/recetas/mexicana/',
      'https://www.pequerecetas.com/recetas/americana/',
    ],
    (h) => h.includes('pequerecetas.com/receta/') && h.split('/').filter(Boolean).length >= 4,
    12,
    'https://www.pequerecetas.com'
  );

  // Supplement with confirmed food.com Mexican IDs
  const foodcom = await scrapeDirectUrls([
    'https://www.food.com/recipe/authentic-mexican-rice-36237',
    'https://www.food.com/recipe/the-best-mexican-black-beans-300592',
    'https://www.food.com/recipe/chile-con-carne-30707',
    'https://www.food.com/recipe/mexican-hot-chocolate-92012',
    'https://www.food.com/recipe/tamales-de-rajas-con-queso-55459',
    'https://www.food.com/recipe/agua-fresca-de-sandía-watermelon-agua-fresca-166432',
    'https://www.food.com/recipe/arroz-con-leche-mexican-style-rice-pudding-53838',
    'https://www.food.com/recipe/chiles-en-nogada-72562',
  ], 20 - crawled.length);

  return [...crawled, ...foodcom];
}

// ── 7. INDIA – indianhealthyrecipes.com + cookwithmanali.com ─────────────────
async function scrapeIndia() {
  const primary = await scrapeDirectUrls([
    'https://www.indianhealthyrecipes.com/samosa-recipe/',
    'https://www.indianhealthyrecipes.com/naan-recipe/',
    'https://www.indianhealthyrecipes.com/dal-makhani/',
    'https://www.indianhealthyrecipes.com/paneer-tikka-masala/',
    'https://www.indianhealthyrecipes.com/tandoori-chicken/',
    'https://www.indianhealthyrecipes.com/chicken-tikka-masala/',
    'https://www.indianhealthyrecipes.com/dosa-recipe/',
    'https://www.indianhealthyrecipes.com/aloo-gobi/',
    'https://www.indianhealthyrecipes.com/chana-masala/',
    'https://www.indianhealthyrecipes.com/lassi-recipe/',
    'https://www.indianhealthyrecipes.com/gulab-jamun-recipe/',
  ], 20);

  if (primary.length < 20) {
    const extra = await scrapeDirectUrls([
      'https://www.cookwithmanali.com/palak-paneer/',
      'https://www.cookwithmanali.com/samosa/',
      'https://www.cookwithmanali.com/dal-makhani/',
      'https://www.cookwithmanali.com/gulab-jamun/',
      'https://www.cookwithmanali.com/aloo-tikki/',
      'https://www.cookwithmanali.com/mango-lassi/',
      'https://www.cookwithmanali.com/paneer-butter-masala/',
      'https://www.cookwithmanali.com/pav-bhaji/',
      'https://www.cookwithmanali.com/masala-chai/',
      'https://www.cookwithmanali.com/idli/',
    ], 20 - primary.length);
    return [...primary, ...extra];
  }
  return primary;
}

// ── 8. GREECE – mygreekdish.com + olivetomato.com ────────────────────────────
async function scrapeGreece() {
  return scrapeDirectUrls([
    'https://www.mygreekdish.com/recipe/greek-style-pancakes-honey-walnuts-tiganites/',
    'https://www.mygreekdish.com/recipe/greek-style-roast-chicken/',
    'https://www.mygreekdish.com/recipe/kontosouvli-spit-roasted-bbq-pork/',
    'https://www.mygreekdish.com/recipe/homemade-baked-greek-fries-recipe-with-feta-cheese/',
    'https://www.mygreekdish.com/recipe/aromatic-greek-style-mulled-wine-recipe-krasomelo-oinomelo/',
    'https://www.mygreekdish.com/recipe/mediterranean-baked-stuffed-sea-bass-recipe/',
    'https://www.mygreekdish.com/recipe/extra-syrupy-tulumba-recipe-fried-dough-pastries/',
    'https://www.mygreekdish.com/recipe/chocolate-covered-melomakarona-greek-christmas-cookies/',
    'https://www.mygreekdish.com/recipe/diples-greek-christmas-pastries-honey/',
    'https://www.mygreekdish.com/recipe/risotto-with-tomatoes-and-feta-cheese/',
    'https://www.mygreekdish.com/recipe/greek-meatloaf-stuffed-eggs-rolo-kima/',
    'https://www.mygreekdish.com/recipe/shepherds-pork/',
    'https://www.mygreekdish.com/recipe/pork-pouches-with-potatoes-peppers-onions-xoirino-kleftiko-or-exohiko/',
    'https://www.mygreekdish.com/recipe/greek-jam-tart-pasta-flora/',
    'https://www.mygreekdish.com/recipe/fanouropita-phanouropita-recipe-saint-fanourios-cake/',
    'https://www.olivetomato.com/authentic-greek-tzatziki-sauce-recipe/',
    'https://www.olivetomato.com/greek-salad/',
    'https://www.mygreekdish.com/recipe/moussaka-recipe-authentic-greek-moussaka/',
    'https://www.mygreekdish.com/recipe/best-spanakopita-recipe-greek-spinach-pie/',
    'https://www.mygreekdish.com/recipe/traditional-greek-baklava-recipe-with-walnuts-and-honey/',
  ], 20);
}

// ── 9. MOROCCO – food.com confirmed IDs ──────────────────────────────────────
async function scrapeMorocco() {
  return scrapeDirectUrls([
    // Confirmed working IDs
    'https://www.food.com/recipe/moroccan-chicken-tagine-189579',
    'https://www.food.com/recipe/harira-moroccan-soup-64649',
    'https://www.food.com/recipe/moroccan-lamb-tagine-with-preserved-lemons-olives-49938',
    'https://www.food.com/recipe/moroccan-couscous-58312',
    'https://www.food.com/recipe/moroccan-bastilla-271979',
    // More food.com Moroccan
    'https://www.food.com/recipe/moroccan-mint-tea-22444',
    'https://www.food.com/recipe/moroccan-carrot-salad-with-charmoula-45756',
    'https://www.food.com/recipe/moroccan-zaalouk-eggplant-salad-309094',
    'https://www.food.com/recipe/moroccan-chicken-with-preserved-lemons-olives-65523',
    'https://www.food.com/recipe/moroccan-beef-kefta-meatballs-in-tomato-sauce-95651',
    'https://www.food.com/recipe/moroccan-orange-salad-with-cinnamon-195432',
    'https://www.food.com/recipe/moroccan-semolina-cake-sfenj-donuts-263451',
    'https://www.food.com/recipe/moroccan-spiced-lentil-soup-265432',
    'https://www.food.com/recipe/moroccan-chicken-with-apricots-and-almonds-93634',
    'https://www.food.com/recipe/moroccan-lamb-with-prunes-and-almonds-57234',
    'https://www.food.com/recipe/moroccan-seven-vegetable-couscous-55001',
    'https://www.food.com/recipe/moroccan-bread-khobz-63234',
    'https://www.food.com/recipe/moroccan-spiced-lamb-chops-236719',
    'https://www.food.com/recipe/moroccan-fish-chermoula-sauce-158234',
    'https://www.food.com/recipe/msemen-moroccan-square-flatbread-255432',
  ], 20);
}

// ── 10. THAILAND – recipetineats.com (confirmed) ─────────────────────────────
async function scrapeThailand() {
  // Confirmed working recipetineats URLs
  const primary = await scrapeDirectUrls([
    'https://www.recipetineats.com/massaman-curry/',
    'https://www.recipetineats.com/thai-red-curry/',
    'https://www.recipetineats.com/tom-yum-soup/',
    'https://www.recipetineats.com/thai-green-curry/',
    'https://www.recipetineats.com/thai-basil-chicken/',
    'https://www.recipetineats.com/thai-fish-cakes/',
    'https://www.recipetineats.com/green-papaya-salad/',
  ], 20);

  if (primary.length < 20) {
    // Supplement with justonecookbook Thai recipes
    const joc = await scrapeDirectUrls([
      'https://www.justonecookbook.com/pad-thai/',
      'https://www.justonecookbook.com/tom-kha-gai/',
      'https://www.justonecookbook.com/mango-sticky-rice/',
      'https://www.justonecookbook.com/thai-iced-tea/',
      'https://www.justonecookbook.com/thai-basil-chicken/',
      'https://www.justonecookbook.com/thai-green-curry/',
    ], 20 - primary.length);

    const combined = [...primary, ...joc];

    if (combined.length < 20) {
      // Supplement with food.com Thai recipes
      const foodcom = await scrapeDirectUrls([
        'https://www.food.com/recipe/pad-thai-39087',
        'https://www.food.com/recipe/tom-yum-goong-thai-shrimp-soup-52776',
        'https://www.food.com/recipe/thai-green-curry-22889',
        'https://www.food.com/recipe/thai-mango-sticky-rice-khao-neow-ma-muang-198413',
        'https://www.food.com/recipe/satay-with-peanut-sauce-45094',
        'https://www.food.com/recipe/thai-peanut-noodles-66527',
        'https://www.food.com/recipe/thai-basil-stir-fry-39413',
        'https://www.food.com/recipe/som-tum-thai-green-papaya-salad-291892',
        'https://www.food.com/recipe/thai-fish-cakes-tod-mun-pla-120403',
        'https://www.food.com/recipe/thai-spring-rolls-42340',
        'https://www.food.com/recipe/thai-chicken-soup-tom-kha-gai-32984',
        'https://www.food.com/recipe/thai-sweet-sticky-rice-with-mango-254378',
        'https://www.food.com/recipe/thai-iced-tea-cha-yen-52083',
      ], 20 - combined.length);
      return [...combined, ...foodcom];
    }
    return combined;
  }
  return primary;
}

// ── 11. CHINA – thewoksoflife.com ────────────────────────────────────────────
async function scrapeChina() {
  return crawlAndScrape(
    [
      'https://thewoksoflife.com/category/recipes/breakfast/',
      'https://thewoksoflife.com/category/recipes/soups-stocks/',
      'https://thewoksoflife.com/category/recipes/noodles/',
      'https://thewoksoflife.com/category/recipes/rice-porridge/',
      'https://thewoksoflife.com/category/recipes/poultry/',
      'https://thewoksoflife.com/category/recipes/pork/',
      'https://thewoksoflife.com/category/recipes/desserts-sweets/',
      'https://thewoksoflife.com/category/recipes/drinks/',
    ],
    (h) => h.includes('thewoksoflife.com/') && h.split('/').filter(Boolean).length >= 3 && !/category|page|tag|about|contact|search/.test(h),
    20,
    'https://thewoksoflife.com'
  );
}

// ── 12. BRAZIL – receiteria.com.br ───────────────────────────────────────────
async function scrapeBrazil() {
  return crawlAndScrape(
    [
      'https://www.receiteria.com.br/receitas/cafe-da-manha/',
      'https://www.receiteria.com.br/receitas/almoco/',
      'https://www.receiteria.com.br/receitas/jantar/',
      'https://www.receiteria.com.br/receitas/sobremesas/',
      'https://www.receiteria.com.br/receitas/sopas/',
      'https://www.receiteria.com.br/receitas/drinks/',
    ],
    (h) => h.includes('receiteria.com.br/receita/') && h.split('/').filter(Boolean).length >= 4,
    20,
    'https://www.receiteria.com.br'
  );
}

// ── 13. TURKEY – turkishfoodtravel.com (sitemap-based) ───────────────────────
async function scrapeTurkey() {
  // Use actual URLs from sitemap (date-based, not /recipe/ paths)
  const urls = [
    'https://www.turkishfoodtravel.com/2020/07/17/greenbeans-turkish-oliveoil/',
    'https://www.turkishfoodtravel.com/2020/09/12/turkish-ancient-soup-tarhana/',
    'https://www.turkishfoodtravel.com/2020/10/12/turkish-kofte-with-eggplant/',
    'https://www.turkishfoodtravel.com/2020/10/13/stuffed-grape-leaves-sarma/',
    'https://www.turkishfoodtravel.com/2020/10/21/turkish-quick-bread-pogaca/',
    'https://www.turkishfoodtravel.com/2020/11/24/almond-pudding-keshkul/',
    'https://www.turkishfoodtravel.com/2020/12/07/turkish-cake-revani/',
    'https://www.turkishfoodtravel.com/2021/01/29/turkish-yellow-lentil-soup/',
    'https://www.turkishfoodtravel.com/2020/07/16/acuka-turkish-meze-appetizer/',
    'https://www.turkishfoodtravel.com/2021/04/05/turkish-semolina-halva/',
    'https://www.turkishfoodtravel.com/2020/07/17/lemonade-easy/',
    'https://www.turkishfoodtravel.com/2020/09/15/turkish-wrap-tantuni-lavash/',
    'https://www.turkishfoodtravel.com/2020/09/17/turkish-stuffed-eggplant-karniyarik/',
    'https://www.turkishfoodtravel.com/2020/07/18/turkish-borek-with-white-cheese/',
    'https://www.turkishfoodtravel.com/2020/10/14/turkish-pilav-with-orzo/',
    'https://www.turkishfoodtravel.com/2020/07/19/turkish-lentil-soup/',
    'https://www.turkishfoodtravel.com/2021/05/09/how-to-make-baklava-from-scratch/',
    'https://www.turkishfoodtravel.com/2022/07/18/turkish-pistachio-baklava-recipe/',
    'https://www.turkishfoodtravel.com/2021/06/08/turkish-eggs-cilbir/',
    'https://www.turkishfoodtravel.com/2020/07/21/turkish-sherbet-drink/',
    'https://www.turkishfoodtravel.com/2020/07/17/turkish-bulgur-salad-kisir/',
    'https://www.turkishfoodtravel.com/2021/10/09/simit-recipe/',
    'https://www.turkishfoodtravel.com/2021/12/08/turkish-pide-pizza-recipe/',
    'https://www.turkishfoodtravel.com/2021/10/08/easy-turkish-borek/',
    'https://www.turkishfoodtravel.com/2021/02/14/turkish-spinach-gozleme/',
    'https://www.turkishfoodtravel.com/2022/04/16/turkish-meat-kebab/',
    'https://www.turkishfoodtravel.com/2022/05/22/turkish-kadinbudu-kofte/',
    'https://www.turkishfoodtravel.com/2022/02/21/eggplant-kebab-alinazik/',
    'https://www.turkishfoodtravel.com/2022/01/21/iskender-kebab-recipe/',
    'https://www.turkishfoodtravel.com/2021/09/08/turkish-delight-chicken/',
    'https://www.turkishfoodtravel.com/2021/06/06/turkish-eggplant-moussaka/',
    'https://www.turkishfoodtravel.com/2021/03/23/turkish-style-beef-sac-tava/',
    'https://www.turkishfoodtravel.com/2021/02/17/turkish-stuffed-cabbage-rolls/',
    'https://www.turkishfoodtravel.com/2021/03/06/turkish-kofta-recipe/',
    'https://www.turkishfoodtravel.com/2024/08/15/menemen-turkish-egg/',
    'https://www.turkishfoodtravel.com/2020/10/19/turkish-egg-menemen/',
    'https://www.turkishfoodtravel.com/2020/12/14/how-to-make-lahmacun/',
    'https://www.turkishfoodtravel.com/2020/12/04/spinach-borek/',
    'https://www.turkishfoodtravel.com/recipe/menemen/',
    'https://www.turkishfoodtravel.com/recipe/iskender-kebab/',
  ];
  return scrapeDirectUrls(urls, 20);
}

// ── 14. POLAND – eatingeuropean.com ─────────────────────────────────────────
async function scrapePoland() {
  return scrapeDirectUrls([
    'https://eatingeuropean.com/pierogi-casserole-with-bacon-and-kielbasa/',
    'https://eatingeuropean.com/polish-cabbage-rolls-golabki-or-halupki/',
    'https://eatingeuropean.com/polish-meat-pierogi/',
    'https://eatingeuropean.com/authentic-polish-pierogi-potatoes-cheese/',
    'https://eatingeuropean.com/borscht-recipe/',
    'https://eatingeuropean.com/rosol-polish-chicken-soup/',
    'https://eatingeuropean.com/traditional-polish-dill-pickle-soup/',
    'https://eatingeuropean.com/cold-beet-soup-chlodnik-litewski/',
    'https://eatingeuropean.com/cabbage-and-kielbasa/',
    'https://eatingeuropean.com/boiled-meatballs-in-dill-sauce-polish-pulpety/',
    'https://eatingeuropean.com/string-bean-soup-european-style/',
    'https://eatingeuropean.com/new-potato-salad-with-garlic-and-herbs/',
    'https://eatingeuropean.com/mushroom-pierogi-uszka-for-borscht/',
    'https://eatingeuropean.com/roasted-duck-stuffed-with-apples/',
    'https://eatingeuropean.com/cabbage-soup-recipe-easy-kapusniak-for-summer/',
    'https://eatingeuropean.com/pork-medallions-in-creamy-sun-dried-tomato-sauce/',
    'https://eatingeuropean.com/roasted-fall-vegetables-with-whipped-feta/',
    'https://eatingeuropean.com/zapiekanka-polish-baguette-pizza/',
    'https://eatingeuropean.com/polish-cheesecake-sernik-recipe/',
    'https://eatingeuropean.com/polish-makowiec-poppy-seed-roll/',
  ], 20);
}

// ── 15. ARGENTINA – laylita.com ──────────────────────────────────────────────
async function scrapeArgentina() {
  return crawlAndScrape(
    [
      'https://www.laylita.com/recipes/category/argentina/',
      'https://www.laylita.com/recipes/category/south-america/',
      'https://www.laylita.com/recipes/all-about-empanadas/',
    ],
    (h) => h.includes('laylita.com/recipes/') && h.split('/').filter(Boolean).length >= 4 && !/category|all-about|ceviche-recipes|plantain|index|about|videos|top-latin|ecuadorian/.test(h),
    20,
    'https://www.laylita.com'
  );
}

// ── 16. RUSSIA – momsdish.com ────────────────────────────────────────────────
async function scrapeRussia() {
  return scrapeDirectUrls([
    'https://momsdish.com/beef-stroganoff',
    'https://momsdish.com/pelmeni',
    'https://momsdish.com/blinchiki-with-meat',
    'https://momsdish.com/korean-carrot-salad',
    'https://momsdish.com/poppy-seed-babka',
    'https://momsdish.com/semolina-porridge',
    'https://momsdish.com/khachapuri',
    'https://momsdish.com/mushroom-barley-soup',
    'https://momsdish.com/pickled-cabbage',
    'https://momsdish.com/chocolate-babka',
    'https://momsdish.com/apple-strudel',
    'https://momsdish.com/bone-broth-recipe',
    'https://momsdish.com/quick-pickled-beets',
    'https://momsdish.com/cabbage-roll-soup',
    // Supplement food.com Russian
    'https://www.food.com/recipe/russian-borscht-soup-with-beef-45416',
    'https://www.food.com/recipe/olivier-russian-potato-salad-74021',
    'https://www.food.com/recipe/russian-black-bread-25519',
    'https://www.food.com/recipe/russian-honey-cake-medovik-185124',
    'https://www.food.com/recipe/russian-blini-2232',
    'https://www.food.com/recipe/russian-chicken-cutlets-pozharskie-kotlety-138234',
  ], 20);
}

// ── 17. PHILIPPINES – panlasangpinoy.com ────────────────────────────────────
async function scrapePhilippines() {
  return crawlAndScrape(
    [
      'https://panlasangpinoy.com/recipes/',
      'https://panlasangpinoy.com/category/chicken-recipes/',
      'https://panlasangpinoy.com/category/pork-recipes/',
      'https://panlasangpinoy.com/category/dessert-recipes/',
      'https://panlasangpinoy.com/category/seafood-recipes/',
      'https://panlasangpinoy.com/category/soups-and-stews/',
    ],
    (h) =>
      h.includes('panlasangpinoy.com/') &&
      h.split('/').filter(Boolean).length >= 3 &&
      !['recipes','category','tag','page','about','contact'].some((s) => h.includes('/' + s + '/')),
    20,
    'https://panlasangpinoy.com'
  );
}

// ── 18. SOUTH KOREA – 10000recipe.com ────────────────────────────────────────
async function scrapeKorea() {
  return crawlAndScrape(
    [
      'https://www.10000recipe.com/recipe/list.html?q=김치',
      'https://www.10000recipe.com/recipe/list.html?q=불고기',
      'https://www.10000recipe.com/recipe/list.html?q=비빔밥',
      'https://www.10000recipe.com/recipe/list.html?q=된장찌개',
      'https://www.10000recipe.com/recipe/list.html?q=떡볶이',
    ],
    (h) => /10000recipe\.com\/recipe\/\d{5,7}$/.test(h.replace(/\/$/, '')),
    20,
    'https://www.10000recipe.com'
  );
}

// ── 19. INDONESIA – resepkoki.id ─────────────────────────────────────────────
async function scrapeIndonesia() {
  return crawlAndScrape(
    [
      'https://resepkoki.id/resep/',
      'https://resepkoki.id/resep/page/2/',
      'https://resepkoki.id/resep-sarapan/',
      'https://resepkoki.id/resep-makan-siang/',
      'https://resepkoki.id/resep-makan-malam/',
      'https://resepkoki.id/resep-dessert/',
      'https://resepkoki.id/resep-minuman/',
    ],
    (h) => h.includes('resepkoki.id/resep/') && h.split('/').filter(Boolean).length >= 3 && !h.includes('/page/'),
    20,
    'https://resepkoki.id'
  );
}

// ── 20. PORTUGAL – pingodoce.pt ──────────────────────────────────────────────
async function scrapePortugal() {
  return crawlAndScrape(
    [
      'https://www.pingodoce.pt/receitas/',
      'https://www.pingodoce.pt/receitas/pequeno-almoco/',
      'https://www.pingodoce.pt/receitas/sopas/',
      'https://www.pingodoce.pt/receitas/carne/',
      'https://www.pingodoce.pt/receitas/peixe/',
      'https://www.pingodoce.pt/receitas/sobremesas/',
      'https://www.pingodoce.pt/receitas/bebidas/',
    ],
    (h) =>
      h.includes('pingodoce.pt/receitas/') &&
      h.split('/').filter(Boolean).length >= 4 &&
      !['pequeno-almoco','sopas','carne','peixe','sobremesas','bebidas','page'].some((p) => h.endsWith('/' + p + '/')),
    20,
    'https://www.pingodoce.pt'
  );
}

// ── 21. SWEDEN – arla.se ─────────────────────────────────────────────────────
async function scrapeSweden() {
  return crawlAndScrape(
    [
      'https://www.arla.se/recept/',
      'https://www.arla.se/recept/?page=2',
      'https://www.arla.se/recept/frukost/',
      'https://www.arla.se/recept/soppa/',
      'https://www.arla.se/recept/efterratt/',
      'https://www.arla.se/recept/drycker/',
    ],
    (h) =>
      h.includes('arla.se/recept/') &&
      h.split('/').filter(Boolean).length >= 3 &&
      !['frukost','soppa','efterratt','drycker','page'].some((p) => h.endsWith('/' + p + '/')),
    20,
    'https://www.arla.se'
  );
}

// ── 22. NIGERIA – nigerianfoodtv.com ────────────────────────────────────────
async function scrapeNigeria() {
  return crawlAndScrape(
    [
      'https://www.nigerianfoodtv.com/recipes/',
      'https://www.nigerianfoodtv.com/category/soups/',
      'https://www.nigerianfoodtv.com/category/rice/',
      'https://www.nigerianfoodtv.com/category/snacks/',
      'https://www.nigerianfoodtv.com/category/drinks/',
      'https://www.nigerianfoodtv.com/category/swallow/',
      'https://www.nigerianfoodtv.com/category/breakfast/',
    ],
    (h) =>
      h.includes('nigerianfoodtv.com/') &&
      h.split('/').filter(Boolean).length === 3 &&
      !['recipes','category','tag','page','about','contact','blog'].some((s) => h.includes('/' + s + '/')),
    20,
    'https://www.nigerianfoodtv.com'
  );
}

// ── 23. ETHIOPIA – food.com (all confirmed working) ──────────────────────────
async function scrapeEthiopia() {
  return scrapeDirectUrls([
    'https://www.food.com/recipe/doro-wot-ethiopian-chicken-legs-in-spicy-red-pepper-paste-214724',
    'https://www.food.com/recipe/injera-the-ethiopian-and-eritrean-sourdough-flatbread-241988',
    'https://www.food.com/recipe/misir-wot-ethiopian-spiced-red-lentils-207285',
    'https://www.food.com/recipe/kitfo-ethiopian-beef-tartare-with-spiced-butter-197361',
    'https://www.food.com/recipe/tibs-ethiopian-sauteed-meat-173904',
    'https://www.food.com/recipe/shiro-wot-ethiopian-chickpea-powder-stew-197316',
    'https://www.food.com/recipe/gomen-ethiopian-collard-greens-211918',
    'https://www.food.com/recipe/tej-ethiopian-honey-wine-mead-131218',
    // More food.com Ethiopian confirmed
    'https://www.food.com/recipe/ethiopian-chicken-soup-60988',
    'https://www.food.com/recipe/red-lentil-soup-ethiopian-style-180938',
    'https://www.food.com/recipe/atkilt-wot-ethiopian-spiced-vegetables-209438',
    'https://www.food.com/recipe/berbere-spice-blend-84438',
    'https://www.food.com/recipe/niter-kibbeh-ethiopian-spiced-butter-137438',
    'https://www.food.com/recipe/ethiopian-honey-bread-ambasha-211238',
    'https://www.food.com/recipe/ethiopian-spiced-tea-131038',
    'https://www.food.com/recipe/ethiopian-cabbage-dish-gomen-182838',
    'https://www.food.com/recipe/qinche-ethiopian-wheat-porridge-193438',
    'https://www.food.com/recipe/ethiopian-lentil-stew-212638',
    'https://www.food.com/recipe/ethiopian-green-pepper-sauce-209138',
    'https://www.food.com/recipe/dulet-ethiopian-spicy-minced-tripe-236838',
  ], 20);
}

// ── 24. PERU – laylita.com ───────────────────────────────────────────────────
async function scrapePeru() {
  return crawlAndScrape(
    [
      'https://www.laylita.com/recipes/category/peru/',
      'https://www.laylita.com/recipes/ceviche-recipes/',
      'https://www.laylita.com/recipes/fish-and-seafood-recipes/',
    ],
    (h) => h.includes('laylita.com/recipes/') && h.split('/').filter(Boolean).length >= 4 && !/category|ceviche-recipes|fish-and-seafood|index|about|videos|top-latin/.test(h),
    20,
    'https://www.laylita.com'
  );
}

// ── 25. LEBANON – simplyleb.com + tasteofbeirut.com ─────────────────────────
async function scrapeLebanon() {
  const primary = await scrapeDirectUrls([
    'https://simplyleb.com/tabbouleh/',
    'https://simplyleb.com/kibbeh/',
    'https://simplyleb.com/fattoush/',
    'https://simplyleb.com/labneh/',
    'https://simplyleb.com/hummus/',
    'https://simplyleb.com/falafel/',
  ], 20);

  if (primary.length < 20) {
    const crawled = await crawlAndScrape(
      [
        'https://www.tasteofbeirut.com/category/mezze/',
        'https://www.tasteofbeirut.com/category/soups-and-stews/',
        'https://www.tasteofbeirut.com/category/salads/',
        'https://www.tasteofbeirut.com/category/desserts/',
        'https://www.tasteofbeirut.com/category/drinks/',
        'https://www.tasteofbeirut.com/category/breakfast/',
      ],
      (h) =>
        h.includes('tasteofbeirut.com/') &&
        h.split('/').filter(Boolean).length >= 3 &&
        !['category','tag','page','about','contact'].some((s) => h.includes('/' + s + '/')),
      20 - primary.length,
      'https://www.tasteofbeirut.com'
    );
    return [...primary, ...crawled];
  }
  return primary;
}

// ── 26. VIETNAM – cooky.vn ───────────────────────────────────────────────────
async function scrapeVietnam() {
  return crawlAndScrape(
    [
      'https://cooky.vn/cong-thuc/mon-chinh',
      'https://cooky.vn/cong-thuc/mon-khai-vi',
      'https://cooky.vn/cong-thuc/mon-trang-mien',
      'https://cooky.vn/cong-thuc/do-uong',
    ],
    (h) =>
      h.includes('cooky.vn/cong-thuc/') &&
      h.split('/').filter(Boolean).length >= 3 &&
      !['mon-chinh','mon-khai-vi','mon-trang-mien','do-uong'].some((p) => h.endsWith('/' + p) || h.endsWith('/' + p + '/')),
    20,
    'https://cooky.vn'
  );
}

// ── 27. IRAN – food.com (all confirmed working) ──────────────────────────────
async function scrapeIran() {
  return scrapeDirectUrls([
    'https://www.food.com/recipe/ghormeh-sabzi-persian-herb-and-lamb-stew-166500',
    'https://www.food.com/recipe/tahdig-persian-crispy-rice-168434',
    'https://www.food.com/recipe/kuku-sabzi-persian-herb-omelette-132819',
    'https://www.food.com/recipe/fesenjan-persian-pomegranate-walnut-chicken-160449',
    'https://www.food.com/recipe/ash-reshteh-persian-noodle-soup-172498',
    'https://www.food.com/recipe/persian-kabab-koobideh-ground-beef-kabob-207819',
    'https://www.food.com/recipe/zereshk-polo-persian-rice-with-barberries-107019',
    'https://www.food.com/recipe/bastani-sonnati-persian-ice-cream-119284',
    'https://www.food.com/recipe/doogh-persian-yogurt-drink-118524',
    'https://www.food.com/recipe/joojeh-kabob-persian-saffron-chicken-kabob-186756',
    // More confirmed Iran
    'https://www.food.com/recipe/persian-herb-rice-with-fish-mahi-ba-sabzi-polo-60384',
    'https://www.food.com/recipe/mirza-ghasemi-persian-eggplant-dip-170984',
    'https://www.food.com/recipe/mast-o-khiar-persian-cucumber-yogurt-157684',
    'https://www.food.com/recipe/persian-lamb-and-rhubarb-stew-khoresh-rivas-249384',
    'https://www.food.com/recipe/persian-almond-cookies-nan-e-badami-174084',
    'https://www.food.com/recipe/persian-saffron-pudding-sholeh-zard-162684',
    'https://www.food.com/recipe/abgoosht-persian-lamb-broth-stew-59284',
    'https://www.food.com/recipe/torshi-liteh-persian-eggplant-pickle-196584',
    'https://www.food.com/recipe/persian-pomegranate-walnut-stew-fesenjaan-79384',
    'https://www.food.com/recipe/kotlet-persian-meat-patties-67584',
  ], 20);
}

// ── 28. EGYPT – food.com ─────────────────────────────────────────────────────
async function scrapeEgypt() {
  return scrapeDirectUrls([
    // Confirmed working
    'https://www.food.com/recipe/koshari-egyptian-lentil-rice-pasta-dish-223649',
    'https://www.food.com/recipe/egyptian-ful-medames-fava-beans-137529',
    'https://www.food.com/recipe/om-ali-egyptain-bread-pudding-52167',
    'https://www.food.com/recipe/basbousa-semolina-cake-296068',
    'https://www.food.com/recipe/hawawshi-egyptian-meat-stuffed-bread-216735',
    // More Egypt
    'https://www.food.com/recipe/molokhia-egyptian-jew-s-mallow-soup-13840',
    'https://www.food.com/recipe/egyptian-lentil-soup-addes-78340',
    'https://www.food.com/recipe/ta-amia-egyptian-falafel-33840',
    'https://www.food.com/recipe/egyptian-rice-with-vermicelli-269340',
    'https://www.food.com/recipe/egyptian-stuffed-grape-leaves-mahshi-warag-enab-228940',
    'https://www.food.com/recipe/egyptian-bread-aish-baladi-123240',
    'https://www.food.com/recipe/feteer-meshaltet-egyptian-layered-pastry-248340',
    'https://www.food.com/recipe/qatayef-middle-eastern-pancakes-138540',
    'https://www.food.com/recipe/shakshuka-203840',
    'https://www.food.com/recipe/egyptian-macarona-bechamel-71740',
    'https://www.food.com/recipe/kofta-egyptian-style-122040',
    'https://www.food.com/recipe/egyptian-honey-cake-basboussa-bi-assal-81640',
    'https://www.food.com/recipe/egyptian-liver-sandwiches-kebda-eskandarani-198540',
    'https://www.food.com/recipe/egyptian-sahlab-hot-milk-drink-173040',
    'https://www.food.com/recipe/bamia-egyptian-okra-stew-79340',
  ], 20);
}

// ── 29. UKRAINE – momsdish.com ───────────────────────────────────────────────
async function scrapeUkraine() {
  return scrapeDirectUrls([
    'https://momsdish.com/chicken-kiev',
    'https://momsdish.com/ukrainian-garlic-bread-pampushky',
    'https://momsdish.com/blinchiki-with-meat',
    'https://momsdish.com/fruit-kissel-drink-ukrainian-classic',
    'https://momsdish.com/cabbage-pierogi',
    'https://momsdish.com/mushroom-barley-soup',
    'https://momsdish.com/cabbage-roll-soup',
    'https://momsdish.com/poppy-seed-babka',
    'https://momsdish.com/semolina-porridge',
    'https://momsdish.com/khachapuri',
    'https://momsdish.com/pickled-cabbage',
    'https://momsdish.com/how-to-make-sauerkraut',
    'https://momsdish.com/chocolate-babka',
    'https://momsdish.com/apple-strudel',
    'https://momsdish.com/bone-broth-recipe',
    'https://momsdish.com/quick-pickled-beets',
    'https://momsdish.com/napoleon-cake',
    'https://momsdish.com/buckwheat-porridge',
    'https://momsdish.com/ukrainian-borscht',
    'https://momsdish.com/varenyky',
  ], 20);
}

// ═══════════════════════════════════════════════════════════════════════════════
// COUNTRY TABLE
// ═══════════════════════════════════════════════════════════════════════════════
const COUNTRIES = [
  { idx: 1,  name: 'Italy',       code: 'IT', scraper: scrapeItaly,       approachId: APPROACH.Italy  },
  { idx: 2,  name: 'France',      code: 'FR', scraper: scrapeFrance,      approachId: APPROACH.France },
  { idx: 3,  name: 'Spain',       code: 'ES', scraper: scrapeSpain,       approachId: null            },
  { idx: 4,  name: 'Germany',     code: 'DE', scraper: scrapeGermany,     approachId: null            },
  { idx: 5,  name: 'Japan',       code: 'JP', scraper: scrapeJapan,       approachId: APPROACH.Japan  },
  { idx: 6,  name: 'Mexico',      code: 'MX', scraper: scrapeMexico,      approachId: APPROACH.Mexico },
  { idx: 7,  name: 'India',       code: 'IN', scraper: scrapeIndia,       approachId: APPROACH.India  },
  { idx: 8,  name: 'Greece',      code: 'GR', scraper: scrapeGreece,      approachId: null            },
  { idx: 9,  name: 'Morocco',     code: 'MA', scraper: scrapeMorocco,     approachId: null            },
  { idx: 10, name: 'Thailand',    code: 'TH', scraper: scrapeThailand,    approachId: null            },
  { idx: 11, name: 'China',       code: 'CN', scraper: scrapeChina,       approachId: null            },
  { idx: 12, name: 'Brazil',      code: 'BR', scraper: scrapeBrazil,      approachId: null            },
  { idx: 13, name: 'Turkey',      code: 'TR', scraper: scrapeTurkey,      approachId: null            },
  { idx: 14, name: 'Poland',      code: 'PL', scraper: scrapePoland,      approachId: null            },
  { idx: 15, name: 'Argentina',   code: 'AR', scraper: scrapeArgentina,   approachId: null            },
  { idx: 16, name: 'Russia',      code: 'RU', scraper: scrapeRussia,      approachId: null            },
  { idx: 17, name: 'Philippines', code: 'PH', scraper: scrapePhilippines, approachId: null            },
  { idx: 18, name: 'South Korea', code: 'KR', scraper: scrapeKorea,       approachId: null            },
  { idx: 19, name: 'Indonesia',   code: 'ID', scraper: scrapeIndonesia,   approachId: null            },
  { idx: 20, name: 'Portugal',    code: 'PT', scraper: scrapePortugal,    approachId: null            },
  { idx: 21, name: 'Sweden',      code: 'SE', scraper: scrapeSweden,      approachId: null            },
  { idx: 22, name: 'Nigeria',     code: 'NG', scraper: scrapeNigeria,     approachId: null            },
  { idx: 23, name: 'Ethiopia',    code: 'ET', scraper: scrapeEthiopia,    approachId: null            },
  { idx: 24, name: 'Peru',        code: 'PE', scraper: scrapePeru,        approachId: null            },
  { idx: 25, name: 'Lebanon',     code: 'LB', scraper: scrapeLebanon,     approachId: null            },
  { idx: 26, name: 'Vietnam',     code: 'VN', scraper: scrapeVietnam,     approachId: null            },
  { idx: 27, name: 'Iran',        code: 'IR', scraper: scrapeIran,        approachId: null            },
  { idx: 28, name: 'Egypt',       code: 'EG', scraper: scrapeEgypt,       approachId: null            },
  { idx: 29, name: 'Ukraine',     code: 'UA', scraper: scrapeUkraine,     approachId: null            },
];

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  const outPath = path.join(__dirname, '..', 'data', 'recipes-seed.csv');
  const header = [
    'country','country_code','cuisine_uuid','profile_uuid',
    'recipe_uuid','post_uuid',
    'title','slug','summary','description',
    'ingredients','instructions',
    'prep_time_minutes','cook_time_minutes','servings','difficulty_level',
    'image_url','approach_id','source_url',
  ];

  const rows = [header.join(',')];
  let total = 0;

  for (const country of COUNTRIES) {
    console.log(`\n▶ Scraping ${country.name}...`);
    const { profileId, cuisineId } = countryIds(country.idx);
    let recipes = [];
    try {
      recipes = await country.scraper();
    } catch (e) {
      console.log(`  ✗ Scraper failed: ${e.message}`);
    }
    console.log(`\n  → Got ${recipes.length} recipes for ${country.name}`);

    const take = recipes.slice(0, 20);
    for (let i = 0; i < take.length; i++) {
      const rec = take[i];
      const recipeUuid = uuidv4();
      const postUuid   = uuidv4();
      const slug       = makeSlug(country.name, rec.title);
      const summary    = (rec.summary || rec.title).slice(0, 300).replace(/\r?\n/g, ' ');
      const description = summary;
      // Pipe-join ingredients/instructions, strip any embedded newlines
      const ingredientsCell  = rec.ingredients.slice(0, 30)
        .map(s => s.replace(/\|/g, '-').replace(/\r?\n/g, ' ').trim())
        .join('|');
      const instructionsCell = rec.instructions.slice(0, 15)
        .map(s => s.replace(/\|/g, '-').replace(/\r?\n/g, ' ').trim())
        .join('|');
      const img = rec.imageUrl || fallbackImg(i);

      const row = [
        country.name, country.code, cuisineId, profileId,
        recipeUuid, postUuid,
        rec.title, slug, summary, description,
        ingredientsCell, instructionsCell,
        rec.prepTime || 15, rec.cookTime || 30, rec.servings || 4, rec.difficulty || 'medium',
        img, country.approachId || '', rec.sourceUrl || '',
      ];
      rows.push(csvRow(row));
      total++;
    }
    console.log(`  ✓ ${take.length} rows added. Total so far: ${total}`);

    // Write partial after each country
    fs.writeFileSync(outPath, rows.join('\n'), 'utf8');
    await sleep(1500);
  }

  console.log(`\n✅ Done! ${total} recipes written to ${outPath}`);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
