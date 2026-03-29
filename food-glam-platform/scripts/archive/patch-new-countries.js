#!/usr/bin/env node
/**
 * patch-new-countries.js - Patched scraper for missing/incomplete countries.
 * Pre-fetches all shared sitemaps ONCE to avoid duplicate network calls.
 *
 * Countries: NZ(31), ZA(32), GH(33), KE(34), JM(38), CU(39), GE(47),
 *            SA(49), AE(50), JO(70), NP(71), + topup AT(54), NL(55), PK(45)
 */

const https  = require('https');
const http   = require('http');
const { URL } = require('url');
const fs     = require('fs');
const path   = require('path');
const { randomUUID } = require('crypto');

function cuisineUUID(idx) { return `d0000000-0000-0000-0000-${String(idx).padStart(12,'0')}`; }
function profileUUID(idx) { return `c0000000-0000-0000-0000-${String(idx).padStart(12,'0')}`; }

const APPROACH_IDS = [
  'b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000004',
  'b0000000-0000-0000-0000-000000000005','b0000000-0000-0000-0000-000000000006',
];

// ─── HTTP ───────────────────────────────────────────────────────────────────
function fetchUrl(url, timeout = 18000) {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.get({
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'identity',
        },
        timeout,
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const loc = res.headers.location.startsWith('http')
            ? res.headers.location
            : `${parsed.protocol}//${parsed.hostname}${res.headers.location}`;
          return fetchUrl(loc, timeout).then(resolve).catch(reject);
        }
        const c = [];
        res.on('data', d => c.push(d));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(c).toString('utf8') }));
        res.on('error', reject);
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    } catch (e) { reject(e); }
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function extractUrls(xml) {
  return [...xml.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/g)].map(m => m[1]);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function safeFetch(url, timeout = 18000) {
  try { return await fetchUrl(url, timeout); }
  catch { return { status: 0, body: '' }; }
}

async function fetchSitemapUrlsSafe(url) {
  try {
    const { body } = await fetchUrl(url, 20000);
    let urls = extractUrls(body);
    if (urls.some(u => u.endsWith('.xml'))) {
      const sub = [];
      for (const s of urls.filter(u => u.endsWith('.xml')).slice(0, 4)) {
        try { sub.push(...extractUrls((await fetchUrl(s, 15000)).body)); } catch {}
        await sleep(200);
      }
      urls = sub;
    }
    return urls;
  } catch { return []; }
}

// ─── JSON-LD ────────────────────────────────────────────────────────────────
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
        if (item['@graph']) for (const g of item['@graph']) if (g['@type'] === 'Recipe') results.push(g);
      }
    } catch {}
  }
  return results;
}

function parseDuration(d) {
  if (!d) return 0;
  const h = d.match(/(\d+)H/i); const mn = d.match(/(\d+)M/i);
  return (h ? +h[1] * 60 : 0) + (mn ? +mn[1] : 0);
}

function parseSchema(schema, sourceUrl) {
  if (!schema) return null;
  const title = schema.name || '';
  if (!title || title.length < 3) return null;
  const ingredients = (schema.recipeIngredient || []).filter(Boolean).map(i => String(i).trim()).filter(i => i.length > 1);
  if (ingredients.length < 3) return null;
  let instructions = [];
  for (const step of schema.recipeInstructions || []) {
    if (typeof step === 'string') instructions.push(step.trim());
    else if (step?.text) instructions.push(String(step.text).trim());
    else if (step?.itemListElement) for (const s of step.itemListElement) {
      if (s?.text) instructions.push(String(s.text).trim());
      else if (typeof s === 'string') instructions.push(s.trim());
    }
  }
  instructions = instructions.filter(s => s.length > 5);
  // Handle sites that embed all steps in a single HowToStep (e.g. taste.co.za)
  if (instructions.length === 1 && instructions[0].length > 100) {
    // Split by numbered steps: '1. Step\n2. Step' or '1.Step2.Step'
    const split = instructions[0].split(/(?=\d+\.\s)/).map(s => s.trim()).filter(s => s.length > 10);
    if (split.length >= 2) instructions = split;
  }
  if (instructions.length < 1) return null;
  const prepTime = parseDuration(schema.prepTime) || 15;
  const cookTime = parseDuration(schema.cookTime) || 30;
  let servings = 4;
  if (schema.recipeYield) { const n = parseInt(Array.isArray(schema.recipeYield) ? schema.recipeYield[0] : schema.recipeYield); if (!isNaN(n) && n > 0 && n <= 100) servings = n; }
  const total = prepTime + cookTime;
  const difficulty = total <= 30 ? 'easy' : total <= 75 ? 'medium' : 'hard';
  let imageUrl = '';
  if (schema.image) {
    if (typeof schema.image === 'string') imageUrl = schema.image;
    else if (schema.image.url) imageUrl = schema.image.url;
    else if (Array.isArray(schema.image)) imageUrl = typeof schema.image[0] === 'string' ? schema.image[0] : schema.image[0]?.url || '';
  }
  let summary = schema.description || '';
  if (summary.length > 300) summary = summary.slice(0, 297) + '...';
  return { title, summary: summary || title, description: schema.description || summary || title, ingredients, instructions, prepTime, cookTime, servings, difficulty, imageUrl, sourceUrl };
}

async function scrapeList(urls, label, max = 20) {
  const recipes = [];
  const toTry = urls.slice(0, max * 8); // cap: try at most 8x recipes needed
  for (const url of toTry) {
    if (recipes.length >= max) break;
    try {
      const { status, body } = await fetchUrl(url, 15000);
      if (status !== 200) { await sleep(100); continue; }
      for (const s of extractJsonLd(body)) {
        const r = parseSchema(s, url);
        if (r) { recipes.push(r); console.log(`  [${label}] ✓ ${r.title}`); break; }
      }
    } catch {}
    await sleep(250);
  }
  return recipes;
}

// ─── SHARED CACHES (filled in main()) ─────────────────────────────────────
let BBC = [];      // all BBC Good Food recipe URLs
let HF  = [];      // all hungryforever /recipe/ URLs
let RTE = [];      // recipetineats
let RFE = [];      // recipesfromeurope
let NFTV = [];     // nigerianfoodtv

// ─── COUNTRY SCRAPERS ──────────────────────────────────────────────────────

async function doNewZealand() {
  const nzKw = ['pavlova','lamington','anzac','hokey-pokey','kumara','whitebait','afghans','ginger-crunch','new-zealand','kiwi','pumpkin-soup','hangi','rewena'];
  const nzRte = RTE.filter(u => nzKw.some(k => u.toLowerCase().includes(k)));
  const nzBbc = BBC.filter(u => nzKw.some(k => u.toLowerCase().includes(k)));
  // Chelsea sitemap
  const chelseaUrls = await fetchSitemapUrlsSafe('https://www.chelsea.co.nz/sitemap.xml');
  const chelsea = chelseaUrls.filter(u => u.includes('/browse-recipes/')).slice(0, 80);
  console.log(`  NZ: RTE=${nzRte.length} BBC=${nzBbc.length} Chelsea=${chelsea.length}`);
  return scrapeList([...nzRte, ...nzBbc, ...chelsea, ...shuffle(RTE).slice(0, 50)], 'New Zealand');
}

async function doSouthAfrica() {
  // Paginate taste.co.za listing pages
  const urls = new Set();
  for (let page = 1; page <= 12; page++) {
    try {
      const url = page === 1 ? 'https://taste.co.za/recipes/' : `https://taste.co.za/recipes/page/${page}/`;
      const { status, body } = await fetchUrl(url, 18000);
      if (status !== 200) break;
      [...body.matchAll(/href="(https:\/\/taste\.co\.za\/recipes\/[a-z0-9-]+\/)"/g)]
        .map(m => m[1])
        .filter(u => u !== 'https://taste.co.za/recipes/' && !u.includes('/page/') && !u.includes('feed'))
        .forEach(u => urls.add(u));
      console.log(`  taste.co.za page ${page}: total=${urls.size}`);
      if (urls.size >= 60) break;
    } catch { break; }
    await sleep(500);
  }
  return scrapeList(shuffle([...urls]).slice(0, 60), 'South Africa');
}

async function doGhana() {
  const kw = ['jollof','waakye','kenkey','kelewele','fufu','banku','kontomire','red-red','plantain',
    'groundnut','peanut','yam','tilapia','coconut','bofrot','chin-chin','suya','egusi','okra',
    'stew','soup','rice','chicken','beef','fish','beans','palm','spinach','west-african','ghanaian'];
  const ghNftv = NFTV.filter(u => kw.some(k => u.toLowerCase().includes(k)));
  const ghBbc  = BBC.filter(u => kw.some(k => u.toLowerCase().includes(k)));
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
  console.log(`  Ghana: NFTV=${ghNftv.length} BBC=${ghBbc.length}`);
  return scrapeList([...hardcoded, ...ghNftv, ...ghBbc, ...shuffle(NFTV).slice(0, 50)], 'Ghana');
}

async function doKenya() {
  const kw = ['ugali','nyama','sukuma','pilau','mandazi','chapati','githeri','matoke','irio',
    'mukimo','maharagwe','mutura','kachumbari','samosa','biryani','coconut','tilapia',
    'east-african','kenyan','beans'];
  const keNftv = NFTV.filter(u => kw.some(k => u.toLowerCase().includes(k)));
  const keBbc  = BBC.filter(u => kw.some(k => u.toLowerCase().includes(k)));
  const keRte  = RTE.filter(u => ['biryani','coconut-rice','chicken-stew','lamb-stew','pilaf','chapati'].some(k => u.toLowerCase().includes(k)));
  console.log(`  Kenya: NFTV=${keNftv.length} BBC=${keBbc.length} RTE=${keRte.length}`);
  return scrapeList([...keNftv, ...keBbc, ...keRte, ...shuffle(NFTV).slice(0, 50)], 'Kenya');
}

async function doJamaica() {
  const kw = ['jerk','ackee','oxtail','curry-goat','rice-and-peas','escovitch','callaloo','bammy',
    'plantain','rum','jamaican','caribbean','festival','patty','saltfish','brown-stew',
    'rundown','cornmeal','dumpling','scotch-bonnet'];
  const jmBbc = BBC.filter(u => kw.some(k => u.toLowerCase().includes(k)));
  const jmRte = RTE.filter(u => kw.some(k => u.toLowerCase().includes(k)));
  // jamaicancookery.com
  const jcUrls = await fetchSitemapUrlsSafe('https://jamaicancookery.com/wp-sitemap-posts-post-1.xml');
  console.log(`  Jamaica: jc=${jcUrls.length} BBC=${jmBbc.length} RTE=${jmRte.length}`);
  return scrapeList([...jcUrls, ...jmBbc, ...jmRte, ...shuffle(BBC).slice(0, 50)], 'Jamaica');
}

async function doCuba() {
  const kw = ['cuban','ropa-vieja','picadillo','arroz-con-pollo','black-bean','mojo','lechon',
    'vaca-frita','tostones','congri','croquetas','flan','mojito','maduros','caribbean',
    'latin','rum','plantain'];
  const cuBbc = BBC.filter(u => kw.some(k => u.toLowerCase().includes(k)));
  // laylita.com
  const layUrls = await fetchSitemapUrlsSafe('https://www.laylita.com/recipes/sitemap.xml');
  const cuLay  = layUrls.filter(u => kw.some(k => u.toLowerCase().includes(k)));
  // mylatinatable
  const mltUrls = await fetchSitemapUrlsSafe('https://www.mylatinatable.com/post-sitemap.xml');
  const cuMlt  = mltUrls.filter(u => kw.some(k => u.toLowerCase().includes(k)));
  console.log(`  Cuba: BBC=${cuBbc.length} laylita=${cuLay.length} mlt=${cuMlt.length}`);
  return scrapeList([...cuBbc, ...cuLay, ...cuMlt, ...shuffle([...layUrls, ...BBC]).slice(0, 60)], 'Cuba');
}

async function doGeorgia() {
  // georgianrecipes.net - no JSON-LD, parse paragraphs
  const geoUrls = [];
  for (let i = 1; i <= 4; i++) {
    const u = i === 1 ? 'https://georgianrecipes.net/sitemap.xml' : `https://georgianrecipes.net/sitemap${i}.xml`;
    try {
      const { body } = await fetchUrl(u, 15000);
      const urls = extractUrls(body).filter(u => /\/\d{4}\/\d{2}\/\d{2}\//.test(u));
      geoUrls.push(...urls);
      if (urls.length === 0 && i > 1) break;
    } catch {}
    await sleep(400);
  }
  // Try WP sitemap too
  try {
    const { body } = await fetchUrl('https://georgianrecipes.net/wp-sitemap-posts-post-1.xml', 12000);
    geoUrls.push(...extractUrls(body));
  } catch {}
  console.log(`  Georgia: ${geoUrls.length} URLs found`);

  const recipes = [];
  for (const url of shuffle([...new Set(geoUrls)]).slice(0, 80)) {
    if (recipes.length >= 20) break;
    try {
      const { status, body } = await fetchUrl(url, 18000);
      if (status !== 200) continue;

      // Try JSON-LD first
      let found = false;
      for (const s of extractJsonLd(body)) {
        const r = parseSchema(s, url);
        if (r) { recipes.push(r); console.log(`  [Georgia] ✓ (json) ${r.title}`); found = true; break; }
      }
      if (found) { await sleep(400); continue; }

      // HTML paragraph parser
      const clean = body.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
      const paras = [...clean.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
        .map(m => m[1].replace(/<[^>]+>/g, ' ').replace(/&hellip;/g,'...').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&#\d+;/g,' ').trim())
        .filter(t => t.length > 20);
      if (paras.length < 3) continue;

      // Title: try h2 first (post title), then derive from URL slug
      const h2 = (clean.match(/<h2[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\.\s\S]*?)<\/h2>/i)||clean.match(/<h2[^>]*>([\.\s\S]*?)<\/h2>/i)||[])[1]?.replace(/<[^>]+>/g,'').trim();
      const slugTitle = url.split('/').filter(Boolean).pop()?.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
      const title = h2 || slugTitle || '';
      if (!title || title.length < 3) continue;

      // Gather ALL ingredient paragraphs (some posts have multiple sections)
      const ingrParas = paras.filter(p => /^Ingredient|^Other ingredient/i.test(p));
      let ingredients = [];
      for (const p of ingrParas) {
        const cleaned = p.replace(/^(Other\s+)?Ingredients?[^:]*:\s*/i, '');
        ingredients.push(...cleaned.split(/,\s*(?=\d|\w)/).map(s => s.trim()).filter(s => s.length > 2));
      }
      if (ingredients.length < 3) continue;

      // Instructions: paragraphs that start with 'Preparation' OR appear after ingredients
      const lastIngrIdx = paras.map((p,i) => [p,i]).filter(([p]) => /^Ingredient|^Other ingredient/i.test(p)).map(([,i]) => i).pop() ?? -1;
      const prepIdx = paras.findIndex(p => /^Preparation|^Method/i.test(p));
      const startIdx = Math.max(lastIngrIdx, prepIdx);
      const instructions = (startIdx >= 0 ? paras.slice(startIdx) : paras)
        .filter(p => p.length > 20 && !p.startsWith('Posted by') && !/^\d+ Comment/.test(p) && !/^Share|^Like|^Tagged/i.test(p))
        .slice(0, 15);
      if (instructions.length < 1) continue;

      const img = clean.match(/property="og:image"\s+content="([^"]+)"/) || clean.match(/<img[^>]+src="(https?:\/\/[^"]+\.(jpg|jpeg|png|webp))/i);
      const desc = (clean.match(/name="description"\s+content="([^"]+)"/) || clean.match(/property="og:description"\s+content="([^"]+)"/))?.[1] || paras[1] || title;

      recipes.push({ title, summary: desc.slice(0,300), description: desc, ingredients, instructions, prepTime: 20, cookTime: 40, servings: 4, difficulty: 'medium', imageUrl: img?.[1] || '', sourceUrl: url });
      console.log(`  [Georgia] ✓ (html) ${title}`);
    } catch {}
    await sleep(400);
  }
  return recipes;
}

async function doSaudiArabia() {
  const kw = ['kabsa','mandi','harees','machboos','jareesh','madfoon','lamb','arabic','gulf',
    'saudi','rice','chicken','biryani','haleem','kebab','shawarma','hummus','falafel',
    'curry','nihari','pilaf','kofta','mutton'];
  const saHf  = HF.filter(u => kw.some(k => u.toLowerCase().includes(k)));
  const saBbc = BBC.filter(u => kw.some(k => u.toLowerCase().includes(k)));
  console.log(`  Saudi: HF=${saHf.length} BBC=${saBbc.length}`);
  return scrapeList([...saHf, ...saBbc, ...shuffle(HF).slice(0, 80)], 'Saudi Arabia');
}

async function doUAE() {
  const kw = ['machboos','harees','luqaimat','balaleet','khameer','shawarma','falafel','hummus',
    'ouzi','arabic','emirati','gulf','middle-east','lamb','biryani','chicken','rice',
    'kebab','curry','pilaf','haleem','mutton','kofta'];
  const uaeHf  = HF.filter(u => kw.some(k => u.toLowerCase().includes(k)));
  const uaeBbc = BBC.filter(u => kw.some(k => u.toLowerCase().includes(k)));
  console.log(`  UAE: HF=${uaeHf.length} BBC=${uaeBbc.length}`);
  return scrapeList([...uaeHf, ...uaeBbc, ...shuffle(HF).slice(0, 80)], 'UAE');
}

async function doJordan() {
  const kw = ['mansaf','maqluba','jordanian','jordan','zarb','musakhan','arayes','kunafa','makdous',
    'fatteh','levantine','middle-east','lamb','chicken','hummus','falafel','tabbouleh',
    'kibbeh','mujadarah','lentil','shawarma'];
  const joHf  = HF.filter(u => kw.some(k => u.toLowerCase().includes(k)));
  const joBbc = BBC.filter(u => kw.some(k => u.toLowerCase().includes(k)));
  console.log(`  Jordan: HF=${joHf.length} BBC=${joBbc.length}`);
  return scrapeList([...joHf, ...joBbc, ...shuffle(HF).slice(0, 80)], 'Jordan');
}

async function doNepal() {
  const kw = ['nepali','nepal','dal-bhat','momo','thukpa','chatamari','gundruk','dhido','kwati',
    'sel-roti','achar','himalayan','tibetan','dal','lentil','rice','chicken','lamb','curry','biryani'];
  const npBbc = BBC.filter(u => kw.some(k => u.toLowerCase().includes(k)));
  const npHf  = HF.filter(u => kw.some(k => u.toLowerCase().includes(k)));
  const cwn = await fetchSitemapUrlsSafe('https://www.cookwithnabeela.com/recipe-sitemap1.xml');
  const npCwn = cwn.filter(u => kw.some(k => u.toLowerCase().includes(k)));
  // recipesaresimple
  let rasUrls = [];
  for (let i = 1; i <= 3; i++) {
    const u = i === 1 ? 'https://www.recipesaresimple.com/recipe-sitemap.xml' : `https://www.recipesaresimple.com/recipe-sitemap${i}.xml`;
    try { rasUrls.push(...(await fetchSitemapUrlsSafe(u)).filter(u => u.includes('/recipe/'))); } catch {}
    await sleep(300);
  }
  const npRas = rasUrls.filter(u => kw.some(k => u.toLowerCase().includes(k)));
  console.log(`  Nepal: BBC=${npBbc.length} HF=${npHf.length} CWN=${npCwn.length} RAS=${npRas.length}`);
  return scrapeList([...npBbc, ...npRas, ...npCwn, ...npHf, ...shuffle([...HF, ...cwn]).slice(0, 60)], 'Nepal');
}

async function doAustriaTopup() {
  const kw = ['austrian','austria','schnitzel','kaiserschmarrn','sachertorte','apfelstrudel','strudel','linzer','vanillekipferl'];
  return scrapeList([...RFE.filter(u=>kw.some(k=>u.toLowerCase().includes(k))), ...BBC.filter(u=>kw.some(k=>u.toLowerCase().includes(k))), ...shuffle(RFE).slice(0,30)], 'Austria', 5);
}

async function doNetherlandsTopup() {
  const kw = ['dutch','netherlands','stamppot','stroopwafel','pannenkoek','poffertjes','hutspot','appeltaart','bitterballen','erwtensoep'];
  return scrapeList([...RFE.filter(u=>kw.some(k=>u.toLowerCase().includes(k))), ...BBC.filter(u=>kw.some(k=>u.toLowerCase().includes(k))), ...shuffle(RFE).slice(0,30)], 'Netherlands', 5);
}

async function doPakistanTopup() {
  const cwn34 = [
    ...await fetchSitemapUrlsSafe('https://www.cookwithnabeela.com/recipe-sitemap3.xml'),
    ...await fetchSitemapUrlsSafe('https://www.cookwithnabeela.com/recipe-sitemap4.xml'),
  ];
  return scrapeList(shuffle(cwn34.filter(u=>u.includes('/recipe/'))).slice(0,20), 'Pakistan', 5);
}

// ─── CSV helpers ────────────────────────────────────────────────────────────
function toSlug(country, title) {
  return `${country}-${title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}
function csvField(v) { return `"${String(v ?? '').replace(/\r?\n/g, ' ').replace(/"/g, '""')}"`; }
function writeRows(name, code, cuisineId, profileId, recipes, max, fd) {
  const seen = new Set();
  let count = 0;
  for (const r of recipes) {
    if (count >= max) break;
    const slug = toSlug(name, r.title);
    if (seen.has(slug)) continue;
    seen.add(slug);
    const approachId = APPROACH_IDS[count % APPROACH_IDS.length];
    const row = [
      csvField(name), csvField(code), csvField(cuisineId), csvField(profileId),
      csvField(randomUUID()), csvField(randomUUID()),
      csvField(r.title), csvField(slug),
      csvField(r.summary), csvField(r.description),
      csvField(r.ingredients.join('|')), csvField(r.instructions.join('|')),
      String(Math.max(0, r.prepTime||15)), String(Math.max(0, r.cookTime||30)),
      String(r.servings||4), csvField(r.difficulty||'medium'),
      csvField(r.imageUrl||''), csvField(approachId), csvField(r.sourceUrl||''),
    ].join(',');
    fs.writeSync(fd, row + '\n');
    count++;
  }
  return count;
}

// ─── MAIN ───────────────────────────────────────────────────────────────────
async function main() {
  const outPath = path.join(__dirname, '../data/recipes-patch.csv');
  const header  = 'country,country_code,cuisine_uuid,profile_uuid,recipe_uuid,post_uuid,title,slug,summary,description,ingredients,instructions,prep_time_minutes,cook_time_minutes,servings,difficulty_level,image_url,approach_id,source_url\n';
  fs.writeFileSync(outPath, header, 'utf8');
  const fd = fs.openSync(outPath, 'a');

  // ── Pre-fetch shared sitemaps ──────────────────────────────────────────
  console.log('\n📡 Pre-fetching shared sitemaps...');

  console.log('  BBC Good Food (5 quarters)...');
  const bbcSitemaps = [
    'https://www.bbcgoodfood.com/sitemaps/2026-Q1-recipe.xml',
    'https://www.bbcgoodfood.com/sitemaps/2025-Q4-recipe.xml',
    'https://www.bbcgoodfood.com/sitemaps/2025-Q3-recipe.xml',
    'https://www.bbcgoodfood.com/sitemaps/2025-Q2-recipe.xml',
    'https://www.bbcgoodfood.com/sitemaps/2025-Q1-recipe.xml',
  ];
  for (const s of bbcSitemaps) {
    try {
      const { body } = await fetchUrl(s, 20000);
      BBC.push(...extractUrls(body).filter(u => u.includes('/recipes/')));
    } catch {}
    await sleep(300);
  }
  BBC = [...new Set(BBC)];
  console.log(`  BBC: ${BBC.length} recipe URLs`);

  console.log('  hungryforever.net recipe sitemaps (1-8)...');
  for (let i = 1; i <= 8; i++) {
    const url = `https://hungryforever.net/recipe-sitemap${i === 1 ? '' : i}.xml`;
    try {
      const { body } = await fetchUrl(url, 20000);
      HF.push(...extractUrls(body).filter(u => u.includes('/recipe/')));
    } catch {}
    await sleep(300);
  }
  HF = [...new Set(HF)];
  console.log(`  HF: ${HF.length} recipe URLs`);

  console.log('  recipetineats.com...');
  try {
    const { body: b1 } = await fetchUrl('https://www.recipetineats.com/post-sitemap.xml', 20000);
    const { body: b2 } = await fetchUrl('https://www.recipetineats.com/post-sitemap2.xml', 20000);
    RTE = [...new Set([...extractUrls(b1), ...extractUrls(b2)])].filter(u => !u.includes('/blog/') && !u.includes('/category/'));
  } catch {}
  console.log(`  RTE: ${RTE.length} URLs`);

  console.log('  recipesfromeurope.com...');
  try {
    const { body } = await fetchUrl('https://www.recipesfromeurope.com/post-sitemap.xml', 20000);
    RFE = extractUrls(body);
  } catch {}
  console.log(`  RFE: ${RFE.length} URLs`);

  console.log('  nigerianfoodtv.com...');
  try {
    const { body } = await fetchUrl('https://www.nigerianfoodtv.com/wp-sitemap-posts-post-1.xml', 20000);
    NFTV = extractUrls(body);
  } catch {}
  console.log(`  NFTV: ${NFTV.length} URLs`);
  console.log('  ✅ Sitemaps loaded.\n');

  // ── Run scrapers ───────────────────────────────────────────────────────
  const JOBS = [
    { name: 'New Zealand',  code: 'NZ', idx: 31, scraper: doNewZealand,       target: 20 },
    { name: 'South Africa', code: 'ZA', idx: 32, scraper: doSouthAfrica,      target: 20 },
    { name: 'Ghana',        code: 'GH', idx: 33, scraper: doGhana,            target: 20 },
    { name: 'Kenya',        code: 'KE', idx: 34, scraper: doKenya,            target: 20 },
    { name: 'Jamaica',      code: 'JM', idx: 38, scraper: doJamaica,          target: 20 },
    { name: 'Cuba',         code: 'CU', idx: 39, scraper: doCuba,             target: 20 },
    { name: 'Georgia',      code: 'GE', idx: 47, scraper: doGeorgia,          target: 20 },
    { name: 'Saudi Arabia', code: 'SA', idx: 49, scraper: doSaudiArabia,      target: 20 },
    { name: 'UAE',          code: 'AE', idx: 50, scraper: doUAE,              target: 20 },
    { name: 'Jordan',       code: 'JO', idx: 70, scraper: doJordan,           target: 20 },
    { name: 'Nepal',        code: 'NP', idx: 71, scraper: doNepal,            target: 20 },
    { name: 'Austria',      code: 'AT', idx: 54, scraper: doAustriaTopup,     target:  1 },
    { name: 'Netherlands',  code: 'NL', idx: 55, scraper: doNetherlandsTopup, target:  1 },
    { name: 'Pakistan',     code: 'PK', idx: 45, scraper: doPakistanTopup,    target:  1 },
  ];

  const summary = [];
  let totalRows = 0;

  for (const { name, code, idx, scraper, target } of JOBS) {
    console.log(`\n🌍 ${name} (idx=${idx})...`);
    let recipes = [];
    try { recipes = await scraper(); } catch (e) { console.error(`  ERROR: ${e.message}`); }
    const cuisineId = cuisineUUID(idx);
    const profileId = profileUUID(idx);
    const count = writeRows(name, code, cuisineId, profileId, recipes, target, fd);
    summary.push({ name, count, target });
    totalRows += count;
    console.log(`  → ${count}/${target} for ${name}`);
    await sleep(1500);
  }

  fs.closeSync(fd);

  console.log('\n══════════════════════════════════════');
  console.log('PATCH SUMMARY');
  console.log('══════════════════════════════════════');
  for (const s of summary) {
    const mark = s.count >= s.target ? '✅' : s.count > 0 ? `⚠️  ${s.count}/${s.target}` : '❌  0';
    console.log(`  ${mark}  ${s.name}`);
  }
  console.log(`\nTotal rows: ${totalRows}`);
  console.log(`Output: ${outPath}`);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
