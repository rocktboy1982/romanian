#!/usr/bin/env node
/**
 * seed-cocktails-expansion.js — Fetches cocktails from TheCocktailDB API + IBA GitHub,
 * deduplicates, transforms to our schema, and inserts into the posts table.
 * 
 * Target: ~1000 cocktails total (15 existing + ~985 new)
 * 
 * Sources:
 *   1. TheCocktailDB API (free, key="1") — ~441 cocktails
 *   2. GitHub mikeyhogarth/cocktails — ~100 IBA cocktails
 * 
 * Rate limiting: 1 request per second to TheCocktailDB to avoid ban.
 * 
 * Usage: node scripts/seed-cocktails-expansion.js [--dry-run]
 */

const { Pool } = require('pg')
const https = require('https')
const http = require('http')

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '54322'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'postgres',
})

const SYSTEM_USER = 'c0000000-0000-0000-0000-000000000001'
const DRY_RUN = process.argv.includes('--dry-run')

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    mod.get(url, { headers: { 'User-Agent': 'MareChef-Cocktail-Seeder/1.0' } }, res => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error(`JSON parse error for ${url}: ${e.message}`)) }
      })
    }).on('error', reject)
  })
}

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // strip diacritics
    .replace(/['']/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 120)
}

// ─── Spirit Classification ───────────────────────────────────────────────────

const SPIRIT_MAP = [
  { keywords: ['bourbon', 'rye whiskey', 'scotch', 'whiskey', 'whisky', 'irish whiskey', 'blended whiskey'], spirit: 'whisky', label: 'Whisky & Bourbon' },
  { keywords: ['gin', 'sloe gin', 'old tom gin', 'london dry gin'], spirit: 'gin', label: 'Gin' },
  { keywords: ['white rum', 'dark rum', 'light rum', 'rum', 'spiced rum', 'gold rum', 'añejo rum', 'overproof rum', 'coconut rum', 'cachaca', 'cachaça'], spirit: 'rum', label: 'Rum' },
  { keywords: ['tequila', 'mezcal', 'blanco tequila', 'reposado tequila'], spirit: 'tequila', label: 'Tequila & Mezcal' },
  { keywords: ['vodka', 'vanilla vodka', 'citrus vodka', 'absolut', 'flavored vodka'], spirit: 'vodka', label: 'Vodka' },
  { keywords: ['brandy', 'cognac', 'armagnac', 'pisco', 'calvados', 'grappa', 'applejack'], spirit: 'brandy', label: 'Brandy & Cognac' },
  { keywords: ['kahlua', 'kahlúa', 'amaretto', 'baileys', 'chambord', 'chartreuse', 'cointreau', 'campari', 'aperol',
    'triple sec', 'curaçao', 'curacao', 'blue curacao', 'grand marnier', 'maraschino', 'midori', 'frangelico',
    'galliano', 'drambuie', 'benedictine', 'absinthe', 'sambuca', 'limoncello', 'peach schnapps', 'schnapps',
    'vermouth', 'sweet vermouth', 'dry vermouth', 'lillet', 'pimm\'s', 'cynar', 'fernet', 'jägermeister',
    'jagermeister', 'St-Germain', 'st. germain', 'elderflower liqueur', 'creme de', 'crème de',
    'maraschino liqueur', 'cherry liqueur', 'coffee liqueur', 'orange liqueur', 'peach liqueur',
    'raspberry liqueur', 'blackberry liqueur', 'hazelnut liqueur', 'irish cream', 'cream liqueur'],
    spirit: 'liqueur', label: 'Lichioruri' },
  { keywords: ['champagne', 'prosecco', 'wine', 'red wine', 'white wine', 'sparkling wine', 'cava', 'rosé', 'port', 'sherry', 'sake'], spirit: 'wine', label: 'Vin & Șampanie' },
]

function classifySpirit(ingredients) {
  const joined = ingredients.map(i => i.toLowerCase()).join(' ')
  
  // Check each spirit category in order (most specific first)
  for (const { keywords, spirit, label } of SPIRIT_MAP) {
    for (const kw of keywords) {
      if (joined.includes(kw)) return { spirit, spiritLabel: label }
    }
  }
  
  // If no alcohol keyword found, check if it's explicitly non-alcoholic
  return { spirit: 'none', spiritLabel: 'Mocktail-uri' }
}

function estimateABV(spirit, isAlcoholic) {
  if (!isAlcoholic) return 0
  const abvMap = {
    whisky: 28, gin: 22, rum: 18, tequila: 22, vodka: 20,
    brandy: 26, liqueur: 14, wine: 10, none: 0
  }
  return abvMap[spirit] || 15
}

function mapGlassware(glass) {
  if (!glass) return 'Highball'
  const g = glass.toLowerCase()
  if (g.includes('rocks') || g.includes('old-fashioned') || g.includes('whiskey')) return 'Rocks'
  if (g.includes('highball') || g.includes('collins')) return 'Highball'
  if (g.includes('martini') || g.includes('cocktail') || g.includes('coupe') || g.includes('nick and nora')) return 'Martini'
  if (g.includes('margarita')) return 'Margarita'
  if (g.includes('hurricane') || g.includes('poco grande') || g.includes('tiki')) return 'Pahar înalt'
  if (g.includes('wine') || g.includes('copa') || g.includes('balloon') || g.includes('goblet')) return 'Copa / Balon'
  if (g.includes('flute') || g.includes('champagne')) return 'Pahar de vin'
  if (g.includes('shot')) return 'Shot'
  if (g.includes('mug') || g.includes('copper') || g.includes('irish coffee')) return 'Cană'
  if (g.includes('punch') || g.includes('pitcher')) return 'Pahar înalt'
  return 'Highball'
}

function mapDifficulty(ingredientCount, hasEggWhite, hasFlaming) {
  if (hasFlaming) return 'hard'
  if (hasEggWhite || ingredientCount > 6) return 'medium'
  if (ingredientCount <= 3) return 'easy'
  return 'easy'
}

function generateTags(cocktail) {
  const tags = []
  
  // Category tags
  if (cocktail.isAlcoholic) tags.push('alcoholic')
  else tags.push('mocktail')
  
  // Method tags
  const steps = (cocktail.steps || []).join(' ').toLowerCase()
  if (steps.includes('shake') || steps.includes('agit')) tags.push('shaken')
  if (steps.includes('stir') || steps.includes('amestec')) tags.push('stirred')
  if (steps.includes('blend') || steps.includes('mixer')) tags.push('blended')
  if (steps.includes('layer') || steps.includes('float')) tags.push('layered')
  if (steps.includes('build') || steps.includes('pour') || steps.includes('turn')) tags.push('built')
  
  // Flavor profile tags
  const allText = cocktail.ingredients.join(' ').toLowerCase()
  if (allText.includes('lemon') || allText.includes('lime') || allText.includes('citrus') || allText.includes('grapefruit')) tags.push('citrus')
  if (allText.includes('cream') || allText.includes('milk') || allText.includes('coconut')) tags.push('creamy')
  if (allText.includes('coffee') || allText.includes('espresso')) tags.push('coffee')
  if (allText.includes('mint') || allText.includes('mentă')) tags.push('mint')
  if (allText.includes('ginger') || allText.includes('ghimbir')) tags.push('ginger')
  if (allText.includes('honey') || allText.includes('miere')) tags.push('honey')
  if (allText.includes('berry') || allText.includes('berries') || allText.includes('strawberr') || allText.includes('raspberry') || allText.includes('blueberry')) tags.push('fruity')
  if (allText.includes('tropical') || allText.includes('pineapple') || allText.includes('mango') || allText.includes('passion')) tags.push('tropical')
  if (allText.includes('bitter')) tags.push('bitter')
  if (allText.includes('egg white') || allText.includes('albuș')) tags.push('egg-white')
  
  // Season/occasion
  if (allText.includes('hot') || allText.includes('warm') || allText.includes('cald')) tags.push('warm')
  
  // Ensure at least 2 tags
  if (tags.length < 2) tags.push('classic')
  
  return [...new Set(tags)].slice(0, 6)  // max 6 tags
}

// ─── TheCocktailDB Fetcher ──────────────────────────────────────────────────

async function fetchTheCocktailDB() {
  console.log('\n📡 Fetching from TheCocktailDB API...')
  const cocktails = []
  
  // Search by each letter a-z plus digits 0-9
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('')
  
  for (const ch of chars) {
    try {
      const url = `https://www.thecocktaildb.com/api/json/v1/1/search.php?f=${ch}`
      const data = await fetchJSON(url)
      
      if (data.drinks && Array.isArray(data.drinks)) {
        for (const d of data.drinks) {
          // Extract ingredients and measures
          const ingredients = []
          const ingredientNames = []
          for (let i = 1; i <= 15; i++) {
            const ing = d[`strIngredient${i}`]
            const measure = d[`strMeasure${i}`]
            if (ing && ing.trim()) {
              const m = measure ? measure.trim() : ''
              ingredients.push(m ? `${m} ${ing.trim()}` : ing.trim())
              ingredientNames.push(ing.trim())
            }
          }
          
          const isAlcoholic = d.strAlcoholic !== 'Non alcoholic'
          const { spirit, spiritLabel } = classifySpirit(ingredientNames)
          
          const hasEggWhite = ingredientNames.some(i => i.toLowerCase().includes('egg'))
          const hasFlaming = (d.strInstructions || '').toLowerCase().includes('flam')
          
          cocktails.push({
            source: 'thecocktaildb',
            sourceId: d.idDrink,
            name: d.strDrink,
            slug: slugify(d.strDrink),
            category: d.strCategory || '',
            isAlcoholic,
            glass: d.strGlass || '',
            instructions: d.strInstructions || '',
            ingredients,
            ingredientNames,
            image: d.strDrinkThumb || '',
            spirit,
            spiritLabel,
            abv: estimateABV(spirit, isAlcoholic),
            difficulty: mapDifficulty(ingredients.length, hasEggWhite, hasFlaming),
            glassware: mapGlassware(d.strGlass),
          })
        }
      }
      
      process.stdout.write(`  [${ch}] ${data.drinks ? data.drinks.length : 0} drinks\n`)
    } catch (err) {
      console.warn(`  ⚠ Error fetching letter "${ch}": ${err.message}`)
    }
    
    // Rate limit: 1 request per 0.8 seconds (within free tier limits)
    await sleep(800)
  }
  
  console.log(`  ✅ TheCocktailDB total: ${cocktails.length}`)
  return cocktails
}

// ─── GitHub IBA Fetcher ─────────────────────────────────────────────────────

async function fetchIBACocktails() {
  console.log('\n📡 Fetching IBA cocktails from GitHub...')
  
  try {
    const url = 'https://raw.githubusercontent.com/mikeyhogarth/cocktails/master/cocktails.json'
    const data = await fetchJSON(url)
    
    const cocktails = []
    const list = Array.isArray(data) ? data : (data.cocktails || [])
    
    for (const c of list) {
      const ingredientStrs = (c.ingredients || []).map(i => {
        const parts = []
        if (i.amount) parts.push(String(i.amount))
        if (i.unit) parts.push(i.unit)
        if (i.ingredient || i.label) parts.push(i.ingredient || i.label)
        return parts.join(' ').trim()
      })
      
      const ingredientNames = (c.ingredients || []).map(i => (i.ingredient || i.label || '').trim()).filter(Boolean)
      
      const isAlcoholic = !['non alcoholic', 'non-alcoholic', 'mocktail'].includes((c.category || '').toLowerCase())
      const { spirit, spiritLabel } = classifySpirit(ingredientNames)
      
      const hasEggWhite = ingredientNames.some(i => i.toLowerCase().includes('egg'))
      
      cocktails.push({
        source: 'iba-github',
        name: c.name,
        slug: slugify(c.name),
        category: c.category || '',
        isAlcoholic,
        glass: c.glass || '',
        instructions: c.preparation || '',
        ingredients: ingredientStrs,
        ingredientNames,
        image: '',
        spirit,
        spiritLabel,
        abv: estimateABV(spirit, isAlcoholic),
        difficulty: mapDifficulty(ingredientStrs.length, hasEggWhite, false),
        glassware: mapGlassware(c.glass),
        garnish: c.garnish || '',
      })
    }
    
    console.log(`  ✅ IBA GitHub total: ${cocktails.length}`)
    return cocktails
  } catch (err) {
    console.warn(`  ⚠ Error fetching IBA cocktails: ${err.message}`)
    // Try alternate path
    try {
      const url2 = 'https://raw.githubusercontent.com/mikeyhogarth/cocktails/master/src/data/cocktails.json'
      const data = await fetchJSON(url2)
      const list = Array.isArray(data) ? data : (data.cocktails || [])
      console.log(`  ✅ IBA GitHub (alt path) total: ${list.length}`)
      
      const cocktails = []
      for (const c of list) {
        const ingredientStrs = (c.ingredients || []).map(i => {
          const parts = []
          if (i.amount) parts.push(String(i.amount))
          if (i.unit) parts.push(i.unit)
          if (i.ingredient || i.label) parts.push(i.ingredient || i.label)
          return parts.join(' ').trim()
        })
        
        const ingredientNames = (c.ingredients || []).map(i => (i.ingredient || i.label || '').trim()).filter(Boolean)
        const isAlcoholic = !['non alcoholic', 'non-alcoholic', 'mocktail'].includes((c.category || '').toLowerCase())
        const { spirit, spiritLabel } = classifySpirit(ingredientNames)
        const hasEggWhite = ingredientNames.some(i => i.toLowerCase().includes('egg'))
        
        cocktails.push({
          source: 'iba-github',
          name: c.name,
          slug: slugify(c.name),
          category: c.category || '',
          isAlcoholic,
          glass: c.glass || '',
          instructions: c.preparation || '',
          ingredients: ingredientStrs,
          ingredientNames,
          image: '',
          spirit,
          spiritLabel,
          abv: estimateABV(spirit, isAlcoholic),
          difficulty: mapDifficulty(ingredientStrs.length, hasEggWhite, false),
          glassware: mapGlassware(c.glass),
          garnish: c.garnish || '',
        })
      }
      return cocktails
    } catch (err2) {
      console.warn(`  ⚠ Error fetching IBA alt path: ${err2.message}`)
      return []
    }
  }
}

// ─── Additional well-known cocktails to supplement toward 1000 ──────────────
// These are real cocktails with real ingredients, not generated.

const SUPPLEMENTAL_COCKTAILS = [
  // Classic cocktails that may not be in TheCocktailDB
  { name: 'Penicillin', ingredients: ['60 ml blended scotch', '22 ml fresh lemon juice', '22 ml honey-ginger syrup', '7 ml Islay single malt scotch (float)'], glass: 'Rocks', garnish: 'Candied ginger', isAlcoholic: true },
  { name: 'Paper Plane', ingredients: ['22 ml bourbon', '22 ml Aperol', '22 ml Amaro Nonino', '22 ml fresh lemon juice'], glass: 'Coupe', garnish: 'None', isAlcoholic: true },
  { name: 'Naked and Famous', ingredients: ['22 ml mezcal', '22 ml Aperol', '22 ml yellow Chartreuse', '22 ml fresh lime juice'], glass: 'Coupe', garnish: 'None', isAlcoholic: true },
  { name: 'Division Bell', ingredients: ['30 ml mezcal', '22 ml Aperol', '22 ml maraschino liqueur', '22 ml fresh lime juice'], glass: 'Coupe', garnish: 'Grapefruit twist', isAlcoholic: true },
  { name: 'Last Word', ingredients: ['22 ml gin', '22 ml green Chartreuse', '22 ml maraschino liqueur', '22 ml fresh lime juice'], glass: 'Coupe', garnish: 'Brandied cherry', isAlcoholic: true },
  { name: 'Bee\'s Knees', ingredients: ['60 ml gin', '22 ml fresh lemon juice', '15 ml honey syrup'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Gold Rush', ingredients: ['60 ml bourbon', '22 ml fresh lemon juice', '22 ml honey syrup'], glass: 'Rocks', garnish: 'Lemon wheel', isAlcoholic: true },
  { name: 'Enzoni', ingredients: ['30 ml gin', '30 ml Campari', '22 ml fresh lemon juice', '15 ml simple syrup', '5 green grapes'], glass: 'Rocks', garnish: 'Grape', isAlcoholic: true },
  { name: 'Tommy\'s Margarita', ingredients: ['60 ml tequila blanco', '30 ml fresh lime juice', '15 ml agave nectar'], glass: 'Rocks', garnish: 'Lime wheel', isAlcoholic: true },
  { name: 'Jungle Bird', ingredients: ['45 ml dark rum', '22 ml Campari', '15 ml fresh lime juice', '15 ml simple syrup', '45 ml pineapple juice'], glass: 'Rocks', garnish: 'Pineapple wedge', isAlcoholic: true },
  { name: 'Hemingway Daiquiri', ingredients: ['60 ml white rum', '15 ml maraschino liqueur', '30 ml fresh grapefruit juice', '22 ml fresh lime juice'], glass: 'Coupe', garnish: 'Lime wheel', isAlcoholic: true },
  { name: 'Corpse Reviver No. 2', ingredients: ['22 ml gin', '22 ml Cointreau', '22 ml Lillet Blanc', '22 ml fresh lemon juice', 'Dash of absinthe'], glass: 'Coupe', garnish: 'Brandied cherry', isAlcoholic: true },
  { name: 'Vieux Carré', ingredients: ['30 ml rye whiskey', '30 ml cognac', '30 ml sweet vermouth', '1 tsp Bénédictine', '2 dashes Peychaud\'s bitters', '2 dashes Angostura bitters'], glass: 'Rocks', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Boulevardier', ingredients: ['30 ml bourbon', '30 ml Campari', '30 ml sweet vermouth'], glass: 'Rocks', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Ti\' Punch', ingredients: ['60 ml rhum agricole', '15 ml cane syrup', '1 lime disc'], glass: 'Rocks', garnish: 'Lime disc', isAlcoholic: true },
  { name: 'Caipirinha', ingredients: ['60 ml cachaça', '1 lime cut into wedges', '2 tsp sugar'], glass: 'Rocks', garnish: 'Lime wedge', isAlcoholic: true },
  { name: 'Pisco Sour', ingredients: ['60 ml pisco', '30 ml fresh lime juice', '22 ml simple syrup', '1 egg white', '3 dashes Angostura bitters'], glass: 'Coupe', garnish: 'Angostura bitters drops', isAlcoholic: true },
  { name: 'Clover Club', ingredients: ['45 ml gin', '15 ml dry vermouth', '15 ml fresh lemon juice', '15 ml raspberry syrup', '1 egg white'], glass: 'Coupe', garnish: 'Raspberries', isAlcoholic: true },
  { name: 'Ramos Gin Fizz', ingredients: ['45 ml gin', '15 ml fresh lime juice', '15 ml fresh lemon juice', '30 ml simple syrup', '30 ml heavy cream', '1 egg white', '3 drops orange flower water', 'Soda water'], glass: 'Highball', garnish: 'None', isAlcoholic: true },
  { name: 'Suffering Bastard', ingredients: ['30 ml bourbon', '30 ml gin', '15 ml fresh lime juice', '2 dashes Angostura bitters', 'Ginger beer'], glass: 'Highball', garnish: 'Mint sprig, orange slice', isAlcoholic: true },
  { name: 'Amaretto Sour', ingredients: ['45 ml amaretto', '30 ml bourbon', '30 ml fresh lemon juice', '15 ml simple syrup', '1 egg white'], glass: 'Rocks', garnish: 'Brandied cherry, lemon peel', isAlcoholic: true },
  { name: 'Negroni Sbagliato', ingredients: ['30 ml Campari', '30 ml sweet vermouth', '30 ml prosecco'], glass: 'Rocks', garnish: 'Orange slice', isAlcoholic: true },
  { name: 'Blood and Sand', ingredients: ['22 ml scotch', '22 ml Cherry Heering', '22 ml sweet vermouth', '22 ml fresh orange juice'], glass: 'Coupe', garnish: 'Flamed orange peel', isAlcoholic: true },
  { name: 'New York Sour', ingredients: ['60 ml bourbon', '22 ml fresh lemon juice', '15 ml simple syrup', '1 egg white', '15 ml red wine (float)'], glass: 'Rocks', garnish: 'Lemon wheel, cherry', isAlcoholic: true },
  { name: 'French 75', ingredients: ['30 ml gin', '15 ml fresh lemon juice', '15 ml simple syrup', '60 ml champagne'], glass: 'Champagne flute', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Sazerac', ingredients: ['60 ml rye whiskey', '1 sugar cube', '3 dashes Peychaud\'s bitters', 'Absinthe rinse'], glass: 'Rocks', garnish: 'Lemon peel', isAlcoholic: true },
  { name: 'Sidecar', ingredients: ['50 ml cognac', '20 ml Cointreau', '20 ml fresh lemon juice'], glass: 'Coupe', garnish: 'Sugar rim, orange twist', isAlcoholic: true },
  { name: 'Gimlet', ingredients: ['60 ml gin', '30 ml fresh lime juice', '15 ml simple syrup'], glass: 'Coupe', garnish: 'Lime wheel', isAlcoholic: true },
  { name: 'Bramble', ingredients: ['50 ml gin', '25 ml fresh lemon juice', '12 ml simple syrup', '15 ml crème de mûre'], glass: 'Rocks', garnish: 'Blackberry, lemon slice', isAlcoholic: true },
  { name: 'Dark \'n\' Stormy (Bermuda)', ingredients: ['60 ml Gosling\'s Black Seal rum', '120 ml ginger beer', '15 ml fresh lime juice'], glass: 'Highball', garnish: 'Lime wedge', isAlcoholic: true },
  { name: 'Pornstar Martini', ingredients: ['45 ml vanilla vodka', '15 ml passion fruit liqueur', '30 ml passion fruit purée', '15 ml fresh lime juice', '15 ml vanilla syrup', 'Prosecco on the side'], glass: 'Coupe', garnish: 'Half passion fruit', isAlcoholic: true },
  { name: 'Cosmopolitan', ingredients: ['40 ml citrus vodka', '15 ml Cointreau', '30 ml cranberry juice', '15 ml fresh lime juice'], glass: 'Martini', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Martini (Dry)', ingredients: ['60 ml gin', '10 ml dry vermouth'], glass: 'Martini', garnish: 'Olive or lemon twist', isAlcoholic: true },
  { name: 'Manhattan', ingredients: ['60 ml rye whiskey', '30 ml sweet vermouth', '2 dashes Angostura bitters'], glass: 'Coupe', garnish: 'Brandied cherry', isAlcoholic: true },
  { name: 'Daiquiri', ingredients: ['60 ml white rum', '30 ml fresh lime juice', '15 ml simple syrup'], glass: 'Coupe', garnish: 'Lime wheel', isAlcoholic: true },
  { name: 'Aviation', ingredients: ['45 ml gin', '15 ml maraschino liqueur', '15 ml fresh lemon juice', '7 ml crème de violette'], glass: 'Coupe', garnish: 'Brandied cherry', isAlcoholic: true },
  { name: 'Tom Collins', ingredients: ['45 ml gin', '30 ml fresh lemon juice', '15 ml simple syrup', 'Soda water'], glass: 'Collins', garnish: 'Lemon wheel, cherry', isAlcoholic: true },
  { name: 'Mint Julep', ingredients: ['60 ml bourbon', '15 ml simple syrup', '8-10 mint leaves', 'Crushed ice'], glass: 'Julep cup', garnish: 'Mint bouquet', isAlcoholic: true },
  { name: 'Singapore Sling', ingredients: ['30 ml gin', '15 ml Cherry Heering', '7 ml Cointreau', '7 ml DOM Bénédictine', '120 ml pineapple juice', '15 ml fresh lime juice', '10 ml grenadine', '1 dash Angostura bitters'], glass: 'Hurricane', garnish: 'Pineapple wedge, cherry', isAlcoholic: true },
  { name: 'Vesper Martini', ingredients: ['60 ml gin', '15 ml vodka', '7 ml Lillet Blanc'], glass: 'Martini', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Bellini', ingredients: ['60 ml white peach purée', '120 ml prosecco'], glass: 'Champagne flute', garnish: 'None', isAlcoholic: true },
  { name: 'Kir Royale', ingredients: ['15 ml crème de cassis', '120 ml champagne'], glass: 'Champagne flute', garnish: 'None', isAlcoholic: true },
  { name: 'Mai Tai', ingredients: ['30 ml aged rum', '30 ml dark rum', '15 ml orange curaçao', '15 ml orgeat syrup', '30 ml fresh lime juice'], glass: 'Rocks', garnish: 'Mint sprig, lime shell', isAlcoholic: true },
  { name: 'Zombie', ingredients: ['30 ml gold rum', '30 ml dark rum', '30 ml overproof rum', '30 ml fresh lime juice', '15 ml falernum', '15 ml grenadine', '15 ml cinnamon syrup', '1 dash Angostura bitters', '2 dashes absinthe'], glass: 'Tiki mug', garnish: 'Mint bouquet', isAlcoholic: true },
  { name: 'Piña Colada', ingredients: ['60 ml white rum', '90 ml pineapple juice', '30 ml coconut cream', 'Crushed ice'], glass: 'Hurricane', garnish: 'Pineapple wedge, cherry', isAlcoholic: true },
  { name: 'Long Island Iced Tea', ingredients: ['15 ml vodka', '15 ml gin', '15 ml white rum', '15 ml tequila', '15 ml triple sec', '22 ml fresh lemon juice', '30 ml simple syrup', 'Cola'], glass: 'Highball', garnish: 'Lemon wedge', isAlcoholic: true },
  { name: 'Moscow Mule', ingredients: ['60 ml vodka', '15 ml fresh lime juice', '120 ml ginger beer'], glass: 'Copper mug', garnish: 'Lime wheel', isAlcoholic: true },
  { name: 'Tequila Sunrise', ingredients: ['45 ml tequila', '120 ml fresh orange juice', '15 ml grenadine'], glass: 'Highball', garnish: 'Orange slice, cherry', isAlcoholic: true },
  { name: 'Godfather', ingredients: ['45 ml scotch', '22 ml amaretto'], glass: 'Rocks', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Godmother', ingredients: ['45 ml vodka', '22 ml amaretto'], glass: 'Rocks', garnish: 'None', isAlcoholic: true },
  { name: 'B-52', ingredients: ['15 ml Kahlúa', '15 ml Baileys Irish Cream', '15 ml Grand Marnier'], glass: 'Shot', garnish: 'None', isAlcoholic: true },
  { name: 'Rusty Nail', ingredients: ['45 ml scotch', '22 ml Drambuie'], glass: 'Rocks', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Rob Roy', ingredients: ['60 ml scotch', '30 ml sweet vermouth', '2 dashes Angostura bitters'], glass: 'Coupe', garnish: 'Brandied cherry', isAlcoholic: true },
  { name: 'Gin Rickey', ingredients: ['60 ml gin', '30 ml fresh lime juice', 'Soda water'], glass: 'Highball', garnish: 'Lime wedge', isAlcoholic: true },
  { name: 'Planter\'s Punch', ingredients: ['45 ml dark rum', '15 ml fresh lime juice', '15 ml fresh orange juice', '15 ml pineapple juice', '15 ml grenadine', '3 dashes Angostura bitters'], glass: 'Highball', garnish: 'Orange slice, cherry', isAlcoholic: true },
  { name: 'Jack Rose', ingredients: ['45 ml applejack', '22 ml fresh lime juice', '15 ml grenadine'], glass: 'Coupe', garnish: 'None', isAlcoholic: true },
  { name: 'Hanky Panky', ingredients: ['45 ml gin', '45 ml sweet vermouth', '2 dashes Fernet-Branca'], glass: 'Coupe', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Death in the Afternoon', ingredients: ['30 ml absinthe', '120 ml champagne'], glass: 'Champagne flute', garnish: 'None', isAlcoholic: true },
  { name: 'Paloma Spicy', ingredients: ['60 ml tequila', '15 ml fresh lime juice', '120 ml grapefruit soda', '2 slices jalapeño', 'Tajín rim'], glass: 'Highball', garnish: 'Grapefruit wedge, jalapeño', isAlcoholic: true },
  { name: 'Mezcal Negroni', ingredients: ['30 ml mezcal', '30 ml Campari', '30 ml sweet vermouth'], glass: 'Rocks', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Trinidad Sour', ingredients: ['30 ml Angostura bitters', '22 ml orgeat syrup', '22 ml fresh lemon juice', '15 ml rye whiskey'], glass: 'Coupe', garnish: 'None', isAlcoholic: true },
  { name: 'Chartreuse Swizzle', ingredients: ['45 ml green Chartreuse', '30 ml pineapple juice', '22 ml fresh lime juice', '15 ml falernum'], glass: 'Highball', garnish: 'Mint sprig, nutmeg', isAlcoholic: true },
  { name: 'Tipperary', ingredients: ['30 ml Irish whiskey', '30 ml sweet vermouth', '15 ml green Chartreuse'], glass: 'Coupe', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Greenpoint', ingredients: ['60 ml rye whiskey', '15 ml yellow Chartreuse', '15 ml sweet vermouth', '1 dash Angostura bitters', '1 dash orange bitters'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Illegal', ingredients: ['22 ml mezcal', '22 ml overproof white rum', '22 ml falernum', '22 ml fresh lime juice', '15 ml simple syrup', '1 egg white'], glass: 'Coupe', garnish: 'None', isAlcoholic: true },
  { name: 'Bijou', ingredients: ['30 ml gin', '30 ml sweet vermouth', '30 ml green Chartreuse', '1 dash orange bitters'], glass: 'Coupe', garnish: 'Brandied cherry', isAlcoholic: true },
  { name: 'Deshler', ingredients: ['45 ml rye whiskey', '30 ml Dubonnet Rouge', '2 dashes Cointreau', '2 dashes Peychaud\'s bitters'], glass: 'Coupe', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Ward Eight', ingredients: ['60 ml rye whiskey', '22 ml fresh lemon juice', '22 ml fresh orange juice', '15 ml grenadine'], glass: 'Coupe', garnish: 'Orange slice, cherry', isAlcoholic: true },
  { name: 'Algonquin', ingredients: ['45 ml rye whiskey', '22 ml dry vermouth', '22 ml pineapple juice'], glass: 'Coupe', garnish: 'None', isAlcoholic: true },
  { name: 'Brown Derby', ingredients: ['45 ml bourbon', '30 ml fresh grapefruit juice', '15 ml honey syrup'], glass: 'Coupe', garnish: 'None', isAlcoholic: true },
  { name: 'Rattlesnake', ingredients: ['45 ml rye whiskey', '15 ml fresh lemon juice', '15 ml simple syrup', '1 egg white', 'Dash of absinthe'], glass: 'Coupe', garnish: 'None', isAlcoholic: true },
  { name: 'Horse\'s Neck', ingredients: ['60 ml bourbon', 'Ginger ale', '2 dashes Angostura bitters'], glass: 'Highball', garnish: 'Long lemon peel spiral', isAlcoholic: true },
  { name: 'Kentucky Mule', ingredients: ['60 ml bourbon', '15 ml fresh lime juice', '120 ml ginger beer'], glass: 'Copper mug', garnish: 'Lime wheel', isAlcoholic: true },
  { name: 'Mexican Mule', ingredients: ['60 ml tequila', '15 ml fresh lime juice', '120 ml ginger beer'], glass: 'Copper mug', garnish: 'Lime wheel', isAlcoholic: true },
  { name: 'Gin Basil Smash', ingredients: ['60 ml gin', '22 ml fresh lemon juice', '15 ml simple syrup', '8-10 fresh basil leaves'], glass: 'Rocks', garnish: 'Basil leaf', isAlcoholic: true },
  { name: 'Southside', ingredients: ['60 ml gin', '22 ml fresh lime juice', '15 ml simple syrup', '6-8 mint leaves'], glass: 'Coupe', garnish: 'Mint leaf', isAlcoholic: true },
  { name: 'Eastside', ingredients: ['60 ml gin', '22 ml fresh lime juice', '15 ml simple syrup', '3 cucumber slices', '6 mint leaves'], glass: 'Coupe', garnish: 'Cucumber ribbon', isAlcoholic: true },
  { name: 'Elder Fashion', ingredients: ['60 ml gin', '22 ml elderflower liqueur', '2 dashes grapefruit bitters'], glass: 'Rocks', garnish: 'Grapefruit twist', isAlcoholic: true },
  { name: 'Gin Gin Mule', ingredients: ['45 ml gin', '15 ml simple syrup', '15 ml fresh lime juice', '6 mint leaves', '30 ml ginger beer'], glass: 'Highball', garnish: 'Mint sprig', isAlcoholic: true },
  { name: 'Saturn', ingredients: ['30 ml gin', '15 ml fresh lemon juice', '15 ml passion fruit syrup', '7 ml falernum', '7 ml orgeat syrup'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Airmail', ingredients: ['30 ml gold rum', '15 ml fresh lime juice', '15 ml honey syrup', '60 ml champagne'], glass: 'Champagne flute', garnish: 'None', isAlcoholic: true },
  { name: 'Hemingway Special', ingredients: ['60 ml white rum', '30 ml fresh grapefruit juice', '15 ml maraschino liqueur', '15 ml fresh lime juice'], glass: 'Coupe', garnish: 'Grapefruit twist', isAlcoholic: true },
  { name: 'Cable Car', ingredients: ['45 ml spiced rum', '22 ml orange curaçao', '30 ml fresh lemon juice', '22 ml simple syrup', 'Cinnamon sugar rim'], glass: 'Coupe', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Fog Cutter', ingredients: ['30 ml white rum', '22 ml brandy', '15 ml gin', '30 ml fresh lemon juice', '15 ml orange juice', '15 ml orgeat syrup', '15 ml sherry (float)'], glass: 'Tiki mug', garnish: 'Mint sprig', isAlcoholic: true },
  { name: 'Jet Pilot', ingredients: ['22 ml dark Jamaican rum', '22 ml gold Puerto Rican rum', '22 ml overproof rum', '15 ml fresh lime juice', '15 ml fresh grapefruit juice', '15 ml cinnamon syrup', '15 ml falernum', '1 dash Angostura bitters', '6 drops absinthe'], glass: 'Tiki mug', garnish: 'Lime shell', isAlcoholic: true },
  { name: 'Port Light', ingredients: ['45 ml bourbon', '15 ml fresh lemon juice', '15 ml honey syrup', '1 egg white', '15 ml passion fruit syrup'], glass: 'Coupe', garnish: 'Nutmeg', isAlcoholic: true },
  { name: 'Chrysanthemum', ingredients: ['45 ml dry vermouth', '22 ml Bénédictine', '1 tsp absinthe'], glass: 'Coupe', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Improved Whiskey Cocktail', ingredients: ['60 ml rye whiskey', '7 ml maraschino liqueur', '7 ml simple syrup', '2 dashes Angostura bitters', '1 dash absinthe'], glass: 'Rocks', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Monte Carlo', ingredients: ['60 ml rye whiskey', '15 ml Bénédictine', '2 dashes Angostura bitters'], glass: 'Rocks', garnish: 'None', isAlcoholic: true },
  { name: 'Final Ward', ingredients: ['22 ml rye whiskey', '22 ml green Chartreuse', '22 ml maraschino liqueur', '22 ml fresh lemon juice'], glass: 'Coupe', garnish: 'None', isAlcoholic: true },
  { name: 'Black Manhattan', ingredients: ['60 ml rye whiskey', '30 ml Averna amaro', '2 dashes Angostura bitters', '1 dash orange bitters'], glass: 'Coupe', garnish: 'Brandied cherry', isAlcoholic: true },
  { name: 'Toronto', ingredients: ['60 ml Canadian whisky', '7 ml Fernet-Branca', '7 ml simple syrup', '2 dashes Angostura bitters'], glass: 'Coupe', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Benton\'s Old Fashioned', ingredients: ['60 ml bacon-infused bourbon', '7 ml grade A maple syrup', '2 dashes Angostura bitters'], glass: 'Rocks', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Oaxaca Old Fashioned', ingredients: ['45 ml reposado tequila', '15 ml mezcal', '7 ml agave nectar', '2 dashes Angostura bitters'], glass: 'Rocks', garnish: 'Flamed orange twist', isAlcoholic: true },
  { name: 'El Diablo', ingredients: ['45 ml tequila', '15 ml crème de cassis', '15 ml fresh lime juice', '90 ml ginger beer'], glass: 'Highball', garnish: 'Lime wedge', isAlcoholic: true },
  { name: 'Batanga', ingredients: ['60 ml tequila blanco', '15 ml fresh lime juice', 'Coca-Cola', 'Salt rim'], glass: 'Highball', garnish: 'Lime wedge', isAlcoholic: true },
  { name: 'Mexican Firing Squad', ingredients: ['45 ml tequila blanco', '22 ml fresh lime juice', '15 ml grenadine', '3 dashes Angostura bitters'], glass: 'Highball', garnish: 'Lime wheel', isAlcoholic: true },
  { name: 'Cantaritos', ingredients: ['60 ml tequila', '30 ml fresh orange juice', '30 ml fresh grapefruit juice', '15 ml fresh lime juice', 'Grapefruit soda', 'Sal de gusano rim'], glass: 'Clay cup', garnish: 'Citrus wheels', isAlcoholic: true },
  { name: 'Michelada', ingredients: ['360 ml Mexican lager', '60 ml fresh lime juice', '30 ml tomato juice', '15 ml Worcestershire sauce', '15 ml hot sauce', 'Tajín rim'], glass: 'Pint', garnish: 'Lime wedge', isAlcoholic: true },
  { name: 'Carajillo', ingredients: ['45 ml Licor 43', '60 ml espresso'], glass: 'Rocks', garnish: 'Coffee beans', isAlcoholic: true },
  { name: 'Fitzgerald', ingredients: ['45 ml gin', '22 ml fresh lemon juice', '15 ml simple syrup', '2 dashes Angostura bitters'], glass: 'Coupe', garnish: 'Lemon wedge', isAlcoholic: true },
  { name: 'Vodka Martini', ingredients: ['60 ml vodka', '10 ml dry vermouth'], glass: 'Martini', garnish: 'Olive or lemon twist', isAlcoholic: true },
  { name: 'Vodka Gimlet', ingredients: ['60 ml vodka', '30 ml fresh lime juice', '15 ml simple syrup'], glass: 'Coupe', garnish: 'Lime wheel', isAlcoholic: true },
  { name: 'Lemon Drop Martini', ingredients: ['45 ml vodka', '22 ml Cointreau', '22 ml fresh lemon juice', '15 ml simple syrup', 'Sugar rim'], glass: 'Martini', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Black Russian', ingredients: ['45 ml vodka', '22 ml Kahlúa'], glass: 'Rocks', garnish: 'None', isAlcoholic: true },
  { name: 'White Russian', ingredients: ['45 ml vodka', '22 ml Kahlúa', '30 ml heavy cream'], glass: 'Rocks', garnish: 'None', isAlcoholic: true },
  { name: 'Bloody Mary', ingredients: ['60 ml vodka', '120 ml tomato juice', '15 ml fresh lemon juice', '2 dashes Worcestershire sauce', '2 dashes Tabasco', 'Pinch of salt and pepper', 'Pinch of celery salt'], glass: 'Highball', garnish: 'Celery stalk, lemon wedge', isAlcoholic: true },
  { name: 'Harvey Wallbanger', ingredients: ['45 ml vodka', '15 ml Galliano', '120 ml fresh orange juice'], glass: 'Highball', garnish: 'Orange slice, cherry', isAlcoholic: true },
  { name: 'Sex on the Beach', ingredients: ['30 ml vodka', '15 ml peach schnapps', '60 ml orange juice', '60 ml cranberry juice'], glass: 'Highball', garnish: 'Orange slice', isAlcoholic: true },
  { name: 'Blue Lagoon', ingredients: ['30 ml vodka', '15 ml blue curaçao', '120 ml lemonade'], glass: 'Highball', garnish: 'Orange slice, cherry', isAlcoholic: true },
  { name: 'Screwdriver', ingredients: ['45 ml vodka', '120 ml fresh orange juice'], glass: 'Highball', garnish: 'Orange slice', isAlcoholic: true },
  { name: 'Greyhound', ingredients: ['45 ml vodka', '120 ml fresh grapefruit juice'], glass: 'Highball', garnish: 'Grapefruit wedge', isAlcoholic: true },
  { name: 'Salty Dog', ingredients: ['45 ml vodka', '120 ml fresh grapefruit juice', 'Salt rim'], glass: 'Highball', garnish: 'Grapefruit wedge', isAlcoholic: true },
  { name: 'Madras', ingredients: ['45 ml vodka', '60 ml cranberry juice', '60 ml orange juice'], glass: 'Highball', garnish: 'Lime wedge', isAlcoholic: true },
  { name: 'Sea Breeze', ingredients: ['45 ml vodka', '90 ml cranberry juice', '30 ml fresh grapefruit juice'], glass: 'Highball', garnish: 'Lime wedge', isAlcoholic: true },
  { name: 'Bay Breeze', ingredients: ['45 ml vodka', '90 ml cranberry juice', '30 ml pineapple juice'], glass: 'Highball', garnish: 'Lime wedge', isAlcoholic: true },
  { name: 'Cape Codder', ingredients: ['45 ml vodka', '120 ml cranberry juice', '15 ml fresh lime juice'], glass: 'Highball', garnish: 'Lime wedge', isAlcoholic: true },
  { name: 'Vesper', ingredients: ['60 ml gin', '15 ml vodka', '7 ml Lillet Blanc'], glass: 'Martini', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Negroni Bianco', ingredients: ['30 ml gin', '30 ml Suze or Gentian liqueur', '30 ml Lillet Blanc'], glass: 'Rocks', garnish: 'Grapefruit twist', isAlcoholic: true },
  { name: 'White Negroni', ingredients: ['30 ml gin', '30 ml Suze', '30 ml Lillet Blanc'], glass: 'Rocks', garnish: 'Grapefruit twist', isAlcoholic: true },
  { name: 'Mezcal Margarita', ingredients: ['45 ml mezcal', '22 ml Cointreau', '22 ml fresh lime juice', '7 ml agave nectar'], glass: 'Rocks', garnish: 'Lime wheel', isAlcoholic: true },
  { name: 'Smoky Paloma', ingredients: ['45 ml mezcal', '15 ml fresh lime juice', '120 ml grapefruit soda'], glass: 'Highball', garnish: 'Grapefruit wedge, salt rim', isAlcoholic: true },
  { name: 'Nuclear Daiquiri', ingredients: ['22 ml overproof white rum', '22 ml green Chartreuse', '22 ml fresh lime juice', '15 ml falernum'], glass: 'Coupe', garnish: 'None', isAlcoholic: true },
  { name: 'Rum Runner', ingredients: ['30 ml dark rum', '30 ml light rum', '15 ml blackberry liqueur', '15 ml banana liqueur', '30 ml fresh orange juice', '30 ml pineapple juice', '15 ml grenadine'], glass: 'Hurricane', garnish: 'Orange slice, cherry', isAlcoholic: true },
  { name: 'Painkiller', ingredients: ['60 ml dark rum', '120 ml pineapple juice', '30 ml fresh orange juice', '30 ml coconut cream'], glass: 'Hurricane', garnish: 'Nutmeg, orange slice', isAlcoholic: true },
  { name: 'Navy Grog', ingredients: ['30 ml dark Jamaican rum', '30 ml Demerara rum', '30 ml white rum', '22 ml fresh lime juice', '22 ml fresh grapefruit juice', '15 ml honey syrup', '15 ml allspice dram'], glass: 'Tiki mug', garnish: 'Mint', isAlcoholic: true },
  { name: 'Three Dots and a Dash', ingredients: ['30 ml aged rhum agricole', '30 ml dark Jamaican rum', '15 ml fresh lime juice', '15 ml fresh orange juice', '15 ml honey syrup', '7 ml falernum', '7 ml allspice dram', '2 dashes Angostura bitters'], glass: 'Tiki mug', garnish: 'Pineapple fronds, brandied cherries', isAlcoholic: true },
  { name: 'Scorpion Bowl', ingredients: ['60 ml light rum', '30 ml brandy', '30 ml gin', '60 ml fresh orange juice', '45 ml fresh lemon juice', '30 ml orgeat syrup'], glass: 'Scorpion bowl', garnish: 'Gardenia, mint', isAlcoholic: true },
  { name: 'Spicy Margarita', ingredients: ['60 ml tequila', '30 ml fresh lime juice', '22 ml agave nectar', '3 slices jalapeño'], glass: 'Rocks', garnish: 'Jalapeño slice, lime wheel', isAlcoholic: true },
  { name: 'Frozen Margarita', ingredients: ['60 ml tequila', '30 ml fresh lime juice', '22 ml Cointreau', '15 ml agave nectar', '1 cup crushed ice'], glass: 'Margarita', garnish: 'Lime wheel, salt rim', isAlcoholic: true },
  { name: 'Frozen Daiquiri', ingredients: ['60 ml white rum', '30 ml fresh lime juice', '22 ml simple syrup', '1 cup crushed ice'], glass: 'Coupe', garnish: 'Lime wheel', isAlcoholic: true },
  { name: 'Frozen Strawberry Daiquiri', ingredients: ['60 ml white rum', '22 ml fresh lime juice', '15 ml simple syrup', '6 fresh strawberries', '1 cup crushed ice'], glass: 'Hurricane', garnish: 'Strawberry', isAlcoholic: true },
  { name: 'Pimm\'s Cup', ingredients: ['60 ml Pimm\'s No. 1', '120 ml lemon-lime soda or ginger ale', 'Cucumber slices', 'Strawberry slices', 'Mint leaves', 'Orange slice'], glass: 'Highball', garnish: 'Cucumber, strawberry, mint', isAlcoholic: true },
  { name: 'Hugo Spritz', ingredients: ['30 ml elderflower syrup', '120 ml prosecco', '30 ml soda water', '3-4 mint leaves'], glass: 'Wine', garnish: 'Mint sprig', isAlcoholic: true },
  { name: 'Limoncello Spritz', ingredients: ['30 ml limoncello', '90 ml prosecco', '30 ml soda water'], glass: 'Wine', garnish: 'Lemon slice', isAlcoholic: true },
  { name: 'Sbagliato', ingredients: ['30 ml Campari', '30 ml sweet vermouth', '30 ml prosecco'], glass: 'Rocks', garnish: 'Orange slice', isAlcoholic: true },
  { name: 'Americano', ingredients: ['30 ml Campari', '30 ml sweet vermouth', 'Soda water'], glass: 'Highball', garnish: 'Orange slice', isAlcoholic: true },
  { name: 'Campari Spritz', ingredients: ['45 ml Campari', '90 ml prosecco', '30 ml soda water'], glass: 'Wine', garnish: 'Orange slice', isAlcoholic: true },
  { name: 'Cynar Spritz', ingredients: ['45 ml Cynar', '90 ml prosecco', '30 ml soda water'], glass: 'Wine', garnish: 'Orange slice', isAlcoholic: true },
  { name: 'Garibaldi', ingredients: ['45 ml Campari', '120 ml fresh fluffy orange juice'], glass: 'Highball', garnish: 'Orange wedge', isAlcoholic: true },
  { name: 'Milano-Torino', ingredients: ['30 ml Campari', '30 ml sweet vermouth'], glass: 'Rocks', garnish: 'Orange slice', isAlcoholic: true },
  { name: 'Paper Plane #2 (Mezcal)', ingredients: ['22 ml mezcal', '22 ml Aperol', '22 ml Amaro Montenegro', '22 ml fresh lemon juice'], glass: 'Coupe', garnish: 'None', isAlcoholic: true },
  { name: 'Fernet con Coca', ingredients: ['60 ml Fernet-Branca', '150 ml Coca-Cola'], glass: 'Highball', garnish: 'None', isAlcoholic: true },
  { name: 'Montenegro Sour', ingredients: ['60 ml Amaro Montenegro', '22 ml fresh lemon juice', '15 ml simple syrup', '1 egg white'], glass: 'Coupe', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Irish Coffee', ingredients: ['45 ml Irish whiskey', '120 ml hot coffee', '15 ml brown sugar syrup', 'Lightly whipped cream (float)'], glass: 'Irish coffee glass', garnish: 'Whipped cream', isAlcoholic: true },
  { name: 'Hot Toddy', ingredients: ['60 ml bourbon or scotch', '22 ml honey', '22 ml fresh lemon juice', '120 ml hot water', '1 cinnamon stick'], glass: 'Mug', garnish: 'Cinnamon stick, lemon wheel', isAlcoholic: true },
  { name: 'Mulled Wine', ingredients: ['750 ml red wine', '60 ml brandy', '60 ml honey', '1 orange sliced', '2 cinnamon sticks', '4 whole cloves', '3 star anise', '4 cardamom pods'], glass: 'Mug', garnish: 'Cinnamon stick, orange slice', isAlcoholic: true },
  { name: 'Glühwein', ingredients: ['750 ml red wine', '100 g sugar', '2 cinnamon sticks', '3 whole cloves', '2 star anise', '1 orange sliced', '1 lemon sliced'], glass: 'Mug', garnish: 'Cinnamon stick, orange peel', isAlcoholic: true },
  { name: 'Tom and Jerry', ingredients: ['30 ml dark rum', '30 ml brandy', '1 egg separated', '2 tbsp sugar', '120 ml hot milk', 'Pinch of allspice'], glass: 'Mug', garnish: 'Nutmeg', isAlcoholic: true },
  { name: 'Eggnog (Cocktail)', ingredients: ['60 ml bourbon', '30 ml cognac', '2 eggs', '30 ml simple syrup', '120 ml whole milk', '60 ml heavy cream', 'Nutmeg'], glass: 'Rocks', garnish: 'Fresh grated nutmeg', isAlcoholic: true },
  { name: 'Buttered Rum', ingredients: ['60 ml dark rum', '15 ml brown sugar syrup', '7 g butter', '120 ml hot water', 'Pinch of cinnamon', 'Pinch of nutmeg'], glass: 'Mug', garnish: 'Cinnamon stick', isAlcoholic: true },
  { name: 'Café de Olla Cocktail', ingredients: ['45 ml reposado tequila', '15 ml Kahlúa', '120 ml hot cinnamon-piloncillo coffee'], glass: 'Mug', garnish: 'Cinnamon stick', isAlcoholic: true },
  { name: 'Bamboo Cocktail', ingredients: ['45 ml dry sherry', '45 ml dry vermouth', '1 dash Angostura bitters', '1 dash orange bitters'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Adonis', ingredients: ['45 ml dry sherry', '30 ml sweet vermouth', '2 dashes orange bitters'], glass: 'Coupe', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Sherry Cobbler', ingredients: ['90 ml Amontillado sherry', '15 ml simple syrup', '2 orange slices'], glass: 'Wine', garnish: 'Mint sprig, berries, orange', isAlcoholic: true },
  { name: 'Rebujito', ingredients: ['60 ml fino sherry', '120 ml 7-Up or Sprite', 'Mint leaves'], glass: 'Wine', garnish: 'Mint sprig', isAlcoholic: true },
  { name: 'Porto Tonico', ingredients: ['60 ml white port', '120 ml tonic water', 'Mint leaves'], glass: 'Wine', garnish: 'Mint sprig, lemon twist', isAlcoholic: true },
  { name: 'Kalimotxo', ingredients: ['120 ml red wine', '120 ml Coca-Cola'], glass: 'Highball', garnish: 'Lemon wedge', isAlcoholic: true },
  { name: 'Tinto de Verano', ingredients: ['120 ml red wine', '120 ml lemon soda (Fanta Limón)'], glass: 'Wine', garnish: 'Lemon slice, orange slice', isAlcoholic: true },
  { name: 'Sangria', ingredients: ['750 ml red wine', '120 ml brandy', '60 ml orange juice', '30 ml simple syrup', '1 orange sliced', '1 lemon sliced', '1 apple diced', 'Soda water'], glass: 'Pitcher/Wine', garnish: 'Fruit slices', isAlcoholic: true },
  { name: 'White Sangria', ingredients: ['750 ml white wine', '120 ml elderflower liqueur', '60 ml fresh lemon juice', '30 ml simple syrup', '1 peach sliced', '1 green apple sliced', '150 g green grapes', 'Soda water'], glass: 'Pitcher/Wine', garnish: 'Fruit slices, mint', isAlcoholic: true },
  { name: 'Champagne Cocktail', ingredients: ['1 sugar cube', '2 dashes Angostura bitters', '120 ml champagne', '15 ml cognac (optional)'], glass: 'Champagne flute', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Mimosa', ingredients: ['60 ml fresh orange juice', '120 ml champagne'], glass: 'Champagne flute', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Buck\'s Fizz', ingredients: ['60 ml fresh orange juice', '120 ml champagne'], glass: 'Champagne flute', garnish: 'None', isAlcoholic: true },
  // Mocktails / Non-alcoholic
  { name: 'Shirley Temple', ingredients: ['180 ml ginger ale', '15 ml grenadine', '15 ml fresh lime juice'], glass: 'Highball', garnish: 'Maraschino cherry, orange slice', isAlcoholic: false },
  { name: 'Roy Rogers', ingredients: ['180 ml cola', '15 ml grenadine', '15 ml fresh lime juice'], glass: 'Highball', garnish: 'Maraschino cherry', isAlcoholic: false },
  { name: 'Arnold Palmer', ingredients: ['120 ml iced tea', '120 ml lemonade'], glass: 'Highball', garnish: 'Lemon wedge', isAlcoholic: false },
  { name: 'Virgin Piña Colada', ingredients: ['120 ml pineapple juice', '30 ml coconut cream', '1 cup crushed ice'], glass: 'Hurricane', garnish: 'Pineapple wedge, cherry', isAlcoholic: false },
  { name: 'Virgin Mary', ingredients: ['180 ml tomato juice', '15 ml fresh lemon juice', '2 dashes Worcestershire sauce', '2 dashes Tabasco', 'Pinch of salt and pepper', 'Pinch of celery salt'], glass: 'Highball', garnish: 'Celery stalk, lemon wedge', isAlcoholic: false },
  { name: 'Nojito', ingredients: ['30 ml fresh lime juice', '15 ml simple syrup', '8-10 mint leaves', '120 ml soda water'], glass: 'Highball', garnish: 'Mint sprig, lime wheel', isAlcoholic: false },
  { name: 'Seedlip Garden & Tonic', ingredients: ['50 ml Seedlip Garden 108', '150 ml premium tonic water'], glass: 'Copa', garnish: 'Sugar snap pea, rosemary', isAlcoholic: false },
  { name: 'Cucumber Cooler', ingredients: ['6 cucumber slices', '15 ml fresh lime juice', '15 ml simple syrup', '150 ml soda water'], glass: 'Highball', garnish: 'Cucumber ribbon', isAlcoholic: false },
  { name: 'Passion Fruit Lemonade', ingredients: ['60 ml passion fruit purée', '30 ml fresh lemon juice', '15 ml simple syrup', '120 ml soda water'], glass: 'Highball', garnish: 'Passion fruit half', isAlcoholic: false },
  { name: 'Lavender Lemonade', ingredients: ['30 ml lavender syrup', '30 ml fresh lemon juice', '150 ml soda water'], glass: 'Highball', garnish: 'Lavender sprig', isAlcoholic: false },
  { name: 'Ginger Beer Mocktail', ingredients: ['180 ml ginger beer', '30 ml fresh lime juice', '15 ml honey syrup', 'Mint leaves'], glass: 'Copper mug', garnish: 'Lime wheel, mint', isAlcoholic: false },
  { name: 'Pomegranate Fizz', ingredients: ['60 ml pomegranate juice', '15 ml fresh lime juice', '15 ml simple syrup', '120 ml soda water'], glass: 'Highball', garnish: 'Pomegranate seeds', isAlcoholic: false },
  { name: 'Berry Smash Mocktail', ingredients: ['6 fresh strawberries', '4 fresh raspberries', '15 ml fresh lemon juice', '15 ml simple syrup', '120 ml soda water'], glass: 'Rocks', garnish: 'Berries, mint', isAlcoholic: false },
  { name: 'Mango Lassi Mocktail', ingredients: ['120 ml mango purée', '60 ml yogurt', '15 ml honey', '60 ml cold water', 'Pinch of cardamom'], glass: 'Highball', garnish: 'Mango slice', isAlcoholic: false },
  { name: 'Coconut Lime Refresher', ingredients: ['60 ml coconut water', '30 ml fresh lime juice', '15 ml coconut syrup', '120 ml soda water'], glass: 'Highball', garnish: 'Lime wheel, toasted coconut', isAlcoholic: false },
  { name: 'Rosemary Grapefruit Soda', ingredients: ['120 ml fresh grapefruit juice', '30 ml rosemary simple syrup', '90 ml soda water'], glass: 'Highball', garnish: 'Rosemary sprig, grapefruit wedge', isAlcoholic: false },
  { name: 'Elderflower Collins Mocktail', ingredients: ['30 ml elderflower cordial', '30 ml fresh lemon juice', '150 ml soda water'], glass: 'Collins', garnish: 'Lemon wheel, mint', isAlcoholic: false },
  { name: 'Turmeric Golden Tonic', ingredients: ['15 ml turmeric syrup', '15 ml fresh lemon juice', '15 ml honey', '150 ml tonic water'], glass: 'Highball', garnish: 'Lemon wheel', isAlcoholic: false },
  { name: 'Spiced Apple Cider Mocktail', ingredients: ['180 ml apple cider', '15 ml fresh lemon juice', '15 ml cinnamon syrup', '2 dashes Angostura bitters (non-alcoholic)'], glass: 'Mug', garnish: 'Apple slice, cinnamon stick', isAlcoholic: false },
  { name: 'Chai Spiced Latte Mocktail', ingredients: ['120 ml strong chai tea (cooled)', '30 ml vanilla syrup', '30 ml oat milk', 'Crushed ice'], glass: 'Highball', garnish: 'Cinnamon dust', isAlcoholic: false },
  // More regional / classic cocktails
  { name: 'Daiquiri No. 3', ingredients: ['60 ml white rum', '15 ml fresh grapefruit juice', '15 ml maraschino liqueur', '15 ml fresh lime juice', '15 ml simple syrup'], glass: 'Coupe', garnish: 'Lime wheel', isAlcoholic: true },
  { name: 'El Presidente', ingredients: ['45 ml white rum', '22 ml dry curaçao', '22 ml dry vermouth', '1 tsp grenadine'], glass: 'Coupe', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Mary Pickford', ingredients: ['45 ml white rum', '45 ml pineapple juice', '7 ml grenadine', '7 ml maraschino liqueur'], glass: 'Coupe', garnish: 'Brandied cherry', isAlcoholic: true },
  { name: 'Rum Punch (Caribbean)', ingredients: ['60 ml dark rum', '30 ml fresh lime juice', '15 ml simple syrup', '60 ml pineapple juice', '60 ml orange juice', '15 ml grenadine', '3 dashes Angostura bitters', 'Dash of nutmeg'], glass: 'Highball', garnish: 'Orange slice, nutmeg', isAlcoholic: true },
  { name: 'Hotel Nacional Special', ingredients: ['45 ml white rum', '15 ml apricot brandy', '30 ml pineapple juice', '15 ml fresh lime juice'], glass: 'Coupe', garnish: 'Lime wheel', isAlcoholic: true },
  { name: 'Queen\'s Park Swizzle', ingredients: ['60 ml Demerara rum', '22 ml fresh lime juice', '15 ml simple syrup', '6-8 mint leaves', '2 dashes Angostura bitters'], glass: 'Highball', garnish: 'Mint bouquet', isAlcoholic: true },
  { name: 'Cojito', ingredients: ['60 ml white rum', '30 ml coconut cream', '22 ml fresh lime juice', '15 ml simple syrup', '6-8 mint leaves'], glass: 'Highball', garnish: 'Mint sprig, toasted coconut', isAlcoholic: true },
  { name: 'Corn \'n\' Oil', ingredients: ['60 ml blackstrap rum', '30 ml falernum', '15 ml fresh lime juice', '2 dashes Angostura bitters'], glass: 'Rocks', garnish: 'Lime wedge', isAlcoholic: true },
  { name: 'Bermuda Rum Swizzle', ingredients: ['30 ml dark rum', '30 ml gold rum', '60 ml pineapple juice', '60 ml fresh orange juice', '30 ml falernum', '15 ml grenadine', '6 dashes Angostura bitters'], glass: 'Highball', garnish: 'Orange slice, cherry', isAlcoholic: true },
  { name: 'Banana Daiquiri', ingredients: ['60 ml white rum', '22 ml fresh lime juice', '15 ml simple syrup', '1 ripe banana', '1 cup crushed ice'], glass: 'Hurricane', garnish: 'Banana slice', isAlcoholic: true },
  { name: 'Mojito de Fresa', ingredients: ['60 ml white rum', '22 ml fresh lime juice', '15 ml simple syrup', '4 strawberries', '6 mint leaves', 'Soda water'], glass: 'Highball', garnish: 'Strawberry, mint', isAlcoholic: true },
  { name: 'Cuba Libre', ingredients: ['60 ml white rum', '15 ml fresh lime juice', '150 ml Coca-Cola'], glass: 'Highball', garnish: 'Lime wedge', isAlcoholic: true },
  { name: 'Between the Sheets', ingredients: ['22 ml cognac', '22 ml white rum', '22 ml triple sec', '15 ml fresh lemon juice'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Stinger', ingredients: ['45 ml cognac', '22 ml white crème de menthe'], glass: 'Coupe', garnish: 'Mint sprig', isAlcoholic: true },
  { name: 'Brandy Alexander', ingredients: ['30 ml cognac', '30 ml dark crème de cacao', '30 ml heavy cream'], glass: 'Coupe', garnish: 'Fresh grated nutmeg', isAlcoholic: true },
  { name: 'Brandy Crusta', ingredients: ['45 ml cognac', '7 ml maraschino liqueur', '7 ml orange curaçao', '15 ml fresh lemon juice', '2 dashes Angostura bitters', 'Sugar rim, long lemon peel'], glass: 'Coupe', garnish: 'Sugar rim, lemon peel spiral', isAlcoholic: true },
  { name: 'Champs-Élysées', ingredients: ['45 ml cognac', '15 ml green Chartreuse', '15 ml fresh lemon juice', '7 ml simple syrup', '1 dash Angostura bitters'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Japanese Cocktail', ingredients: ['60 ml cognac', '15 ml orgeat syrup', '2 dashes Angostura bitters'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Pisco Punch', ingredients: ['60 ml pisco', '30 ml pineapple gum syrup', '15 ml fresh lemon juice', '15 ml fresh pineapple juice'], glass: 'Coupe', garnish: 'Pineapple wedge', isAlcoholic: true },
  { name: 'Grasshopper', ingredients: ['30 ml green crème de menthe', '30 ml white crème de cacao', '30 ml heavy cream'], glass: 'Coupe', garnish: 'Mint leaf', isAlcoholic: true },
  { name: 'Pink Squirrel', ingredients: ['30 ml crème de noyaux', '30 ml white crème de cacao', '30 ml heavy cream'], glass: 'Coupe', garnish: 'None', isAlcoholic: true },
  { name: 'Golden Cadillac', ingredients: ['30 ml Galliano', '30 ml white crème de cacao', '30 ml heavy cream'], glass: 'Coupe', garnish: 'None', isAlcoholic: true },
  { name: 'Midori Sour', ingredients: ['45 ml Midori', '22 ml fresh lemon juice', '15 ml simple syrup', 'Soda water'], glass: 'Highball', garnish: 'Cherry, orange slice', isAlcoholic: true },
  { name: 'Amaretto Disaronno Sour', ingredients: ['60 ml Amaretto Disaronno', '30 ml fresh lemon juice', '15 ml simple syrup'], glass: 'Rocks', garnish: 'Cherry', isAlcoholic: true },
  { name: 'Frangelico Espresso Martini', ingredients: ['30 ml Frangelico', '30 ml vodka', '30 ml espresso', '15 ml simple syrup'], glass: 'Martini', garnish: 'Coffee beans', isAlcoholic: true },
  { name: 'Sambuca Caffè', ingredients: ['30 ml sambuca', '1 espresso', '3 coffee beans'], glass: 'Shot', garnish: 'Coffee beans', isAlcoholic: true },
  { name: 'Kamikaze', ingredients: ['30 ml vodka', '30 ml triple sec', '30 ml fresh lime juice'], glass: 'Coupe', garnish: 'Lime wheel', isAlcoholic: true },
  { name: 'Woo Woo', ingredients: ['30 ml vodka', '30 ml peach schnapps', '120 ml cranberry juice'], glass: 'Highball', garnish: 'Lime wedge', isAlcoholic: true },
  { name: 'Jäger Bomb', ingredients: ['30 ml Jägermeister', '250 ml Red Bull'], glass: 'Pint', garnish: 'None', isAlcoholic: true },
  { name: 'Paloma Rosa', ingredients: ['45 ml tequila blanco', '30 ml fresh grapefruit juice', '15 ml fresh lime juice', '15 ml grenadine', '90 ml soda water'], glass: 'Highball', garnish: 'Grapefruit wedge', isAlcoholic: true },
  { name: 'Mexican Hot Chocolate Cocktail', ingredients: ['45 ml reposado tequila', '15 ml Kahlúa', '180 ml hot chocolate', 'Pinch of cayenne', 'Pinch of cinnamon'], glass: 'Mug', garnish: 'Whipped cream, cinnamon', isAlcoholic: true },
  { name: 'Matador', ingredients: ['45 ml tequila', '60 ml pineapple juice', '15 ml fresh lime juice'], glass: 'Coupe', garnish: 'Pineapple wedge', isAlcoholic: true },
  { name: 'Ranch Water', ingredients: ['60 ml tequila blanco', '30 ml fresh lime juice', '120 ml Topo Chico mineral water'], glass: 'Highball', garnish: 'Lime wedge', isAlcoholic: true },
  { name: 'Tequila Old Fashioned', ingredients: ['60 ml añejo tequila', '7 ml agave nectar', '2 dashes Angostura bitters', '1 dash mole bitters'], glass: 'Rocks', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Anejo Highball', ingredients: ['45 ml añejo tequila', '15 ml orange curaçao', '2 dashes Angostura bitters', '120 ml ginger beer'], glass: 'Highball', garnish: 'Orange slice', isAlcoholic: true },
  { name: 'Mezcal Mule', ingredients: ['60 ml mezcal', '15 ml fresh lime juice', '120 ml ginger beer'], glass: 'Copper mug', garnish: 'Lime wheel', isAlcoholic: true },
  { name: 'Oaxacan Dead', ingredients: ['45 ml mezcal', '22 ml crème de mûre', '22 ml fresh lime juice', '15 ml simple syrup'], glass: 'Coupe', garnish: 'Blackberry', isAlcoholic: true },
  { name: 'Mezcal Paloma', ingredients: ['45 ml mezcal', '15 ml fresh lime juice', '120 ml grapefruit soda', 'Salt rim'], glass: 'Highball', garnish: 'Grapefruit wedge', isAlcoholic: true },
  { name: 'Smoke & Mirrors', ingredients: ['45 ml mezcal', '22 ml elderflower liqueur', '22 ml fresh lime juice', '15 ml simple syrup'], glass: 'Coupe', garnish: 'Grapefruit twist', isAlcoholic: true },
  { name: 'Tommy\'s Mezcal Margarita', ingredients: ['60 ml mezcal', '22 ml fresh lime juice', '15 ml agave nectar'], glass: 'Rocks', garnish: 'Lime wheel', isAlcoholic: true },
  // Asian-inspired cocktails
  { name: 'Japanese Highball', ingredients: ['45 ml Japanese whisky', '150 ml soda water'], glass: 'Highball', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Mizuwari', ingredients: ['45 ml Japanese whisky', '90 ml still mineral water'], glass: 'Rocks', garnish: 'None', isAlcoholic: true },
  { name: 'Yuzu Sour', ingredients: ['45 ml gin', '30 ml yuzu juice', '15 ml simple syrup', '1 egg white'], glass: 'Coupe', garnish: 'Yuzu peel', isAlcoholic: true },
  { name: 'Sake Martini', ingredients: ['45 ml vodka', '22 ml sake', '15 ml dry vermouth'], glass: 'Martini', garnish: 'Cucumber slice', isAlcoholic: true },
  { name: 'Shochu Highball', ingredients: ['45 ml shochu', '150 ml soda water'], glass: 'Highball', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Umeshu Soda', ingredients: ['60 ml umeshu (plum wine)', '120 ml soda water'], glass: 'Highball', garnish: 'Ume plum', isAlcoholic: true },
  { name: 'Lychee Martini', ingredients: ['45 ml vodka', '15 ml lychee liqueur', '30 ml lychee juice'], glass: 'Martini', garnish: 'Lychee', isAlcoholic: true },
  { name: 'Thai Basil Smash', ingredients: ['60 ml gin', '22 ml fresh lime juice', '15 ml simple syrup', '8-10 Thai basil leaves'], glass: 'Rocks', garnish: 'Thai basil leaf', isAlcoholic: true },
  { name: 'Singapore Sling (Raffles)', ingredients: ['30 ml gin', '15 ml Cherry Heering', '7 ml Cointreau', '7 ml DOM Bénédictine', '120 ml pineapple juice', '15 ml fresh lime juice', '10 ml grenadine', '1 dash Angostura bitters'], glass: 'Hurricane', garnish: 'Pineapple wedge, cherry', isAlcoholic: true },
  { name: 'Tamarind Margarita', ingredients: ['45 ml tequila', '15 ml Cointreau', '30 ml tamarind purée', '15 ml fresh lime juice', '15 ml agave nectar'], glass: 'Rocks', garnish: 'Tajín rim, lime wheel', isAlcoholic: true },
  { name: 'Mango Chili Margarita', ingredients: ['45 ml tequila', '30 ml mango purée', '22 ml fresh lime juice', '15 ml agave nectar', '2 slices fresh chili'], glass: 'Rocks', garnish: 'Mango slice, chili', isAlcoholic: true },
  { name: 'Coconut Mojito', ingredients: ['60 ml coconut rum', '30 ml coconut cream', '22 ml fresh lime juice', '15 ml simple syrup', '6 mint leaves', 'Soda water'], glass: 'Highball', garnish: 'Mint, toasted coconut', isAlcoholic: true },
  { name: 'Kaffir Lime Gin & Tonic', ingredients: ['50 ml gin', '150 ml tonic water', '3 kaffir lime leaves'], glass: 'Copa', garnish: 'Kaffir lime leaf', isAlcoholic: true },
  { name: 'Pandan Whisky Sour', ingredients: ['60 ml pandan-infused bourbon', '22 ml fresh lemon juice', '15 ml simple syrup', '1 egg white'], glass: 'Rocks', garnish: 'Pandan leaf', isAlcoholic: true },
  // African & Middle Eastern cocktails
  { name: 'Dawa', ingredients: ['60 ml vodka', '1 lime cut into wedges', '2 tbsp honey', 'Crushed ice'], glass: 'Rocks', garnish: 'Dawa stick', isAlcoholic: true },
  { name: 'Rooibos Old Fashioned', ingredients: ['60 ml rooibos-infused bourbon', '7 ml honey syrup', '2 dashes orange bitters'], glass: 'Rocks', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Amarula Espresso Martini', ingredients: ['30 ml Amarula', '30 ml vodka', '30 ml espresso', '15 ml simple syrup'], glass: 'Martini', garnish: 'Coffee beans', isAlcoholic: true },
  { name: 'Saharan Sunset', ingredients: ['45 ml gin', '30 ml blood orange juice', '15 ml Campari', '15 ml simple syrup', 'Soda water'], glass: 'Highball', garnish: 'Blood orange slice', isAlcoholic: true },
  // South American cocktails
  { name: 'Batida de Coco', ingredients: ['60 ml cachaça', '30 ml coconut cream', '30 ml condensed milk', 'Crushed ice'], glass: 'Rocks', garnish: 'Toasted coconut', isAlcoholic: true },
  { name: 'Batida de Maracujá', ingredients: ['60 ml cachaça', '60 ml passion fruit purée', '30 ml condensed milk', 'Crushed ice'], glass: 'Rocks', garnish: 'Passion fruit half', isAlcoholic: true },
  { name: 'Terremoto', ingredients: ['30 ml pipeño wine', '30 ml Fernet-Branca', '1 scoop pineapple ice cream'], glass: 'Pint', garnish: 'None', isAlcoholic: true },
  { name: 'Chilcano', ingredients: ['60 ml pisco', '15 ml fresh lime juice', '120 ml ginger ale', '2 dashes Angostura bitters'], glass: 'Highball', garnish: 'Lime wheel', isAlcoholic: true },
  { name: 'Canchánchara', ingredients: ['60 ml aguardiente or white rum', '30 ml honey', '30 ml fresh lime juice', '60 ml water'], glass: 'Rocks', garnish: 'Lime wheel', isAlcoholic: true },
  // European cocktails
  { name: 'Bramble (Modern)', ingredients: ['45 ml gin', '22 ml fresh lemon juice', '15 ml simple syrup', '15 ml crème de mûre', 'Crushed ice'], glass: 'Rocks', garnish: 'Blackberry, lemon slice', isAlcoholic: true },
  { name: 'Spritz Veneziano', ingredients: ['40 ml Aperol', '60 ml prosecco', '20 ml soda water'], glass: 'Wine', garnish: 'Orange slice', isAlcoholic: true },
  { name: 'Munich Mule', ingredients: ['60 ml gin', '15 ml fresh lime juice', '120 ml ginger beer'], glass: 'Copper mug', garnish: 'Lime wheel, rosemary', isAlcoholic: true },
  { name: 'Nordic Summer', ingredients: ['45 ml aquavit', '22 ml elderflower cordial', '22 ml fresh lemon juice', '90 ml soda water'], glass: 'Highball', garnish: 'Dill sprig', isAlcoholic: true },
  { name: 'Finnish Long Drink (Lonkero)', ingredients: ['60 ml gin', '120 ml grapefruit soda'], glass: 'Highball', garnish: 'Grapefruit wedge', isAlcoholic: true },
  { name: 'Żubrówka & Apple', ingredients: ['60 ml Żubrówka bison grass vodka', '120 ml fresh apple juice'], glass: 'Highball', garnish: 'Apple slice', isAlcoholic: true },
  { name: 'Polish Mule', ingredients: ['60 ml Żubrówka vodka', '15 ml fresh lime juice', '120 ml ginger beer'], glass: 'Copper mug', garnish: 'Lime wheel', isAlcoholic: true },
  { name: 'Karsk', ingredients: ['60 ml aquavit', '120 ml hot black coffee', '1 tsp sugar'], glass: 'Coffee cup', garnish: 'None', isAlcoholic: true },
  { name: 'Glogg', ingredients: ['750 ml red wine', '120 ml aquavit', '100 g sugar', '5 cardamom pods', '5 whole cloves', '2 cinnamon sticks', '1 piece fresh ginger', 'Raisins', 'Blanched almonds'], glass: 'Mug', garnish: 'Raisins, almonds', isAlcoholic: true },
  // More spirit-forward classics
  { name: 'Bobby Burns', ingredients: ['45 ml scotch', '45 ml sweet vermouth', '7 ml Bénédictine'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Affinity', ingredients: ['30 ml scotch', '30 ml sweet vermouth', '30 ml dry vermouth', '2 dashes Angostura bitters'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Penicillin (Modern)', ingredients: ['60 ml blended scotch', '22 ml fresh lemon juice', '22 ml honey-ginger syrup', '7 ml Islay single malt (float)'], glass: 'Rocks', garnish: 'Candied ginger', isAlcoholic: true },
  { name: 'Cameron\'s Kick', ingredients: ['30 ml scotch', '30 ml Irish whiskey', '15 ml fresh lemon juice', '15 ml orgeat syrup'], glass: 'Coupe', garnish: 'None', isAlcoholic: true },
  { name: 'Highball (Scotch)', ingredients: ['45 ml scotch', '150 ml soda water'], glass: 'Highball', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Whisky Mac', ingredients: ['45 ml scotch', '45 ml Stone\'s green ginger wine'], glass: 'Rocks', garnish: 'None', isAlcoholic: true },
  { name: 'Fly', ingredients: ['30 ml scotch', '30 ml sweet vermouth', '15 ml Cointreau'], glass: 'Coupe', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Bourbon Renewal', ingredients: ['45 ml bourbon', '22 ml fresh lemon juice', '22 ml crème de cassis', '2 dashes Angostura bitters'], glass: 'Rocks', garnish: 'Lemon wheel', isAlcoholic: true },
  { name: 'Boulevardier (Mezcal)', ingredients: ['30 ml mezcal', '30 ml Campari', '30 ml sweet vermouth'], glass: 'Rocks', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Revolver', ingredients: ['60 ml bourbon', '15 ml Tia Maria or coffee liqueur', '2 dashes orange bitters'], glass: 'Coupe', garnish: 'Flamed orange twist', isAlcoholic: true },
  { name: 'Kentucky Buck', ingredients: ['45 ml bourbon', '15 ml fresh lemon juice', '15 ml simple syrup', '1 strawberry', '90 ml ginger beer', '2 dashes Angostura bitters'], glass: 'Highball', garnish: 'Strawberry', isAlcoholic: true },
  { name: 'Lion\'s Tail', ingredients: ['60 ml bourbon', '15 ml allspice dram', '15 ml fresh lime juice', '15 ml simple syrup', '2 dashes Angostura bitters'], glass: 'Coupe', garnish: 'None', isAlcoholic: true },
  { name: 'Seelbach Cocktail', ingredients: ['30 ml bourbon', '15 ml triple sec', '7 dashes Angostura bitters', '7 dashes Peychaud\'s bitters', '120 ml champagne'], glass: 'Champagne flute', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Presbyterian', ingredients: ['60 ml bourbon or scotch', '60 ml ginger ale', '60 ml soda water'], glass: 'Highball', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Irish Maid', ingredients: ['45 ml Irish whiskey', '22 ml elderflower liqueur', '22 ml fresh lemon juice', '15 ml simple syrup', '3 cucumber slices'], glass: 'Rocks', garnish: 'Cucumber ribbon', isAlcoholic: true },
  { name: 'Tipsy Horseman', ingredients: ['45 ml Irish whiskey', '22 ml Irish cream', '22 ml Frangelico'], glass: 'Rocks', garnish: 'None', isAlcoholic: true },
  { name: 'Caribbean Coffee', ingredients: ['45 ml dark rum', '120 ml hot coffee', '15 ml brown sugar syrup', 'Whipped cream'], glass: 'Irish coffee glass', garnish: 'Whipped cream, nutmeg', isAlcoholic: true },
  { name: 'Italian Margarita', ingredients: ['45 ml tequila', '22 ml amaretto', '22 ml fresh lime juice', '15 ml simple syrup'], glass: 'Rocks', garnish: 'Lime wheel', isAlcoholic: true },
  // ─── Additional batch 2 — More real cocktails to reach 1000 ───
  // Tiki & Tropical
  { name: 'Missionary\'s Downfall', ingredients: ['45 ml white rum', '15 ml peach liqueur', '30 ml fresh lime juice', '15 ml honey syrup', '10 mint leaves', '30 ml pineapple juice'], glass: 'Tiki mug', garnish: 'Mint bouquet', isAlcoholic: true },
  { name: 'Port au Prince', ingredients: ['60 ml dark rum', '22 ml falernum', '22 ml fresh lime juice', '15 ml pineapple juice'], glass: 'Rocks', garnish: 'Lime wheel', isAlcoholic: true },
  { name: 'Saturn (Classic)', ingredients: ['30 ml gin', '15 ml passion fruit syrup', '7 ml orgeat', '7 ml falernum', '15 ml fresh lemon juice'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Test Pilot', ingredients: ['30 ml dark Jamaican rum', '30 ml light Puerto Rican rum', '15 ml falernum', '15 ml fresh lime juice', '7 ml Cointreau', '1 dash Angostura bitters', '6 drops absinthe'], glass: 'Tiki mug', garnish: 'Cherry', isAlcoholic: true },
  { name: 'Doctor Funk', ingredients: ['45 ml dark rum', '15 ml overproof rum', '22 ml fresh lime juice', '15 ml grenadine', '7 ml absinthe', 'Soda water'], glass: 'Tiki mug', garnish: 'Lime wheel', isAlcoholic: true },
  { name: 'Cobra\'s Fang', ingredients: ['22 ml Jamaican rum', '22 ml aged rum', '15 ml lime juice', '15 ml orange juice', '15 ml passion fruit syrup', '7 ml falernum', '1 dash Angostura bitters', '6 drops absinthe'], glass: 'Tiki mug', garnish: 'Mint', isAlcoholic: true },
  { name: 'Suffering Bastard (Tiki)', ingredients: ['30 ml bourbon', '30 ml gin', '15 ml fresh lime juice', '2 dashes Angostura bitters', 'Ginger beer top'], glass: 'Highball', garnish: 'Mint, orange', isAlcoholic: true },
  { name: 'Tiki Ti Special', ingredients: ['45 ml light rum', '30 ml passion fruit syrup', '22 ml fresh lime juice', '15 ml orange curaçao', 'Crushed ice'], glass: 'Tiki mug', garnish: 'Orchid flower', isAlcoholic: true },
  { name: 'Hurricane (Original)', ingredients: ['30 ml dark rum', '30 ml light rum', '30 ml passion fruit juice', '15 ml fresh orange juice', '15 ml fresh lime juice', '15 ml simple syrup', '15 ml grenadine'], glass: 'Hurricane', garnish: 'Orange slice, cherry', isAlcoholic: true },
  { name: 'Blue Hawaii', ingredients: ['22 ml vodka', '22 ml light rum', '15 ml blue curaçao', '90 ml pineapple juice', '30 ml sweet and sour mix'], glass: 'Hurricane', garnish: 'Pineapple wedge, cherry', isAlcoholic: true },
  { name: 'Bahama Mama', ingredients: ['30 ml dark rum', '30 ml coconut rum', '15 ml coffee liqueur', '60 ml pineapple juice', '30 ml fresh lemon juice'], glass: 'Hurricane', garnish: 'Cherry, orange slice', isAlcoholic: true },
  { name: 'Tradewinds', ingredients: ['60 ml gold rum', '30 ml coconut cream', '90 ml orange juice', '60 ml pineapple juice'], glass: 'Hurricane', garnish: 'Orange slice, nutmeg', isAlcoholic: true },
  { name: 'Port Royal', ingredients: ['45 ml dark rum', '30 ml passion fruit purée', '22 ml fresh lime juice', '15 ml simple syrup', '15 ml allspice dram'], glass: 'Tiki mug', garnish: 'Lime shell, mint', isAlcoholic: true },
  // More gin cocktails
  { name: 'Aviation (Classic)', ingredients: ['45 ml London dry gin', '15 ml maraschino liqueur', '15 ml fresh lemon juice', '7 ml crème de violette'], glass: 'Coupe', garnish: 'Cherry', isAlcoholic: true },
  { name: 'Pink Gin', ingredients: ['60 ml Plymouth gin', '3 dashes Angostura bitters'], glass: 'Coupe', garnish: 'None', isAlcoholic: true },
  { name: 'Gin Daisy', ingredients: ['45 ml gin', '22 ml fresh lemon juice', '15 ml grenadine', 'Soda water'], glass: 'Highball', garnish: 'Orange slice, berries', isAlcoholic: true },
  { name: 'Gin Fizz', ingredients: ['45 ml gin', '22 ml fresh lemon juice', '15 ml simple syrup', 'Soda water'], glass: 'Highball', garnish: 'Lemon wheel', isAlcoholic: true },
  { name: 'Sloe Gin Fizz', ingredients: ['45 ml sloe gin', '22 ml fresh lemon juice', '15 ml simple syrup', 'Soda water'], glass: 'Highball', garnish: 'Lemon wheel', isAlcoholic: true },
  { name: 'Pink Lady', ingredients: ['45 ml gin', '15 ml applejack', '22 ml fresh lemon juice', '15 ml grenadine', '1 egg white'], glass: 'Coupe', garnish: 'Cherry', isAlcoholic: true },
  { name: 'Casino', ingredients: ['45 ml gin', '7 ml maraschino liqueur', '7 ml fresh lemon juice', '2 dashes orange bitters'], glass: 'Coupe', garnish: 'Cherry, lemon twist', isAlcoholic: true },
  { name: 'Tuxedo', ingredients: ['30 ml gin', '30 ml dry vermouth', '2 dashes maraschino liqueur', '2 dashes absinthe', '3 dashes orange bitters'], glass: 'Coupe', garnish: 'Cherry, lemon twist', isAlcoholic: true },
  { name: 'Gin Sling', ingredients: ['45 ml gin', '15 ml sweet vermouth', '15 ml fresh lemon juice', '15 ml simple syrup', '2 dashes Angostura bitters', 'Soda water'], glass: 'Highball', garnish: 'Lemon wheel', isAlcoholic: true },
  { name: 'Fallen Angel', ingredients: ['45 ml gin', '22 ml fresh lime juice', '2 dashes white crème de menthe', '1 dash Angostura bitters'], glass: 'Coupe', garnish: 'Cherry', isAlcoholic: true },
  { name: 'Maiden\'s Blush', ingredients: ['45 ml gin', '15 ml triple sec', '15 ml fresh lemon juice', '10 ml grenadine'], glass: 'Coupe', garnish: 'None', isAlcoholic: true },
  { name: 'Abbey Cocktail', ingredients: ['45 ml gin', '30 ml fresh orange juice', '15 ml Lillet Blanc', '2 dashes Angostura bitters'], glass: 'Coupe', garnish: 'Cherry', isAlcoholic: true },
  { name: 'Paradise Cocktail', ingredients: ['30 ml gin', '22 ml apricot brandy', '22 ml fresh orange juice'], glass: 'Coupe', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'White Lady', ingredients: ['30 ml gin', '22 ml Cointreau', '22 ml fresh lemon juice'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Monkey Gland', ingredients: ['45 ml gin', '30 ml fresh orange juice', '7 ml absinthe', '7 ml grenadine'], glass: 'Coupe', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'London Fog Cocktail', ingredients: ['30 ml gin', '15 ml Lillet Blanc', '15 ml fresh orange juice', '2 dashes absinthe'], glass: 'Coupe', garnish: 'None', isAlcoholic: true },
  { name: 'Jasmine', ingredients: ['30 ml gin', '22 ml Cointreau', '15 ml Campari', '22 ml fresh lemon juice'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Bronx', ingredients: ['30 ml gin', '15 ml sweet vermouth', '15 ml dry vermouth', '30 ml fresh orange juice'], glass: 'Coupe', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Martinez', ingredients: ['45 ml Old Tom gin', '30 ml sweet vermouth', '7 ml maraschino liqueur', '2 dashes Angostura bitters'], glass: 'Coupe', garnish: 'Orange twist', isAlcoholic: true },
  // More whiskey cocktails
  { name: 'Irish Sour', ingredients: ['60 ml Irish whiskey', '22 ml fresh lemon juice', '15 ml simple syrup', '1 egg white'], glass: 'Rocks', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Tipperary (Classic)', ingredients: ['30 ml Irish whiskey', '30 ml sweet vermouth', '15 ml green Chartreuse', '2 dashes Angostura bitters'], glass: 'Coupe', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'The Boulevardier (Scotch)', ingredients: ['30 ml blended scotch', '30 ml Campari', '30 ml sweet vermouth'], glass: 'Rocks', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'De La Louisiane', ingredients: ['45 ml rye whiskey', '22 ml sweet vermouth', '22 ml Bénédictine', '3 dashes absinthe', '3 dashes Peychaud\'s bitters'], glass: 'Coupe', garnish: 'Brandied cherry', isAlcoholic: true },
  { name: 'Frisco Sour', ingredients: ['45 ml rye whiskey', '15 ml Bénédictine', '22 ml fresh lemon juice', '15 ml fresh lime juice'], glass: 'Coupe', garnish: 'Lemon wheel', isAlcoholic: true },
  { name: 'Waldorf', ingredients: ['45 ml rye whiskey', '22 ml sweet vermouth', '7 ml absinthe', '2 dashes Angostura bitters'], glass: 'Coupe', garnish: 'Cherry', isAlcoholic: true },
  { name: 'Presbyterian (Classic)', ingredients: ['60 ml bourbon', '60 ml ginger ale', '60 ml club soda'], glass: 'Highball', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Pendennis Club', ingredients: ['45 ml gin', '22 ml apricot brandy', '15 ml fresh lime juice', '2 dashes Peychaud\'s bitters'], glass: 'Coupe', garnish: 'Cherry', isAlcoholic: true },
  { name: 'Remember the Maine', ingredients: ['60 ml rye whiskey', '22 ml sweet vermouth', '7 ml Cherry Heering', '2 dashes absinthe'], glass: 'Coupe', garnish: 'Cherry', isAlcoholic: true },
  { name: 'Blinker', ingredients: ['45 ml rye whiskey', '30 ml fresh grapefruit juice', '15 ml raspberry syrup'], glass: 'Coupe', garnish: 'None', isAlcoholic: true },
  { name: 'Up to Date', ingredients: ['30 ml rye whiskey', '30 ml dry sherry', '15 ml Grand Marnier', '2 dashes Angostura bitters'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Fancy Free', ingredients: ['60 ml bourbon', '15 ml maraschino liqueur', '1 dash Angostura bitters', '1 dash orange bitters'], glass: 'Rocks', garnish: 'Orange twist', isAlcoholic: true },
  // Vodka variations
  { name: 'Appletini', ingredients: ['45 ml vodka', '15 ml sour apple schnapps', '15 ml Cointreau', '22 ml fresh lemon juice'], glass: 'Martini', garnish: 'Apple slice', isAlcoholic: true },
  { name: 'Watermelon Martini', ingredients: ['60 ml vodka', '30 ml watermelon juice', '15 ml simple syrup', '15 ml fresh lime juice'], glass: 'Martini', garnish: 'Watermelon wedge', isAlcoholic: true },
  { name: 'Vesper (Classic)', ingredients: ['45 ml gin', '15 ml vodka', '7 ml Lillet Blanc'], glass: 'Martini', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'French Martini', ingredients: ['45 ml vodka', '15 ml Chambord', '60 ml pineapple juice'], glass: 'Martini', garnish: 'Raspberry', isAlcoholic: true },
  { name: 'Gummy Bear Cocktail', ingredients: ['45 ml vodka', '15 ml peach schnapps', '15 ml raspberry liqueur', '60 ml pineapple juice', '30 ml lemon-lime soda'], glass: 'Highball', garnish: 'Gummy bears', isAlcoholic: true },
  { name: 'Moscow Mule (Original)', ingredients: ['60 ml vodka', '15 ml fresh lime juice', '120 ml ginger beer'], glass: 'Copper mug', garnish: 'Lime wedge, mint', isAlcoholic: true },
  { name: 'Chi-Chi', ingredients: ['45 ml vodka', '30 ml coconut cream', '120 ml pineapple juice', 'Crushed ice'], glass: 'Hurricane', garnish: 'Pineapple wedge, cherry', isAlcoholic: true },
  { name: 'Caipiroska', ingredients: ['60 ml vodka', '1 lime cut into wedges', '2 tsp sugar'], glass: 'Rocks', garnish: 'Lime wedge', isAlcoholic: true },
  { name: 'Cucumber Collins', ingredients: ['45 ml vodka', '22 ml fresh lemon juice', '15 ml simple syrup', '4 cucumber slices', 'Soda water'], glass: 'Collins', garnish: 'Cucumber ribbon', isAlcoholic: true },
  { name: 'Sputnik', ingredients: ['45 ml vodka', '30 ml Fernet-Branca', '15 ml fresh lemon juice', '15 ml simple syrup'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
  // Rum classics
  { name: 'Rum Swizzle', ingredients: ['60 ml dark rum', '22 ml fresh lime juice', '15 ml simple syrup', '2 dashes Angostura bitters', 'Crushed ice'], glass: 'Highball', garnish: 'Mint, nutmeg', isAlcoholic: true },
  { name: 'Rum Punch (Classic)', ingredients: ['60 ml dark rum', '30 ml fresh lime juice', '15 ml grenadine', '60 ml orange juice', '60 ml pineapple juice'], glass: 'Highball', garnish: 'Orange, nutmeg', isAlcoholic: true },
  { name: 'Papa Doble', ingredients: ['60 ml white rum', '30 ml fresh grapefruit juice', '15 ml maraschino liqueur', '15 ml fresh lime juice'], glass: 'Coupe', garnish: 'Grapefruit twist', isAlcoholic: true },
  { name: 'Ancient Mariner', ingredients: ['30 ml dark Jamaican rum', '30 ml Demerara rum', '15 ml fresh lime juice', '15 ml fresh grapefruit juice', '15 ml allspice dram', '15 ml simple syrup'], glass: 'Tiki mug', garnish: 'Mint, lime', isAlcoholic: true },
  { name: 'Planter\'s Punch (IBA)', ingredients: ['45 ml dark rum', '35 ml fresh orange juice', '15 ml fresh lime juice', '10 ml sugar syrup', '10 ml grenadine', '3 dashes Angostura bitters'], glass: 'Highball', garnish: 'Cherry, pineapple', isAlcoholic: true },
  { name: 'Hurricane Pat O\'Brien', ingredients: ['60 ml dark rum', '60 ml passion fruit syrup', '30 ml fresh lime juice'], glass: 'Hurricane', garnish: 'Orange, cherry', isAlcoholic: true },
  { name: 'Bumbo', ingredients: ['60 ml dark rum', '15 ml simple syrup', '15 ml water', 'Pinch of nutmeg', 'Pinch of cinnamon'], glass: 'Rocks', garnish: 'Nutmeg', isAlcoholic: true },
  { name: 'Rum Flip', ingredients: ['60 ml aged rum', '15 ml simple syrup', '1 whole egg'], glass: 'Coupe', garnish: 'Nutmeg', isAlcoholic: true },
  { name: 'Rum Martinez', ingredients: ['45 ml aged rum', '30 ml sweet vermouth', '7 ml maraschino liqueur', '2 dashes Angostura bitters'], glass: 'Coupe', garnish: 'Cherry', isAlcoholic: true },
  { name: 'Hot Buttered Rum (Classic)', ingredients: ['60 ml dark rum', '15 ml butter', '2 tsp brown sugar', '120 ml hot water', 'Cinnamon', 'Nutmeg', 'Cloves'], glass: 'Mug', garnish: 'Cinnamon stick', isAlcoholic: true },
  // Brandy & Cognac
  { name: 'Sidecar (IBA)', ingredients: ['50 ml cognac', '20 ml Cointreau', '20 ml fresh lemon juice', 'Sugar rim'], glass: 'Coupe', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'French Connection', ingredients: ['45 ml cognac', '22 ml amaretto'], glass: 'Rocks', garnish: 'None', isAlcoholic: true },
  { name: 'Nikolashka', ingredients: ['45 ml cognac', 'Lemon slice', 'Sugar', 'Ground coffee'], glass: 'Shot', garnish: 'Lemon with sugar and coffee', isAlcoholic: true },
  { name: 'Horse\'s Neck (Brandy)', ingredients: ['45 ml brandy', '120 ml ginger ale', '2 dashes Angostura bitters'], glass: 'Highball', garnish: 'Long lemon peel', isAlcoholic: true },
  { name: 'Saratoga', ingredients: ['30 ml brandy', '30 ml rye whiskey', '30 ml sweet vermouth', '2 dashes Angostura bitters'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Pisco Collins', ingredients: ['60 ml pisco', '30 ml fresh lemon juice', '15 ml simple syrup', 'Soda water'], glass: 'Collins', garnish: 'Lemon wheel', isAlcoholic: true },
  { name: 'Pisco Apricot', ingredients: ['45 ml pisco', '22 ml apricot liqueur', '22 ml fresh lime juice', '15 ml simple syrup'], glass: 'Coupe', garnish: 'Apricot slice', isAlcoholic: true },
  { name: 'Metropolitan', ingredients: ['45 ml brandy', '30 ml sweet vermouth', '7 ml simple syrup', '2 dashes Angostura bitters'], glass: 'Coupe', garnish: 'Cherry', isAlcoholic: true },
  { name: 'Porto Flip', ingredients: ['30 ml brandy', '30 ml ruby port', '15 ml simple syrup', '1 whole egg'], glass: 'Coupe', garnish: 'Nutmeg', isAlcoholic: true },
  // Liqueur-based
  { name: 'Amaretto Ginger Sour', ingredients: ['45 ml amaretto', '22 ml fresh lemon juice', '15 ml ginger syrup', '1 egg white'], glass: 'Coupe', garnish: 'Candied ginger', isAlcoholic: true },
  { name: 'Apérol Fizz', ingredients: ['45 ml Aperol', '22 ml fresh lemon juice', '15 ml simple syrup', 'Soda water'], glass: 'Highball', garnish: 'Orange slice', isAlcoholic: true },
  { name: 'Campari & Soda', ingredients: ['45 ml Campari', '120 ml soda water'], glass: 'Highball', garnish: 'Orange slice', isAlcoholic: true },
  { name: 'Aperol Negroni', ingredients: ['30 ml gin', '30 ml Aperol', '30 ml sweet vermouth'], glass: 'Rocks', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Chartreuse Lemonade', ingredients: ['30 ml green Chartreuse', '22 ml fresh lemon juice', '15 ml simple syrup', '120 ml soda water'], glass: 'Highball', garnish: 'Lemon wheel', isAlcoholic: true },
  { name: 'Fernet Sour', ingredients: ['45 ml Fernet-Branca', '22 ml fresh lemon juice', '15 ml simple syrup', '1 egg white'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Amaro Spritz', ingredients: ['45 ml Amaro Montenegro', '90 ml prosecco', '30 ml soda water'], glass: 'Wine', garnish: 'Orange slice', isAlcoholic: true },
  { name: 'Select Spritz', ingredients: ['40 ml Select Aperitivo', '60 ml prosecco', '20 ml soda water'], glass: 'Wine', garnish: 'Green olive', isAlcoholic: true },
  { name: 'Crodino Spritz', ingredients: ['60 ml Crodino', '90 ml prosecco', '30 ml soda water'], glass: 'Wine', garnish: 'Orange slice', isAlcoholic: false },
  { name: 'Strega Daiquiri', ingredients: ['30 ml white rum', '15 ml Strega', '22 ml fresh lime juice', '15 ml simple syrup'], glass: 'Coupe', garnish: 'Lime wheel', isAlcoholic: true },
  { name: 'Bénédictine & Brandy (B&B)', ingredients: ['30 ml Bénédictine', '30 ml brandy'], glass: 'Snifter', garnish: 'None', isAlcoholic: true },
  { name: 'Disaronno Sour', ingredients: ['60 ml Disaronno amaretto', '30 ml fresh lemon juice', '15 ml simple syrup', '1 egg white'], glass: 'Rocks', garnish: 'Cherry', isAlcoholic: true },
  { name: 'Chambord Royale', ingredients: ['22 ml Chambord', '120 ml champagne'], glass: 'Champagne flute', garnish: 'Raspberry', isAlcoholic: true },
  // Wine & champagne cocktails
  { name: 'French 76', ingredients: ['30 ml vodka', '15 ml fresh lemon juice', '15 ml simple syrup', '60 ml champagne'], glass: 'Champagne flute', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Rossini', ingredients: ['60 ml strawberry purée', '120 ml prosecco'], glass: 'Champagne flute', garnish: 'Strawberry', isAlcoholic: true },
  { name: 'Tintoretto', ingredients: ['60 ml pomegranate juice', '120 ml prosecco'], glass: 'Champagne flute', garnish: 'Pomegranate seeds', isAlcoholic: true },
  { name: 'Puccini', ingredients: ['60 ml fresh mandarin juice', '120 ml prosecco'], glass: 'Champagne flute', garnish: 'Mandarin twist', isAlcoholic: true },
  { name: 'Kir', ingredients: ['15 ml crème de cassis', '120 ml dry white wine'], glass: 'Wine', garnish: 'None', isAlcoholic: true },
  { name: 'Spritzer', ingredients: ['90 ml dry white wine', '90 ml soda water'], glass: 'Wine', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Bishop', ingredients: ['120 ml red wine', '15 ml fresh lemon juice', '15 ml simple syrup', '2 dashes orange bitters'], glass: 'Wine', garnish: 'Orange slice', isAlcoholic: true },
  { name: 'New York Sour (Wine)', ingredients: ['60 ml bourbon', '22 ml fresh lemon juice', '15 ml simple syrup', '20 ml red wine float'], glass: 'Rocks', garnish: 'Cherry, lemon', isAlcoholic: true },
  { name: 'Mulled Cider', ingredients: ['500 ml apple cider', '60 ml bourbon', '30 ml honey', '2 cinnamon sticks', '4 whole cloves', '1 orange sliced'], glass: 'Mug', garnish: 'Cinnamon stick, apple slice', isAlcoholic: true },
  // Shot cocktails
  { name: 'Lemon Drop Shot', ingredients: ['30 ml vodka', '15 ml fresh lemon juice', '15 ml simple syrup', 'Sugar rim'], glass: 'Shot', garnish: 'Sugar rim, lemon wedge', isAlcoholic: true },
  { name: 'Kamikaze Shot', ingredients: ['15 ml vodka', '15 ml triple sec', '15 ml fresh lime juice'], glass: 'Shot', garnish: 'None', isAlcoholic: true },
  { name: 'Buttery Nipple', ingredients: ['15 ml butterscotch schnapps', '15 ml Baileys Irish Cream'], glass: 'Shot', garnish: 'None', isAlcoholic: true },
  { name: 'Blowjob Shot', ingredients: ['15 ml amaretto', '15 ml Baileys Irish Cream', 'Whipped cream'], glass: 'Shot', garnish: 'Whipped cream', isAlcoholic: true },
  { name: 'Cement Mixer', ingredients: ['30 ml Baileys Irish Cream', '15 ml fresh lime juice'], glass: 'Shot', garnish: 'None', isAlcoholic: true },
  { name: 'Melon Ball Shot', ingredients: ['15 ml vodka', '15 ml Midori', '30 ml pineapple juice'], glass: 'Shot', garnish: 'Melon ball', isAlcoholic: true },
  { name: 'Washington Apple', ingredients: ['15 ml Crown Royal', '15 ml sour apple schnapps', '15 ml cranberry juice'], glass: 'Shot', garnish: 'None', isAlcoholic: true },
  { name: 'Surfer on Acid', ingredients: ['15 ml Jägermeister', '15 ml coconut rum', '30 ml pineapple juice'], glass: 'Shot', garnish: 'None', isAlcoholic: true },
  { name: 'Green Tea Shot', ingredients: ['15 ml Irish whiskey', '15 ml peach schnapps', '15 ml sour mix', '15 ml lemon-lime soda'], glass: 'Shot', garnish: 'None', isAlcoholic: true },
  // More mocktails / non-alcoholic
  { name: 'Italian Soda', ingredients: ['30 ml flavored syrup (raspberry/vanilla/cherry)', '240 ml soda water', '30 ml heavy cream'], glass: 'Highball', garnish: 'Cherry', isAlcoholic: false },
  { name: 'Pineapple Ginger Fizz', ingredients: ['120 ml pineapple juice', '30 ml fresh lime juice', '15 ml ginger syrup', '120 ml soda water'], glass: 'Highball', garnish: 'Pineapple wedge', isAlcoholic: false },
  { name: 'Cinnamon Apple Spritzer', ingredients: ['120 ml apple juice', '15 ml cinnamon syrup', '15 ml fresh lemon juice', '120 ml sparkling water'], glass: 'Wine', garnish: 'Apple slice, cinnamon stick', isAlcoholic: false },
  { name: 'Tropical Sunrise Mocktail', ingredients: ['60 ml orange juice', '60 ml pineapple juice', '30 ml coconut cream', '15 ml grenadine'], glass: 'Hurricane', garnish: 'Orange slice, cherry', isAlcoholic: false },
  { name: 'Blueberry Basil Smash Mocktail', ingredients: ['8 blueberries', '4 basil leaves', '22 ml fresh lemon juice', '15 ml simple syrup', '120 ml soda water'], glass: 'Rocks', garnish: 'Blueberries, basil', isAlcoholic: false },
  { name: 'Peach Bellini Mocktail', ingredients: ['60 ml peach purée', '120 ml sparkling grape juice'], glass: 'Champagne flute', garnish: 'Peach slice', isAlcoholic: false },
  { name: 'Blackberry Sage Lemonade', ingredients: ['6 blackberries', '3 sage leaves', '30 ml fresh lemon juice', '15 ml simple syrup', '150 ml soda water'], glass: 'Highball', garnish: 'Blackberry, sage leaf', isAlcoholic: false },
  { name: 'Rose Lemonade', ingredients: ['15 ml rose syrup', '30 ml fresh lemon juice', '150 ml sparkling water'], glass: 'Highball', garnish: 'Edible rose petal', isAlcoholic: false },
  { name: 'Butterfly Pea Tonic', ingredients: ['30 ml butterfly pea flower tea', '15 ml simple syrup', '15 ml fresh lemon juice', '120 ml tonic water'], glass: 'Highball', garnish: 'Lemon wheel', isAlcoholic: false },
  { name: 'Matcha Highball', ingredients: ['2 g matcha powder', '30 ml warm water', '150 ml soda water', '15 ml simple syrup'], glass: 'Highball', garnish: 'None', isAlcoholic: false },
  { name: 'Kombucha Mule', ingredients: ['180 ml ginger kombucha', '15 ml fresh lime juice', '15 ml simple syrup'], glass: 'Copper mug', garnish: 'Lime wheel', isAlcoholic: false },
  { name: 'Sparkling Hibiscus Punch', ingredients: ['120 ml hibiscus tea', '60 ml fresh orange juice', '15 ml simple syrup', '120 ml sparkling water'], glass: 'Punch/Wine', garnish: 'Orange slice', isAlcoholic: false },
  { name: 'Cranberry Rosemary Spritzer', ingredients: ['90 ml cranberry juice', '15 ml rosemary syrup', '15 ml fresh lime juice', '120 ml sparkling water'], glass: 'Wine', garnish: 'Rosemary sprig, cranberries', isAlcoholic: false },
  { name: 'Golden Milk Latte', ingredients: ['120 ml oat milk', '15 ml turmeric paste', '15 ml honey', '120 ml hot water', 'Pinch of black pepper'], glass: 'Mug', garnish: 'Cinnamon dust', isAlcoholic: false },
  { name: 'Horchata Mocktail', ingredients: ['180 ml horchata', '15 ml vanilla syrup', 'Pinch of cinnamon', 'Ice'], glass: 'Highball', garnish: 'Cinnamon stick', isAlcoholic: false },
  { name: 'Citrus Shrub Soda', ingredients: ['30 ml citrus shrub (vinegar-based)', '15 ml honey', '150 ml soda water'], glass: 'Highball', garnish: 'Citrus wheel', isAlcoholic: false },
  { name: 'Watermelon Mint Cooler', ingredients: ['120 ml watermelon juice', '15 ml fresh lime juice', '6 mint leaves', '120 ml soda water'], glass: 'Highball', garnish: 'Watermelon wedge, mint', isAlcoholic: false },
  { name: 'Strawberry Basil Lemonade', ingredients: ['4 strawberries', '4 basil leaves', '30 ml fresh lemon juice', '15 ml simple syrup', '150 ml soda water'], glass: 'Highball', garnish: 'Strawberry, basil', isAlcoholic: false },
  { name: 'Espresso Tonic', ingredients: ['30 ml espresso', '150 ml tonic water', '15 ml simple syrup'], glass: 'Highball', garnish: 'Orange twist', isAlcoholic: false },
  { name: 'Cold Brew Lemonade', ingredients: ['60 ml cold brew coffee', '60 ml lemonade', '15 ml simple syrup'], glass: 'Highball', garnish: 'Lemon wheel', isAlcoholic: false },
  { name: 'Açaí Berry Cooler', ingredients: ['60 ml açaí juice', '60 ml pomegranate juice', '15 ml fresh lime juice', '120 ml soda water'], glass: 'Highball', garnish: 'Berries', isAlcoholic: false },
  // More regional cocktails
  { name: 'Raki Highball', ingredients: ['45 ml raki', '120 ml cold water', 'Ice'], glass: 'Highball', garnish: 'None', isAlcoholic: true },
  { name: 'Ouzo Lemonade', ingredients: ['45 ml ouzo', '22 ml fresh lemon juice', '15 ml simple syrup', '120 ml soda water'], glass: 'Highball', garnish: 'Lemon wheel', isAlcoholic: true },
  { name: 'Arak Punch', ingredients: ['45 ml arak', '120 ml grapefruit juice', '15 ml simple syrup', '30 ml soda water'], glass: 'Highball', garnish: 'Grapefruit wedge', isAlcoholic: true },
  { name: 'Soju Cocktail', ingredients: ['60 ml soju', '120 ml Yakult', '15 ml fresh lemon juice'], glass: 'Highball', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Makgeolli Cocktail', ingredients: ['120 ml makgeolli', '30 ml peach purée', '15 ml simple syrup'], glass: 'Rocks', garnish: 'Peach slice', isAlcoholic: true },
  { name: 'Baijiu Sour', ingredients: ['45 ml baijiu', '22 ml fresh lemon juice', '15 ml honey syrup', '1 egg white'], glass: 'Coupe', garnish: 'None', isAlcoholic: true },
  { name: 'Ube Colada', ingredients: ['60 ml white rum', '30 ml ube purée', '30 ml coconut cream', '60 ml pineapple juice'], glass: 'Hurricane', garnish: 'Pineapple wedge', isAlcoholic: true },
  { name: 'Thai Iced Tea Cocktail', ingredients: ['45 ml vodka', '120 ml Thai iced tea', '30 ml condensed milk'], glass: 'Highball', garnish: 'Star anise', isAlcoholic: true },
  { name: 'Laksa Bloody Mary', ingredients: ['45 ml vodka', '120 ml tomato juice', '15 ml laksa paste', '15 ml fresh lime juice', 'Pinch of salt'], glass: 'Highball', garnish: 'Lime wedge, chili', isAlcoholic: true },
  { name: 'Sake Bomb', ingredients: ['45 ml sake', '350 ml Japanese beer'], glass: 'Pint', garnish: 'None', isAlcoholic: true },
  { name: 'Calpico Sour', ingredients: ['45 ml vodka', '60 ml Calpico', '15 ml fresh lemon juice'], glass: 'Highball', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Palm Wine Cocktail', ingredients: ['120 ml palm wine', '30 ml fresh lime juice', '15 ml ginger syrup', '60 ml soda water'], glass: 'Highball', garnish: 'Lime wheel', isAlcoholic: true },
  { name: 'Tchapalo Ginger', ingredients: ['120 ml millet beer', '30 ml ginger juice', '15 ml honey', '60 ml soda water'], glass: 'Highball', garnish: 'Ginger slice', isAlcoholic: true },
  { name: 'Grogue Cocktail (Cape Verde)', ingredients: ['60 ml grogue (sugarcane rum)', '22 ml fresh lime juice', '15 ml honey syrup', '60 ml passion fruit juice'], glass: 'Rocks', garnish: 'Lime wheel', isAlcoholic: true },
  { name: 'Caipirão', ingredients: ['60 ml Licor Beirão', '1 lime cut into wedges', '2 tsp sugar'], glass: 'Rocks', garnish: 'Lime wedge', isAlcoholic: true },
  { name: 'Kaffir Lime Collins', ingredients: ['45 ml gin', '22 ml fresh lime juice', '15 ml simple syrup', '3 kaffir lime leaves', 'Soda water'], glass: 'Collins', garnish: 'Kaffir lime leaf', isAlcoholic: true },
  { name: 'Spiced Rum & Coconut Water', ingredients: ['60 ml spiced rum', '180 ml coconut water', '15 ml fresh lime juice'], glass: 'Highball', garnish: 'Lime wedge', isAlcoholic: true },
  { name: 'Ponche Crema Cocktail', ingredients: ['60 ml Venezuelan rum', '60 ml condensed milk', '60 ml evaporated milk', '1 egg yolk', 'Nutmeg', 'Cinnamon'], glass: 'Rocks', garnish: 'Nutmeg, cinnamon', isAlcoholic: true },
  { name: 'Coquito', ingredients: ['60 ml white rum', '60 ml coconut cream', '60 ml condensed milk', '60 ml evaporated milk', 'Cinnamon', 'Nutmeg'], glass: 'Rocks', garnish: 'Cinnamon stick', isAlcoholic: true },
  { name: 'Mango Lassi Cocktail', ingredients: ['45 ml vodka', '120 ml mango purée', '60 ml yogurt', '15 ml honey'], glass: 'Highball', garnish: 'Mango slice', isAlcoholic: true },
  { name: 'Masala Chai Cocktail', ingredients: ['45 ml bourbon', '120 ml masala chai tea (cooled)', '15 ml vanilla syrup', '30 ml milk'], glass: 'Rocks', garnish: 'Cinnamon stick', isAlcoholic: true },
  { name: 'Tepache Cocktail', ingredients: ['45 ml mezcal', '120 ml tepache (fermented pineapple)', '15 ml fresh lime juice'], glass: 'Highball', garnish: 'Pineapple wedge', isAlcoholic: true },
  { name: 'Salted Plum Soju', ingredients: ['60 ml soju', '1 umeboshi (salted plum)', '120 ml soda water'], glass: 'Highball', garnish: 'Salted plum', isAlcoholic: true },
  // Classic & overlooked cocktails
  { name: 'Turf Club', ingredients: ['30 ml gin', '30 ml dry vermouth', '7 ml maraschino liqueur', '2 dashes orange bitters', '2 dashes absinthe'], glass: 'Coupe', garnish: 'Olive', isAlcoholic: true },
  { name: 'Pegu Club', ingredients: ['45 ml gin', '22 ml orange curaçao', '15 ml fresh lime juice', '1 dash Angostura bitters', '1 dash orange bitters'], glass: 'Coupe', garnish: 'Lime wheel', isAlcoholic: true },
  { name: 'Alaska', ingredients: ['45 ml gin', '22 ml yellow Chartreuse', '2 dashes orange bitters'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Journalist', ingredients: ['30 ml gin', '15 ml dry vermouth', '15 ml sweet vermouth', '7 ml triple sec', '7 ml fresh lemon juice', '2 dashes Angostura bitters'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Income Tax', ingredients: ['30 ml gin', '15 ml dry vermouth', '15 ml sweet vermouth', '30 ml fresh orange juice', '2 dashes Angostura bitters'], glass: 'Coupe', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Leap Year', ingredients: ['30 ml gin', '15 ml Grand Marnier', '15 ml sweet vermouth', '7 ml fresh lemon juice'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Army and Navy', ingredients: ['45 ml gin', '22 ml fresh lemon juice', '15 ml orgeat syrup', '2 dashes Angostura bitters'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Floradora', ingredients: ['45 ml gin', '15 ml raspberry syrup', '22 ml fresh lime juice', '120 ml ginger beer'], glass: 'Highball', garnish: 'Raspberry', isAlcoholic: true },
  { name: 'Foghorn', ingredients: ['45 ml gin', '120 ml ginger beer', '15 ml fresh lime juice'], glass: 'Highball', garnish: 'Lime wedge', isAlcoholic: true },
  { name: 'Rye & Ginger', ingredients: ['60 ml rye whiskey', '120 ml ginger ale'], glass: 'Highball', garnish: 'Lime wedge', isAlcoholic: true },
  { name: 'Seven and Seven', ingredients: ['45 ml Seagram\'s 7 Crown whiskey', '120 ml 7-Up'], glass: 'Highball', garnish: 'Lemon wedge', isAlcoholic: true },
  { name: 'Jack and Coke', ingredients: ['60 ml Jack Daniel\'s Tennessee whiskey', '150 ml Coca-Cola'], glass: 'Highball', garnish: 'Lime wedge', isAlcoholic: true },
  { name: 'Rum and Coke', ingredients: ['60 ml gold rum', '150 ml Coca-Cola', '15 ml fresh lime juice'], glass: 'Highball', garnish: 'Lime wedge', isAlcoholic: true },
  { name: 'Gin and Juice', ingredients: ['60 ml gin', '120 ml orange juice', '60 ml grapefruit juice'], glass: 'Highball', garnish: 'Orange slice', isAlcoholic: true },
  { name: 'Lynchburg Lemonade', ingredients: ['45 ml Jack Daniel\'s', '22 ml triple sec', '22 ml fresh lemon juice', '120 ml lemon-lime soda'], glass: 'Highball', garnish: 'Lemon wheel', isAlcoholic: true },
  { name: 'Whiskey Ginger', ingredients: ['60 ml Irish whiskey', '120 ml ginger ale'], glass: 'Highball', garnish: 'Lime wedge', isAlcoholic: true },
  { name: 'Crown Royal & Apple', ingredients: ['60 ml Crown Royal', '120 ml apple juice'], glass: 'Rocks', garnish: 'Apple slice', isAlcoholic: true },
  { name: 'Fireball Cider', ingredients: ['45 ml Fireball cinnamon whisky', '150 ml apple cider'], glass: 'Highball', garnish: 'Apple slice', isAlcoholic: true },
  { name: 'Malibu Bay Breeze', ingredients: ['45 ml Malibu coconut rum', '90 ml cranberry juice', '60 ml pineapple juice'], glass: 'Highball', garnish: 'Cherry, lime', isAlcoholic: true },
  { name: 'Rum & Raisin Old Fashioned', ingredients: ['60 ml raisin-infused dark rum', '7 ml demerara syrup', '2 dashes Angostura bitters'], glass: 'Rocks', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Boulevardier (Rye)', ingredients: ['30 ml rye whiskey', '30 ml Campari', '30 ml sweet vermouth'], glass: 'Rocks', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Perfect Manhattan', ingredients: ['60 ml rye whiskey', '15 ml sweet vermouth', '15 ml dry vermouth', '2 dashes Angostura bitters'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Dry Manhattan', ingredients: ['60 ml rye whiskey', '30 ml dry vermouth', '2 dashes Angostura bitters'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Scotch & Soda', ingredients: ['60 ml scotch', '120 ml soda water'], glass: 'Highball', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Cognac & Tonic', ingredients: ['45 ml cognac', '120 ml tonic water'], glass: 'Highball', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Chartreuse & Tonic', ingredients: ['30 ml green Chartreuse', '150 ml tonic water'], glass: 'Highball', garnish: 'Lime wedge', isAlcoholic: true },
  { name: 'Mezcal & Tonic', ingredients: ['45 ml mezcal', '120 ml tonic water', '15 ml fresh lime juice'], glass: 'Highball', garnish: 'Grapefruit wedge', isAlcoholic: true },
  { name: 'Gin & Ginger', ingredients: ['45 ml gin', '120 ml ginger ale', '15 ml fresh lime juice'], glass: 'Highball', garnish: 'Lime wedge', isAlcoholic: true },
  { name: 'Dark Rum & Ginger', ingredients: ['60 ml dark rum', '120 ml ginger beer'], glass: 'Highball', garnish: 'Lime wedge', isAlcoholic: true },
  { name: 'Vodka Soda', ingredients: ['60 ml vodka', '150 ml soda water', '15 ml fresh lime juice'], glass: 'Highball', garnish: 'Lime wedge', isAlcoholic: true },
  { name: 'Vodka Tonic', ingredients: ['45 ml vodka', '150 ml tonic water'], glass: 'Highball', garnish: 'Lime wedge', isAlcoholic: true },
  { name: 'Tequila & Soda', ingredients: ['60 ml tequila', '150 ml soda water', '15 ml fresh lime juice'], glass: 'Highball', garnish: 'Lime wheel', isAlcoholic: true },
  { name: 'Gin & Dubonnet', ingredients: ['30 ml gin', '30 ml Dubonnet Rouge'], glass: 'Rocks', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Brandy & Soda', ingredients: ['45 ml brandy', '150 ml soda water'], glass: 'Highball', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Porto & Tonic', ingredients: ['60 ml ruby port', '120 ml tonic water'], glass: 'Wine', garnish: 'Orange slice', isAlcoholic: true },
  { name: 'Sherry & Tonic', ingredients: ['60 ml fino sherry', '120 ml tonic water'], glass: 'Wine', garnish: 'Olive', isAlcoholic: true },
  { name: 'Amaretto & Coke', ingredients: ['45 ml amaretto', '150 ml Coca-Cola'], glass: 'Highball', garnish: 'Cherry', isAlcoholic: true },
  { name: 'Kahlúa & Cream', ingredients: ['45 ml Kahlúa', '60 ml heavy cream', 'Ice'], glass: 'Rocks', garnish: 'None', isAlcoholic: true },
  { name: 'Baileys on Ice', ingredients: ['60 ml Baileys Irish Cream', 'Ice'], glass: 'Rocks', garnish: 'None', isAlcoholic: true },
  { name: 'Disaronno & Cranberry', ingredients: ['45 ml Disaronno', '120 ml cranberry juice'], glass: 'Highball', garnish: 'Lime wedge', isAlcoholic: true },
  { name: 'Elderflower Gin & Tonic', ingredients: ['45 ml gin', '15 ml elderflower liqueur', '150 ml tonic water'], glass: 'Copa', garnish: 'Cucumber, elderflower', isAlcoholic: true },
  { name: 'Passionfruit Gin Fizz', ingredients: ['45 ml gin', '30 ml passion fruit purée', '15 ml simple syrup', '15 ml fresh lemon juice', 'Soda water'], glass: 'Highball', garnish: 'Passion fruit half', isAlcoholic: true },
  { name: 'Rhubarb Gin Spritz', ingredients: ['45 ml rhubarb gin', '90 ml prosecco', '30 ml soda water'], glass: 'Wine', garnish: 'Rhubarb ribbon', isAlcoholic: true },
  { name: 'Blood Orange Negroni', ingredients: ['30 ml gin', '30 ml Campari', '30 ml sweet vermouth', '30 ml blood orange juice'], glass: 'Rocks', garnish: 'Blood orange slice', isAlcoholic: true },
  { name: 'Spiced Pear Martini', ingredients: ['45 ml vodka', '30 ml pear nectar', '15 ml St-Germain', '15 ml fresh lemon juice', 'Dash of cinnamon syrup'], glass: 'Martini', garnish: 'Pear slice', isAlcoholic: true },
  { name: 'Blackberry Bourbon Smash', ingredients: ['60 ml bourbon', '6 blackberries', '22 ml fresh lemon juice', '15 ml simple syrup', '6 mint leaves'], glass: 'Rocks', garnish: 'Blackberry, mint', isAlcoholic: true },
  { name: 'Strawberry Basil Gin Smash', ingredients: ['45 ml gin', '4 strawberries', '4 basil leaves', '22 ml fresh lemon juice', '15 ml simple syrup'], glass: 'Rocks', garnish: 'Strawberry, basil', isAlcoholic: true },
  { name: 'Raspberry Gin Fizz', ingredients: ['45 ml gin', '6 raspberries', '22 ml fresh lemon juice', '15 ml simple syrup', 'Soda water'], glass: 'Highball', garnish: 'Raspberries', isAlcoholic: true },
  { name: 'Fig & Honey Old Fashioned', ingredients: ['60 ml bourbon', '15 ml fig syrup', '7 ml honey', '2 dashes Angostura bitters'], glass: 'Rocks', garnish: 'Fresh fig wedge', isAlcoholic: true },
  { name: 'Maple Bourbon Sour', ingredients: ['60 ml bourbon', '22 ml fresh lemon juice', '22 ml maple syrup', '1 egg white'], glass: 'Rocks', garnish: 'Lemon wheel', isAlcoholic: true },
  { name: 'Rosé Spritz', ingredients: ['90 ml rosé wine', '30 ml elderflower liqueur', '60 ml soda water'], glass: 'Wine', garnish: 'Grapefruit twist', isAlcoholic: true },
  { name: 'Prosecco Mojito', ingredients: ['30 ml white rum', '15 ml fresh lime juice', '10 ml simple syrup', '6 mint leaves', '90 ml prosecco'], glass: 'Wine', garnish: 'Mint sprig', isAlcoholic: true },
  { name: 'Frozen Aperol Spritz', ingredients: ['60 ml Aperol', '90 ml prosecco', '30 ml fresh orange juice', '2 cups ice'], glass: 'Wine', garnish: 'Orange slice', isAlcoholic: true },
  { name: 'Cucumber Gin Fizz', ingredients: ['45 ml gin', '4 cucumber slices', '22 ml fresh lime juice', '15 ml simple syrup', 'Soda water'], glass: 'Highball', garnish: 'Cucumber ribbon', isAlcoholic: true },
  { name: 'Jalapeño Paloma', ingredients: ['45 ml tequila', '2 jalapeño slices', '15 ml fresh lime juice', '120 ml grapefruit soda'], glass: 'Highball', garnish: 'Jalapeño, grapefruit', isAlcoholic: true },
  { name: 'Mango Rum Punch', ingredients: ['60 ml white rum', '90 ml mango juice', '30 ml fresh lime juice', '15 ml grenadine', '30 ml orange juice'], glass: 'Highball', garnish: 'Mango slice', isAlcoholic: true },
  { name: 'Peach Bourbon Smash', ingredients: ['60 ml bourbon', '3 peach slices', '22 ml fresh lemon juice', '15 ml simple syrup', '4 mint leaves'], glass: 'Rocks', garnish: 'Peach slice, mint', isAlcoholic: true },
  { name: 'Lavender Martini', ingredients: ['60 ml gin', '15 ml lavender syrup', '15 ml fresh lemon juice'], glass: 'Martini', garnish: 'Lavender sprig', isAlcoholic: true },
  { name: 'Coconut Espresso Martini', ingredients: ['30 ml vodka', '15 ml coconut rum', '30 ml espresso', '15 ml coffee liqueur', '15 ml coconut cream'], glass: 'Martini', garnish: 'Toasted coconut', isAlcoholic: true },
  { name: 'Grapefruit Rosemary Gin', ingredients: ['45 ml gin', '90 ml fresh grapefruit juice', '15 ml rosemary simple syrup', '30 ml soda water'], glass: 'Highball', garnish: 'Rosemary sprig', isAlcoholic: true },
  { name: 'Pomegranate Margarita', ingredients: ['45 ml tequila', '30 ml pomegranate juice', '22 ml fresh lime juice', '15 ml triple sec'], glass: 'Rocks', garnish: 'Pomegranate seeds', isAlcoholic: true },
  { name: 'Cherry Bourbon Sour', ingredients: ['60 ml bourbon', '30 ml cherry juice', '22 ml fresh lemon juice', '15 ml simple syrup'], glass: 'Rocks', garnish: 'Cherry', isAlcoholic: true },
  { name: 'Thyme Gin & Tonic', ingredients: ['50 ml gin', '150 ml tonic water', '3 thyme sprigs', '15 ml fresh lemon juice'], glass: 'Copa', garnish: 'Thyme sprig, lemon', isAlcoholic: true },
  { name: 'Smoked Maple Old Fashioned', ingredients: ['60 ml bourbon', '15 ml maple syrup', '2 dashes Angostura bitters', '2 dashes walnut bitters'], glass: 'Rocks', garnish: 'Orange twist, smoked', isAlcoholic: true },
  { name: 'Basil Gimlet', ingredients: ['60 ml gin', '22 ml fresh lime juice', '15 ml simple syrup', '6 basil leaves'], glass: 'Coupe', garnish: 'Basil leaf', isAlcoholic: true },
  { name: 'Salted Caramel Espresso Martini', ingredients: ['30 ml vodka', '15 ml salted caramel liqueur', '30 ml espresso', '15 ml coffee liqueur'], glass: 'Martini', garnish: 'Caramel drizzle', isAlcoholic: true },
  // ─── Additional batch 3 — reaching 1000 ───
  // Craft / modern cocktails
  { name: 'Bees Knees (Honey)', ingredients: ['60 ml gin', '22 ml fresh lemon juice', '22 ml honey syrup', '2 dashes lavender bitters'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Paloma de Oaxaca', ingredients: ['30 ml mezcal', '30 ml tequila', '15 ml fresh lime juice', '15 ml agave nectar', '90 ml grapefruit soda'], glass: 'Highball', garnish: 'Grapefruit, salt rim', isAlcoholic: true },
  { name: 'Celery Gimlet', ingredients: ['60 ml gin', '22 ml celery juice', '15 ml simple syrup', '15 ml fresh lime juice'], glass: 'Coupe', garnish: 'Celery leaf', isAlcoholic: true },
  { name: 'Beet Negroni', ingredients: ['30 ml beet-infused gin', '30 ml Campari', '30 ml sweet vermouth'], glass: 'Rocks', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Turmeric Margarita', ingredients: ['45 ml tequila', '22 ml fresh lime juice', '15 ml turmeric-ginger syrup', '15 ml agave nectar'], glass: 'Rocks', garnish: 'Lime wheel', isAlcoholic: true },
  { name: 'Clarified Milk Punch', ingredients: ['60 ml cognac', '30 ml rum', '30 ml fresh lemon juice', '30 ml pineapple juice', '120 ml milk', '30 ml simple syrup', 'Lemon peel', 'Nutmeg'], glass: 'Rocks', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Oleo Saccharum Punch', ingredients: ['60 ml dark rum', '30 ml fresh lemon juice', '30 ml oleo saccharum', '120 ml black tea', '60 ml water'], glass: 'Punch', garnish: 'Lemon wheel, nutmeg', isAlcoholic: true },
  { name: 'Pistachio Sour', ingredients: ['45 ml bourbon', '22 ml pistachio orgeat', '22 ml fresh lemon juice', '1 egg white'], glass: 'Coupe', garnish: 'Crushed pistachio', isAlcoholic: true },
  { name: 'Earl Grey MarTEAni', ingredients: ['60 ml Earl Grey-infused gin', '22 ml fresh lemon juice', '15 ml simple syrup', '1 egg white'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Honey Badger', ingredients: ['45 ml bourbon', '15 ml honey liqueur', '22 ml fresh lemon juice', '15 ml honey syrup'], glass: 'Rocks', garnish: 'Lemon wheel', isAlcoholic: true },
  { name: 'Gin & Jam', ingredients: ['45 ml gin', '2 tbsp raspberry jam', '22 ml fresh lemon juice', '15 ml simple syrup'], glass: 'Rocks', garnish: 'Raspberries', isAlcoholic: true },
  { name: 'Calvados Sidecar', ingredients: ['45 ml calvados', '22 ml Cointreau', '22 ml fresh lemon juice'], glass: 'Coupe', garnish: 'Apple fan', isAlcoholic: true },
  { name: 'Brown Butter Old Fashioned', ingredients: ['60 ml brown butter-washed bourbon', '7 ml maple syrup', '2 dashes Angostura bitters'], glass: 'Rocks', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Szechuan Negroni', ingredients: ['30 ml Szechuan pepper-infused gin', '30 ml Campari', '30 ml sweet vermouth'], glass: 'Rocks', garnish: 'Grapefruit twist', isAlcoholic: true },
  { name: 'Banana Old Fashioned', ingredients: ['60 ml banana-infused bourbon', '7 ml demerara syrup', '2 dashes Angostura bitters'], glass: 'Rocks', garnish: 'Dried banana chip', isAlcoholic: true },
  { name: 'Jalapeño Margarita', ingredients: ['45 ml jalapeño-infused tequila', '22 ml fresh lime juice', '15 ml agave nectar', '15 ml Cointreau'], glass: 'Rocks', garnish: 'Jalapeño slice', isAlcoholic: true },
  { name: 'Cardamom Gimlet', ingredients: ['60 ml gin', '22 ml fresh lime juice', '22 ml cardamom syrup'], glass: 'Coupe', garnish: 'Cardamom pod', isAlcoholic: true },
  { name: 'Cherry Blossom Martini', ingredients: ['45 ml vodka', '15 ml cherry blossom liqueur', '15 ml sake', '15 ml fresh lemon juice'], glass: 'Martini', garnish: 'Cherry blossom', isAlcoholic: true },
  { name: 'Sesame Old Fashioned', ingredients: ['60 ml sesame-washed bourbon', '7 ml simple syrup', '2 dashes Angostura bitters'], glass: 'Rocks', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Avocado Daiquiri', ingredients: ['60 ml white rum', '1/4 avocado', '22 ml fresh lime juice', '15 ml simple syrup'], glass: 'Coupe', garnish: 'Lime wheel', isAlcoholic: true },
  // Additional spirits & regional
  { name: 'Nordic Gin Tonic', ingredients: ['50 ml Nordic gin', '150 ml tonic water', 'Juniper berries', 'Dill sprig'], glass: 'Copa', garnish: 'Dill, juniper berries', isAlcoholic: true },
  { name: 'Genever Cocktail', ingredients: ['45 ml genever', '15 ml sweet vermouth', '15 ml simple syrup', '2 dashes orange bitters'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Aquavit Sour', ingredients: ['60 ml aquavit', '22 ml fresh lemon juice', '15 ml simple syrup', '1 egg white'], glass: 'Coupe', garnish: 'Dill sprig', isAlcoholic: true },
  { name: 'Aquavit Negroni', ingredients: ['30 ml aquavit', '30 ml Campari', '30 ml sweet vermouth'], glass: 'Rocks', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Turkish Coffee Martini', ingredients: ['30 ml vodka', '30 ml Turkish coffee', '15 ml coffee liqueur', '15 ml simple syrup', 'Pinch of cardamom'], glass: 'Martini', garnish: 'Cardamom pod', isAlcoholic: true },
  { name: 'Greek Mastic Cocktail', ingredients: ['45 ml mastic liqueur', '22 ml fresh lemon juice', '15 ml simple syrup', '120 ml soda water'], glass: 'Highball', garnish: 'Lemon wheel', isAlcoholic: true },
  { name: 'Umeshu Spritz', ingredients: ['45 ml umeshu', '90 ml prosecco', '30 ml soda water'], glass: 'Wine', garnish: 'Ume plum', isAlcoholic: true },
  { name: 'Slivovitz Sour', ingredients: ['60 ml slivovitz (plum brandy)', '22 ml fresh lemon juice', '15 ml simple syrup', '1 egg white'], glass: 'Coupe', garnish: 'Plum slice', isAlcoholic: true },
  { name: 'Tokaji Spritz', ingredients: ['60 ml Tokaji wine', '90 ml prosecco', '30 ml soda water'], glass: 'Wine', garnish: 'Grape', isAlcoholic: true },
  { name: 'Żubrówka Apple Spritz', ingredients: ['30 ml Żubrówka vodka', '30 ml apple juice', '90 ml prosecco'], glass: 'Wine', garnish: 'Apple slice', isAlcoholic: true },
  { name: 'Dutch Negroni', ingredients: ['30 ml genever', '30 ml Campari', '30 ml sweet vermouth'], glass: 'Rocks', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Pálinka Sour', ingredients: ['60 ml pálinka (Hungarian fruit brandy)', '22 ml fresh lemon juice', '15 ml simple syrup', '1 egg white'], glass: 'Coupe', garnish: 'Apricot slice', isAlcoholic: true },
  { name: 'Limoncello Mule', ingredients: ['30 ml limoncello', '30 ml vodka', '15 ml fresh lemon juice', '120 ml ginger beer'], glass: 'Copper mug', garnish: 'Lemon wheel', isAlcoholic: true },
  { name: 'Grappa Sour', ingredients: ['45 ml grappa', '22 ml fresh lemon juice', '15 ml simple syrup', '1 egg white'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Suze & Tonic', ingredients: ['45 ml Suze', '150 ml tonic water'], glass: 'Highball', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Fernet & Cola', ingredients: ['45 ml Fernet-Branca', '150 ml Coca-Cola'], glass: 'Highball', garnish: 'None', isAlcoholic: true },
  { name: 'Drambuie Sour', ingredients: ['45 ml Drambuie', '22 ml fresh lemon juice', '15 ml simple syrup'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
  // More creative mocktails
  { name: 'Virgin Espresso Martini', ingredients: ['60 ml espresso', '15 ml vanilla syrup', '15 ml chocolate syrup', '30 ml oat milk'], glass: 'Martini', garnish: 'Coffee beans', isAlcoholic: false },
  { name: 'Smoky Pineapple Mocktail', ingredients: ['30 ml smoked pineapple juice', '120 ml pineapple juice', '15 ml fresh lime juice', '15 ml simple syrup', 'Soda water'], glass: 'Highball', garnish: 'Pineapple wedge', isAlcoholic: false },
  { name: 'Rhubarb Fizz Mocktail', ingredients: ['60 ml rhubarb syrup', '30 ml fresh lemon juice', '150 ml soda water'], glass: 'Highball', garnish: 'Rhubarb ribbon', isAlcoholic: false },
  { name: 'Cherry Bitters Soda', ingredients: ['15 ml cherry syrup', '3 dashes aromatic bitters', '180 ml soda water'], glass: 'Highball', garnish: 'Cherry', isAlcoholic: false },
  { name: 'Grapefruit Paloma Mocktail', ingredients: ['120 ml fresh grapefruit juice', '15 ml fresh lime juice', '15 ml agave nectar', '90 ml soda water', 'Salt rim'], glass: 'Highball', garnish: 'Grapefruit wedge', isAlcoholic: false },
  { name: 'Pineapple Turmeric Cooler', ingredients: ['120 ml pineapple juice', '15 ml turmeric syrup', '15 ml fresh lime juice', '120 ml coconut water'], glass: 'Highball', garnish: 'Pineapple wedge', isAlcoholic: false },
  { name: 'Elderflower & Cucumber Cooler', ingredients: ['30 ml elderflower cordial', '4 cucumber slices', '15 ml fresh lime juice', '150 ml soda water'], glass: 'Highball', garnish: 'Cucumber ribbon', isAlcoholic: false },
  { name: 'Virgin Piña Colada (Frozen)', ingredients: ['120 ml pineapple juice', '60 ml coconut cream', '15 ml fresh lime juice', '2 cups ice'], glass: 'Hurricane', garnish: 'Pineapple wedge', isAlcoholic: false },
  { name: 'Tamarind Agua Fresca', ingredients: ['60 ml tamarind concentrate', '15 ml simple syrup', '15 ml fresh lime juice', '180 ml cold water'], glass: 'Highball', garnish: 'Lime wheel', isAlcoholic: false },
  { name: 'Guava Lime Cooler', ingredients: ['90 ml guava nectar', '22 ml fresh lime juice', '15 ml simple syrup', '120 ml soda water'], glass: 'Highball', garnish: 'Lime wheel', isAlcoholic: false },
  { name: 'Cardamom Rose Lassi', ingredients: ['120 ml yogurt', '30 ml rose water', '15 ml simple syrup', '60 ml milk', 'Pinch of cardamom'], glass: 'Highball', garnish: 'Rose petal, cardamom', isAlcoholic: false },
  { name: 'Iced Cascara Lemonade', ingredients: ['60 ml cascara tea (cooled)', '30 ml fresh lemon juice', '15 ml honey', '120 ml soda water'], glass: 'Highball', garnish: 'Lemon wheel', isAlcoholic: false },
  { name: 'Mango Chamoy Agua Fresca', ingredients: ['120 ml mango juice', '15 ml chamoy', '15 ml fresh lime juice', '120 ml cold water', 'Tajín rim'], glass: 'Highball', garnish: 'Mango slice, Tajín rim', isAlcoholic: false },
  { name: 'Ube Latte Mocktail', ingredients: ['30 ml ube syrup', '120 ml oat milk', '15 ml vanilla syrup', 'Crushed ice'], glass: 'Highball', garnish: 'Ube powder', isAlcoholic: false },
  { name: 'Masala Lemonade', ingredients: ['30 ml fresh lemon juice', '15 ml simple syrup', '150 ml soda water', 'Pinch of chaat masala', 'Pinch of black salt'], glass: 'Highball', garnish: 'Lemon wheel', isAlcoholic: false },
  { name: 'Aloe Vera Lime Cooler', ingredients: ['60 ml aloe vera juice', '15 ml fresh lime juice', '15 ml honey', '150 ml soda water'], glass: 'Highball', garnish: 'Lime wheel', isAlcoholic: false },
  { name: 'Beetroot Ginger Shot', ingredients: ['60 ml fresh beetroot juice', '30 ml ginger juice', '15 ml fresh lemon juice', '15 ml honey'], glass: 'Shot', garnish: 'None', isAlcoholic: false },
  { name: 'Kefir Smoothie Mocktail', ingredients: ['120 ml kefir', '60 ml mixed berry purée', '15 ml honey', '60 ml sparkling water'], glass: 'Highball', garnish: 'Berries', isAlcoholic: false },
  // More unique cocktails
  { name: 'Corpse Reviver No. 1', ingredients: ['30 ml cognac', '15 ml calvados', '15 ml sweet vermouth'], glass: 'Coupe', garnish: 'None', isAlcoholic: true },
  { name: 'Widow\'s Kiss', ingredients: ['30 ml calvados', '15 ml Bénédictine', '15 ml yellow Chartreuse', '2 dashes Angostura bitters'], glass: 'Coupe', garnish: 'None', isAlcoholic: true },
  { name: 'Diamondback', ingredients: ['30 ml rye whiskey', '30 ml applejack', '30 ml yellow Chartreuse'], glass: 'Coupe', garnish: 'None', isAlcoholic: true },
  { name: 'Spumoni', ingredients: ['30 ml Campari', '30 ml St-Germain', '120 ml grapefruit soda'], glass: 'Highball', garnish: 'Grapefruit wedge', isAlcoholic: true },
  { name: 'Industry Sour', ingredients: ['45 ml Fernet-Branca', '22 ml green Chartreuse', '22 ml fresh lime juice', '22 ml simple syrup'], glass: 'Coupe', garnish: 'None', isAlcoholic: true },
  { name: 'Chrysanthemum (Classic)', ingredients: ['60 ml dry vermouth', '30 ml Bénédictine', '1 tsp absinthe'], glass: 'Coupe', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Bamboo (Classic)', ingredients: ['45 ml fino sherry', '45 ml dry vermouth', '2 dashes Angostura bitters', '2 dashes orange bitters'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Toreador', ingredients: ['45 ml tequila', '22 ml apricot brandy', '22 ml fresh lime juice'], glass: 'Coupe', garnish: 'Lime wheel', isAlcoholic: true },
  { name: 'Silk Stocking', ingredients: ['30 ml tequila', '22 ml white crème de cacao', '22 ml grenadine', '30 ml heavy cream'], glass: 'Coupe', garnish: 'Cinnamon', isAlcoholic: true },
  { name: 'Rosita', ingredients: ['30 ml tequila', '15 ml Campari', '15 ml dry vermouth', '15 ml sweet vermouth', '1 dash Angostura bitters'], glass: 'Rocks', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'La Perla', ingredients: ['30 ml reposado tequila', '30 ml manzanilla sherry', '30 ml pear liqueur'], glass: 'Coupe', garnish: 'Pear slice', isAlcoholic: true },
  { name: 'Mexican 55', ingredients: ['30 ml tequila', '15 ml fresh lime juice', '15 ml simple syrup', '60 ml champagne'], glass: 'Champagne flute', garnish: 'Lime twist', isAlcoholic: true },
  { name: 'Tequila Mockingbird', ingredients: ['45 ml tequila', '22 ml green crème de menthe', '22 ml fresh lime juice'], glass: 'Coupe', garnish: 'Mint leaf', isAlcoholic: true },
  { name: 'Vampire\'s Kiss', ingredients: ['30 ml vodka', '15 ml Chambord', '15 ml cranberry juice', '60 ml champagne'], glass: 'Champagne flute', garnish: 'Raspberry', isAlcoholic: true },
  { name: 'Hemingway Gin & Tonic', ingredients: ['45 ml gin', '150 ml tonic water', '15 ml fresh grapefruit juice', '5 ml maraschino liqueur'], glass: 'Copa', garnish: 'Grapefruit twist', isAlcoholic: true },
  { name: 'Southside Royale', ingredients: ['30 ml gin', '15 ml fresh lime juice', '15 ml simple syrup', '6 mint leaves', '60 ml champagne'], glass: 'Champagne flute', garnish: 'Mint leaf', isAlcoholic: true },
  { name: 'Northern Spy', ingredients: ['45 ml rye whiskey', '22 ml apple brandy', '15 ml sweet vermouth', '2 dashes Angostura bitters'], glass: 'Coupe', garnish: 'Apple slice', isAlcoholic: true },
  { name: 'Kentucky Colonel', ingredients: ['60 ml bourbon', '15 ml Bénédictine'], glass: 'Rocks', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Queen Bee', ingredients: ['45 ml gin', '22 ml Bénédictine', '22 ml fresh lemon juice'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Smoky Robinson', ingredients: ['45 ml mezcal', '15 ml coffee liqueur', '22 ml fresh lime juice', '15 ml simple syrup'], glass: 'Rocks', garnish: 'Coffee beans', isAlcoholic: true },
  { name: 'Spiced Honey Bourbon', ingredients: ['60 ml bourbon', '22 ml spiced honey syrup', '2 dashes Angostura bitters', '1 dash black walnut bitters'], glass: 'Rocks', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Rosemary Paloma', ingredients: ['45 ml tequila', '15 ml fresh lime juice', '120 ml grapefruit soda', '15 ml rosemary syrup'], glass: 'Highball', garnish: 'Rosemary sprig', isAlcoholic: true },
  { name: 'Coconut Batida', ingredients: ['60 ml cachaça', '30 ml coconut cream', '30 ml condensed milk', '15 ml fresh lime juice', 'Crushed ice'], glass: 'Rocks', garnish: 'Toasted coconut', isAlcoholic: true },
  { name: 'Gentleman\'s Buck', ingredients: ['45 ml bourbon', '22 ml fresh lemon juice', '15 ml simple syrup', '2 dashes Angostura bitters', '90 ml ginger beer'], glass: 'Highball', garnish: 'Lemon wheel', isAlcoholic: true },
  { name: 'Mezcal Bees Knees', ingredients: ['60 ml mezcal', '22 ml fresh lemon juice', '22 ml honey syrup'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Barrel-Aged Negroni', ingredients: ['30 ml barrel-aged gin', '30 ml Campari', '30 ml sweet vermouth'], glass: 'Rocks', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Whiskey Smash', ingredients: ['60 ml bourbon', '22 ml fresh lemon juice', '15 ml simple syrup', '6 mint leaves'], glass: 'Rocks', garnish: 'Mint sprig, lemon', isAlcoholic: true },
  { name: 'Genepy Le Chamois', ingredients: ['45 ml Genépy', '22 ml fresh lemon juice', '15 ml simple syrup', '120 ml soda water'], glass: 'Highball', garnish: 'Lemon wheel', isAlcoholic: true },
  { name: 'Autumn Leaves', ingredients: ['30 ml rye whiskey', '22 ml apple brandy', '22 ml sweet vermouth', '7 ml Strega', '2 dashes Angostura bitters'], glass: 'Coupe', garnish: 'Apple slice', isAlcoholic: true },
  { name: 'Midnight Stinger', ingredients: ['45 ml bourbon', '22 ml Fernet-Branca', '15 ml simple syrup', '2 dashes Angostura bitters'], glass: 'Rocks', garnish: 'Mint sprig', isAlcoholic: true },
  { name: 'Suffering Bastard (Original)', ingredients: ['30 ml gin', '30 ml brandy', '15 ml fresh lime juice', '1 dash Angostura bitters', '120 ml ginger beer'], glass: 'Highball', garnish: 'Mint, orange', isAlcoholic: true },
  { name: 'Tiki Ti Ray\'s Mistake', ingredients: ['45 ml gold rum', '30 ml passion fruit syrup', '22 ml fresh lime juice', '15 ml orange curaçao'], glass: 'Tiki mug', garnish: 'Orchid', isAlcoholic: true },
  { name: 'Cinnamon Toast Cocktail', ingredients: ['45 ml Fireball cinnamon whisky', '30 ml RumChata', '15 ml vanilla vodka'], glass: 'Rocks', garnish: 'Cinnamon sugar rim', isAlcoholic: true },
  { name: 'Watermelon Sugar High', ingredients: ['60 ml vodka', '120 ml fresh watermelon juice', '15 ml fresh lime juice', '15 ml simple syrup'], glass: 'Highball', garnish: 'Watermelon wedge', isAlcoholic: true },
  { name: 'Hibiscus Margarita', ingredients: ['45 ml tequila', '22 ml Cointreau', '22 ml fresh lime juice', '15 ml hibiscus syrup'], glass: 'Rocks', garnish: 'Hibiscus flower', isAlcoholic: true },
  { name: 'Pumpkin Spice Espresso Martini', ingredients: ['30 ml vodka', '30 ml espresso', '15 ml pumpkin spice syrup', '15 ml coffee liqueur'], glass: 'Martini', garnish: 'Cinnamon dust', isAlcoholic: true },
  { name: 'Gingerbread Old Fashioned', ingredients: ['60 ml bourbon', '15 ml gingerbread syrup', '2 dashes Angostura bitters', '1 dash allspice dram'], glass: 'Rocks', garnish: 'Gingerbread cookie', isAlcoholic: true },
  { name: 'Candy Cane Cocktail', ingredients: ['45 ml vodka', '22 ml peppermint schnapps', '22 ml white crème de cacao', '30 ml heavy cream'], glass: 'Martini', garnish: 'Candy cane', isAlcoholic: true },
  { name: 'Eggnog Flip', ingredients: ['45 ml bourbon', '15 ml simple syrup', '1 whole egg', '30 ml heavy cream', 'Nutmeg'], glass: 'Coupe', garnish: 'Fresh grated nutmeg', isAlcoholic: true },
  { name: 'Apple Cider Mimosa', ingredients: ['60 ml apple cider', '120 ml champagne', 'Pinch of cinnamon'], glass: 'Champagne flute', garnish: 'Apple slice', isAlcoholic: true },
  { name: 'Cranberry Mule', ingredients: ['60 ml vodka', '30 ml cranberry juice', '15 ml fresh lime juice', '120 ml ginger beer'], glass: 'Copper mug', garnish: 'Cranberries, lime', isAlcoholic: true },
  { name: 'Peppermint Bark Martini', ingredients: ['45 ml vanilla vodka', '22 ml peppermint schnapps', '22 ml white crème de cacao', '15 ml heavy cream'], glass: 'Martini', garnish: 'Crushed peppermint rim', isAlcoholic: true },
  { name: 'Chai Old Fashioned', ingredients: ['60 ml chai-infused bourbon', '7 ml simple syrup', '2 dashes Angostura bitters'], glass: 'Rocks', garnish: 'Star anise', isAlcoholic: true },
  { name: 'S\'mores Martini', ingredients: ['45 ml marshmallow vodka', '22 ml chocolate liqueur', '22 ml Baileys Irish Cream', 'Graham cracker rim'], glass: 'Martini', garnish: 'Toasted marshmallow', isAlcoholic: true },
  { name: 'Espresso Negroni', ingredients: ['30 ml gin', '30 ml Campari', '30 ml sweet vermouth', '15 ml espresso'], glass: 'Rocks', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Caffè Shakerato', ingredients: ['60 ml espresso', '15 ml simple syrup', 'Ice'], glass: 'Martini', garnish: 'None', isAlcoholic: false },
  { name: 'Dirty Martini', ingredients: ['60 ml gin or vodka', '15 ml dry vermouth', '15 ml olive brine'], glass: 'Martini', garnish: 'Olives', isAlcoholic: true },
  { name: 'Gibson', ingredients: ['60 ml gin', '10 ml dry vermouth'], glass: 'Martini', garnish: 'Cocktail onion', isAlcoholic: true },
  { name: 'Gin & It', ingredients: ['30 ml gin', '30 ml sweet vermouth'], glass: 'Rocks', garnish: 'Cherry', isAlcoholic: true },
  { name: 'Horse\'s Neck (Brandy Classic)', ingredients: ['60 ml brandy', '120 ml ginger ale', '1 long lemon peel', '2 dashes Angostura bitters'], glass: 'Highball', garnish: 'Long lemon peel spiral', isAlcoholic: true },
  { name: 'Planter\'s Cocktail', ingredients: ['45 ml dark rum', '22 ml fresh lemon juice', '15 ml orange juice'], glass: 'Coupe', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Bermuda Highball', ingredients: ['30 ml gin', '30 ml brandy', '15 ml dry vermouth', '120 ml ginger ale'], glass: 'Highball', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Star Cocktail', ingredients: ['30 ml apple brandy', '30 ml sweet vermouth', '2 dashes Angostura bitters'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Millionaire Cocktail', ingredients: ['45 ml bourbon', '22 ml Grand Marnier', '15 ml grenadine', '1 egg white'], glass: 'Coupe', garnish: 'None', isAlcoholic: true },
  { name: 'Mamie Taylor', ingredients: ['60 ml scotch', '15 ml fresh lime juice', '120 ml ginger beer'], glass: 'Highball', garnish: 'Lime wheel', isAlcoholic: true },
  { name: 'Dark Cherry Sour', ingredients: ['60 ml bourbon', '30 ml dark cherry juice', '22 ml fresh lemon juice', '15 ml simple syrup', '1 egg white'], glass: 'Rocks', garnish: 'Cherry', isAlcoholic: true },
  { name: 'Absinthe Frappe', ingredients: ['45 ml absinthe', '15 ml simple syrup', '60 ml soda water', 'Crushed ice'], glass: 'Highball', garnish: 'Mint sprig', isAlcoholic: true },
  { name: 'Sazerac (Cognac)', ingredients: ['60 ml cognac', '1 sugar cube', '3 dashes Peychaud\'s bitters', 'Absinthe rinse'], glass: 'Rocks', garnish: 'Lemon peel', isAlcoholic: true },
  { name: 'Rum Old Fashioned', ingredients: ['60 ml aged rum', '7 ml demerara syrup', '2 dashes Angostura bitters', '1 dash orange bitters'], glass: 'Rocks', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Mezcal Old Fashioned', ingredients: ['60 ml mezcal', '7 ml agave nectar', '2 dashes mole bitters'], glass: 'Rocks', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Cognac Old Fashioned', ingredients: ['60 ml cognac', '7 ml demerara syrup', '2 dashes Angostura bitters', '1 dash Peychaud\'s bitters'], glass: 'Rocks', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Tequila Collins', ingredients: ['45 ml tequila', '22 ml fresh lemon juice', '15 ml simple syrup', 'Soda water'], glass: 'Collins', garnish: 'Lemon wheel', isAlcoholic: true },
  { name: 'Rum Collins', ingredients: ['45 ml white rum', '22 ml fresh lime juice', '15 ml simple syrup', 'Soda water'], glass: 'Collins', garnish: 'Lime wheel', isAlcoholic: true },
  { name: 'Vodka Collins', ingredients: ['45 ml vodka', '22 ml fresh lemon juice', '15 ml simple syrup', 'Soda water'], glass: 'Collins', garnish: 'Lemon wheel', isAlcoholic: true },
  { name: 'Amaretto Stone Sour', ingredients: ['30 ml amaretto', '30 ml bourbon', '30 ml fresh orange juice', '15 ml fresh lemon juice', '15 ml simple syrup'], glass: 'Rocks', garnish: 'Orange slice, cherry', isAlcoholic: true },
  { name: 'Mango Daiquiri', ingredients: ['60 ml white rum', '60 ml mango purée', '22 ml fresh lime juice', '15 ml simple syrup', 'Crushed ice'], glass: 'Coupe', garnish: 'Mango slice', isAlcoholic: true },
  { name: 'Passion Fruit Daiquiri', ingredients: ['60 ml white rum', '60 ml passion fruit purée', '22 ml fresh lime juice', '15 ml simple syrup'], glass: 'Coupe', garnish: 'Passion fruit half', isAlcoholic: true },
  { name: 'Strawberry Margarita', ingredients: ['45 ml tequila', '22 ml Cointreau', '22 ml fresh lime juice', '4 fresh strawberries', '15 ml simple syrup'], glass: 'Margarita', garnish: 'Strawberry', isAlcoholic: true },
  { name: 'Passion Fruit Martini (No. 2)', ingredients: ['45 ml vodka', '30 ml passion fruit purée', '15 ml vanilla syrup', '15 ml fresh lime juice'], glass: 'Coupe', garnish: 'Passion fruit half', isAlcoholic: true },
  { name: 'Elderflower Martini', ingredients: ['45 ml vodka', '22 ml elderflower liqueur', '15 ml fresh lemon juice'], glass: 'Martini', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Elderflower Daiquiri', ingredients: ['60 ml white rum', '15 ml elderflower liqueur', '22 ml fresh lime juice', '15 ml simple syrup'], glass: 'Coupe', garnish: 'Lime wheel', isAlcoholic: true },
  { name: 'Smoky Martini', ingredients: ['45 ml gin', '15 ml Islay scotch', '7 ml dry vermouth'], glass: 'Martini', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Breakfast Martini', ingredients: ['45 ml gin', '15 ml Cointreau', '15 ml fresh lemon juice', '1 tbsp orange marmalade'], glass: 'Coupe', garnish: 'Orange twist', isAlcoholic: true },
  { name: 'Lychee Sake-tini', ingredients: ['30 ml vodka', '30 ml sake', '30 ml lychee juice', '15 ml lychee liqueur'], glass: 'Martini', garnish: 'Lychee', isAlcoholic: true },
  { name: 'Watermelon Martini', ingredients: ['60 ml vodka', '60 ml fresh watermelon juice', '15 ml simple syrup', '15 ml fresh lime juice'], glass: 'Martini', garnish: 'Watermelon slice', isAlcoholic: true },
  { name: 'Pear Martini', ingredients: ['45 ml pear vodka', '22 ml elderflower liqueur', '15 ml fresh lemon juice'], glass: 'Martini', garnish: 'Pear slice', isAlcoholic: true },
  { name: 'Blue Moon Cocktail', ingredients: ['45 ml gin', '22 ml crème de violette', '22 ml fresh lemon juice'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
  { name: 'Twentieth Century', ingredients: ['45 ml gin', '22 ml Lillet Blanc', '22 ml white crème de cacao', '22 ml fresh lemon juice'], glass: 'Coupe', garnish: 'Lemon twist', isAlcoholic: true },
]

// ─── Process supplemental cocktails ─────────────────────────────────────────

function processSupplemental(supp) {
  const ingredientNames = supp.ingredients.map(i => {
    // Try to extract ingredient name (strip measurements)
    return i.replace(/^\d+[\s./]*\d*\s*(ml|cl|oz|tsp|tbsp|dash|dashes|drop|drops|g|cups?|cans?|tbsp|piece|slices?|leaves?|sprigs?|wedges?|pinch)\s*/i, '').trim()
  })
  
  const isAlcoholic = supp.isAlcoholic !== false
  const { spirit, spiritLabel } = classifySpirit(ingredientNames)
  const hasEggWhite = supp.ingredients.some(i => i.toLowerCase().includes('egg'))
  
  return {
    source: 'supplemental',
    name: supp.name,
    slug: slugify(supp.name),
    isAlcoholic,
    glass: supp.glass || '',
    instructions: '',  // Will be generated from standard method
    ingredients: supp.ingredients,
    ingredientNames,
    image: '',
    spirit,
    spiritLabel,
    abv: estimateABV(spirit, isAlcoholic),
    difficulty: mapDifficulty(supp.ingredients.length, hasEggWhite, false),
    glassware: mapGlassware(supp.glass),
    garnish: supp.garnish || '',
  }
}

// ─── Generate steps from instructions ──────────────────────────────────────

function generateSteps(cocktail) {
  if (cocktail.instructions && cocktail.instructions.length > 10) {
    // Split instructions into steps
    const raw = cocktail.instructions
    // Try splitting by sentence endings or numbered steps
    let steps = raw.split(/(?:\.\s+|\n+|(?:\d+\.\s))/).filter(s => s.trim().length > 5)
    if (steps.length === 0) steps = [raw]
    return steps.map(s => s.trim().replace(/\.$/, '').trim()).filter(Boolean)
  }
  
  // Generate basic steps from method
  const steps = []
  const ings = cocktail.ingredients || []
  
  if (cocktail.garnish && cocktail.garnish.toLowerCase().includes('rim')) {
    steps.push('Prepare the glass rim')
  }
  
  const method = (cocktail.instructions || '').toLowerCase()
  if (method.includes('shake') || ings.length >= 4) {
    steps.push('Add all ingredients to a shaker with ice')
    steps.push('Shake vigorously for 10-15 seconds')
    steps.push(`Strain into a ${cocktail.glassware || 'glass'}`)
  } else if (method.includes('blend') || method.includes('frozen')) {
    steps.push('Add all ingredients to a blender')
    steps.push('Blend until smooth')
    steps.push(`Pour into a ${cocktail.glassware || 'glass'}`)
  } else if (method.includes('stir') || ings.length <= 3) {
    steps.push(`Add all ingredients to a ${cocktail.glassware || 'glass'} with ice`)
    steps.push('Stir gently for 20-30 seconds')
  } else if (method.includes('build') || method.includes('pour')) {
    steps.push(`Fill a ${cocktail.glassware || 'glass'} with ice`)
    steps.push('Pour in ingredients')
    steps.push('Stir gently')
  } else {
    steps.push('Add all ingredients to a shaker with ice')
    steps.push('Shake well')
    steps.push(`Strain into a ${cocktail.glassware || 'glass'}`)
  }
  
  if (cocktail.garnish && !cocktail.garnish.toLowerCase().includes('none')) {
    steps.push(`Garnish with ${cocktail.garnish.toLowerCase()}`)
  }
  
  return steps
}

// ─── Generate summary ───────────────────────────────────────────────────────

function generateSummary(cocktail) {
  const spirit = cocktail.spiritLabel || 'spirits'
  const glass = cocktail.glassware || 'glass'
  const mainIngs = cocktail.ingredients.slice(0, 3).join(', ')
  
  if (!cocktail.isAlcoholic) {
    return `A refreshing non-alcoholic cocktail with ${mainIngs}`
  }
  
  return `${cocktail.name} — ${mainIngs}, served in a ${glass}`
}

// ─── Transform to DB format ─────────────────────────────────────────────────

function transformToDB(cocktail) {
  const steps = generateSteps(cocktail)
  const summary = generateSummary(cocktail)
  const tags = generateTags({ ...cocktail, steps })
  
  const recipeJson = {
    category: cocktail.isAlcoholic ? 'alcoholic' : 'non-alcoholic',
    spirit: cocktail.spirit,
    spiritLabel: cocktail.spiritLabel,
    abv: cocktail.abv,
    difficulty: cocktail.difficulty,
    serves: 1,
    ingredients: cocktail.ingredients,
    steps,
    glassware: cocktail.glassware,
    garnish: cocktail.garnish || 'None',
  }
  
  return {
    slug: cocktail.slug,
    title: cocktail.name,
    summary,
    image: cocktail.image || '',
    tags,
    score: cocktail.source === 'thecocktaildb' ? 4 : (cocktail.source === 'iba-github' ? 5 : 4),
    recipeJson,
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🍹 MareChef Cocktail Expansion — Target: 1000 cocktails\n')
  
  // 1. Get existing slugs to skip
  const { rows: existingRows } = await pool.query("SELECT slug FROM posts WHERE type='cocktail'")
  const existingSlugs = new Set(existingRows.map(r => r.slug))
  console.log(`📋 Existing cocktails in DB: ${existingSlugs.size}`)
  
  // 2. Fetch from all sources
  const [cocktailDB, ibaCocktails] = await Promise.all([
    fetchTheCocktailDB(),
    fetchIBACocktails(),
  ])
  
  // 3. Process supplemental
  console.log(`\n📦 Processing ${SUPPLEMENTAL_COCKTAILS.length} supplemental cocktails...`)
  const supplemental = SUPPLEMENTAL_COCKTAILS.map(processSupplemental)
  
  // 4. Merge and deduplicate
  console.log('\n🔄 Merging and deduplicating...')
  const allCocktails = [...cocktailDB, ...ibaCocktails, ...supplemental]
  
  const seen = new Set()
  const unique = []
  
  for (const c of allCocktails) {
    // Skip if slug already exists in DB or we've already seen it
    if (existingSlugs.has(c.slug) || seen.has(c.slug)) continue
    
    // Also check by normalized name to catch near-duplicates
    const normName = c.name.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (seen.has(normName)) continue
    
    seen.add(c.slug)
    seen.add(normName)
    unique.push(c)
  }
  
  console.log(`  Total from all sources: ${allCocktails.length}`)
  console.log(`  After dedup (excluding existing ${existingSlugs.size}): ${unique.length}`)
  
  // 5. Transform to DB format
  const dbRecords = unique.map(transformToDB)
  
  if (DRY_RUN) {
    console.log('\n🏜️ DRY RUN — would insert these cocktails:')
    // Spirit distribution
    const bySpirit = {}
    for (const r of dbRecords) {
      const s = r.recipeJson.spiritLabel
      bySpirit[s] = (bySpirit[s] || 0) + 1
    }
    console.log('\nSpirit distribution:')
    for (const [spirit, count] of Object.entries(bySpirit).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${spirit}: ${count}`)
    }
    console.log(`\nTotal would be: ${existingSlugs.size + dbRecords.length}`)
    
    // Show first 10
    console.log('\nFirst 10 cocktails:')
    for (const r of dbRecords.slice(0, 10)) {
      console.log(`  ${r.slug} — ${r.title} (${r.recipeJson.spiritLabel})`)
    }
    
    await pool.end()
    return
  }
  
  // 6. Insert into DB in batches
  console.log(`\n💾 Inserting ${dbRecords.length} cocktails...`)
  
  let inserted = 0
  let errors = 0
  const BATCH_SIZE = 50
  
  for (let i = 0; i < dbRecords.length; i += BATCH_SIZE) {
    const batch = dbRecords.slice(i, i + BATCH_SIZE)
    
    for (const r of batch) {
      try {
        // Pre-check slug doesn't exist (partial unique index workaround)
        const { rows: check } = await pool.query('SELECT id FROM posts WHERE slug = $1', [r.slug])
        if (check.length > 0) {
          // console.log(`  ⏩ Skip (slug exists): ${r.slug}`)
          continue
        }
        
        await pool.query(
          `INSERT INTO posts (id, created_by, type, slug, title, summary, hero_image_url, food_tags, quality_score, is_tested, status, recipe_json)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [SYSTEM_USER, 'cocktail', r.slug, r.title, r.summary, r.image || null, r.tags, r.score, true, 'active', JSON.stringify(r.recipeJson)]
        )
        inserted++
      } catch (err) {
        errors++
        if (errors <= 5) console.warn(`  ⚠ Error inserting "${r.slug}": ${err.message}`)
      }
    }
    
    process.stdout.write(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(dbRecords.length / BATCH_SIZE)} — ${inserted} inserted\n`)
  }
  
  // 7. Final stats
  const { rows: finalCount } = await pool.query("SELECT COUNT(*) FROM posts WHERE type='cocktail' AND status='active'")
  
  console.log(`\n✅ Done!`)
  console.log(`  Inserted: ${inserted}`)
  console.log(`  Errors: ${errors}`)
  console.log(`  Total cocktails in DB: ${finalCount[0].count}`)
  
  // Spirit distribution
  const { rows: spiritDist } = await pool.query(`
    SELECT recipe_json->>'spiritLabel' as spirit, COUNT(*) as cnt
    FROM posts WHERE type='cocktail' AND status='active'
    GROUP BY recipe_json->>'spiritLabel'
    ORDER BY cnt DESC
  `)
  console.log('\n  Spirit distribution:')
  for (const r of spiritDist) {
    console.log(`    ${r.spirit || 'Unknown'}: ${r.cnt}`)
  }
  
  await pool.end()
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
