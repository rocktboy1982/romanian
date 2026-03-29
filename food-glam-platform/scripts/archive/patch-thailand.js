'use strict';
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const ax = axios.create({
  timeout: 25000, maxRedirects: 5,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
  },
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function get(url, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try { const r = await ax.get(url, { responseType: 'text' }); return r.data; }
    catch (e) { if (i === retries) throw e; await sleep(2000 * (i + 1)); }
  }
}

function extractJsonLd(html, sourceUrl) {
  const $ = cheerio.load(html);
  const blocks = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try { blocks.push(JSON.parse($(el).html())); } catch (_) {}
  });
  for (const block of blocks) {
    const c = [];
    if (block && block['@type'] === 'Recipe') c.push(block);
    if (block && Array.isArray(block['@graph'])) block['@graph'].forEach(n => { if (n && n['@type'] === 'Recipe') c.push(n); });
    if (Array.isArray(block)) block.forEach(n => { if (n && n['@type'] === 'Recipe') c.push(n); });
    if (c.length > 0) {
      const r = c[0];
      const title = r.name || ''; if (!title) return null;
      let ing = []; if (Array.isArray(r.recipeIngredient)) ing = r.recipeIngredient.map(s => String(s).trim()).filter(Boolean);
      let ins = [];
      if (Array.isArray(r.recipeInstructions)) r.recipeInstructions.forEach(step => {
        if (typeof step === 'string') ins.push(step.trim());
        else if (step && step.text) ins.push(String(step.text).trim());
      });
      ins = ins.filter(s => s.length > 3);
      const pd = (iso) => { if (!iso) return 0; const s = String(iso); let m = 0; const h = s.match(/(\d+)H/i), mi = s.match(/(\d+)M/i); if (h) m += parseInt(h[1]) * 60; if (mi) m += parseInt(mi[1]); return m || 0; };
      let img = ''; if (typeof r.image === 'string') img = r.image; else if (r.image && r.image.url) img = r.image.url; else if (Array.isArray(r.image) && r.image[0]) img = typeof r.image[0] === 'string' ? r.image[0] : r.image[0].url || '';
      const desc = String(r.description || '').trim().slice(0, 500);
      return { title, summary: desc || title, ingredients: ing, instructions: ins, prepTime: pd(r.prepTime), cookTime: pd(r.cookTime || r.totalTime), servings: parseInt(typeof r.recipeYield === 'string' ? r.recipeYield : Array.isArray(r.recipeYield) ? r.recipeYield[0] : '4') || 4, imageUrl: img, sourceUrl: sourceUrl || '' };
    }
  }
  return null;
}

function csvCell(v) {
  if (v == null) return '';
  const s = String(v).replace(/\r?\n/g, ' ');
  if (s.includes(',') || s.includes('"')) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function csvRow(arr) { return arr.map(csvCell).join(','); }

const urls = [
  'https://www.recipetineats.com/massaman-curry/',
  'https://www.recipetineats.com/thai-red-curry/',
  'https://www.recipetineats.com/tom-yum-soup/',
  'https://www.recipetineats.com/thai-green-curry/',
  'https://www.recipetineats.com/thai-basil-chicken/',
  'https://www.recipetineats.com/thai-fish-cakes/',
  'https://www.recipetineats.com/green-papaya-salad/',
  'https://www.food.com/recipe/pad-thai-39087',
  'https://www.food.com/recipe/tom-yum-goong-thai-shrimp-soup-52776',
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
  'https://www.food.com/recipe/thai-green-curry-22889',
];

async function main() {
  const rows = [];
  const slugs = new Set();
  // Load existing slugs to avoid collisions
  const csv = fs.readFileSync('data/recipes-seed.csv', 'utf8');
  csv.split('\n').slice(1).forEach(line => {
    const parts = line.split(',');
    if (parts[7]) slugs.add(parts[7]);
  });

  function slug(t) {
    const b = ('Thailand-' + t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
    let s = b, n = 2; while (slugs.has(s)) s = b + '-' + n++; slugs.add(s); return s;
  }

  for (const url of urls) {
    if (rows.length >= 20) break;
    try {
      const html = await get(url);
      const rec = extractJsonLd(html, url);
      if (rec && rec.ingredients.length >= 2 && rec.instructions.length >= 1) {
        rows.push(rec); process.stdout.write('.');
      } else process.stdout.write('x');
    } catch (e) { process.stdout.write('x'); }
    await sleep(700);
  }
  console.log('\nGot', rows.length, 'Thailand recipes');

  const newLines = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const ing = r.ingredients.slice(0, 30).map(s => s.replace(/\|/g, '-').replace(/\r?\n/g, ' ').trim()).join('|');
    const ins = r.instructions.slice(0, 15).map(s => s.replace(/\|/g, '-').replace(/\r?\n/g, ' ').trim()).join('|');
    const sum = (r.summary || r.title).slice(0, 300).replace(/\r?\n/g, ' ');
    newLines.push(csvRow([
      'Thailand', 'TH', 'd10000000-0000-0000-0000-000000000001', 'c10000000-0000-0000-0000-000000000001',
      uuidv4(), uuidv4(), r.title, slug(r.title), sum, sum, ing, ins,
      r.prepTime || 15, r.cookTime || 30, r.servings || 4, 'medium', r.imageUrl || '', '', r.sourceUrl || '',
    ]));
  }

  fs.writeFileSync('data/recipes-seed.csv', csv.trimEnd() + '\n' + newLines.join('\n'), 'utf8');
  console.log('Appended', newLines.length, 'Thailand rows to CSV');
}

main().catch(console.error);
