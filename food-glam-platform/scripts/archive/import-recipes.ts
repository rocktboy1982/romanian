/**
 * import-recipes.ts
 * Imports 580 recipes (29 countries × 20) from data/recipes-seed.csv
 * into the local Supabase PostgreSQL instance.
 *
 * Tables touched:
 *   auth.users         — inserts ghost users for each country chef profile
 *   public.profiles    — one profile per country (c{idx}000000-...)
 *   public.cuisines    — one cuisine per country (d{idx}000000-...)
 *   public.approaches  — already seeded, just ensures they exist
 *   public.recipes     — one row per scraped recipe
 *   public.posts       — one post per recipe (mirrors recipe content)
 *
 * Run:
 *   npx tsx scripts/import-recipes.ts
 *   # or: npx ts-node --esm scripts/import-recipes.ts
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  max: 5,
});

// ─── CSV parser ───────────────────────────────────────────────────────────────
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let inQuote = false;
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        cell += '"';
        i += 2;
        continue;
      }
      inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      cells.push(cell);
      cell = '';
    } else {
      cell += ch;
    }
    i++;
  }
  cells.push(cell);
  return cells;
}

interface RecipeRow {
  country: string;
  countryCode: string;
  cuisineUuid: string;
  profileUuid: string;
  recipeUuid: string;
  postUuid: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  servings: number;
  difficultyLevel: 'easy' | 'medium' | 'hard';
  imageUrl: string;
  approachId: string | null;
  sourceUrl: string;
}

function parseRow(headers: string[], values: string[]): RecipeRow | null {
  const get = (col: string) => values[headers.indexOf(col)]?.trim() ?? '';

  const title = get('title');
  if (!title) return null;

  const difficulty = get('difficulty_level');
  const difficultyLevel: 'easy' | 'medium' | 'hard' =
    difficulty === 'easy' || difficulty === 'hard' ? difficulty : 'medium';

  return {
    country: get('country'),
    countryCode: get('country_code'),
    cuisineUuid: get('cuisine_uuid'),
    profileUuid: get('profile_uuid'),
    recipeUuid: get('recipe_uuid'),
    postUuid: get('post_uuid'),
    title,
    slug: get('slug'),
    summary: get('summary').slice(0, 500),
    description: get('description').slice(0, 500),
    ingredients: get('ingredients').split('|').map(s => s.trim()).filter(Boolean),
    instructions: get('instructions').split('|').map(s => s.trim()).filter(Boolean),
    prepTimeMinutes: parseInt(get('prep_time_minutes')) || 15,
    cookTimeMinutes: parseInt(get('cook_time_minutes')) || 30,
    servings: parseInt(get('servings')) || 4,
    difficultyLevel,
    imageUrl: get('image_url'),
    approachId: get('approach_id') || null,
    sourceUrl: get('source_url'),
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const client = await pool.connect();

  try {
    // Read from all CSV files (seed + new countries + patch)
    const csvFiles = [
      path.join(__dirname, '..', 'data', 'recipes-seed.csv'),
      path.join(__dirname, '..', 'data', 'recipes-new-countries.csv'),
      path.join(__dirname, '..', 'data', 'recipes-patch-clean.csv'),
      path.join(__dirname, '..', 'data', 'recipes-patch-topup.csv'),
      path.join(__dirname, '..', 'data', 'recipes-patch-final.csv'),
      path.join(__dirname, '..', 'data', 'recipes-missing-countries.csv'),
    ].filter(f => { try { fs.accessSync(f); return true; } catch { return false; } });

    const allRows: RecipeRow[] = [];
    for (const csvPath of csvFiles) {
      const csv = fs.readFileSync(csvPath, 'utf8');
      const csvLines = csv.split('\n').filter(l => l.trim());
      const fileHeaders = parseCsvLine(csvLines[0]);
      const fileRows = csvLines.slice(1).map(l => parseRow(fileHeaders, parseCsvLine(l))).filter(Boolean) as RecipeRow[];
      allRows.push(...fileRows);
      console.log(`Loaded ${fileRows.length} rows from ${path.basename(csvPath)}`);
    }

    // Deduplicate: keep first occurrence per slug and per UUID
    const seenSlugs = new Set<string>();
    const seenUuids = new Set<string>();
    const rows = allRows.filter(row => {
      if (seenSlugs.has(row.slug) || seenUuids.has(row.recipeUuid)) return false;
      seenSlugs.add(row.slug);
      seenUuids.add(row.recipeUuid);
      return true;
    });
    console.log(`Deduplicated: ${allRows.length} → ${rows.length} unique rows`);

    console.log(`Total: ${rows.length} rows from ${csvFiles.length} files`);

    await client.query('BEGIN');

    // ── Step 1: Ensure approaches exist ──────────────────────────────────────
    const approaches = [
      ['b0000000-0000-0000-0000-000000000001', 'Italian', 'Classic Italian cooking traditions'],
      ['b0000000-0000-0000-0000-000000000002', 'Japanese', 'Japanese culinary arts'],
      ['b0000000-0000-0000-0000-000000000003', 'Mexican', 'Traditional Mexican cuisine'],
      ['b0000000-0000-0000-0000-000000000004', 'French', 'Classic French cooking'],
      ['b0000000-0000-0000-0000-000000000005', 'Indian', 'Indian culinary traditions'],
      ['b0000000-0000-0000-0000-000000000006', 'Plant-Based', 'Plant-based cooking'],
    ];
    for (const [id, name, description] of approaches) {
      await client.query(
        `INSERT INTO approaches (id, name, description) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [id, name, description]
      );
    }
    console.log('✓ Approaches ensured');

    // ── Step 2: Collect unique countries/profiles/cuisines ───────────────────
    const countryMap = new Map<string, RecipeRow>(); // country → first row with that country
    for (const row of rows) {
      if (!countryMap.has(row.country)) countryMap.set(row.country, row);
    }

    // ── Step 3: Insert auth.users + profiles + cuisines per country ──────────
    for (const [country, row] of countryMap) {
      const { profileUuid, cuisineUuid, countryCode } = row;
      const email = `chef_${country.toLowerCase().replace(/\s+/g, '_')}@seed.local`;

      // Insert into auth.users (bypass FK constraint — local dev only)
      await client.query(
        `INSERT INTO auth.users (
          id, email, encrypted_password, email_confirmed_at,
          created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
        ) VALUES (
          $1, $2, '', NOW(), NOW(), NOW(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          '{}'::jsonb, 'authenticated', 'authenticated'
        ) ON CONFLICT (id) DO NOTHING`,
        [profileUuid, email]
      );

      // Insert profile
      await client.query(
        `INSERT INTO profiles (id, email, username, display_name, bio)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [
          profileUuid,
          email,
          `chef_${country.toLowerCase().replace(/\s+/g, '_')}`,
          `Chef ${country}`,
          `${country} cuisine specialist`,
        ]
      );

      // Insert cuisine with fixed UUID
      await client.query(
        `INSERT INTO cuisines (id, name, slug, country_code, description)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [
          cuisineUuid,
          country,
          country.toLowerCase().replace(/\s+/g, '-'),
          countryCode,
          `${country} cuisine`,
        ]
      );
    }
    console.log(`✓ ${countryMap.size} profiles + cuisines upserted`);

    // ── Step 4: Insert recipes ────────────────────────────────────────────────
    let recipesInserted = 0;
    let recipesSkipped = 0;
    for (const row of rows) {
      const approachId = row.approachId && row.approachId.length > 0 ? row.approachId : null;

      const res = await client.query(
        `INSERT INTO recipes (
          id, title, slug, summary, description,
          ingredients, instructions,
          prep_time_minutes, cook_time_minutes, servings, difficulty_level,
          image_url, approach_id, created_by, cuisine_id
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10, $11,
          $12, $13, $14, $15
        ) ON CONFLICT (id) DO NOTHING
          RETURNING id`,
        [
          row.recipeUuid,
          row.title,
          row.slug,
          row.summary || row.title,
          row.description || row.summary || row.title,
          row.ingredients,
          row.instructions,
          row.prepTimeMinutes,
          row.cookTimeMinutes,
          row.servings,
          row.difficultyLevel,
          row.imageUrl,
          approachId,
          row.profileUuid,
          row.cuisineUuid,
        ]
      );

      if (res.rowCount && res.rowCount > 0) recipesInserted++;
      else recipesSkipped++;
    }
    console.log(`✓ Recipes: ${recipesInserted} inserted, ${recipesSkipped} skipped`);

    // ── Step 5: Insert posts ──────────────────────────────────────────────────
    let postsInserted = 0;
    let postsSkipped = 0;
    for (const row of rows) {
      const approachId = row.approachId && row.approachId.length > 0 ? row.approachId : null;
      const content = [
        row.summary,
        row.sourceUrl ? `Source: ${row.sourceUrl}` : '',
        row.ingredients.length > 0 ? `Ingredients: ${row.ingredients.slice(0, 5).join(', ')}${row.ingredients.length > 5 ? '...' : ''}` : '',
      ].filter(Boolean).join('\n\n');

      const res = await client.query(
        `INSERT INTO posts (id, created_by, approach_id, title, content, status)
         VALUES ($1, $2, $3, $4, $5, 'active')
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [
          row.postUuid,
          row.profileUuid,
          approachId,
          row.title,
          content,
        ]
      );

      if (res.rowCount && res.rowCount > 0) postsInserted++;
      else postsSkipped++;
    }
    console.log(`✓ Posts: ${postsInserted} inserted, ${postsSkipped} skipped`);

    await client.query('COMMIT');
    console.log('\n✅ Import complete!');

    // ── Verification query ───────────────────────────────────────────────────
    const verifyRes = await client.query(`
      SELECT c.name as country, COUNT(r.id) as recipe_count
      FROM cuisines c
      LEFT JOIN recipes r ON r.cuisine_id = c.id
      WHERE c.id::text LIKE 'd%'
      GROUP BY c.name
      ORDER BY c.name
    `);
    console.log('\nVerification — recipe counts per country:');
    for (const row of verifyRes.rows) {
      const count = parseInt(row.recipe_count);
      const mark = count >= 20 ? '✅' : count > 0 ? '⚠️ ' : '❌';
      console.log(`  ${mark} ${row.country}: ${count}`);
    }

    const totalRes = await client.query("SELECT COUNT(*) FROM recipes WHERE cuisine_id::text LIKE $1", ['d%']);
    console.log(`\nTotal seeded recipes: ${totalRes.rows[0].count}`);

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', (err as any).message || err);
  if ((err as any).detail) console.error('Detail:', (err as any).detail);
  if ((err as any).hint) console.error('Hint:', (err as any).hint);
  process.exit(1);
});
