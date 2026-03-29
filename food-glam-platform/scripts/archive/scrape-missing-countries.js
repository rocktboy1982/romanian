#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

function cuisineUUID(idx) { return `d0000000-0000-0000-0000-${String(idx).padStart(12,'0')}`; }
function profileUUID(idx) { return `c0000000-0000-0000-0000-${String(idx).padStart(12,'0')}`; }
function csvField(v) { return `"${String(v ?? '').replace(/\r?\n/g, ' ').replace(/"/g, '""')}"`; }
function toSlug(prefix, title) {
  return prefix.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' +
    title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 55);
}
const APPROACH_IDS = [
  'b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000004',
  'b0000000-0000-0000-0000-000000000005','b0000000-0000-0000-0000-000000000006'
];
const CSV_HEADER = 'country,country_code,cuisine_uuid,profile_uuid,recipe_uuid,post_uuid,title,slug,summary,description,ingredients,instructions,prep_time_minutes,cook_time_minutes,servings,difficulty_level,image_url,approach_id,source_url';

function makeRow(country, code, cuisineId, profileId, r, rowIdx) {
  const slug = toSlug(country.toLowerCase(), r.title);
  const approachId = APPROACH_IDS[rowIdx % APPROACH_IDS.length];
  const total = (r.prepTime || 15) + (r.cookTime || 30);
  const diff = r.difficulty || (total <= 30 ? 'easy' : total <= 75 ? 'medium' : 'hard');
  return [
    csvField(country), csvField(code), csvField(cuisineId), csvField(profileId),
    csvField(randomUUID()), csvField(randomUUID()),
    csvField(r.title), csvField(slug),
    csvField(r.summary || r.title), csvField(r.description || r.summary || r.title),
    csvField(r.ingredients.join('|')),
    csvField(r.instructions.join('|')),
    csvField(r.prepTime || 15), csvField(r.cookTime || 30),
    csvField(r.servings || 4), csvField(diff),
    csvField(r.imageUrl || ''), csvField(approachId),
    csvField(r.sourceUrl || ''),
  ].join(',');
}

const COUNTRIES = [
  { name: 'Afghanistan',       code: 'AF', idx: 100 },
  { name: 'Albania',           code: 'AL', idx: 101 },
  { name: 'Armenia',           code: 'AM', idx: 102 },
  { name: 'Azerbaijan',        code: 'AZ', idx: 103 },
  { name: 'Bahrain',           code: 'BH', idx: 104 },
  { name: 'Barbados',          code: 'BB', idx: 105 },
  { name: 'Belarus',           code: 'BY', idx: 106 },
  { name: 'Benin',             code: 'BJ', idx: 107 },
  { name: 'Bhutan',            code: 'BT', idx: 108 },
  { name: 'Bolivia',           code: 'BO', idx: 109 },
  { name: 'Bosnia',            code: 'BA', idx: 110 },
  { name: 'Botswana',          code: 'BW', idx: 111 },
  { name: 'Brunei',            code: 'BN', idx: 112 },
  { name: 'Burkina Faso',      code: 'BF', idx: 113 },
  { name: 'Burundi',           code: 'BI', idx: 114 },
  { name: 'Cameroon',          code: 'CM', idx: 115 },
  { name: 'Congo',             code: 'CD', idx: 116 },
  { name: 'Costa Rica',        code: 'CR', idx: 117 },
  { name: 'Cyprus',            code: 'CY', idx: 118 },
  { name: 'Djibouti',          code: 'DJ', idx: 119 },
  { name: 'Dominican Republic',code: 'DO', idx: 120 },
  { name: 'East Timor',        code: 'TL', idx: 121 },
  { name: 'El Salvador',       code: 'SV', idx: 122 },
  { name: 'Eritrea',           code: 'ER', idx: 123 },
  { name: 'Estonia',           code: 'EE', idx: 124 },
  { name: 'Fiji',              code: 'FJ', idx: 125 },
  { name: 'Gambia',            code: 'GM', idx: 126 },
  { name: 'Guatemala',         code: 'GT', idx: 127 },
  { name: 'Guinea',            code: 'GN', idx: 128 },
  { name: 'Guyana',            code: 'GY', idx: 129 },
  { name: 'Haiti',             code: 'HT', idx: 130 },
  { name: 'Hawaii (US)',       code: 'US', idx: 131 },
  { name: 'Honduras',          code: 'HN', idx: 132 },
  { name: 'Hong Kong',         code: 'HK', idx: 133 },
  { name: 'Iceland',           code: 'IS', idx: 134 },
  { name: 'Iraq',              code: 'IQ', idx: 135 },
  { name: 'Ivory Coast',       code: 'CI', idx: 136 },
  { name: 'Kazakhstan',        code: 'KZ', idx: 137 },
  { name: 'Kosovo',            code: 'XK', idx: 138 },
  { name: 'Kuwait',            code: 'KW', idx: 139 },
  { name: 'Kyrgyzstan',        code: 'KG', idx: 140 },
  { name: 'Laos',              code: 'LA', idx: 141 },
  { name: 'Latvia',            code: 'LV', idx: 142 },
  { name: 'Liberia',           code: 'LR', idx: 143 },
  { name: 'Libya',             code: 'LY', idx: 144 },
  { name: 'Lithuania',         code: 'LT', idx: 145 },
  { name: 'Luxembourg',        code: 'LU', idx: 146 },
  { name: 'Madagascar',        code: 'MG', idx: 147 },
  { name: 'Malawi',            code: 'MW', idx: 148 },
  { name: 'Maldives',          code: 'MV', idx: 149 },
  { name: 'Mali',              code: 'ML', idx: 150 },
  { name: 'Malta',             code: 'MT', idx: 151 },
  { name: 'Mauritania',        code: 'MR', idx: 152 },
  { name: 'Midwestern US',     code: 'US', idx: 153 },
  { name: 'Moldova',           code: 'MD', idx: 154 },
  { name: 'Mongolia',          code: 'MN', idx: 155 },
  { name: 'Montenegro',        code: 'ME', idx: 156 },
  { name: 'Mozambique',        code: 'MZ', idx: 157 },
  { name: 'Namibia',           code: 'NA', idx: 158 },
  { name: 'Nicaragua',         code: 'NI', idx: 159 },
  { name: 'Niger',             code: 'NE', idx: 160 },
  { name: 'North Macedonia',   code: 'MK', idx: 161 },
  { name: 'Northeastern US',   code: 'US', idx: 162 },
  { name: 'Oman',              code: 'OM', idx: 163 },
  { name: 'Palestine',         code: 'PS', idx: 164 },
  { name: 'Panama',            code: 'PA', idx: 165 },
  { name: 'Papua New Guinea',  code: 'PG', idx: 166 },
  { name: 'Paraguay',          code: 'PY', idx: 167 },
  { name: 'Puerto Rico',       code: 'PR', idx: 168 },
  { name: 'Qatar',             code: 'QA', idx: 169 },
  { name: 'Rwanda',            code: 'RW', idx: 170 },
  { name: 'Samoa',             code: 'WS', idx: 171 },
  { name: 'Senegal',           code: 'SN', idx: 172 },
  { name: 'Serbia',            code: 'RS', idx: 173 },
  { name: 'Sierra Leone',      code: 'SL', idx: 174 },
  { name: 'Slovakia',          code: 'SK', idx: 175 },
  { name: 'Slovenia',          code: 'SI', idx: 176 },
  { name: 'Somalia',           code: 'SO', idx: 177 },
  { name: 'Southern US',       code: 'US', idx: 178 },
  { name: 'Sudan',             code: 'SD', idx: 179 },
  { name: 'Suriname',          code: 'SR', idx: 180 },
  { name: 'Switzerland',       code: 'CH', idx: 181 },
  { name: 'Syria',             code: 'SY', idx: 182 },
  { name: 'Tajikistan',        code: 'TJ', idx: 183 },
  { name: 'Tanzania',          code: 'TZ', idx: 184 },
  { name: 'Tex-Mex',           code: 'US', idx: 185 },
  { name: 'Togo',              code: 'TG', idx: 186 },
  { name: 'Tonga',             code: 'TO', idx: 187 },
  { name: 'Trinidad',          code: 'TT', idx: 188 },
  { name: 'Turkmenistan',      code: 'TM', idx: 189 },
  { name: 'Uganda',            code: 'UG', idx: 190 },
  { name: 'Uruguay',           code: 'UY', idx: 191 },
  { name: 'Vanuatu',           code: 'VU', idx: 192 },
  { name: 'Western US',        code: 'US', idx: 193 },
  { name: 'Yemen',             code: 'YE', idx: 194 },
  { name: 'Zambia',            code: 'ZM', idx: 195 },
  { name: 'Zimbabwe',          code: 'ZW', idx: 196 },
];

// Recipe data loaded from batch files
const RECIPES = {};
const batchDir = path.join(__dirname, '..', 'data', 'recipe-batches');
if (fs.existsSync(batchDir)) {
  const files = fs.readdirSync(batchDir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const batch = require(path.join(batchDir, file));
    Object.assign(RECIPES, batch);
  }
}

const OUTPUT = path.join(__dirname, '..', 'data', 'recipes-missing-countries.csv');

async function main() {
  const rows = [CSV_HEADER];
  let totalHardcoded = 0;
  let totalFallback = 0;

  for (const country of COUNTRIES) {
    const cuisineId = cuisineUUID(country.idx);
    const profileId = profileUUID(country.idx);
    const recipes = RECIPES[country.name];
    if (!recipes || recipes.length < 20) {
      console.error(`ERROR: ${country.name} has ${recipes ? recipes.length : 0} recipes, need 20`);
      process.exit(1);
    }
    recipes.slice(0, 20).forEach((r, i) => {
      rows.push(makeRow(country.name, country.code, cuisineId, profileId, r, i));
    });
    totalHardcoded += 20;
    console.log(`  ✓ ${country.name}: 20 recipes`);
  }

  fs.writeFileSync(OUTPUT, rows.join('\n'), 'utf8');
  console.log(`\n✅ Written ${rows.length - 1} recipe rows to ${OUTPUT}`);
  console.log(`   Hardcoded: ${totalHardcoded}`);
}

main().catch(err => { console.error(err); process.exit(1); });
