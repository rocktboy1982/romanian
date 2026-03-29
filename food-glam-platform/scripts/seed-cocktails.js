#!/usr/bin/env node
/**
 * seed-cocktails.js — Inserts 15 cocktails into the posts table.
 * Run once: node scripts/seed-cocktails.js
 */
const { Pool } = require('pg')

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '54322'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'postgres',
})

const cocktails = [
  { slug: 'classic-negroni', title: 'Classic Negroni', summary: 'Iconul italian amar-dulce - părți egale de gin, Campari și vermut dulce, amestecat peste gheață', image: 'https://images.unsplash.com/photo-1570598912132-0ba1dc952b7d?w=800&q=80', tags: ['classic','stirred','bitter','aperitif'], score: 5, json: { category:'alcoholic', spirit:'gin', spiritLabel:'Gin', abv:24, difficulty:'easy', serves:1, ingredients:['30 ml gin','30 ml Campari','30 ml vermut dulce roșu'], steps:['Turnați toate ingredientele într-un pahar de amestecare cu gheață','Amestecați timp de 20-30 de secunde','Strecurați într-un pahar rocks peste gheață proaspătă','Garnisiți cu coajă de portocală'], glassware:'Rocks', garnish:'Coajă de portocală' }},
  { slug: 'old-fashioned', title: 'Old Fashioned', summary: 'Whisky, zahăr și amari - cocktailul original, amestecat la perfecțiune mătăsoasă', image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&q=80', tags: ['classic','stirred','spirit-forward','american'], score: 5, json: { category:'alcoholic', spirit:'whisky', spiritLabel:'Whisky', abv:32, difficulty:'easy', serves:1, ingredients:['60 ml bourbon sau rye whisky','1 cub de zahăr','2-3 picături Angostura bitters','Strop de apă'], steps:['Puneți cubul de zahăr în pahar cu bitters și un strop de apă','Zdrobiți ușor zahărul','Adăugați gheață și whisky','Amestecați ușor','Garnisiți cu coajă de portocală și o cireașă'], glassware:'Rocks', garnish:'Coajă de portocală, cireașă' }},
  { slug: 'mojito', title: 'Classic Mojito', summary: 'Rom cuban, lămâie proaspătă, mentă și apă carbogazoasă - crocant, răcoritor și perfect', image: 'https://images.unsplash.com/photo-1609951651556-5334e2706168?w=800&q=80', tags: ['refreshing','shaken','tropical','summer'], score: 5, json: { category:'alcoholic', spirit:'rum', spiritLabel:'Rum', abv:12, difficulty:'easy', serves:1, ingredients:['60 ml rom alb','30 ml suc de lămâie proaspăt','2 lingurițe zahăr','6-8 frunze de mentă','Apă carbogazoasă'], steps:['Zdrobiți ușor mentă cu zahăr și suc de lămâie','Adăugați rom și gheață','Completați cu apă carbogazoasă','Amestecați ușor și garnisiți cu mentă'], glassware:'Highball', garnish:'Ramură de mentă' }},
  { slug: 'margarita', title: 'Classic Margarita', summary: 'Tequila, triple sec și lămâie proaspătă pe o margine sărată', image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800&q=80', tags: ['classic','shaken','citrus','party'], score: 5, json: { category:'alcoholic', spirit:'tequila', spiritLabel:'Tequila', abv:20, difficulty:'easy', serves:1, ingredients:['50 ml tequila','30 ml triple sec','20 ml suc de lămâie proaspăt','Sare pentru margine'], steps:['Umeziți marginea paharului cu lămâie și treceți prin sare','Agitați tequila, triple sec și suc de lămâie cu gheață','Strecurați în paharul pregătit'], glassware:'Margarita', garnish:'Felie de lămâie' }},
  { slug: 'espresso-martini', title: 'Espresso Martini', summary: 'Vodcă, espresso proaspăt și lichior de cafea agitat puternic', image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&q=80', tags: ['trending','shaken','coffee','after-dinner'], score: 5, json: { category:'alcoholic', spirit:'vodka', spiritLabel:'Vodka', abv:18, difficulty:'medium', serves:1, ingredients:['50 ml vodcă','30 ml lichior de cafea','30 ml espresso proaspăt răcit','10 ml sirop de zahăr'], steps:['Adăugați toate ingredientele în shaker cu gheață','Agitați puternic 15 secunde','Strecurați dublu într-un pahar de martini răcit','Garnisiți cu 3 boabe de cafea'], glassware:'Martini', garnish:'3 boabe de cafea' }},
  { slug: 'aperol-spritz', title: 'Aperol Spritz', summary: 'Aperol, prosecco și apă carbogazoasă - ritualul orei de aur al Italiei', image: 'https://images.unsplash.com/photo-1560508180-03f285f67ded?w=800&q=80', tags: ['aperitif','bubbly','summer','low-abv'], score: 5, json: { category:'alcoholic', spirit:'liqueur', spiritLabel:'Lichior', abv:11, difficulty:'easy', serves:1, ingredients:['90 ml prosecco','60 ml Aperol','30 ml apă carbogazoasă'], steps:['Umpleți un pahar mare de vin cu gheață','Turnați prosecco, apoi Aperol','Adăugați apă carbogazoasă','Garnisiți cu felie de portocală'], glassware:'Pahar de vin', garnish:'Felie de portocală' }},
  { slug: 'dark-stormy', title: 'Dark & Stormy', summary: 'Rom negru peste bere de ghimbir cu o stropitură de lămâie', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=800&q=80', tags: ['built','ginger','tropical','refreshing'], score: 5, json: { category:'alcoholic', spirit:'rum', spiritLabel:'Rum', abv:14, difficulty:'easy', serves:1, ingredients:['60 ml rom negru','120 ml bere de ghimbir','Suc de lămâie'], steps:['Umpleți un pahar highball cu gheață','Turnați berea de ghimbir','Turnați încet romul negru peste spate de lingură','Stoarceți o felie de lămâie'], glassware:'Highball', garnish:'Felie de lămâie' }},
  { slug: 'whisky-sour', title: 'Whisky Sour', summary: 'Bourbon, suc de lămâie și zahăr agitat cu albuș de ou', image: 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=800&q=80', tags: ['sour','shaken','classic','egg-white'], score: 5, json: { category:'alcoholic', spirit:'whisky', spiritLabel:'Whisky', abv:16, difficulty:'medium', serves:1, ingredients:['60 ml bourbon','30 ml suc de lămâie proaspăt','15 ml sirop de zahăr','1 albuș de ou (opțional)'], steps:['Adăugați ingredientele în shaker fără gheață (dry shake)','Adăugați gheață și agitați din nou puternic','Strecurați dublu în pahar rocks cu gheață'], glassware:'Rocks', garnish:'Coajă de portocală, cireașă' }},
  { slug: 'paloma', title: 'Paloma', summary: 'Tequila, apă carbogazoasă de grapefruit și o margine sărată', image: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=800&q=80', tags: ['refreshing','citrus','built','summer'], score: 5, json: { category:'alcoholic', spirit:'tequila', spiritLabel:'Tequila', abv:13, difficulty:'easy', serves:1, ingredients:['60 ml tequila','15 ml suc de lămâie proaspăt','Suc de grapefruit','Sare pentru margine'], steps:['Umeziți marginea paharului și treceți prin sare','Umpleți cu gheață','Turnați tequila și suc de lămâie','Completați cu suc de grapefruit'], glassware:'Highball', garnish:'Felie de grapefruit' }},
  { slug: 'gin-tonic', title: 'Perfect Gin & Tonic', summary: 'Gin premium, tonic de calitate și garnitura potrivită', image: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=800&q=80', tags: ['built','refreshing','botanical','classic'], score: 5, json: { category:'alcoholic', spirit:'gin', spiritLabel:'Gin', abv:10, difficulty:'easy', serves:1, ingredients:['50 ml gin','150 ml apă tonică premium','Gheață'], steps:['Umpleți un pahar copa cu gheață','Turnați ginul','Adăugați încet apa tonică','Amestecați ușor o dată'], glassware:'Copa / Balon', garnish:'Felie de castravete sau citrice' }},
  { slug: 'virgin-mojito', title: 'Virgin Mojito', summary: 'Toată prospețimea unui mojito clasic, zero alcool', image: 'https://images.unsplash.com/photo-1497534446932-c925b458314e?w=800&q=80', tags: ['mocktail','refreshing','mint','citrus'], score: 5, json: { category:'non-alcoholic', spirit:'none', spiritLabel:'Mocktail', abv:0, difficulty:'easy', serves:1, ingredients:['30 ml suc de lămâie proaspăt','2 lingurițe zahăr','8-10 frunze de mentă','Apă carbogazoasă','Gheață'], steps:['Zdrobiți ușor mentă cu zahăr și suc de lămâie','Adăugați gheață','Completați cu apă carbogazoasă','Amestecați ușor'], glassware:'Highball', garnish:'Ramură de mentă, felie de lămâie' }},
  { slug: 'watermelon-agua-fresca', title: 'Watermelon Agua Fresca', summary: 'Pepene verde proaspăt amestecat, lămâie și mentă', image: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800&q=80', tags: ['mocktail','fruity','summer','blended'], score: 5, json: { category:'non-alcoholic', spirit:'none', spiritLabel:'Mocktail', abv:0, difficulty:'easy', serves:2, ingredients:['4 căni pepene verde cubulețe','Suc de la 2 lămâi','2 linguri zahăr','1 cană apă rece','Frunze de mentă'], steps:['Amestecați pepenele verde în blender','Strecurați prin sită fină','Adăugați suc de lămâie, zahăr și apă','Serviți peste gheață cu mentă'], glassware:'Pahar înalt', garnish:'Felie de pepene, mentă' }},
  { slug: 'ginger-lemon-shrub', title: 'Ginger & Lemon Shrub', summary: 'Oțet de băut, ghimbir proaspăt și lămâie - complex și plin de viață', image: 'https://images.unsplash.com/photo-1601314002592-b8734bca6604?w=800&q=80', tags: ['mocktail','ginger','shrub','wellness'], score: 4, json: { category:'non-alcoholic', spirit:'none', spiritLabel:'Mocktail', abv:0, difficulty:'medium', serves:1, ingredients:['30 ml shrub de ghimbir','15 ml suc de lămâie','Apă carbogazoasă','Gheață'], steps:['Turnați shrubul și sucul de lămâie în pahar','Adăugați gheață','Completați cu apă carbogazoasă','Amestecați ușor'], glassware:'Highball', garnish:'Felie de ghimbir, felie de lămâie' }},
  { slug: 'hibiscus-lemonade', title: 'Hibiscus Lemonade', summary: 'Ceai acrișor de hibiscus întâlnește limonada proaspătă', image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800&q=80', tags: ['mocktail','floral','citrus','party'], score: 5, json: { category:'non-alcoholic', spirit:'none', spiritLabel:'Mocktail', abv:0, difficulty:'easy', serves:4, ingredients:['4 căni ceai de hibiscus răcit','Suc de la 4 lămâi','100 g zahăr','4 căni apă rece'], steps:['Preparați ceaiul de hibiscus și lăsați să se răcească','Amestecați cu sucul de lămâie, zahăr și apă','Serviți peste gheață','Garnisiți cu mentă'], glassware:'Pahar înalt', garnish:'Mentă, felie de lămâie' }},
  { slug: 'matcha-tonic', title: 'Iced Matcha Tonic', summary: 'Matcha de grad ceremonial, apă tonică și yuzu - energie curată', image: 'https://images.unsplash.com/photo-1515823064-d6e0c04616a7?w=800&q=80', tags: ['mocktail','matcha','wellness','japanese'], score: 5, json: { category:'non-alcoholic', spirit:'none', spiritLabel:'Mocktail', abv:0, difficulty:'easy', serves:1, ingredients:['2 g matcha de grad ceremonial','30 ml apă caldă','150 ml apă tonică','Gheață'], steps:['Cernați matcha într-un bol mic','Adăugați apă caldă și bateți cu telul','Umpleți paharul cu gheață','Turnați apa tonică','Turnați încet matcha peste tonic'], glassware:'Highball', garnish:'Nimic sau felie de yuzu' }},
]

async function seed() {
  // Check for existing cocktails to avoid duplicates
  const { rows: existing } = await pool.query("SELECT COUNT(*) FROM posts WHERE type='cocktail'")
  if (parseInt(existing[0].count) > 0) {
    console.log(`Already have ${existing[0].count} cocktails in DB. Skipping seed.`)
    await pool.end()
    return
  }

  // Use system user for seeded content
  const SYSTEM_USER = 'c0000000-0000-0000-0000-000000000001'

  let inserted = 0
  for (const c of cocktails) {
    await pool.query(
      `INSERT INTO posts (id, created_by, type, slug, title, summary, hero_image_url, food_tags, quality_score, is_tested, status, recipe_json)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [SYSTEM_USER, 'cocktail', c.slug, c.title, c.summary, c.image, c.tags, c.score, true, 'active', JSON.stringify(c.json)]
    )
    inserted++
    process.stdout.write('.')
  }

  console.log(`\n✅ Inserted ${inserted} cocktails into posts table`)
  const { rows } = await pool.query("SELECT COUNT(*) FROM posts WHERE type='cocktail'")
  console.log(`Total cocktails in DB: ${rows[0].count}`)
  await pool.end()
}

seed().catch(e => { console.error('Fatal:', e); process.exit(1) })
