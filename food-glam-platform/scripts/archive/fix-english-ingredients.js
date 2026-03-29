#!/usr/bin/env node
'use strict';

/**
 * fix-english-ingredients.js — Translate remaining English words in ingredients/titles to Romanian.
 *
 * Uses a fast dictionary replacement first, then Ollama for anything remaining.
 *
 * Usage:
 *   node scripts/fix-english-ingredients.js              # fix all
 *   node scripts/fix-english-ingredients.js --dry-run    # preview
 *   node scripts/fix-english-ingredients.js --batch 50   # limit
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

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_IDX = process.argv.indexOf('--batch');
const BATCH_SIZE = BATCH_IDX !== -1 ? parseInt(process.argv[BATCH_IDX + 1]) || 999 : 9999;

// ── Dictionary: English → Romanian ingredient words ──
const DICT = {
  // Spices & herbs
  'cumin': 'chimion', 'oregano': 'oregano', 'basil': 'busuioc', 'thyme': 'cimbru',
  'rosemary': 'rozmarin', 'parsley': 'pătrunjel', 'cilantro': 'coriandru',
  'dill': 'mărar', 'mint': 'mentă', 'fennel': 'fenicul', 'bay leaf': 'frunză de dafin',
  'bay leaves': 'foi de dafin', 'cinnamon': 'scorțișoară', 'ginger': 'ghimbir',
  'turmeric': 'curcumă', 'paprika': 'boia', 'nutmeg': 'nucșoară',
  'cardamom': 'cardamom', 'saffron': 'șofran', 'cloves': 'cuișoare', 'clove': 'cuișoară',
  'vanilla': 'vanilie', 'chili': 'chili', 'chilli': 'chili', 'mustard': 'muștar',
  'sesame': 'susan', 'bell pepper': 'ardei gras',
  // Proteins
  'chicken': 'pui', 'beef': 'vită', 'pork': 'porc', 'lamb': 'miel', 'veal': 'vițel',
  'duck': 'rață', 'turkey': 'curcan', 'bacon': 'bacon', 'ham': 'șuncă',
  'sausage': 'cârnați', 'prosciutto': 'prosciutto', 'pancetta': 'pancetta',
  'shrimp': 'creveți', 'fish': 'pește', 'salmon': 'somon', 'tuna': 'ton',
  'crab': 'crab', 'lobster': 'homar', 'squid': 'calamar', 'octopus': 'caracatiță',
  'tofu': 'tofu', 'eggs': 'ouă', 'egg': 'ou',
  // Dairy
  'butter': 'unt', 'cream': 'smântână', 'milk': 'lapte', 'cheese': 'brânză',
  'yogurt': 'iaurt',
  // Produce
  'garlic': 'usturoi', 'onion': 'ceapă', 'tomato': 'roșie', 'tomatoes': 'roșii',
  'potato': 'cartof', 'potatoes': 'cartofi', 'carrot': 'morcov', 'celery': 'țelină',
  'cabbage': 'varză', 'spinach': 'spanac', 'lettuce': 'salată verde',
  'broccoli': 'broccoli', 'cauliflower': 'conopidă', 'zucchini': 'dovlecel',
  'eggplant': 'vinete', 'mushroom': 'ciuperci', 'mushrooms': 'ciuperci',
  'cucumber': 'castravete', 'corn': 'porumb', 'peas': 'mazăre',
  'beans': 'fasole', 'lentils': 'linte', 'chickpeas': 'năut', 'chickpea': 'năut',
  'avocado': 'avocado', 'olive': 'măslină', 'olives': 'măsline',
  'lemon': 'lămâie', 'coconut': 'nucă de cocos',
  // Pantry
  'flour': 'făină', 'sugar': 'zahăr', 'salt': 'sare', 'pepper': 'piper',
  'oil': 'ulei', 'vinegar': 'oțet', 'honey': 'miere', 'rice': 'orez',
  'bread': 'pâine', 'sauce': 'sos', 'soy sauce': 'sos de soia', 'juice': 'suc',
  'water': 'apă', 'pasta': 'paste',
  // Nuts
  'peanut': 'arahide', 'peanuts': 'arahide', 'almond': 'migdale', 'almonds': 'migdale',
  'walnut': 'nuci', 'walnuts': 'nuci', 'cashew': 'caju', 'pistachio': 'fistic',
  'hazelnut': 'alune', 'hazelnuts': 'alune', 'pecan': 'pecan',
  // Cooking words in titles
  'Baked': 'Copt', 'Grilled': 'La grătar', 'Roasted': 'Prăjit',
  'Fried': 'Prăjit', 'Steamed': 'Aburit', 'Stuffed': 'Umplut',
  'Crispy': 'Crocant', 'Spicy': 'Picant', 'Smoked': 'Afumat',
  'Fresh': 'Proaspăt', 'Creamy': 'Cremos', 'Sweet': 'Dulce',
  'Traditional': 'Tradițional', 'Classic': 'Clasic',
  'Braised': 'Înăbușit', 'Stir Fry': 'Stir Fry',
  'with': 'cu', 'and': 'și', 'from': 'din', 'Ripe': 'Coapte',
  'Red': 'Roșu', 'Cold': 'Rece', 'Hot': 'Fierbinte',
};

// Build regex sorted by length (longest first for multi-word matches)
const dictKeys = Object.keys(DICT).sort((a, b) => b.length - a.length);
const dictRegex = new RegExp('\\b(' + dictKeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'gi');

function dictReplace(text) {
  return text.replace(dictRegex, (match) => {
    const lower = match.toLowerCase();
    const replacement = DICT[lower] || DICT[match];
    if (!replacement) return match;
    // Preserve case for first letter
    if (match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase()) {
      return replacement.charAt(0).toUpperCase() + replacement.slice(1);
    }
    return replacement;
  });
}

const ENG_CHECK = /\b(butter|sugar|salt|pepper|flour|eggs?|water|oil|chicken|garlic|onion|cream|milk|cheese|lemon|tomato|potato|rice|bread|beef|pork|sauce|juice|honey|vanilla|cinnamon|ginger|parsley|cilantro|basil|oregano|thyme|cumin|bell pepper|cloves?|nutmeg|turmeric|paprika|chili|chilli|bay leaf|bay leaves|rosemary|dill|mint|fennel|cardamom|saffron|mustard|vinegar|soy sauce|sesame|coconut|peanut|almond|walnut|cashew|pistachio|hazelnut|pecan|olive|avocado|cucumber|carrot|celery|cabbage|spinach|lettuce|broccoli|cauliflower|zucchini|eggplant|mushrooms?|corn|peas|beans|lentils|chickpeas?|tofu|shrimp|fish|salmon|tuna|duck|turkey|lamb|veal|bacon|ham|sausage)\b/i;

const ENG_TITLE = /\b(Baked|Grilled|Roasted|Fried|Steamed|Stuffed|Classic|Traditional|Style|Crispy|Spicy|Sweet|Sour|Hot|Cold|Fresh|Creamy|Smoked|Braised|Stir Fry|Ripe|Red|with|and|from)\b/;

async function main() {
  console.log(DRY_RUN ? '🔍 DRY RUN\n' : '🚀 Fixing English ingredients...\n');

  let all = [];
  let from = 0;
  while (all.length < BATCH_SIZE) {
    const { data } = await supabase.from('posts').select('id, title, recipe_json').eq('type', 'recipe').range(from, from + 999);
    if (!data || !data.length) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }

  console.log('Recipes loaded:', all.length);

  let fixedIngredients = 0;
  let fixedTitles = 0;
  let skipped = 0;

  for (let i = 0; i < all.length; i++) {
    const r = all[i];
    const rj = typeof r.recipe_json === 'string' ? JSON.parse(r.recipe_json) : r.recipe_json;
    if (!rj) { skipped++; continue; }

    let changed = false;
    const updates = {};

    // Fix ingredients
    const ings = rj.ingredients || [];
    const fixedIngs = ings.map(ing => {
      if (typeof ing !== 'string') return ing;
      if (!ENG_CHECK.test(ing)) return ing;
      const fixed = dictReplace(ing);
      if (fixed !== ing) { changed = true; fixedIngredients++; }
      return fixed;
    });

    if (changed) {
      rj.ingredients = fixedIngs;
      updates.recipe_json = rj;
    }

    // Fix title
    if (ENG_TITLE.test(r.title)) {
      const fixedTitle = dictReplace(r.title);
      if (fixedTitle !== r.title) {
        updates.title = fixedTitle;
        fixedTitles++;
        changed = true;
      }
    }

    if (changed && !DRY_RUN) {
      const { error } = await supabase.from('posts').update(updates).eq('id', r.id);
      if (error) console.log(`  ✗ ${r.title.slice(0, 40)}: ${error.message.slice(0, 50)}`);
    }

    if (changed && (fixedIngredients + fixedTitles) % 50 === 0) {
      process.stdout.write(`  [${i + 1}/${all.length}] ${fixedIngredients} ingredients, ${fixedTitles} titles fixed\r`);
    }
  }

  console.log(`\n\n✅ Done`);
  console.log(`  Ingredients fixed: ${fixedIngredients}`);
  console.log(`  Titles fixed: ${fixedTitles}`);
  console.log(`  Skipped (no recipe_json): ${skipped}`);
}

main().catch(console.error);
