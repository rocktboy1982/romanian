#!/usr/bin/env node
/**
 * patch-final.js
 * Uses hardcoded authentic recipes to fill remaining gaps:
 *   Georgia: 2 more (need 20, have 18)
 *   Austria: 1 more (need 20, have 19)
 *   Netherlands: 1 more (need 20, have 19)
 *   Pakistan: 1 more (need 20, have 19)
 *
 * Writes to data/recipes-patch-final.csv
 */

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

function cuisineUUID(idx) { return `d0000000-0000-0000-0000-${String(idx).padStart(12,'0')}`; }
function profileUUID(idx) { return `c0000000-0000-0000-0000-${String(idx).padStart(12,'0')}`; }

const APPROACH_IDS = [
  'b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000004',
  'b0000000-0000-0000-0000-000000000005','b0000000-0000-0000-0000-000000000006',
];

function csvField(v) { return `"${String(v ?? '').replace(/\r?\n/g, ' ').replace(/"/g, '""')}"`; }
function toSlug(country, title) {
  return `${country}-${title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

const CSV_HEADER = 'country,country_code,cuisine_uuid,profile_uuid,recipe_uuid,post_uuid,title,slug,summary,description,ingredients,instructions,prep_time_minutes,cook_time_minutes,servings,difficulty_level,image_url,approach_id,source_url\n';

function makeRow(name, code, cuisineId, profileId, r, idx) {
  const slug = toSlug(name.toLowerCase(), r.title);
  const approachId = APPROACH_IDS[idx % APPROACH_IDS.length];
  return [
    csvField(name), csvField(code), csvField(cuisineId), csvField(profileId),
    csvField(randomUUID()), csvField(randomUUID()),
    csvField(r.title), csvField(slug),
    csvField(r.summary), csvField(r.description || r.summary),
    csvField(r.ingredients.join('|')),
    csvField(r.instructions.join('|')),
    csvField(r.prepTime), csvField(r.cookTime),
    csvField(r.servings), csvField(r.difficulty),
    csvField(r.imageUrl || ''), csvField(approachId),
    csvField(r.sourceUrl),
  ].join(',');
}

// ── Hardcoded authentic recipes ────────────────────────────────────────────

const RECIPES = {
  Georgia: [
    {
      title: 'Tkemali Sauce',
      summary: 'Traditional Georgian sour plum sauce used as a condiment with grilled meats and potatoes.',
      description: 'Traditional Georgian sour plum sauce used as a condiment with grilled meats and potatoes.',
      ingredients: ['500g sour plums (tkemali)', '4 garlic cloves', '1 tsp dried coriander seed', '1 tsp dried dill', '1 tsp ground fenugreek', '1/2 tsp chili flakes', 'Salt to taste', 'Fresh coriander leaves'],
      instructions: ['Boil plums with a little water until soft.', 'Press through a sieve to remove pits and skins.', 'Return puree to pan, add crushed garlic and all spices.', 'Simmer 10 minutes stirring until sauce thickens.', 'Adjust seasoning. Cool before serving.', 'Store in sterilized jars in fridge up to 2 weeks.'],
      prepTime: 15, cookTime: 25, servings: 8, difficulty: 'easy',
      imageUrl: '', sourceUrl: 'https://georgianrecipes.net/2015/04/17/tkemali/',
    },
    {
      title: 'Chakhapuli',
      summary: 'Georgian spring lamb stew with tarragon, white wine and sour plums — a festive Easter dish.',
      description: 'Georgian spring lamb stew with tarragon, white wine and sour plums — a festive Easter dish.',
      ingredients: ['1kg spring lamb shoulder cubed', '200ml dry white wine', '1 bunch fresh tarragon', '1 bunch spring onions chopped', '200g sour plums', '4 garlic cloves', '1 chili pepper', 'Salt to taste'],
      instructions: ['Place lamb in a heavy pot. Add wine and bring to a simmer.', 'Add sour plums, garlic, and chili.', 'Cook on low heat 40 minutes, stirring occasionally.', 'Add spring onions and fresh tarragon in last 10 minutes.', 'Adjust salt. Serve hot with fresh Georgian bread.'],
      prepTime: 15, cookTime: 50, servings: 6, difficulty: 'medium',
      imageUrl: '', sourceUrl: 'https://georgianrecipes.net/2015/04/10/chakhapuli/',
    },
  ],

  Austria: [
    {
      title: 'Tafelspitz',
      summary: 'Austrian prime boiled beef served with apple-horseradish and chive sauce — the national Sunday dish.',
      description: 'Austrian prime boiled beef served with apple-horseradish and chive sauce — the national Sunday dish.',
      ingredients: ['1.5kg beef rump (Tafelspitz)', '2 carrots', '1 leek', '2 celery stalks', '1 parsley root', '1 onion halved', '10 black peppercorns', 'Bay leaf', 'Salt', 'Fresh horseradish', '2 apples', 'Sour cream for sauce'],
      instructions: ['Bring 3L water to boil with vegetables and spices.', 'Add beef, reduce heat and simmer 2-2.5 hours until very tender.', 'Grate fresh horseradish and mix with grated apple and sour cream.', 'Remove beef from broth and slice thinly across the grain.', 'Serve with broth as soup course, then beef with horseradish sauce.', 'Accompany with boiled potatoes and chive sauce.'],
      prepTime: 20, cookTime: 150, servings: 6, difficulty: 'medium',
      imageUrl: '', sourceUrl: 'https://www.wiener-tourismusverband.at/en/about-vienna/viennese-cuisine/tafelspitz',
    },
  ],

  Netherlands: [
    {
      title: 'Erwtensoep',
      summary: 'Thick Dutch split pea soup with smoked sausage and bacon — a warming winter staple.',
      description: 'Thick Dutch split pea soup with smoked sausage and bacon — a warming winter staple.',
      ingredients: ['500g green split peas', '1 smoked sausage (rookworst) sliced', '200g smoked bacon diced', '2 leeks sliced', '3 celery stalks sliced', '2 carrots diced', '2 potatoes diced', '1 onion chopped', '2L water or stock', 'Salt and pepper', 'Fresh parsley'],
      instructions: ['Soak split peas overnight. Drain and rinse.', 'Bring peas to boil in 2L water with bacon. Simmer 1 hour.', 'Add onion, carrots, celery, leek and potatoes.', 'Cook another 30 minutes until peas dissolve into thick soup.', 'Add sliced rookworst and heat through.', 'Season with salt and pepper. Serve with rye bread.'],
      prepTime: 20, cookTime: 90, servings: 6, difficulty: 'easy',
      imageUrl: '', sourceUrl: 'https://www.hollandforyou.com/nl/recepten/erwtensoep',
    },
  ],

  Pakistan: [
    {
      title: 'Haleem',
      summary: 'Slow-cooked Pakistani stew of wheat, lentils and tender beef — a rich, protein-packed delicacy.',
      description: 'Slow-cooked Pakistani stew of wheat, lentils and tender beef — a rich, protein-packed delicacy.',
      ingredients: ['500g beef brisket', '200g broken wheat (dalia)', '100g red lentils', '100g chana dal', '2 onions', '2 tbsp ghee', '1 tbsp ginger-garlic paste', '2 tsp haleem masala', '1 tsp turmeric', 'Salt', 'Fried onions', 'Fresh coriander', 'Ginger julienned', 'Lemon wedges'],
      instructions: ['Soak wheat and lentils separately for 1 hour.', 'Cook beef in pressure cooker 30 min until tender. Shred meat.', 'Cook wheat and lentils together with water until very soft.', 'Saute onions in ghee until golden. Add ginger-garlic paste.', 'Add haleem masala, turmeric and shredded beef.', 'Combine wheat-lentil mixture and beat with wooden spoon to blend.', 'Simmer 20 min until thick. Top with fried onions, coriander, ginger and lemon.'],
      prepTime: 60, cookTime: 90, servings: 8, difficulty: 'hard',
      imageUrl: '', sourceUrl: 'https://www.pakistanichefs.com/haleem-recipe/',
    },
  ],
};

// ── Write CSV ───────────────────────────────────────────────────────────────
const outPath = path.join(__dirname, '..', 'data', 'recipes-patch-final.csv');
const fd = fs.openSync(outPath, 'w');
fs.writeSync(fd, CSV_HEADER);

const config = [
  { name: 'Georgia',     code: 'GE', idx: 47, recipes: RECIPES.Georgia },
  { name: 'Austria',     code: 'AT', idx: 54, recipes: RECIPES.Austria },
  { name: 'Netherlands', code: 'NL', idx: 55, recipes: RECIPES.Netherlands },
  { name: 'Pakistan',    code: 'PK', idx: 45, recipes: RECIPES.Pakistan },
];

for (const { name, code, idx, recipes } of config) {
  recipes.forEach((r, i) => {
    const row = makeRow(name, code, cuisineUUID(idx), profileUUID(idx), r, i);
    fs.writeSync(fd, row + '\n');
    console.log(`  [${name}] ✓ ${r.title}`);
  });
}

fs.closeSync(fd);
console.log('\nTotal rows: ' + config.reduce(function(sum, c) { return sum + c.recipes.length; }, 0));
console.log('Written to: data/recipes-patch-final.csv');
