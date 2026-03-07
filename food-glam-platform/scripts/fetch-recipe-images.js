#!/usr/bin/env node
/**
 * fetch-recipe-images.js
 * 
 * Fetches food images for recipes missing hero_image_url.
 * NO API KEYS REQUIRED.
 * 
 * Strategy:
 *   1. TheMealDB (free, no key) — exact match on English dish name
 *   2. Curated Unsplash category mapping — high-quality photos per food category
 * 
 * Progress saved to .image-progress.json — fully resumable.
 * 
 * Usage: node scripts/fetch-recipe-images.js
 */

const { Pool } = require('pg')
const https = require('https')
const fs = require('fs')
const path = require('path')

// ── Config ──────────────────────────────────────────────
const DB = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '54322'),
  user: 'postgres',
  password: 'postgres',
  database: 'postgres',
}

const PROGRESS_FILE = path.join(__dirname, '.image-progress.json')
const DELAY_BETWEEN = 350 // ms between TheMealDB calls (be polite)

// ── Curated Unsplash Images by Food Category ────────────
// Each category has 3-5 high-quality landscape food photos from Unsplash (free to use)
// Format: https://images.unsplash.com/photo-{ID}?auto=format&fit=crop&w=800&q=80

const CATEGORY_IMAGES = {
  chicken: [
    'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1606728035253-49e8a23146de?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?auto=format&fit=crop&w=800&q=80',
  ],
  beef: [
    'https://images.unsplash.com/photo-1546964124-0cce460f38ef?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1603048297172-c92544798d5a?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?auto=format&fit=crop&w=800&q=80',
  ],
  lamb: [
    'https://images.unsplash.com/photo-1514516345957-556ca7d90a29?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1607116667981-ff0c39578b19?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1599921841143-819065a55cc6?auto=format&fit=crop&w=800&q=80',
  ],
  pork: [
    'https://images.unsplash.com/photo-1432139509613-5c4255a78e03?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1529694157872-4e0c0f3b238b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1623653387945-2fd25214f8fc?auto=format&fit=crop&w=800&q=80',
  ],
  fish: [
    'https://images.unsplash.com/photo-1534604973900-c43ab4c2e0ab?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1580476262798-bddd9f4b7369?auto=format&fit=crop&w=800&q=80',
  ],
  seafood: [
    'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1559737558-2f5a35f4523b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1563412885-5f61fbb38a57?auto=format&fit=crop&w=800&q=80',
  ],
  soup: [
    'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1603105037880-880cd4edfb0d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1588566565463-180a5b2090d2?auto=format&fit=crop&w=800&q=80',
  ],
  stew: [
    'https://images.unsplash.com/photo-1534939561126-855b8675edd7?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1617093727343-374698b1b08d?auto=format&fit=crop&w=800&q=80',
  ],
  rice: [
    'https://images.unsplash.com/photo-1536304993881-460e32f50669?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1596560548464-f010549b84d7?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80',
  ],
  noodles: [
    'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1552611052-33e04de891de?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1555126634-323283e090fa?auto=format&fit=crop&w=800&q=80',
  ],
  pasta: [
    'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?auto=format&fit=crop&w=800&q=80',
  ],
  bread: [
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1549931319-a545753467c8?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1585478259715-876acc5be8eb?auto=format&fit=crop&w=800&q=80',
  ],
  salad: [
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1607532941433-304659e8198a?auto=format&fit=crop&w=800&q=80',
  ],
  dessert: [
    'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=800&q=80',
  ],
  cake: [
    'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?auto=format&fit=crop&w=800&q=80',
  ],
  pastry: [
    'https://images.unsplash.com/photo-1517433670267-08bbd4be890f?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1555507036-ab1f4038024a?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=800&q=80',
  ],
  curry: [
    'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1574484284002-952d92456975?auto=format&fit=crop&w=800&q=80',
  ],
  dumpling: [
    'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=800&q=80',
  ],
  fried: [
    'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1606755456206-b25206cde27e?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=800&q=80',
  ],
  grilled: [
    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
  ],
  porridge: [
    'https://images.unsplash.com/photo-1517673400267-0251440c45dc?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=800&q=80',
  ],
  drink: [
    'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80',
  ],
  beans: [
    'https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1611270629569-8b357cb88da9?auto=format&fit=crop&w=800&q=80',
  ],
  vegetable: [
    'https://images.unsplash.com/photo-1543339308-d595c4f9b21a?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
  ],
  egg: [
    'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80',
  ],
  kebab: [
    'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?auto=format&fit=crop&w=800&q=80',
  ],
  pie: [
    'https://images.unsplash.com/photo-1535920527002-b35e96722eb9?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1568571780765-9276ac8b75a2?auto=format&fit=crop&w=800&q=80',
  ],
  sauce: [
    'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?auto=format&fit=crop&w=800&q=80',
  ],
  sandwich: [
    'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1553909489-cd47e0907980?auto=format&fit=crop&w=800&q=80',
  ],
  pancake: [
    'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1528207776546-365bb710ee93?auto=format&fit=crop&w=800&q=80',
  ],
  fruit: [
    'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=800&q=80',
  ],
  // Catch-all: beautiful plated food
  general: [
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1493770348161-369560ae357d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=800&q=80',
  ],
}

// ── Category Detection ──────────────────────────────────
// Maps keywords found in slug/title/ingredients to categories

const KEYWORD_RULES = [
  // Protein
  { keywords: ['chicken', 'pui', 'poulet', 'pollo', 'dajaj', 'kuku', 'digaag', 'daaj'], category: 'chicken' },
  { keywords: ['beef', 'vită', 'boeuf', 'carne', 'steak', 'brisket', 'oxtail'], category: 'beef' },
  { keywords: ['lamb', 'miel', 'agneau', 'cordero', 'goat', 'capra', 'mutton', 'janjetina'], category: 'lamb' },
  { keywords: ['pork', 'porc', 'cerdo', 'bacon', 'ham', 'prosciutto', 'sausage', 'chicharr'], category: 'pork' },
  { keywords: ['fish', 'pește', 'poisson', 'pescado', 'samaki', 'samak', 'tilapia', 'salmon', 'cod', 'tuna', 'bream', 'chambo', 'kapenta'], category: 'fish' },
  { keywords: ['shrimp', 'prawn', 'crab', 'lobster', 'oyster', 'clam', 'mussel', 'seafood', 'camar', 'rubyan'], category: 'seafood' },
  
  // Cooking method
  { keywords: ['soup', 'supă', 'ciorbă', 'sopa', 'shurba', 'shorba', 'chorba', 'broth', 'orba', 'juha', 'maraq'], category: 'soup' },
  { keywords: ['stew', 'tocană', 'ragout', 'guiso', 'dovi', 'relish', 'ifisashi'], category: 'stew' },
  { keywords: ['curry', 'masala', 'tikka', 'korma', 'vindaloo', 'riha', 'qumbe', 'datshi'], category: 'curry' },
  { keywords: ['fried', 'frit', 'prăjit', 'fritter', 'beignet', 'akara', 'kosai', 'bajiya'], category: 'fried' },
  { keywords: ['grill', 'grilled', 'bbq', 'barbecue', 'roast', 'brochette', 'kebab', 'kebap', 'shashlik', 'satay', 'asado', 'choma'], category: 'grilled' },
  
  // Carbs
  { keywords: ['rice', 'orez', 'riz', 'arroz', 'pilaf', 'pilau', 'biryani', 'plov', 'jollof', 'machboos', 'nasi'], category: 'rice' },
  { keywords: ['noodle', 'fidea', 'nouille', 'mein', 'pho', 'ramen', 'lagman', 'foe', 'tsuivan'], category: 'noodles' },
  { keywords: ['pasta', 'spaghett', 'macaroni', 'fettuccin', 'lasagna', 'mbakbaka'], category: 'pasta' },
  { keywords: ['bread', 'pâine', 'pain', 'brot', 'naan', 'roti', 'chapati', 'injera', 'khobz', 'flatbread', 'kisra', 'lavash', 'canjeero', 'anjero'], category: 'bread' },
  
  // Sides & vegetables
  { keywords: ['salad', 'salată', 'slaw', 'ceviche', 'poke'], category: 'salad' },
  { keywords: ['bean', 'fasole', 'haricot', 'lentil', 'dal', 'dhal', 'ful', 'foul'], category: 'beans' },
  { keywords: ['vegetable', 'legum', 'greens', 'spinach', 'morogo', 'covo', 'callaloo', 'okra'], category: 'vegetable' },
  { keywords: ['egg', 'ou', 'omelette', 'frittata', 'kuku', 'shakshuka'], category: 'egg' },
  { keywords: ['porridge', 'terci', 'kaša', 'ugali', 'fufu', 'nsima', 'sadza', 'nshima', 'posho', 'asida', 'banku', 'kenkey'], category: 'porridge' },
  
  // Sweet
  { keywords: ['cake', 'tort', 'gâteau', 'torte', 'bolo'], category: 'cake' },
  { keywords: ['dessert', 'desert', 'dulce', 'sweet', 'pudding', 'custard', 'flan', 'halwa', 'halvah'], category: 'dessert' },
  { keywords: ['pastry', 'plăcintă', 'baklava', 'börek', 'burek', 'samosa', 'sambosa', 'empanada', 'pastel'], category: 'pastry' },
  { keywords: ['pancake', 'clătit', 'crepe', 'blini', 'waffle'], category: 'pancake' },
  { keywords: ['pie', 'tart', 'quiche'], category: 'pie' },
  { keywords: ['fruit', 'fruct', 'mango', 'banana', 'coconut', 'pineapple', 'ananas'], category: 'fruit' },
  
  // Other
  { keywords: ['dumpling', 'momo', 'manti', 'buuz', 'pierogi', 'tamale', 'pelmeni', 'ravioli'], category: 'dumpling' },
  { keywords: ['kebab', 'kebap', 'shish', 'kofta', 'kafta', 'köfte', 'qofte'], category: 'kebab' },
  { keywords: ['sandwich', 'burger', 'wrap', 'taco', 'burrito', 'baleada', 'pupusa'], category: 'sandwich' },
  { keywords: ['sauce', 'sos', 'chutney', 'salsa', 'condiment', 'relish', 'dip'], category: 'sauce' },
  { keywords: ['drink', 'băutură', 'juice', 'suc', 'tea', 'coffee', 'beer', 'punch', 'smoothie', 'cocktail', 'chai', 'horchata', 'lassi', 'kava', 'bissap', 'ginger beer', 'kombucha', 'kvass', 'raki'], category: 'drink' },
]

function detectCategory(slug, title, ingredients) {
  const text = `${slug} ${title} ${ingredients || ''}`.toLowerCase()
  
  for (const rule of KEYWORD_RULES) {
    for (const kw of rule.keywords) {
      if (text.includes(kw)) {
        return rule.category
      }
    }
  }
  
  return 'general'
}

function pickCategoryImage(category, slug) {
  const images = CATEGORY_IMAGES[category] || CATEGORY_IMAGES.general
  // Use slug hash to pick a consistent (but varied) image per recipe
  let hash = 0
  for (let i = 0; i < slug.length; i++) {
    hash = ((hash << 5) - hash) + slug.charCodeAt(i)
    hash |= 0
  }
  const idx = Math.abs(hash) % images.length
  return images[idx]
}

// ── TheMealDB Search ────────────────────────────────────

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'FoodGlam/1.0' } }, (res) => {
      let body = ''
      res.on('data', (chunk) => body += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(body)) } catch { resolve(null) }
      })
    })
    req.on('error', reject)
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Timeout')) })
  })
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

/**
 * Extract English dish name from slug for TheMealDB search.
 * "india-chicken-tikka-masala" → "chicken tikka masala"
 */
function extractDishName(slug) {
  const parts = slug.split('-')
  const countryPrefixes = new Set([
    'afghanistan','albania','algeria','andorra','angola','antigua','argentina','armenia',
    'australia','austria','azerbaijan','bahamas','bahrain','bangladesh','barbados','belarus',
    'belgium','belize','benin','bhutan','bolivia','bosnia','botswana','brazil','brunei',
    'bulgaria','burkina','burundi','cabo','cambodia','cameroon','canada','central','chad',
    'chile','china','colombia','comoros','congo','costa','croatia','cuba','cyprus','czech',
    'denmark','djibouti','dominica','dominican','ecuador','egypt','el','equatorial','eritrea',
    'estonia','eswatini','ethiopia','fiji','finland','france','gabon','gambia','georgia',
    'germany','ghana','greece','grenada','guatemala','guinea','guyana','haiti','hawaii',
    'honduras','hungary','iceland','india','indonesia','iran','iraq','ireland','israel',
    'italy','ivory','jamaica','japan','jordan','kazakhstan','kenya','kiribati','korea',
    'kosovo','kuwait','kyrgyzstan','laos','latvia','lebanon','lesotho','liberia','libya',
    'liechtenstein','lithuania','luxembourg','macedonia','madagascar','malawi','malaysia',
    'maldives','mali','malta','marshall','mauritania','mauritius','mexico','micronesia',
    'moldova','monaco','mongolia','montenegro','morocco','mozambique','myanmar','namibia',
    'nauru','nepal','netherlands','new','nicaragua','niger','nigeria','north','norway',
    'oman','pakistan','palau','palestine','panama','papua','paraguay','peru','philippines',
    'poland','portugal','puerto','qatar','rico','romania','russia','rwanda','saint','samoa',
    'san','sao','saudi','senegal','serbia','seychelles','sierra','singapore','slovakia',
    'slovenia','solomon','somalia','south','southern','spain','sri','sudan','suriname',
    'sweden','switzerland','syria','taiwan','tajikistan','tanzania','thailand','togo',
    'tonga','trinidad','tunisia','turkey','turkmenistan','tuvalu','uganda','ukraine',
    'united','uruguay','us','uzbekistan','vanuatu','vatican','venezuela','verde','vietnam',
    'yemen','zambia','zimbabwe','zealand','leone','tome','principe','kitts','nevis','lucia',
    'vincent','grenadines','marino','arabia','africa','lanka','east','timor','guinea','bissau',
    'faso','coast','rep','islands','kingdom','states','arab','emirates','hong','kong',
    'tex','mex','northeastern','midwestern','western','republic'
  ])
  
  let startIdx = 0
  for (let i = 0; i < parts.length; i++) {
    if (countryPrefixes.has(parts[i])) {
      startIdx = i + 1
    } else {
      break
    }
  }
  if (startIdx >= parts.length) startIdx = Math.max(0, parts.length - 3)
  
  return parts.slice(startIdx).join(' ')
}

async function searchTheMealDB(dishName) {
  try {
    const url = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(dishName)}`
    const data = await httpGet(url)
    if (data && data.meals && data.meals.length > 0) {
      return data.meals[0].strMealThumb
    }
    return null
  } catch (err) {
    return null
  }
}

// ── Progress ────────────────────────────────────────────

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'))
    }
  } catch {}
  return {
    processed: {},
    stats: { total: 0, mealdb: 0, category: 0, errors: 0 }
  }
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2))
}

// ── Main ────────────────────────────────────────────────

async function main() {
  console.log('🖼️  Recipe Image Fetcher (No API Keys)')
  console.log('═══════════════════════════════════════')
  console.log('Strategy: TheMealDB → Curated Unsplash by category\n')

  const pool = new Pool(DB)
  const progress = loadProgress()

  const { rows: recipes } = await pool.query(`
    SELECT id, slug, title, recipe_json->>'ingredients' AS ingredients
    FROM posts 
    WHERE type = 'recipe' 
      AND (hero_image_url IS NULL OR hero_image_url = '')
    ORDER BY slug
  `)

  console.log(`📋 ${recipes.length} recipes need images`)
  console.log(`📌 ${Object.keys(progress.processed).length} already processed\n`)

  let processed = 0

  for (let i = 0; i < recipes.length; i++) {
    const { id, slug, title, ingredients } = recipes[i]

    if (progress.processed[slug]) continue

    processed++
    progress.stats.total++

    const dishName = extractDishName(slug)
    const num = `[${i + 1}/${recipes.length}]`
    
    process.stdout.write(`${num} ${title} → `)

    let imageUrl = null
    let source = 'category'

    // Tier 1: TheMealDB exact search
    try {
      const mealDbUrl = await searchTheMealDB(dishName)
      if (mealDbUrl) {
        imageUrl = mealDbUrl
        source = 'mealdb'
        progress.stats.mealdb++
      }
      await sleep(DELAY_BETWEEN)
    } catch {}

    // Tier 1b: Try simpler name (first 2 words) if full name failed
    if (!imageUrl && dishName.split(' ').length > 2) {
      try {
        const shortName = dishName.split(' ').slice(0, 2).join(' ')
        const mealDbUrl = await searchTheMealDB(shortName)
        if (mealDbUrl) {
          imageUrl = mealDbUrl
          source = 'mealdb'
          progress.stats.mealdb++
        }
        await sleep(DELAY_BETWEEN)
      } catch {}
    }

    // Tier 2: Category-based curated Unsplash image
    if (!imageUrl) {
      const category = detectCategory(slug, title, ingredients)
      imageUrl = pickCategoryImage(category, slug)
      source = `category:${category}`
      progress.stats.category++
    }

    // Update DB
    try {
      await pool.query('UPDATE posts SET hero_image_url = $1 WHERE id = $2', [imageUrl, id])
      progress.processed[slug] = { source, url: imageUrl.substring(0, 80) }
      console.log(`${source === 'mealdb' ? '🎯' : '📂'} ${source}`)
    } catch (err) {
      progress.stats.errors++
      console.log(`💥 Error: ${err.message}`)
    }

    // Save progress every 25 recipes
    if (processed % 25 === 0) {
      saveProgress(progress)
      const pct = ((i + 1) / recipes.length * 100).toFixed(1)
      console.log(`\n📊 ${pct}% — MealDB: ${progress.stats.mealdb} | Category: ${progress.stats.category} | Errors: ${progress.stats.errors}\n`)
    }
  }

  saveProgress(progress)
  console.log('\n════════════════════════')
  console.log('🏁 COMPLETE')
  console.log(`   Total: ${progress.stats.total}`)
  console.log(`   🎯 TheMealDB matches: ${progress.stats.mealdb}`)
  console.log(`   📂 Category images:   ${progress.stats.category}`)
  console.log(`   💥 Errors:            ${progress.stats.errors}`)
  
  await pool.end()
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
