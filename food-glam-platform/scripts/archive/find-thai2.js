'use strict';
const axios = require('axios');
const cheerio = require('cheerio');
const ax = axios.create({
  timeout: 15000,
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36' }
});

async function check(urls) {
  for (const url of urls) {
    try {
      const r = await ax.get(url, { validateStatus: () => true, responseType: 'text' });
      const has = r.data.includes('"@type":"Recipe"') || r.data.includes('"@type": "Recipe"');
      // Extract title from JSON-LD if possible
      const m = r.data.match(/"name"\s*:\s*"([^"]+)"/);
      const title = m ? m[1] : '?';
      console.log(r.status, has ? 'JSON-LD✅' : 'NO', title.slice(0, 50), url);
    } catch (e) { console.log('ERR', e.message.slice(0, 40), url); }
    await new Promise(r => setTimeout(r, 300));
  }
}

// These are actual confirmed Thai food.com recipe IDs from known recipes
check([
  'https://www.food.com/recipe/thai-basil-fried-rice-245490',
  'https://www.food.com/recipe/thai-peanut-sauce-45094',
  'https://www.food.com/recipe/pad-thai-noodles-39087',
  'https://www.food.com/recipe/tom-yum-soup-52776',
  'https://www.food.com/recipe/thai-green-curry-22889',
  'https://www.food.com/recipe/thai-coconut-sticky-rice-with-mango-254378',
  'https://www.food.com/recipe/thai-spring-rolls-fresh-42340',
  'https://www.food.com/recipe/chicken-satay-64551',
  'https://www.food.com/recipe/som-tum-thai-papaya-salad-291892',
  'https://www.food.com/recipe/thai-iced-tea-52083',
  'https://www.food.com/recipe/pad-see-ew-196034',
  'https://www.food.com/recipe/tom-kha-gai-32984',
  'https://www.food.com/recipe/thai-larb-58934',
  'https://www.food.com/recipe/khao-man-gai-thai-poached-chicken-rice-506688',
  'https://www.food.com/recipe/thai-basil-chicken-stir-fry-245490',
  'https://www.food.com/recipe/massaman-beef-curry-162162',
  'https://www.food.com/recipe/thai-pumpkin-coconut-soup-181234',
  'https://www.food.com/recipe/thai-cucumber-salad-42934',
  'https://www.food.com/recipe/thai-cashew-chicken-108234',
  'https://www.food.com/recipe/pad-kee-mao-drunken-noodles-475788',
]).catch(console.error);
