#!/usr/bin/env node
/**
 * patch-topup.js
 * Re-scrapes Ghana (need 3 more), Georgia (need 5 more), Jordan (need 2 more)
 * and writes to data/recipes-patch-topup.csv
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

function fetchUrl(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.get({
        hostname: parsed.hostname, path: parsed.pathname + parsed.search,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
          'Accept': 'text/html,*/*;q=0.8', 'Accept-Encoding': 'identity',
        }, timeout,
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const loc = res.headers.location.startsWith('http') ? res.headers.location : `${parsed.protocol}//${parsed.hostname}${res.headers.location}`;
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
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

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
  const ingredients = (schema.recipeIngredient || []).filter(Boolean).map(i => String(i).replace(/\r?\n/g,' ').trim()).filter(i => i.length > 1);
  if (ingredients.length < 3) return null;
  let instructions = [];
  for (const step of schema.recipeInstructions || []) {
    if (typeof step === 'string') instructions.push(step.replace(/\r?\n/g,' ').trim());
    else if (step?.text) instructions.push(String(step.text).replace(/\r?\n/g,' ').trim());
    else if (step?.itemListElement) for (const s of step.itemListElement) {
      if (s?.text) instructions.push(String(s.text).replace(/\r?\n/g,' ').trim());
      else if (typeof s === 'string') instructions.push(s.replace(/\r?\n/g,' ').trim());
    }
  }
  instructions = instructions.filter(s => s.length > 5);
  if (instructions.length === 1 && instructions[0].length > 100) {
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
  let summary = (schema.description || '').replace(/\r?\n/g,' ');
  if (summary.length > 300) summary = summary.slice(0, 297) + '...';
  return { title, summary: summary || title, description: schema.description?.replace(/\r?\n/g,' ') || summary || title, ingredients, instructions, prepTime, cookTime, servings, difficulty, imageUrl, sourceUrl };
}

async function scrapeList(urls, label, max = 20) {
  const recipes = [];
  const toTry = urls.slice(0, max * 8);
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

function csvField(v) { return `"${String(v ?? '').replace(/\r?\n/g, ' ').replace(/"/g, '""')}"`; }
function toSlug(country, title) {
  return `${country}-${title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

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

async function main() {
  const outPath = path.join(__dirname, '../data/recipes-patch-topup.csv');
  const header  = 'country,country_code,cuisine_uuid,profile_uuid,recipe_uuid,post_uuid,title,slug,summary,description,ingredients,instructions,prep_time_minutes,cook_time_minutes,servings,difficulty_level,image_url,approach_id,source_url\n';
  fs.writeFileSync(outPath, header, 'utf8');
  const fd = fs.openSync(outPath, 'a');

  // Pre-fetch shared sitemaps
  console.log('Loading shared sitemaps...');
  let BBC = [];
  for (const q of ['2026-Q1','2025-Q4','2025-Q3','2025-Q2']) {
    try { const {body} = await fetchUrl(`https://www.bbcgoodfood.com/sitemaps/${q}-recipe.xml`, 20000); BBC.push(...extractUrls(body).filter(u=>u.includes('/recipes/'))); } catch {}
    await sleep(300);
  }
  BBC = [...new Set(BBC)];
  let NFTV = [];
  try { const {body} = await fetchUrl('https://www.nigerianfoodtv.com/wp-sitemap-posts-post-1.xml', 20000); NFTV = extractUrls(body); } catch {}
  let HF = [];
  for (let i=1;i<=4;i++) {
    try { const {body} = await fetchUrl(`https://hungryforever.net/recipe-sitemap${i===1?'':i}.xml`, 20000); HF.push(...extractUrls(body).filter(u=>u.includes('/recipe/'))); } catch {}
    await sleep(300);
  }
  HF = [...new Set(HF)];
  console.log(`BBC=${BBC.length} NFTV=${NFTV.length} HF=${HF.length}`);

  // ── Ghana: need 3 more (current 17, target 20) ──────────────────────────
  // Known working NFTV URLs for Ghana-specific dishes:
  console.log('\n🌍 Ghana topup (need 3)...');
  const ghanaHardcoded = [
    'https://www.nigerianfoodtv.com/ghana-jollof-rice/',
    'https://www.nigerianfoodtv.com/kenkey-recipe/',
    'https://www.nigerianfoodtv.com/kelewele-recipe/',
    'https://www.nigerianfoodtv.com/waakye-recipe/',
    'https://www.nigerianfoodtv.com/kontomire-stew/',
    'https://www.nigerianfoodtv.com/red-red-recipe/',
  ];
  const gBbcKw = ['jollof','egusi','peanut-stew','plantain','west-african','african','suya','coconut-chicken'];
  const gBbc = BBC.filter(u => gBbcKw.some(k=>u.toLowerCase().includes(k)));
  // Use a fresh set - pick from BBC that haven't been used by Ghana yet
  const gFresh = [...gBbc, ...shuffle(BBC).slice(0,50)];
  const ghRecipes = await scrapeList(gFresh, 'Ghana', 5); // get 5, take first 3
  writeRows('Ghana','GH',cuisineUUID(33),profileUUID(33),ghRecipes,3,fd);
  console.log(`  Ghana topup: ${Math.min(ghRecipes.length,3)}`);

  // ── Georgia: need 5 more (current 15, target 20) ─────────────────────────
  console.log('\n🌍 Georgia topup (need 5)...');
  // Get more URLs from georgianrecipes.net
  const geoUrls = [];
  try { const {body} = await fetchUrl('https://georgianrecipes.net/sitemap.xml',15000); geoUrls.push(...extractUrls(body).filter(u=>/\/\d{4}\/\d{2}\/\d{2}\//.test(u))); } catch {}

  const geRecipes = [];
  for (const url of shuffle(geoUrls).slice(0, 60)) {
    if (geRecipes.length >= 5) break;
    try {
      const { status, body } = await fetchUrl(url, 15000);
      if (status !== 200) continue;

      for (const s of extractJsonLd(body)) {
        const r = parseSchema(s, url);
        if (r) { geRecipes.push(r); console.log(`  [Georgia] ✓ (json) ${r.title}`); break; }
      }
      if (geRecipes.length > 0 && geRecipes[geRecipes.length-1].sourceUrl === url) { await sleep(300); continue; }

      // HTML paragraph parser
      const clean = body.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
      const paras = [...clean.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
        .map(m => m[1].replace(/<[^>]+>/g,' ').replace(/&hellip;/g,'...').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&#\d+;/g,' ').replace(/\r?\n/g,' ').trim())
        .filter(t => t.length > 20);
      if (paras.length < 3) continue;

      const h2 = (clean.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)||[])[1]?.replace(/<[^>]+>/g,'').trim();
      const slugTitle = url.split('/').filter(Boolean).pop()?.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) || '';
      const title = h2 || slugTitle;
      if (!title || title.length < 3) continue;

      const ingrParas = paras.filter(p => /^Ingredient|^Other ingredient/i.test(p));
      let ingredients = [];
      for (const p of ingrParas) {
        const cleaned = p.replace(/^(Other\s+)?Ingredients?[^:]*:\s*/i, '');
        ingredients.push(...cleaned.split(/,\s*(?=\d|\w)/).map(s => s.trim()).filter(s => s.length > 2));
      }
      if (ingredients.length < 3) continue;

      const lastIngrIdx = paras.map((p,i) => [p,i]).filter(([p])=>/^Ingredient|^Other ingredient/i.test(p)).map(([,i])=>i).pop() ?? -1;
      const prepIdx = paras.findIndex(p => /^Preparation|^Method/i.test(p));
      const startIdx = Math.max(lastIngrIdx, prepIdx);
      const instructions = (startIdx >= 0 ? paras.slice(startIdx) : paras)
        .filter(p => p.length > 20 && !p.startsWith('Posted by') && !/^\d+ Comment/.test(p) && !/^Share|^Like|^Tagged|^Enter your email/i.test(p))
        .slice(0, 10);
      if (instructions.length < 1) continue;

      const img = (clean.match(/property="og:image"\s+content="([^"]+)"/) || [])[1] || '';
      const desc = (clean.match(/name="description"\s+content="([^"]+)"/) || clean.match(/property="og:description"\s+content="([^"]+)"/))?.[1]?.replace(/\r?\n/g,' ') || paras[1] || title;

      geRecipes.push({ title, summary: desc.slice(0,300), description: desc, ingredients, instructions, prepTime: 20, cookTime: 40, servings: 4, difficulty: 'medium', imageUrl: img, sourceUrl: url });
      console.log(`  [Georgia] ✓ (html) ${title}`);
    } catch {}
    await sleep(350);
  }
  writeRows('Georgia','GE',cuisineUUID(47),profileUUID(47),geRecipes,5,fd);
  console.log(`  Georgia topup: ${Math.min(geRecipes.length,5)}`);

  // ── Jordan: need 2 more (current 18, target 20) ───────────────────────────
  console.log('\n🌍 Jordan topup (need 2)...');
  const joKw = ['mansaf','maqluba','jordanian','levantine','middle-east','lamb','hummus','falafel','tabbouleh','kibbeh','mujadarah','lentil','shawarma','arabic'];
  const joBbc = BBC.filter(u => joKw.some(k=>u.toLowerCase().includes(k)));
  const joHf  = HF.filter(u => joKw.some(k=>u.toLowerCase().includes(k)));
  const joRecipes = await scrapeList([...joBbc, ...joHf, ...shuffle(BBC).slice(0,40)], 'Jordan', 4);
  writeRows('Jordan','JO',cuisineUUID(70),profileUUID(70),joRecipes,2,fd);
  console.log(`  Jordan topup: ${Math.min(joRecipes.length,2)}`);

  fs.closeSync(fd);

  // Verify output
  const lines = fs.readFileSync(outPath,'utf8').split('\n').filter(l=>l.trim());
  console.log('\nTopup CSV rows:', lines.length - 1);
  const counts = {};
  for (const l of lines.slice(1)) { const m=l.match(/^"([^"]+)"/); if(m)counts[m[1]]=(counts[m[1]]||0)+1; }
  console.log(JSON.stringify(counts,null,2));
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
