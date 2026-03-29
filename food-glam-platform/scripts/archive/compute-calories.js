#!/usr/bin/env node
'use strict';

/**
 * compute-calories.js — Batch compute nutrition for all recipes missing calories
 * Uses the calorie engine (USDA kcal/100g lookup + unit conversion)
 */

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

// ── Inline calorie engine (can't import ESM from CJS) ───────────────────────

// USDA kcal per 100g — top 200 ingredients
const KCAL_TABLE = {
  // Proteins
  'chicken breast': 165, 'chicken thigh': 209, 'chicken': 239, 'pui': 239, 'piept de pui': 165,
  'beef': 250, 'vită': 250, 'carne de vită': 250, 'ground beef': 250, 'carne tocată': 250,
  'pork': 242, 'porc': 242, 'carne de porc': 242, 'bacon': 541, 'ham': 145, 'șuncă': 145,
  'lamb': 294, 'miel': 294, 'carne de miel': 294,
  'salmon': 208, 'somon': 208, 'tuna': 130, 'ton': 130, 'shrimp': 99, 'creveți': 99,
  'fish': 206, 'pește': 206, 'cod': 82, 'tilapia': 96,
  'egg': 155, 'eggs': 155, 'ou': 155, 'ouă': 155,
  'tofu': 76, 'tempeh': 192,
  // Dairy
  'milk': 42, 'lapte': 42, 'cream': 340, 'frișcă': 340, 'smântână': 193,
  'butter': 717, 'unt': 717, 'cheese': 402, 'brânză': 350, 'cheddar': 402,
  'mozzarella': 280, 'parmesan': 431, 'feta': 264, 'yogurt': 59, 'iaurt': 59,
  'cream cheese': 342, 'ricotta': 174, 'mascarpone': 429,
  // Grains & Pasta
  'rice': 130, 'orez': 130, 'pasta': 131, 'paste': 131, 'spaghetti': 131,
  'bread': 265, 'pâine': 265, 'flour': 364, 'făină': 364, 'oats': 389, 'ovăz': 389,
  'noodles': 138, 'tăiței': 138, 'couscous': 112, 'quinoa': 120, 'bulgur': 83,
  'tortilla': 306, 'pita': 275, 'baghetă': 274,
  // Vegetables
  'potato': 77, 'cartofi': 77, 'sweet potato': 86, 'cartofi dulci': 86,
  'tomato': 18, 'roșii': 18, 'roșie': 18, 'onion': 40, 'ceapă': 40,
  'garlic': 149, 'usturoi': 149, 'carrot': 41, 'morcov': 41, 'morcovi': 41,
  'pepper': 20, 'ardei': 20, 'bell pepper': 31, 'ardei gras': 31,
  'broccoli': 34, 'cauliflower': 25, 'conopidă': 25,
  'spinach': 23, 'spanac': 23, 'kale': 49, 'cabbage': 25, 'varză': 25,
  'zucchini': 17, 'dovlecel': 17, 'eggplant': 25, 'vinete': 25,
  'mushroom': 22, 'ciuperci': 22, 'corn': 86, 'porumb': 86,
  'peas': 81, 'mazăre': 81, 'beans': 127, 'fasole': 127, 'lentils': 116, 'linte': 116,
  'chickpeas': 164, 'năut': 164, 'cucumber': 15, 'castravete': 15,
  'lettuce': 15, 'salată': 15, 'celery': 14, 'țelină': 14,
  'avocado': 160, 'beetroot': 43, 'sfeclă': 43,
  // Fruits
  'apple': 52, 'măr': 52, 'banana': 89, 'banană': 89, 'lemon': 29, 'lămâie': 29,
  'lime': 30, 'limetă': 30, 'orange': 47, 'portocală': 47,
  'strawberry': 32, 'căpșuni': 32, 'blueberry': 57, 'afine': 57,
  'mango': 60, 'pineapple': 50, 'ananas': 50, 'coconut': 354, 'cocos': 354,
  'grape': 69, 'struguri': 69, 'watermelon': 30, 'pepene': 30,
  // Oils & Fats
  'olive oil': 884, 'ulei de măsline': 884, 'oil': 884, 'ulei': 884,
  'vegetable oil': 884, 'ulei vegetal': 884, 'coconut oil': 862, 'ulei de cocos': 862,
  'sesame oil': 884, 'ulei de susan': 884,
  // Nuts & Seeds
  'almonds': 579, 'migdale': 579, 'walnuts': 654, 'nuci': 654,
  'peanuts': 567, 'arahide': 567, 'cashews': 553, 'caju': 553,
  'sesame seeds': 573, 'susan': 573, 'chia': 486, 'flax': 534, 'in': 534,
  'peanut butter': 588, 'unt de arahide': 588,
  // Sweeteners
  'sugar': 387, 'zahăr': 387, 'honey': 304, 'miere': 304,
  'maple syrup': 260, 'sirop de arțar': 260, 'brown sugar': 380, 'zahăr brun': 380,
  'chocolate': 546, 'ciocolată': 546, 'cocoa': 228, 'cacao': 228,
  // Condiments
  'soy sauce': 53, 'sos de soia': 53, 'vinegar': 18, 'oțet': 18,
  'mustard': 66, 'muștar': 66, 'ketchup': 112, 'mayonnaise': 680, 'maioneză': 680,
  'salt': 0, 'sare': 0, 'pepper': 251, 'piper': 251,
  // Liquids
  'water': 0, 'apă': 0, 'broth': 5, 'supă': 5, 'stock': 5,
  'coconut milk': 230, 'lapte de cocos': 230, 'wine': 83, 'vin': 83,
  'beer': 43, 'bere': 43,
};

// Unit → grams conversion
const UNIT_TO_GRAMS = {
  'g': 1, 'kg': 1000, 'ml': 1, 'l': 1000, 'dl': 100, 'cl': 10,
  'cană': 240, 'căni': 240, 'cup': 240, 'cups': 240,
  'lingură': 15, 'linguri': 15, 'tbsp': 15, 'tablespoon': 15,
  'linguriță': 5, 'lingurițe': 5, 'tsp': 5, 'teaspoon': 5,
  'oz': 28, 'lb': 454, 'bucată': 100, 'buc': 100,
  'felii': 20, 'felie': 20, 'frunze': 3, 'frunză': 3,
  'căței': 5, 'cățel': 5,
};

function parseAmount(str) {
  const m = str.match(/^(\d+[\.,]?\d*)/);
  if (!m) return null;
  return parseFloat(m[1].replace(',', '.'));
}

function parseUnit(str) {
  const after = str.replace(/^\d+[\.,]?\d*\s*/, '').toLowerCase();
  for (const [unit] of Object.entries(UNIT_TO_GRAMS)) {
    if (after.startsWith(unit + ' ') || after.startsWith(unit + ',') || after === unit) return unit;
  }
  return null;
}

// Romanian → English aliases for lookup resolution
const RO_ALIASES = {
  'pâine': 'bread', 'paine': 'bread', 'baghetă': 'bread', 'bagheta': 'bread', 'loaf': 'bread',
  'murături': 'pickle', 'muraturi': 'pickle', 'murătură': 'pickle',
  'măsline': 'olive', 'masline': 'olive',
  'anșoa': 'anchovy', 'ansoa': 'anchovy', 'anșoare': 'anchovy',
  'busuioc': 'basil', 'emmental': 'cheese', 'cașcaval': 'cheese', 'cascaval': 'cheese',
  'salam': 'salami', 'mortadelle': 'mortadella', 'mortadella': 'mortadella',
  'felii': 'slice', 'fileuri': 'fillet',
  'roșii': 'tomato', 'rosii': 'tomato', 'roșie': 'tomato',
  'ceapă': 'onion', 'ceapa': 'onion', 'cepe': 'onion',
  'usturoi': 'garlic', 'morcov': 'carrot', 'morcovi': 'carrot',
  'ardei': 'pepper', 'ardei gras': 'bell pepper', 'ardei iute': 'chili',
  'spanac': 'spinach', 'varză': 'cabbage', 'varza': 'cabbage',
  'dovlecel': 'zucchini', 'vinete': 'eggplant', 'ciuperci': 'mushroom',
  'mazăre': 'peas', 'mazare': 'peas', 'fasole': 'beans', 'linte': 'lentils',
  'năut': 'chickpeas', 'naut': 'chickpeas',
  'cartofi': 'potato', 'cartof': 'potato', 'cartofi dulci': 'sweet potato',
  'castravete': 'cucumber', 'castraveți': 'cucumber',
  'țelină': 'celery', 'telina': 'celery', 'pătrunjel': 'parsley',
  'coriandru': 'cilantro', 'mentă': 'mint', 'menta': 'mint', 'mărar': 'dill',
  'cimbru': 'thyme', 'rozmarin': 'rosemary', 'oregano': 'oregano',
  'scorțișoară': 'cinnamon', 'scortisoara': 'cinnamon',
  'ghimbir': 'ginger', 'curcuma': 'turmeric', 'chimen': 'cumin',
  'boia': 'paprika', 'paprika': 'paprika',
  'piept de pui': 'chicken breast', 'pulpe de pui': 'chicken thigh',
  'carne de vită': 'beef', 'carne de porc': 'pork', 'carne de miel': 'lamb',
  'carne tocată': 'ground beef', 'cotlet': 'pork chop',
  'cârnați': 'sausage', 'carnati': 'sausage', 'cârnăciori': 'sausage',
  'șuncă': 'ham', 'sunca': 'ham', 'prosciutto': 'ham',
  'somon': 'salmon', 'ton': 'tuna', 'creveți': 'shrimp', 'creveti': 'shrimp',
  'pește': 'fish', 'peste': 'fish', 'calmar': 'squid',
  'ou': 'egg', 'ouă': 'eggs', 'oua': 'eggs', 'albuș': 'egg', 'gălbenuș': 'egg',
  'lapte': 'milk', 'smântână': 'sour cream', 'smantana': 'sour cream',
  'frișcă': 'cream', 'frisca': 'cream', 'unt': 'butter',
  'brânză': 'cheese', 'branza': 'cheese', 'parmezan': 'parmesan',
  'iaurt': 'yogurt', 'ricotta': 'ricotta',
  'orez': 'rice', 'paste': 'pasta', 'spaghete': 'spaghetti', 'tăiței': 'noodles',
  'făină': 'flour', 'faina': 'flour', 'griș': 'semolina',
  'zahăr': 'sugar', 'zahar': 'sugar', 'miere': 'honey',
  'ciocolată': 'chocolate', 'ciocolata': 'chocolate', 'cacao': 'cocoa',
  'ulei de măsline': 'olive oil', 'ulei': 'oil', 'ulei vegetal': 'vegetable oil',
  'oțet': 'vinegar', 'otet': 'vinegar', 'sos de soia': 'soy sauce',
  'muștar': 'mustard', 'mustar': 'mustard', 'maioneză': 'mayonnaise',
  'sare': 'salt', 'piper': 'pepper',
  'nucă de cocos': 'coconut', 'migdale': 'almonds', 'nuci': 'walnuts',
  'arahide': 'peanuts', 'caju': 'cashews', 'susan': 'sesame seeds',
  'lămâie': 'lemon', 'lamaie': 'lemon', 'limetă': 'lime',
  'portocală': 'orange', 'portocala': 'orange',
  'măr': 'apple', 'banană': 'banana', 'banana': 'banana',
  'căpșuni': 'strawberry', 'capsuni': 'strawberry', 'afine': 'blueberry',
  'struguri': 'grape', 'ananas': 'pineapple', 'mango': 'mango',
  'avocado': 'avocado', 'pepene': 'watermelon',
  'praf de copt': 'baking powder', 'drojdie': 'yeast',
  'lapte de cocos': 'coconut milk', 'vin': 'wine', 'bere': 'beer', 'rom': 'rum',
  'apă': 'water', 'apa': 'water', 'supă': 'broth', 'supa': 'broth',
};

// Additional kcal entries for things the main table misses
Object.assign(KCAL_TABLE, {
  'salami': 336, 'mortadella': 311, 'olive': 115, 'pickle': 18,
  'anchovy': 210, 'basil': 22, 'parsley': 36, 'cilantro': 23,
  'mint': 44, 'dill': 43, 'thyme': 101, 'rosemary': 131,
  'cinnamon': 247, 'ginger': 80, 'turmeric': 312, 'cumin': 375,
  'paprika': 282, 'chili': 40, 'baking powder': 53, 'yeast': 325,
  'sausage': 301, 'pork chop': 231, 'squid': 92, 'rum': 231,
  'sour cream': 193, 'semolina': 360, 'slice': 300,
});

function resolveRomanian(name) {
  const n = name.toLowerCase().trim()
    .replace(/,.*$/, '') // strip after comma
    .replace(/\(.*\)/, '') // strip parentheses
    .replace(/\s+(tocat|tocată|tocate|tăiat|tăiate|feliat|ras|rasă|proaspăt|proaspătă|congelat|uscat|uscată|fin|grosier)\b.*/i, '') // strip adjectives
    .trim();
  // Direct alias match
  if (RO_ALIASES[n]) return RO_ALIASES[n];
  // Try each alias as substring — longest match first to avoid partial matches
  const sortedAliases = Object.entries(RO_ALIASES).sort((a, b) => b[0].length - a[0].length);
  for (const [ro, en] of sortedAliases) {
    if (n.includes(ro)) return en;
  }
  return n;
}

function lookupKcal(name) {
  const n = name.toLowerCase().trim();
  // Exact match
  if (KCAL_TABLE[n] !== undefined) return KCAL_TABLE[n];
  // Resolve Romanian → English
  const resolved = resolveRomanian(n);
  if (KCAL_TABLE[resolved] !== undefined) return KCAL_TABLE[resolved];
  // Substring match on both original and resolved
  for (const [key, val] of Object.entries(KCAL_TABLE)) {
    if (n.includes(key) || key.includes(n) || resolved.includes(key) || key.includes(resolved)) return val;
  }
  return null;
}

function estimateIngredientKcal(ingredientStr) {
  const amount = parseAmount(ingredientStr);
  const unit = parseUnit(ingredientStr);
  // Extract name: strip amount and unit
  const name = ingredientStr
    .replace(/^\d+[\.,]?\d*\s*/, '')
    .replace(/^(g|kg|ml|l|dl|cl|cană|căni|cup|cups|lingură|linguri|tbsp|linguriță|lingurițe|tsp|oz|lb|buc|bucată|bucăți)\s+/i, '')
    .replace(/,.*$/, '')
    .trim();

  const kcalPer100g = lookupKcal(name);
  if (kcalPer100g === null) return null;
  if (amount === null) return Math.round(kcalPer100g); // assume 100g portion

  const grams = unit ? amount * (UNIT_TO_GRAMS[unit] || 100) : amount;
  return Math.round((grams / 100) * kcalPer100g);
}

function computeRecipeNutrition(ingredients, servings) {
  let totalKcal = 0;
  let matched = 0;
  for (const ing of ingredients) {
    const kcal = estimateIngredientKcal(ing);
    if (kcal !== null) {
      totalKcal += kcal;
      matched++;
    }
  }
  if (matched === 0) return null;
  const perServing = Math.round(totalKcal / servings);
  // Rough macro estimates based on kcal
  return {
    calories: perServing,
    protein: Math.round(perServing * 0.2 / 4),   // 20% of kcal from protein
    carbs: Math.round(perServing * 0.45 / 4),     // 45% from carbs
    fat: Math.round(perServing * 0.35 / 9),       // 35% from fat
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Computing calories for all recipes...');

  const { data: recipes, error } = await supabase
    .from('posts')
    .select('id, title, recipe_json')
    .eq('type', 'recipe')
    .or('recipe_json->nutrition_per_serving.is.null,recipe_json->nutrition_per_serving->calories.is.null');

  if (error) { console.error(error); return; }

  // Also get recipes where calories = 0 or missing
  const { data: zeroCalRecipes } = await supabase
    .from('posts')
    .select('id, title, recipe_json')
    .eq('type', 'recipe');

  // Recompute ALL recipes (previous calculations were inaccurate)
  const allRecipes = zeroCalRecipes || [];

  console.log(`Found ${allRecipes.length} recipes without calories`);

  let updated = 0;
  let failed = 0;

  for (const recipe of allRecipes) {
    const json = recipe.recipe_json || {};
    const ingredients = json.ingredients || json.recipeIngredient || [];
    const servings = json.servings || 4;

    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      failed++;
      continue;
    }

    // Flatten if ingredients are strings
    const ingStrings = ingredients.map(i => typeof i === 'string' ? i : JSON.stringify(i));
    const nutrition = computeRecipeNutrition(ingStrings, servings);

    if (!nutrition || nutrition.calories === 0) {
      failed++;
      continue;
    }

    const updatedJson = { ...json, nutrition_per_serving: nutrition };
    const { error: updateErr } = await supabase
      .from('posts')
      .update({ recipe_json: updatedJson })
      .eq('id', recipe.id);

    if (updateErr) {
      failed++;
    } else {
      updated++;
      if (updated % 50 === 0) console.log(`  Updated ${updated}...`);
    }
  }

  console.log(`\nDone: ${updated} updated, ${failed} failed/skipped`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
