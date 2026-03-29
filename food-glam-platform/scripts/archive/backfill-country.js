#!/usr/bin/env node
'use strict';

/**
 * backfill-country.js — Populate the `country` column on posts table.
 *
 * Strategy:
 *   1. For recipes: extract country from slug prefix using reverse slug map
 *   2. For cocktails: set country = 'International'
 *   3. Report stats
 *
 * Usage:
 *   node scripts/backfill-country.js              # backfill all
 *   node scripts/backfill-country.js --dry-run    # preview only
 */

const { createClient } = require('@supabase/supabase-js');
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DRY_RUN = process.argv.includes('--dry-run');

// ── Reverse slug map: slug prefix → country display name ──
const SLUG_TO_COUNTRY = {
  'china': 'China', 'japan': 'Japan', 'korea': 'South Korea', 'taiwan': 'Taiwan',
  'hong-kong': 'Hong Kong', 'mongolia': 'Mongolia',
  'thailand': 'Thailand', 'vietnam': 'Vietnam', 'cambodia': 'Cambodia',
  'laos': 'Laos', 'myanmar': 'Myanmar', 'indonesia': 'Indonesia',
  'malaysia': 'Malaysia', 'singapore': 'Singapore', 'philippines': 'Philippines',
  'brunei': 'Brunei', 'east-timor': 'East Timor',
  'india': 'India', 'pakistan': 'Pakistan', 'bangladesh': 'Bangladesh',
  'sri-lanka': 'Sri Lanka', 'nepal': 'Nepal', 'bhutan': 'Bhutan', 'maldives': 'Maldives',
  'georgia': 'Georgia', 'armenia': 'Armenia', 'azerbaijan': 'Azerbaijan',
  'uzbekistan': 'Uzbekistan', 'kazakhstan': 'Kazakhstan', 'kyrgyzstan': 'Kyrgyzstan',
  'tajikistan': 'Tajikistan', 'turkmenistan': 'Turkmenistan', 'afghanistan': 'Afghanistan',
  'lebanon': 'Lebanon', 'syria': 'Syria', 'jordan': 'Jordan', 'palestine': 'Palestine',
  'israel': 'Israel', 'saudi-arabia': 'Saudi Arabia', 'uae': 'UAE',
  'qatar': 'Qatar', 'kuwait': 'Kuwait', 'bahrain': 'Bahrain', 'oman': 'Oman',
  'yemen': 'Yemen', 'iran': 'Iran', 'iraq': 'Iraq', 'turkey': 'Turkey', 'cyprus': 'Cyprus',
  'italy': 'Italy', 'spain': 'Spain', 'greece': 'Greece', 'portugal': 'Portugal', 'malta': 'Malta',
  'france': 'France', 'germany': 'Germany', 'austria': 'Austria', 'switzerland': 'Switzerland',
  'netherlands': 'Netherlands', 'belgium': 'Belgium', 'luxembourg': 'Luxembourg',
  'uk': 'UK', 'ireland': 'Ireland',
  'sweden': 'Sweden', 'norway': 'Norway', 'denmark': 'Denmark', 'finland': 'Finland', 'iceland': 'Iceland',
  'estonia': 'Estonia', 'latvia': 'Latvia', 'lithuania': 'Lithuania',
  'poland': 'Poland', 'czech-republic': 'Czech Republic', 'slovakia': 'Slovakia',
  'hungary': 'Hungary', 'slovenia': 'Slovenia', 'croatia': 'Croatia',
  'serbia': 'Serbia', 'bosnia': 'Bosnia', 'albania': 'Albania',
  'north-macedonia': 'North Macedonia', 'bulgaria': 'Bulgaria', 'romania': 'Romania',
  'moldova': 'Moldova', 'montenegro': 'Montenegro', 'kosovo': 'Kosovo',
  'ukraine': 'Ukraine', 'russia': 'Russia', 'belarus': 'Belarus',
  'morocco': 'Morocco', 'algeria': 'Algeria', 'tunisia': 'Tunisia', 'libya': 'Libya',
  'egypt': 'Egypt', 'sudan': 'Sudan', 'mauritania': 'Mauritania',
  'nigeria': 'Nigeria', 'ghana': 'Ghana', 'senegal': 'Senegal', 'ivory-coast': 'Ivory Coast',
  'mali': 'Mali', 'guinea': 'Guinea', 'togo': 'Togo', 'benin': 'Benin',
  'cameroon': 'Cameroon', 'liberia': 'Liberia', 'sierra-leone': 'Sierra Leone',
  'gambia': 'Gambia', 'burkina-faso': 'Burkina Faso', 'niger': 'Niger',
  'ethiopia': 'Ethiopia', 'somalia': 'Somalia', 'eritrea': 'Eritrea', 'djibouti': 'Djibouti',
  'kenya': 'Kenya', 'tanzania': 'Tanzania', 'uganda': 'Uganda', 'rwanda': 'Rwanda',
  'burundi': 'Burundi', 'congo': 'Congo',
  'south-africa': 'South Africa', 'zimbabwe': 'Zimbabwe', 'zambia': 'Zambia',
  'malawi': 'Malawi', 'mozambique': 'Mozambique', 'botswana': 'Botswana',
  'namibia': 'Namibia', 'madagascar': 'Madagascar',
  'southern-us': 'United States', 'northeastern-us': 'United States',
  'midwestern-us': 'United States', 'western-us': 'United States',
  'canada': 'Canada', 'mexico': 'Mexico', 'tex-mex': 'Mexico',
  'guatemala': 'Guatemala', 'el-salvador': 'El Salvador', 'honduras': 'Honduras',
  'nicaragua': 'Nicaragua', 'costa-rica': 'Costa Rica', 'panama': 'Panama',
  'cuba': 'Cuba', 'jamaica': 'Jamaica', 'trinidad': 'Trinidad',
  'haiti': 'Haiti', 'dominican-republic': 'Dominican Republic',
  'puerto-rico': 'Puerto Rico', 'barbados': 'Barbados',
  'peru': 'Peru', 'bolivia': 'Bolivia', 'ecuador': 'Ecuador', 'colombia': 'Colombia',
  'venezuela': 'Venezuela', 'argentina': 'Argentina', 'brazil': 'Brazil',
  'chile': 'Chile', 'uruguay': 'Uruguay', 'paraguay': 'Paraguay',
  'guyana': 'Guyana', 'suriname': 'Suriname',
  'australia': 'Australia', 'new-zealand': 'New Zealand', 'fiji': 'Fiji',
  'samoa': 'Samoa', 'tonga': 'Tonga', 'hawaii': 'Hawaii',
  'papua-new-guinea': 'Papua New Guinea', 'vanuatu': 'Vanuatu',
};

// Sort prefixes longest-first so "south-africa" matches before "south"
const PREFIXES = Object.keys(SLUG_TO_COUNTRY).sort((a, b) => b.length - a.length);

function extractCountry(slug) {
  for (const prefix of PREFIXES) {
    if (slug.startsWith(prefix + '-')) {
      return SLUG_TO_COUNTRY[prefix];
    }
  }
  return null;
}

async function main() {
  console.log(DRY_RUN ? '🔍 DRY RUN — no writes\n' : '🚀 Backfilling country column...\n');

  // Fetch all posts
  let all = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('posts')
      .select('id, slug, type, country')
      .range(from, from + PAGE - 1);
    if (error) { console.error('Fetch error:', error); return; }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  console.log(`Total posts: ${all.length}`);

  const alreadySet = all.filter(r => r.country).length;
  console.log(`Already have country: ${alreadySet}`);

  const toUpdate = all.filter(r => !r.country);
  console.log(`Need backfill: ${toUpdate.length}\n`);

  let updated = 0;
  let unmatched = 0;
  const countryStats = {};
  const unmatchedSlugs = [];

  for (const post of toUpdate) {
    let country;
    if (post.type === 'cocktail') {
      country = 'International';
    } else {
      country = extractCountry(post.slug);
    }

    if (!country) {
      unmatched++;
      if (unmatchedSlugs.length < 20) unmatchedSlugs.push(post.slug);
      continue;
    }

    countryStats[country] = (countryStats[country] || 0) + 1;

    if (!DRY_RUN) {
      const { error } = await supabase
        .from('posts')
        .update({ country })
        .eq('id', post.id);
      if (error) {
        console.error(`  ✗ ${post.slug}: ${error.message}`);
        continue;
      }
    }
    updated++;
  }

  console.log(`\n✅ Updated: ${updated}`);
  console.log(`⚠️  Unmatched: ${unmatched}`);

  if (unmatchedSlugs.length > 0) {
    console.log('\nUnmatched slugs (first 20):');
    unmatchedSlugs.forEach(s => console.log(`  - ${s}`));
  }

  const sorted = Object.entries(countryStats).sort((a, b) => b[1] - a[1]);
  console.log(`\nCountry distribution (${sorted.length} countries):`);
  sorted.forEach(([c, n]) => console.log(`  ${c}: ${n}`));
}

main().catch(console.error);
