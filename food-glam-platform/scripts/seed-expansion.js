#!/usr/bin/env node
'use strict';
/**
 * seed-expansion.js
 * Reads all batch files from data/recipe-batches/ and inserts recipes into the posts table.
 * Skips duplicates via ON CONFLICT (slug) DO NOTHING.
 *
 * Usage: node scripts/seed-expansion.js
 */

const { Pool } = require('pg');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');

// ─── Config ─────────────────────────────────────────────────────────────────
const DB_CONFIG = {
  host: '127.0.0.1',
  port: 54322,
  user: 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: 'postgres',
};

const APPROACH_IDS = [
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000003',
  'b0000000-0000-0000-0000-000000000004',
  'b0000000-0000-0000-0000-000000000005',
  'b0000000-0000-0000-0000-000000000006',
];

const BATCH_DIR = path.join(__dirname, '..', 'data', 'recipe-batches');

// ─── Country name → slug prefix + profileId mapping ─────────────────────────
// Keys must match exactly what the batch files export
const COUNTRY_NAME_MAP = {
  'Afghanistan':        { prefix: 'afghanistan',   profileId: 'c0000000-0000-0000-0000-000000000100' },
  'Albania':            { prefix: 'albania',       profileId: 'c0000000-0000-0000-0000-000000000101' },
  'Algeria':            { prefix: 'algeria',       profileId: 'c0000000-0000-0000-0000-000000000036' },
  'Argentina':          { prefix: 'argentina',     profileId: 'c0000000-0000-0000-0000-000000000015' },
  'Armenia':            { prefix: 'armenia',       profileId: 'c0000000-0000-0000-0000-000000000102' },
  'Australia':          { prefix: 'australia',     profileId: 'c0000000-0000-0000-0000-000000000030' },
  'Austria':            { prefix: 'austria',       profileId: 'c0000000-0000-0000-0000-000000000054' },
  'Azerbaijan':         { prefix: 'azerbaijan',    profileId: 'c0000000-0000-0000-0000-000000000103' },
  'Bahrain':            { prefix: 'bahrain',       profileId: 'c0000000-0000-0000-0000-000000000104' },
  'Bangladesh':         { prefix: 'bangladesh',    profileId: 'c0000000-0000-0000-0000-000000000046' },
  'Barbados':           { prefix: 'barbados',      profileId: 'c0000000-0000-0000-0000-000000000105' },
  'Belarus':            { prefix: 'belarus',       profileId: 'c0000000-0000-0000-0000-000000000106' },
  'Belgium':            { prefix: 'belgium',       profileId: 'c0000000-0000-0000-0000-000000000056' },
  'Benin':              { prefix: 'benin',         profileId: 'c0000000-0000-0000-0000-000000000107' },
  'Bhutan':             { prefix: 'bhutan',        profileId: 'c0000000-0000-0000-0000-000000000108' },
  'Bolivia':            { prefix: 'bolivia',       profileId: 'c0000000-0000-0000-0000-000000000109' },
  'Bosnia':             { prefix: 'bosnia',        profileId: 'c0000000-0000-0000-0000-000000000110' },
  'Botswana':           { prefix: 'botswana',      profileId: 'c0000000-0000-0000-0000-000000000111' },
  'Brazil':             { prefix: 'brazil',        profileId: 'c0000000-0000-0000-0000-000000000012' },
  'Brunei':             { prefix: 'brunei',        profileId: 'c0000000-0000-0000-0000-000000000112' },
  'Bulgaria':           { prefix: 'bulgaria',      profileId: 'c0000000-0000-0000-0000-000000000064' },
  'Burkina Faso':       { prefix: 'burkina',       profileId: 'c0000000-0000-0000-0000-000000000113' },
  'Burundi':            { prefix: 'burundi',       profileId: 'c0000000-0000-0000-0000-000000000114' },
  'Cambodia':           { prefix: 'cambodia',      profileId: 'c0000000-0000-0000-0000-000000000065' },
  'Cameroon':           { prefix: 'cameroon',      profileId: 'c0000000-0000-0000-0000-000000000115' },
  'Canada':             { prefix: 'canada',        profileId: 'c0000000-0000-0000-0000-000000000037' },
  'Chile':              { prefix: 'chile',         profileId: 'c0000000-0000-0000-0000-000000000041' },
  'China':              { prefix: 'china',         profileId: 'c0000000-0000-0000-0000-000000000011' },
  'Colombia':           { prefix: 'colombia',      profileId: 'c0000000-0000-0000-0000-000000000040' },
  'Congo':              { prefix: 'congo',         profileId: 'c0000000-0000-0000-0000-000000000116' },
  'Costa Rica':         { prefix: 'costa',         profileId: 'c0000000-0000-0000-0000-000000000117' },
  'Croatia':            { prefix: 'croatia',       profileId: 'c0000000-0000-0000-0000-000000000062' },
  'Cuba':               { prefix: 'cuba',          profileId: 'c0000000-0000-0000-0000-000000000039' },
  'Cyprus':             { prefix: 'cyprus',        profileId: 'c0000000-0000-0000-0000-000000000118' },
  'Czech Republic':     { prefix: 'czech',         profileId: 'c0000000-0000-0000-0000-000000000061' },
  'Denmark':            { prefix: 'denmark',       profileId: 'c0000000-0000-0000-0000-000000000058' },
  'Djibouti':           { prefix: 'djibouti',      profileId: 'c0000000-0000-0000-0000-000000000119' },
  'Dominican Republic': { prefix: 'dominican',     profileId: 'c0000000-0000-0000-0000-000000000120' },
  'East Timor':         { prefix: 'east',          profileId: 'c0000000-0000-0000-0000-000000000121' },
  'Ecuador':            { prefix: 'ecuador',       profileId: 'c0000000-0000-0000-0000-000000000069' },
  'Egypt':              { prefix: 'egypt',         profileId: 'c0000000-0000-0000-0000-000000000028' },
  'El Salvador':        { prefix: 'el',            profileId: 'c0000000-0000-0000-0000-000000000122' },
  'Eritrea':            { prefix: 'eritrea',       profileId: 'c0000000-0000-0000-0000-000000000123' },
  'Estonia':            { prefix: 'estonia',       profileId: 'c0000000-0000-0000-0000-000000000124' },
  'Ethiopia':           { prefix: 'ethiopia',      profileId: 'c0000000-0000-0000-0000-000000000023' },
  'Fiji':               { prefix: 'fiji',          profileId: 'c0000000-0000-0000-0000-000000000125' },
  'Finland':            { prefix: 'finland',       profileId: 'c0000000-0000-0000-0000-000000000059' },
  'France':             { prefix: 'france',        profileId: 'c0000000-0000-0000-0000-000000000002' },
  'Gambia':             { prefix: 'gambia',        profileId: 'c0000000-0000-0000-0000-000000000126' },
  'Georgia':            { prefix: 'georgia',       profileId: 'c0000000-0000-0000-0000-000000000047' },
  'Germany':            { prefix: 'germany',       profileId: 'c0000000-0000-0000-0000-000000000004' },
  'Ghana':              { prefix: 'ghana',         profileId: 'c0000000-0000-0000-0000-000000000033' },
  'Greece':             { prefix: 'greece',        profileId: 'c0000000-0000-0000-0000-000000000008' },
  'Guatemala':          { prefix: 'guatemala',     profileId: 'c0000000-0000-0000-0000-000000000127' },
  'Guinea':             { prefix: 'guinea',        profileId: 'c0000000-0000-0000-0000-000000000128' },
  'Guyana':             { prefix: 'guyana',        profileId: 'c0000000-0000-0000-0000-000000000129' },
  'Haiti':              { prefix: 'haiti',         profileId: 'c0000000-0000-0000-0000-000000000130' },
  'Hawaii (US)':        { prefix: 'hawaii',        profileId: 'c0000000-0000-0000-0000-000000000131' },
  'Hawaii':             { prefix: 'hawaii',        profileId: 'c0000000-0000-0000-0000-000000000131' },
  'Honduras':           { prefix: 'honduras',      profileId: 'c0000000-0000-0000-0000-000000000132' },
  'Hong Kong':          { prefix: 'hong',          profileId: 'c0000000-0000-0000-0000-000000000133' },
  'Hungary':            { prefix: 'hungary',       profileId: 'c0000000-0000-0000-0000-000000000060' },
  'Iceland':            { prefix: 'iceland',       profileId: 'c0000000-0000-0000-0000-000000000134' },
  'India':              { prefix: 'india',         profileId: 'c0000000-0000-0000-0000-000000000007' },
  'Indonesia':          { prefix: 'indonesia',     profileId: 'c0000000-0000-0000-0000-000000000019' },
  'Iran':               { prefix: 'iran',          profileId: 'c0000000-0000-0000-0000-000000000027' },
  'Iraq':               { prefix: 'iraq',          profileId: 'c0000000-0000-0000-0000-000000000135' },
  'Ireland':            { prefix: 'ireland',       profileId: 'c0000000-0000-0000-0000-000000000053' },
  'Israel':             { prefix: 'israel',        profileId: 'c0000000-0000-0000-0000-000000000051' },
  'Italy':              { prefix: 'italy',         profileId: 'c0000000-0000-0000-0000-000000000001' },
  'Ivory Coast':        { prefix: 'ivory',         profileId: 'c0000000-0000-0000-0000-000000000136' },
  'Jamaica':            { prefix: 'jamaica',       profileId: 'c0000000-0000-0000-0000-000000000038' },
  'Japan':              { prefix: 'japan',         profileId: 'c0000000-0000-0000-0000-000000000005' },
  'Jordan':             { prefix: 'jordan',        profileId: 'c0000000-0000-0000-0000-000000000070' },
  'Kazakhstan':         { prefix: 'kazakhstan',    profileId: 'c0000000-0000-0000-0000-000000000137' },
  'Kenya':              { prefix: 'kenya',         profileId: 'c0000000-0000-0000-0000-000000000034' },
  'Kosovo':             { prefix: 'kosovo',        profileId: 'c0000000-0000-0000-0000-000000000138' },
  'Kuwait':             { prefix: 'kuwait',        profileId: 'c0000000-0000-0000-0000-000000000139' },
  'Kyrgyzstan':         { prefix: 'kyrgyzstan',    profileId: 'c0000000-0000-0000-0000-000000000140' },
  'Laos':               { prefix: 'laos',          profileId: 'c0000000-0000-0000-0000-000000000141' },
  'Latvia':             { prefix: 'latvia',        profileId: 'c0000000-0000-0000-0000-000000000142' },
  'Lebanon':            { prefix: 'lebanon',       profileId: 'c0000000-0000-0000-0000-000000000025' },
  'Liberia':            { prefix: 'liberia',       profileId: 'c0000000-0000-0000-0000-000000000143' },
  'Libya':              { prefix: 'libya',         profileId: 'c0000000-0000-0000-0000-000000000144' },
  'Lithuania':          { prefix: 'lithuania',     profileId: 'c0000000-0000-0000-0000-000000000145' },
  'Luxembourg':         { prefix: 'luxembourg',    profileId: 'c0000000-0000-0000-0000-000000000146' },
  'Madagascar':         { prefix: 'madagascar',    profileId: 'c0000000-0000-0000-0000-000000000147' },
  'Malawi':             { prefix: 'malawi',        profileId: 'c0000000-0000-0000-0000-000000000148' },
  'Malaysia':           { prefix: 'malaysia',      profileId: 'c0000000-0000-0000-0000-000000000042' },
  'Maldives':           { prefix: 'maldives',      profileId: 'c0000000-0000-0000-0000-000000000149' },
  'Mali':               { prefix: 'mali',          profileId: 'c0000000-0000-0000-0000-000000000150' },
  'Malta':              { prefix: 'malta',         profileId: 'c0000000-0000-0000-0000-000000000151' },
  'Mauritania':         { prefix: 'mauritania',    profileId: 'c0000000-0000-0000-0000-000000000152' },
  'Mexico':             { prefix: 'mexico',        profileId: 'c0000000-0000-0000-0000-000000000006' },
  'Midwestern US':      { prefix: 'midwestern',    profileId: 'c0000000-0000-0000-0000-000000000153' },
  'Moldova':            { prefix: 'moldova',       profileId: 'c0000000-0000-0000-0000-000000000154' },
  'Mongolia':           { prefix: 'mongolia',      profileId: 'c0000000-0000-0000-0000-000000000155' },
  'Montenegro':         { prefix: 'montenegro',    profileId: 'c0000000-0000-0000-0000-000000000156' },
  'Morocco':            { prefix: 'morocco',       profileId: 'c0000000-0000-0000-0000-000000000009' },
  'Mozambique':         { prefix: 'mozambique',    profileId: 'c0000000-0000-0000-0000-000000000157' },
  'Myanmar':            { prefix: 'myanmar',       profileId: 'c0000000-0000-0000-0000-000000000066' },
  'Namibia':            { prefix: 'namibia',       profileId: 'c0000000-0000-0000-0000-000000000158' },
  'Nepal':              { prefix: 'nepal',         profileId: 'c0000000-0000-0000-0000-000000000071' },
  'Netherlands':        { prefix: 'netherlands',   profileId: 'c0000000-0000-0000-0000-000000000055' },
  'New Zealand':        { prefix: 'new',           profileId: 'c0000000-0000-0000-0000-000000000031' },
  'Nicaragua':          { prefix: 'nicaragua',     profileId: 'c0000000-0000-0000-0000-000000000159' },
  'Niger':              { prefix: 'niger',         profileId: 'c0000000-0000-0000-0000-000000000160' },
  'Nigeria':            { prefix: 'nigeria',       profileId: 'c0000000-0000-0000-0000-000000000022' },
  'North Macedonia':    { prefix: 'north',         profileId: 'c0000000-0000-0000-0000-000000000161' },
  'Northeastern US':    { prefix: 'northeastern',  profileId: 'c0000000-0000-0000-0000-000000000162' },
  'Norway':             { prefix: 'norway',        profileId: 'c0000000-0000-0000-0000-000000000057' },
  'Oman':               { prefix: 'oman',          profileId: 'c0000000-0000-0000-0000-000000000163' },
  'Pakistan':           { prefix: 'pakistan',       profileId: 'c0000000-0000-0000-0000-000000000045' },
  'Palestine':          { prefix: 'palestine',     profileId: 'c0000000-0000-0000-0000-000000000164' },
  'Panama':             { prefix: 'panama',        profileId: 'c0000000-0000-0000-0000-000000000165' },
  'Papua New Guinea':   { prefix: 'papua',         profileId: 'c0000000-0000-0000-0000-000000000166' },
  'Paraguay':           { prefix: 'paraguay',      profileId: 'c0000000-0000-0000-0000-000000000167' },
  'Peru':               { prefix: 'peru',          profileId: 'c0000000-0000-0000-0000-000000000024' },
  'Philippines':        { prefix: 'philippines',   profileId: 'c0000000-0000-0000-0000-000000000017' },
  'Poland':             { prefix: 'poland',        profileId: 'c0000000-0000-0000-0000-000000000014' },
  'Portugal':           { prefix: 'portugal',      profileId: 'c0000000-0000-0000-0000-000000000020' },
  'Puerto Rico':        { prefix: 'puerto',        profileId: 'c0000000-0000-0000-0000-000000000168' },
  'Qatar':              { prefix: 'qatar',         profileId: 'c0000000-0000-0000-0000-000000000169' },
  'Romania':            { prefix: 'romania',       profileId: 'c0000000-0000-0000-0000-000000000063' },
  'Russia':             { prefix: 'russia',        profileId: 'c0000000-0000-0000-0000-000000000016' },
  'Rwanda':             { prefix: 'rwanda',        profileId: 'c0000000-0000-0000-0000-000000000170' },
  'Samoa':              { prefix: 'samoa',         profileId: 'c0000000-0000-0000-0000-000000000171' },
  'Saudi Arabia':       { prefix: 'saudi',         profileId: 'c0000000-0000-0000-0000-000000000049' },
  'Senegal':            { prefix: 'senegal',       profileId: 'c0000000-0000-0000-0000-000000000172' },
  'Serbia':             { prefix: 'serbia',        profileId: 'c0000000-0000-0000-0000-000000000173' },
  'Sierra Leone':       { prefix: 'sierra',        profileId: 'c0000000-0000-0000-0000-000000000174' },
  'Singapore':          { prefix: 'singapore',     profileId: 'c0000000-0000-0000-0000-000000000043' },
  'Slovakia':           { prefix: 'slovakia',      profileId: 'c0000000-0000-0000-0000-000000000175' },
  'Slovenia':           { prefix: 'slovenia',      profileId: 'c0000000-0000-0000-0000-000000000176' },
  'Somalia':            { prefix: 'somalia',       profileId: 'c0000000-0000-0000-0000-000000000177' },
  'South Africa':       { prefix: 'south',         profileId: 'c0000000-0000-0000-0000-000000000032' },
  'South Korea':        { prefix: 'south',         profileId: 'c0000000-0000-0000-0000-000000000018' },
  'Southern US':        { prefix: 'southern',      profileId: 'c0000000-0000-0000-0000-000000000178' },
  'Spain':              { prefix: 'spain',         profileId: 'c0000000-0000-0000-0000-000000000003' },
  'Sri Lanka':          { prefix: 'sri',           profileId: 'c0000000-0000-0000-0000-000000000044' },
  'Sudan':              { prefix: 'sudan',         profileId: 'c0000000-0000-0000-0000-000000000179' },
  'Suriname':           { prefix: 'suriname',      profileId: 'c0000000-0000-0000-0000-000000000180' },
  'Sweden':             { prefix: 'sweden',        profileId: 'c0000000-0000-0000-0000-000000000021' },
  'Switzerland':        { prefix: 'switzerland',   profileId: 'c0000000-0000-0000-0000-000000000181' },
  'Syria':              { prefix: 'syria',         profileId: 'c0000000-0000-0000-0000-000000000182' },
  'Taiwan':             { prefix: 'taiwan',        profileId: 'c0000000-0000-0000-0000-000000000067' },
  'Tajikistan':         { prefix: 'tajikistan',    profileId: 'c0000000-0000-0000-0000-000000000183' },
  'Tanzania':           { prefix: 'tanzania',      profileId: 'c0000000-0000-0000-0000-000000000184' },
  'Tex-Mex':            { prefix: 'tex',           profileId: 'c0000000-0000-0000-0000-000000000185' },
  'Thailand':           { prefix: 'thailand',      profileId: 'c0000000-0000-0000-0000-000000000010' },
  'Togo':               { prefix: 'togo',          profileId: 'c0000000-0000-0000-0000-000000000186' },
  'Tonga':              { prefix: 'tonga',         profileId: 'c0000000-0000-0000-0000-000000000187' },
  'Trinidad':           { prefix: 'trinidad',      profileId: 'c0000000-0000-0000-0000-000000000188' },
  'Tunisia':            { prefix: 'tunisia',       profileId: 'c0000000-0000-0000-0000-000000000035' },
  'Turkey':             { prefix: 'turkey',        profileId: 'c0000000-0000-0000-0000-000000000013' },
  'Turkmenistan':       { prefix: 'turkmenistan',  profileId: 'c0000000-0000-0000-0000-000000000189' },
  'UAE':                { prefix: 'uae',           profileId: 'c0000000-0000-0000-0000-000000000050' },
  'Uganda':             { prefix: 'uganda',        profileId: 'c0000000-0000-0000-0000-000000000190' },
  'UK':                 { prefix: 'uk',            profileId: 'c0000000-0000-0000-0000-000000000052' },
  'Ukraine':            { prefix: 'ukraine',       profileId: 'c0000000-0000-0000-0000-000000000029' },
  'Uruguay':            { prefix: 'uruguay',       profileId: 'c0000000-0000-0000-0000-000000000191' },
  'Uzbekistan':         { prefix: 'uzbekistan',    profileId: 'c0000000-0000-0000-0000-000000000048' },
  'Vanuatu':            { prefix: 'vanuatu',       profileId: 'c0000000-0000-0000-0000-000000000192' },
  'Venezuela':          { prefix: 'venezuela',     profileId: 'c0000000-0000-0000-0000-000000000068' },
  'Vietnam':            { prefix: 'vietnam',       profileId: 'c0000000-0000-0000-0000-000000000026' },
  'Western US':         { prefix: 'western',       profileId: 'c0000000-0000-0000-0000-000000000193' },
  'Yemen':              { prefix: 'yemen',         profileId: 'c0000000-0000-0000-0000-000000000194' },
  'Zambia':             { prefix: 'zambia',        profileId: 'c0000000-0000-0000-0000-000000000195' },
  'Zimbabwe':           { prefix: 'zimbabwe',      profileId: 'c0000000-0000-0000-0000-000000000196' },
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 120);
}

let approachIdx = 0;
function nextApproach() {
  const id = APPROACH_IDS[approachIdx % APPROACH_IDS.length];
  approachIdx++;
  return id;
}

function buildRecipeJson(r) {
  return JSON.stringify({
    id: randomUUID(),
    servings: r.servings || 4,
    ingredients: r.ingredients || [],
    instructions: r.instructions || [],
    difficulty_level: r.difficulty || 'medium',
    cook_time_minutes: r.cookTime || 30,
    prep_time_minutes: r.prepTime || 15,
    nutrition_per_serving: {
      fat: Math.floor(Math.random() * 20) + 5,
      carbs: Math.floor(Math.random() * 40) + 10,
      protein: Math.floor(Math.random() * 25) + 5,
      calories: Math.floor(Math.random() * 400) + 150,
    },
  });
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const pool = new Pool(DB_CONFIG);

  // 1. Load existing slugs to avoid duplicates
  console.log('Loading existing slugs...');
  const { rows: existingRows } = await pool.query(
    "SELECT slug FROM posts WHERE type='recipe' AND status='active'"
  );
  const existingSlugs = new Set(existingRows.map(r => r.slug));
  console.log(`Found ${existingSlugs.size} existing recipe slugs`);

  // 2. Read all batch files
  const batchFiles = fs.readdirSync(BATCH_DIR)
    .filter(f => f.startsWith('batch') && f.endsWith('.js'))
    .sort();
  console.log(`Found ${batchFiles.length} batch files`);

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  const countryCounts = {};

  for (const batchFile of batchFiles) {
    const batchPath = path.join(BATCH_DIR, batchFile);
    let batchData;
    try {
      batchData = require(batchPath);
    } catch (e) {
      console.error(`  ERROR loading ${batchFile}: ${e.message}`);
      totalErrors++;
      continue;
    }

    console.log(`\nProcessing ${batchFile}...`);

    for (const [countryName, recipes] of Object.entries(batchData)) {
      const mapping = COUNTRY_NAME_MAP[countryName];
      if (!mapping) {
        console.error(`  WARNING: No mapping for country "${countryName}" — skipping ${recipes.length} recipes`);
        totalErrors += recipes.length;
        continue;
      }

      const { prefix, profileId } = mapping;
      let inserted = 0;
      let skipped = 0;

      for (const recipe of recipes) {
        const titleSlug = slugify(recipe.title);
        const slug = `${prefix}-${titleSlug}`;

        if (existingSlugs.has(slug)) {
          skipped++;
          continue;
        }

        const id = randomUUID();
        const approachId = nextApproach();
        const recipeJson = buildRecipeJson(recipe);
        const content = recipe.description || recipe.summary || '';
        const summary = recipe.summary || '';
        const sourceUrl = recipe.sourceUrl || '';

        try {
          const result = await pool.query(
            `INSERT INTO posts (id, created_by, approach_id, title, content, status, type, slug, hero_image_url, summary, source_url, recipe_json, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, 'active', 'recipe', $6, '', $7, $8, $9::jsonb, NOW(), NOW())`,
            [id, profileId, approachId, recipe.title, content, slug, summary, sourceUrl, recipeJson]
          );

          if (result.rowCount > 0) {
            inserted++;
            existingSlugs.add(slug);
          } else {
            skipped++;
          }
        } catch (e) {
          console.error(`    ERROR inserting "${recipe.title}": ${e.message}`);
          totalErrors++;
        }
      }

      countryCounts[prefix] = (countryCounts[prefix] || 0) + inserted;
      totalInserted += inserted;
      totalSkipped += skipped;
      console.log(`  ${countryName} (${prefix}): +${inserted} inserted, ${skipped} skipped`);
    }
  }

  // 3. Summary
  console.log('\n═══════════════════════════════════════════');
  console.log(`DONE: ${totalInserted} inserted, ${totalSkipped} skipped, ${totalErrors} errors`);
  console.log('═══════════════════════════════════════════');

  // Final count
  const { rows: [{ count }] } = await pool.query(
    "SELECT COUNT(*) FROM posts WHERE type='recipe' AND status='active'"
  );
  console.log(`Total active recipes in DB: ${count}`);

  await pool.end();
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
