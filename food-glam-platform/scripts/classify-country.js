#!/usr/bin/env node
'use strict';

/**
 * classify-country.js — Use Ollama to infer country of origin for untagged recipes.
 *
 * Reads title + ingredients, asks the model to return a single country name.
 * Updates posts.country in Supabase.
 *
 * Usage:
 *   node scripts/classify-country.js              # classify all
 *   node scripts/classify-country.js --dry-run     # preview only
 *   node scripts/classify-country.js --batch 50    # limit batch size
 */

const { createClient } = require('@supabase/supabase-js');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ── Load .env.local ──
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_IDX = process.argv.indexOf('--batch');
const BATCH_SIZE = BATCH_IDX !== -1 ? parseInt(process.argv[BATCH_IDX + 1]) || 100 : 9999;
const MODEL = 'qwen2.5:7b'; // fast, good at classification
// Local Ollama server — HTTP is intentional for loopback connections
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const TIMEOUT = 30000;

// Valid countries for normalization
const VALID_COUNTRIES = new Set([
  'Afghanistan','Albania','Algeria','Argentina','Armenia','Australia','Austria','Azerbaijan',
  'Bahrain','Bangladesh','Barbados','Belarus','Belgium','Benin','Bhutan','Bolivia','Bosnia',
  'Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cambodia','Cameroon',
  'Canada','Chile','China','Colombia','Congo','Costa Rica','Croatia','Cuba','Cyprus',
  'Czech Republic','Denmark','Djibouti','Dominican Republic','East Timor','Ecuador','Egypt',
  'El Salvador','Eritrea','Estonia','Ethiopia','Fiji','Finland','France','Gambia','Georgia',
  'Germany','Ghana','Greece','Guatemala','Guinea','Guyana','Haiti','Hawaii','Honduras',
  'Hong Kong','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel',
  'Italy','Ivory Coast','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kosovo','Kuwait',
  'Kyrgyzstan','Laos','Latvia','Lebanon','Liberia','Libya','Lithuania','Luxembourg',
  'Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Mauritania','Mexico','Moldova',
  'Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia','Nepal','Netherlands',
  'New Zealand','Nicaragua','Niger','Nigeria','North Macedonia','Norway','Oman','Pakistan',
  'Palestine','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal',
  'Puerto Rico','Qatar','Romania','Russia','Rwanda','Samoa','Saudi Arabia','Senegal','Serbia',
  'Sierra Leone','Singapore','Slovakia','Slovenia','Somalia','South Africa','South Korea',
  'Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria','Taiwan','Tajikistan',
  'Tanzania','Thailand','Togo','Tonga','Trinidad','Tunisia','Turkey','Turkmenistan','UAE',
  'Uganda','UK','Ukraine','United States','Uruguay','Uzbekistan','Vanuatu','Venezuela',
  'Vietnam','Yemen','Zambia','Zimbabwe',
]);

function ollamaGenerate(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: MODEL,
      prompt,
      stream: false,
      options: { temperature: 0.1, num_predict: 20 },
    });

    const req = http.request(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: TIMEOUT,
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.response?.trim() || '');
        } catch { reject(new Error('Parse error')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

function normalizeCountry(raw) {
  if (!raw) return null;
  // Clean up response
  let clean = raw.replace(/[.!"\n]/g, '').trim();
  // Direct match
  if (VALID_COUNTRIES.has(clean)) return clean;
  // Case-insensitive match
  for (const c of VALID_COUNTRIES) {
    if (c.toLowerCase() === clean.toLowerCase()) return c;
  }
  // Common aliases
  const aliases = {
    'united kingdom': 'UK', 'england': 'UK', 'britain': 'UK', 'great britain': 'UK', 'scottish': 'UK', 'welsh': 'UK',
    'united states': 'United States', 'usa': 'United States', 'us': 'United States', 'american': 'United States', 'america': 'United States',
    'south korea': 'South Korea', 'korea': 'South Korea',
    'uae': 'UAE', 'united arab emirates': 'UAE',
    'middle east': 'Lebanon', 'middle eastern': 'Lebanon',
    'international': null, 'unknown': null, 'global': null, 'various': null, 'fusion': null,
  };
  const lower = clean.toLowerCase();
  if (lower in aliases) return aliases[lower];
  // Partial match
  for (const c of VALID_COUNTRIES) {
    if (lower.includes(c.toLowerCase()) || c.toLowerCase().includes(lower)) return c;
  }
  return null;
}

async function main() {
  console.log(DRY_RUN ? '🔍 DRY RUN\n' : '🚀 Classifying countries with Ollama...\n');
  console.log(`Model: ${MODEL} | Batch: ${BATCH_SIZE}\n`);

  // Fetch untagged recipes
  let all = [];
  let from = 0;
  while (all.length < BATCH_SIZE) {
    const limit = Math.min(1000, BATCH_SIZE - all.length);
    const { data, error } = await supabase.from('posts')
      .select('id, title, slug, recipe_json')
      .is('country', null)
      .neq('type', 'cocktail')
      .range(from, from + limit - 1);
    if (error) { console.error('Fetch error:', error); return; }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < limit) break;
    from += limit;
  }

  console.log(`Recipes to classify: ${all.length}\n`);

  let updated = 0;
  let failed = 0;
  const countryStats = {};

  for (let i = 0; i < all.length; i++) {
    const post = all[i];
    const rj = typeof post.recipe_json === 'string' ? JSON.parse(post.recipe_json) : post.recipe_json;

    // Build ingredient list (first 5)
    const ingredients = (rj?.ingredients || [])
      .slice(0, 5)
      .map(ing => typeof ing === 'string' ? ing.slice(0, 60) : (ing?.name || '').slice(0, 60))
      .filter(Boolean)
      .join(', ');

    const prompt = `What country does this recipe originate from? Reply with ONLY the country name, nothing else.

Title: ${post.title}
Key ingredients: ${ingredients}

Country:`;

    process.stdout.write(`[${i + 1}/${all.length}] ${post.title?.slice(0, 45)}... `);

    try {
      const response = await ollamaGenerate(prompt);
      const country = normalizeCountry(response);

      if (country) {
        countryStats[country] = (countryStats[country] || 0) + 1;
        if (!DRY_RUN) {
          const { error } = await supabase.from('posts').update({ country }).eq('id', post.id);
          if (error) { process.stdout.write(`✗ DB: ${error.message.slice(0, 30)}\n`); failed++; continue; }
        }
        process.stdout.write(`→ ${country}\n`);
        updated++;
      } else {
        process.stdout.write(`→ ? (raw: "${response.slice(0, 30)}")\n`);
        failed++;
      }
    } catch (e) {
      process.stdout.write(`✗ ${e.message}\n`);
      failed++;
    }
  }

  console.log(`\n✅ Classified: ${updated}`);
  console.log(`⚠️  Failed: ${failed}`);
  console.log(`\nCountry distribution:`);
  Object.entries(countryStats).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => console.log(`  ${c}: ${n}`));
}

main().catch(console.error);
