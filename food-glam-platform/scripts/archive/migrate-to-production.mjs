#!/usr/bin/env node
/**
 * Migrate data from local Supabase to production.
 * Usage: node scripts/migrate-to-production.mjs
 */

const PROD_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || (() => { console.error('Set NEXT_PUBLIC_SUPABASE_URL'); process.exit(1); })();
const PROD_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || (() => { console.error('Set SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); })();

import { readFileSync } from 'fs';
import { join } from 'path';

const BASE = process.cwd();

async function supabaseInsert(table, rows) {
  const batchSize = 100;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const res = await fetch(`${PROD_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': PROD_KEY,
        'Authorization': `Bearer ${PROD_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=ignore-duplicates'
      },
      body: JSON.stringify(batch)
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`  ERROR inserting ${table} batch ${i}: ${res.status} ${text}`);
      // Continue with next batch
    } else {
      inserted += batch.length;
      process.stdout.write(`  ${table}: ${inserted}/${rows.length}\r`);
    }
  }
  console.log(`  ${table}: ${inserted}/${rows.length} inserted`);
  return inserted;
}

async function main() {
  console.log('=== MareChef Production Migration ===\n');
  
  // 1. Profiles
  console.log('1/4 Migrating profiles...');
  const profiles = JSON.parse(readFileSync(join(BASE, 'tmp-profiles.json'), 'utf8'));
  await supabaseInsert('profiles', profiles);
  
  // 2. Cuisines
  console.log('2/4 Migrating cuisines...');
  const cuisines = JSON.parse(readFileSync(join(BASE, 'tmp-cuisines.json'), 'utf8'));
  await supabaseInsert('cuisines', cuisines);
  
  // 3. Posts (batched)
  console.log('3/4 Migrating posts (10 batches)...');
  let totalPosts = 0;
  for (let i = 0; i < 10; i++) {
    const file = join(BASE, `tmp-posts-batch-${i}.json`);
    let data;
    try {
      const raw = readFileSync(file, 'utf8').trim();
      if (!raw || raw === '' || raw === 'null') {
        console.log(`  Batch ${i}: empty, skipping`);
        continue;
      }
      data = JSON.parse(raw);
    } catch (e) {
      console.log(`  Batch ${i}: parse error, skipping`);
      continue;
    }
    if (!data || !Array.isArray(data) || data.length === 0) {
      console.log(`  Batch ${i}: no data, skipping`);
      continue;
    }
    console.log(`  Batch ${i}: ${data.length} posts`);
    const count = await supabaseInsert('posts', data);
    totalPosts += count;
  }
  console.log(`  Total posts migrated: ${totalPosts}`);
  
  // 4. Verify
  console.log('\n4/4 Verifying...');
  const checks = ['profiles', 'approaches', 'cuisines', 'posts'];
  for (const table of checks) {
    const res = await fetch(`${PROD_URL}/rest/v1/${table}?select=count`, {
      method: 'HEAD',
      headers: {
        'apikey': PROD_KEY,
        'Authorization': `Bearer ${PROD_KEY}`,
        'Prefer': 'count=exact'
      }
    });
    const count = res.headers.get('content-range');
    console.log(`  ${table}: ${count}`);
  }
  
  console.log('\n=== Migration complete ===');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
