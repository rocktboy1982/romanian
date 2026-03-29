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
      const r = c[0]; const title = r.name || ''; if (!title) return null;
      let ing = []; if (Array.isArray(r.recipeIngredient)) ing = r.recipeIngredient.map(s => String(s).trim()).filter(Boolean);
      let ins = [];
      if (Array.isArray(r.recipeInstructions)) r.recipeInstructions.forEach(step => {
        if (typeof step === 'string') ins.push(step.trim());
        else if (step && step.text) ins.push(String(step.text).trim());
      });
      ins = ins.filter(s => s.length > 3);
      const pd = iso => { if (!iso) return 0; const s = String(iso); let m = 0; const h = s.match(/(\d+)H/i), mi = s.match(/(\d+)M/i); if (h) m += parseInt(h[1]) * 60; if (mi) m += parseInt(mi[1]); return m || 0; };
      let img = ''; if (typeof r.image === 'string') img = r.image; else if (r.image && r.image.url) img = r.image.url; else if (Array.isArray(r.image) && r.image[0]) img = typeof r.image[0] === 'string' ? r.image[0] : r.image[0].url || '';
      return { title, summary: String(r.description || '').trim().slice(0, 500) || title, ingredients: ing, instructions: ins, prepTime: pd(r.prepTime), cookTime: pd(r.cookTime || r.totalTime), servings: parseInt(typeof r.recipeYield === 'string' ? r.recipeYield : Array.isArray(r.recipeYield) ? r.recipeYield[0] : '4') || 4, imageUrl: img, sourceUrl };
    }
  }
  return null;
}

function csvCell(v) {
  if (v == null) return '';
  const s = String(v).replace(/\r?\n|\r/g, ' ');
  if (s.includes(',') || s.includes('"')) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function csvRow(arr) { return arr.map(csvCell).join(','); }

const urls = [
  'https://www.food.com/recipe/thai-larb-gai-minced-chicken-salad-58934',
  'https://www.food.com/recipe/thai-coconut-soup-tom-kha-hed-mushroom-108234',
  'https://www.food.com/recipe/thai-pumpkin-soup-gang-fak-tong-181234',
  'https://www.food.com/recipe/thai-cucumber-salad-42934',
];

async function main() {
  const csvPath = 'data/recipes-seed.csv';
  let csv = fs.readFileSync(csvPath, 'utf8');
  const slugs = new Set(csv.split('\n').slice(1).map(l => l.split(',')[7]).filter(Boolean));
  function makeSlug(t) {
    const b = ('Thailand-' + t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
    let s = b, n = 2; while (slugs.has(s)) s = b + '-' + n++; slugs.add(s); return s;
  }

  // Count existing Thailand rows
  const thaiCount = csv.split('\n').filter(l => l.startsWith('Thailand,')).length;
  const need = 20 - thaiCount;
  console.log(`Thailand has ${thaiCount}, need ${need} more`);

  const newLines = [];
  for (const url of urls) {
    if (newLines.length >= need) break;
    try {
      const r = await ax.get(url, { responseType: 'text' });
      const rec = extractJsonLd(r.data, url);
      if (rec && rec.ingredients.length >= 2 && rec.instructions.length >= 1) {
        const ing = rec.ingredients.slice(0, 30).map(s => s.replace(/\|/g, '-').replace(/\r?\n/g, ' ')).join('|');
        const ins = rec.instructions.slice(0, 15).map(s => s.replace(/\|/g, '-').replace(/\r?\n/g, ' ')).join('|');
        const sum = (rec.summary || rec.title).slice(0, 300).replace(/\r?\n/g, ' ');
        newLines.push(csvRow([
          'Thailand', 'TH', 'd10000000-0000-0000-0000-000000000001', 'c10000000-0000-0000-0000-000000000001',
          uuidv4(), uuidv4(), rec.title, makeSlug(rec.title), sum, sum, ing, ins,
          rec.prepTime || 15, rec.cookTime || 30, rec.servings || 4, 'medium', rec.imageUrl || '', '', rec.sourceUrl || '',
        ]));
        console.log('OK:', rec.title);
      } else { console.log('No JSON-LD recipe:', url); }
    } catch (e) { console.log('ERR:', url, e.message); }
    await sleep(700);
  }

  if (newLines.length > 0) {
    fs.writeFileSync(csvPath, csv.trimEnd() + '\n' + newLines.join('\n'), 'utf8');
    console.log('Added', newLines.length, 'Thailand rows');
  }

  // Final count
  const finalCsv = fs.readFileSync(csvPath, 'utf8');
  const finalCount = finalCsv.split('\n').filter(l => l.startsWith('Thailand,')).length;
  console.log('Thailand final count:', finalCount);
}

main().catch(console.error);
