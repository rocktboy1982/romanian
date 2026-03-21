#!/usr/bin/env node
'use strict';

/**
 * ai-calorie-audit.js — Use Ollama to estimate accurate calories for all recipes
 * Much more accurate than the static lookup table — AI understands context,
 * portion sizes, and Romanian ingredient names natively.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Load .env.local
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

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const OLLAMA_MODEL = 'aya-expanse:8b';

function ollamaRequest(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: OLLAMA_MODEL, prompt, stream: false,
      keep_alive: '24h',
      options: { temperature: 0.1, num_predict: 200 },
    });
    const timer = setTimeout(() => { req.destroy(); reject(new Error('timeout')); }, 120000);
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
        } catch (e) { reject(new Error('Bad JSON')); }
      });
      res.on('error', e => { clearTimeout(timer); reject(e); });
    });
    req.on('error', e => { clearTimeout(timer); reject(e); });
    req.write(body);
    req.end();
  });
}

async function estimateCaloriesAI(title, ingredients, servings) {
  const prompt = `You are a professional nutritionist. Estimate the nutrition per serving for this recipe.

Recipe: ${title}
Servings: ${servings}
Ingredients:
${ingredients.map((x, i) => `${i + 1}. ${x}`).join('\n')}

Return ONLY a JSON object with these fields (numbers only, no text):
{"calories": X, "protein": X, "carbs": X, "fat": X}

Where X is grams for protein/carbs/fat and kcal for calories. Be accurate based on standard nutritional data. Consider typical portion sizes.`;

  const text = await ollamaRequest(prompt);
  const clean = text.replace(/```(?:json)?\n?/g, '').trim();
  const i = clean.indexOf('{');
  const j = clean.lastIndexOf('}');
  if (i === -1 || j === -1) throw new Error('No JSON');
  const parsed = JSON.parse(clean.slice(i, j + 1));

  if (!parsed.calories || typeof parsed.calories !== 'number' || parsed.calories < 10 || parsed.calories > 5000) {
    throw new Error('Invalid calories: ' + parsed.calories);
  }

  return {
    calories: Math.round(parsed.calories),
    protein: Math.round(parsed.protein || parsed.calories * 0.2 / 4),
    carbs: Math.round(parsed.carbs || parsed.calories * 0.45 / 4),
    fat: Math.round(parsed.fat || parsed.calories * 0.35 / 9),
  };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('AI Calorie Audit — using Ollama ' + OLLAMA_MODEL);

  // Get all recipes
  const { data: recipes } = await supabase
    .from('posts')
    .select('id, title, recipe_json')
    .eq('type', 'recipe')
    .order('created_at', { ascending: false });

  console.log(`${(recipes || []).length} recipes to audit\n`);

  let updated = 0, failed = 0, skipped = 0;

  for (const recipe of (recipes || [])) {
    const json = recipe.recipe_json || {};
    const ingredients = json.ingredients || json.recipeIngredient || [];
    const servings = json.servings || 4;

    if (!Array.isArray(ingredients) || ingredients.length < 2) {
      skipped++;
      continue;
    }

    const ingStrings = ingredients.map(i => typeof i === 'string' ? i : JSON.stringify(i));

    process.stdout.write(`  ${recipe.title.slice(0, 50).padEnd(50)} `);

    try {
      const nutrition = await estimateCaloriesAI(recipe.title, ingStrings, servings);
      const current = json.nutrition_per_serving?.calories || 0;
      const diff = Math.abs(nutrition.calories - current);
      const pctDiff = current > 0 ? Math.round((diff / current) * 100) : 999;

      // Update
      const updatedJson = { ...json, nutrition_per_serving: nutrition };
      const { error } = await supabase
        .from('posts')
        .update({ recipe_json: updatedJson })
        .eq('id', recipe.id);

      if (error) {
        process.stdout.write(`✗ DB error\n`);
        failed++;
      } else {
        const arrow = nutrition.calories > current ? '↑' : nutrition.calories < current ? '↓' : '='
        process.stdout.write(`${current} → ${nutrition.calories} kcal ${arrow} (${pctDiff}% diff)\n`);
        updated++;
      }
    } catch (e) {
      process.stdout.write(`⚠️ ${e.message}\n`);
      failed++;
    }
  }

  console.log(`\nDone: ${updated} updated, ${failed} failed, ${skipped} skipped`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
