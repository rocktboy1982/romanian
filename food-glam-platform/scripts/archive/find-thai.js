'use strict';
const axios = require('axios');
const cheerio = require('cheerio');
const ax = axios.create({
  timeout: 15000,
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36' }
});

async function main() {
  // Try food.com category page for Thai
  const r = await ax.get('https://www.food.com/ideas/thai-recipes-6117', { responseType: 'text' });
  const $ = cheerio.load(r.data);
  const links = new Set();
  $('a[href]').each((_, el) => {
    const h = $(el).attr('href') || '';
    if (h.includes('food.com/recipe/') && /\d{4,}/.test(h)) links.add(h.split('?')[0]);
  });
  console.log('Found', links.size, 'recipe links:');
  [...links].slice(0, 25).forEach(l => console.log(l));
}
main().catch(console.error);
