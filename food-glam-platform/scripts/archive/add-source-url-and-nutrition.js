/**
 * This script:
 * 1. Adds source_url column to posts table
 * 2. Extracts source URLs from summary text and populates source_url
 * 3. Cleans summaries (removes "Source: ..." suffix)
 * 4. Adds estimated nutrition_per_serving to recipe_json for all recipes
 */

const { createClient } = require('@supabase/supabase-js')

// SUPABASE_URL from env — set NEXT_PUBLIC_SUPABASE_URL (production) or LOCAL_SUPABASE_URL (local dev)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.LOCAL_SUPABASE_URL
const supabase = createClient(
  SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// Rough calorie estimates per common ingredient keyword
const CALORIE_MAP = {
  // Proteins
  'chicken': 200, 'beef': 250, 'pork': 250, 'lamb': 250, 'fish': 150, 'salmon': 200,
  'shrimp': 100, 'prawn': 100, 'tofu': 80, 'egg': 70, 'eggs': 140,
  'ground beef': 250, 'ground meat': 250, 'sausage': 300, 'bacon': 200,
  'turkey': 180, 'duck': 250, 'crab': 100, 'lobster': 120, 'tuna': 150,
  'cod': 120, 'tilapia': 120, 'anchov': 50, 'sardine': 150,
  // Dairy
  'butter': 100, 'cream': 80, 'cheese': 110, 'yogurt': 60, 'milk': 50,
  'sour cream': 60, 'cream cheese': 100, 'mozzarella': 80, 'parmesan': 60,
  'coconut milk': 120, 'coconut cream': 150, 'condensed milk': 130,
  // Grains/Starch
  'rice': 200, 'pasta': 200, 'noodle': 200, 'flour': 100, 'bread': 80,
  'tortilla': 120, 'potato': 130, 'sweet potato': 120, 'corn': 100,
  'oat': 100, 'quinoa': 170, 'couscous': 180, 'lentil': 170,
  'chickpea': 180, 'bean': 150, 'black bean': 150, 'kidney bean': 150,
  // Fats/Oils
  'oil': 120, 'olive oil': 120, 'vegetable oil': 120, 'coconut oil': 120,
  'sesame oil': 40, 'ghee': 120, 'lard': 120,
  // Vegetables (low cal)
  'onion': 20, 'garlic': 5, 'tomato': 15, 'pepper': 15, 'carrot': 20,
  'celery': 5, 'cucumber': 5, 'lettuce': 5, 'spinach': 10, 'cabbage': 15,
  'broccoli': 20, 'cauliflower': 15, 'zucchini': 15, 'eggplant': 20,
  'mushroom': 15, 'pea': 40, 'green bean': 15, 'kale': 15,
  // Fruits
  'banana': 90, 'apple': 80, 'mango': 70, 'lemon': 5, 'lime': 5,
  'orange': 60, 'coconut': 80, 'pineapple': 50, 'berry': 30,
  'raisin': 60, 'date': 70, 'plantain': 120,
  // Sugar/Sweet
  'sugar': 60, 'honey': 60, 'maple syrup': 50, 'chocolate': 150,
  'cocoa': 30, 'molasses': 40, 'jam': 50, 'jelly': 50,
  // Nuts/Seeds
  'peanut': 100, 'almond': 80, 'walnut': 80, 'cashew': 80,
  'sesame': 30, 'pistachio': 80, 'hazelnut': 80, 'pine nut': 60,
  'peanut butter': 100, 'tahini': 90,
  // Spices (negligible)
  'salt': 0, 'pepper': 0, 'cumin': 2, 'cinnamon': 2, 'paprika': 2,
  'turmeric': 2, 'ginger': 2, 'chili': 2, 'oregano': 1, 'basil': 1,
  'thyme': 1, 'rosemary': 1, 'coriander': 1, 'cilantro': 1,
  'mint': 1, 'dill': 1, 'parsley': 1, 'bay leaf': 0,
  'vanilla': 5, 'soy sauce': 10, 'fish sauce': 5, 'vinegar': 3,
  'worcestershire': 5, 'mustard': 5, 'ketchup': 15,
}

function estimateNutrition(ingredients, servings) {
  let totalCal = 0
  let totalProtein = 0
  let totalCarbs = 0
  let totalFat = 0

  for (const ing of ingredients) {
    const lower = ing.toLowerCase()
    let matched = false

    // Sort by length descending so "ground beef" matches before "beef"
    const keys = Object.keys(CALORIE_MAP).sort((a, b) => b.length - a.length)
    for (const key of keys) {
      if (lower.includes(key)) {
        const cal = CALORIE_MAP[key]
        totalCal += cal
        // Rough macro split based on ingredient type
        if (['chicken','beef','pork','lamb','fish','salmon','shrimp','prawn','tofu','egg','eggs',
             'turkey','duck','crab','lobster','tuna','cod','tilapia','sardine','ground beef',
             'ground meat','sausage','bacon','anchov'].includes(key)) {
          totalProtein += cal * 0.4 / 4 // 40% protein
          totalCarbs += cal * 0.05 / 4
          totalFat += cal * 0.55 / 9
        } else if (['butter','cream','cheese','oil','olive oil','vegetable oil','coconut oil',
                     'ghee','lard','coconut cream','cream cheese','sesame oil',
                     'peanut','almond','walnut','cashew','pistachio','hazelnut',
                     'peanut butter','tahini','pine nut','coconut'].includes(key)) {
          totalProtein += cal * 0.05 / 4
          totalCarbs += cal * 0.05 / 4
          totalFat += cal * 0.9 / 9
        } else if (['rice','pasta','noodle','flour','bread','tortilla','potato','sweet potato',
                     'corn','oat','quinoa','couscous','sugar','honey','maple syrup',
                     'lentil','chickpea','bean','black bean','kidney bean',
                     'banana','plantain','date','raisin'].includes(key)) {
          totalProtein += cal * 0.1 / 4
          totalCarbs += cal * 0.8 / 4
          totalFat += cal * 0.1 / 9
        } else {
          // Veggies, spices, etc
          totalProtein += cal * 0.2 / 4
          totalCarbs += cal * 0.6 / 4
          totalFat += cal * 0.2 / 9
        }
        matched = true
        break
      }
    }
    if (!matched) {
      // Unknown ingredient, add small default
      totalCal += 30
      totalProtein += 2
      totalCarbs += 4
      totalFat += 1
    }
  }

  const s = servings || 4
  return {
    calories: Math.round(totalCal / s),
    protein: Math.round(totalProtein / s),
    carbs: Math.round(totalCarbs / s),
    fat: Math.round(totalFat / s),
  }
}

function extractSourceUrl(summary) {
  if (!summary) return { url: null, clean: summary }

  // Pattern: "Source: https://..." at the end (possibly truncated with ...)
  const match = summary.match(/\n?\s*Source:\s*(https?:\/\/[^\s]+)/i)
  if (match) {
    let url = match[1].replace(/\.{2,}$/, '') // remove trailing dots from truncation
    const clean = summary.substring(0, match.index).trim()
    return { url, clean }
  }
  return { url: null, clean: summary }
}

async function main() {
  console.log('=== Step 1: Add source_url column ===')

  // Try adding column - won't error if exists due to IF NOT EXISTS in migration
  // We'll use the supabase management API / direct approach
  // Since we can't run raw SQL easily, we'll just proceed - the column might already exist
  // Let's test by trying to read it
  const { data: testRead, error: testErr } = await supabase
    .from('posts')
    .select('source_url')
    .limit(1)

  if (testErr && testErr.message.includes('source_url')) {
    console.log('source_url column does not exist yet. Please run the migration first:')
    console.log('  npx supabase db push')
    console.log('Or run this SQL manually in Supabase Studio (http://127.0.0.1:54323):')
    console.log('  ALTER TABLE posts ADD COLUMN IF NOT EXISTS source_url text;')
    console.log('')
    console.log('Waiting for you to add the column...')
    process.exit(1)
  }
  console.log('source_url column exists ✓')

  console.log('\n=== Step 2: Fetch all recipes ===')
  let allPosts = []
  let offset = 0
  const batchSize = 500

  while (true) {
    const { data, error } = await supabase
      .from('posts')
      .select('id, summary, recipe_json, source_url')
      .eq('type', 'recipe')
      .eq('status', 'active')
      .order('id')
      .range(offset, offset + batchSize - 1)

    if (error) { console.error('Fetch error:', error); break }
    if (!data || data.length === 0) break
    allPosts.push(...data)
    offset += data.length
    if (data.length < batchSize) break
  }

  console.log(`Fetched ${allPosts.length} recipes`)

  console.log('\n=== Step 3: Process recipes ===')
  let urlCount = 0
  let nutritionCount = 0
  let cleanedCount = 0
  let errorCount = 0

  // Process in batches
  const BATCH = 50
  for (let i = 0; i < allPosts.length; i += BATCH) {
    const batch = allPosts.slice(i, i + BATCH)
    const updates = []

    for (const post of batch) {
      const update = { id: post.id }
      let needsUpdate = false

      // Extract source URL
      const { url, clean } = extractSourceUrl(post.summary)
      if (url && !post.source_url) {
        update.source_url = url
        urlCount++
        needsUpdate = true
      }
      if (url && clean !== post.summary) {
        update.summary = clean
        cleanedCount++
        needsUpdate = true
      }

      // Add nutrition to recipe_json
      const rj = post.recipe_json || {}
      if (rj.ingredients && rj.ingredients.length > 0 && !rj.nutrition_per_serving) {
        const nutrition = estimateNutrition(rj.ingredients, rj.servings)
        update.recipe_json = {
          ...rj,
          nutrition_per_serving: nutrition,
        }
        nutritionCount++
        needsUpdate = true
      }

      if (needsUpdate) {
        updates.push(update)
      }
    }

    // Apply updates
    for (const upd of updates) {
      const id = upd.id
      delete upd.id
      const { error } = await supabase
        .from('posts')
        .update(upd)
        .eq('id', id)

      if (error) {
        errorCount++
        if (errorCount <= 3) console.error(`Error updating ${id}:`, error.message)
      }
    }

    process.stdout.write(`\r  Processed ${Math.min(i + BATCH, allPosts.length)} / ${allPosts.length}`)
  }

  console.log('\n')
  console.log('=== Results ===')
  console.log(`Source URLs extracted: ${urlCount}`)
  console.log(`Summaries cleaned: ${cleanedCount}`)
  console.log(`Nutrition added: ${nutritionCount}`)
  console.log(`Errors: ${errorCount}`)
}

main().catch(console.error)
