#!/usr/bin/env node
/**
 * Upload images from local Supabase storage to production.
 * Reads from local storage API, uploads to production storage API.
 */

import { readFileSync } from 'fs';

const LOCAL_URL = 'http://127.0.0.1:54321';
const PROD_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || (() => { console.error('Set NEXT_PUBLIC_SUPABASE_URL'); process.exit(1); })();
const PROD_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || (() => { console.error('Set SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); })();
const BUCKET = 'recipe-images';

const CONCURRENCY = 5; // parallel uploads
const MAX_RETRIES = 2;

async function uploadOne(objectName) {
  // Download from local
  const localUrl = `${LOCAL_URL}/storage/v1/object/public/${BUCKET}/${objectName}`;
  const dlRes = await fetch(localUrl);
  if (!dlRes.ok) {
    return { name: objectName, status: 'dl-error', code: dlRes.status };
  }
  const blob = await dlRes.blob();
  const contentType = dlRes.headers.get('content-type') || 'image/jpeg';
  
  // Upload to production
  const uploadUrl = `${PROD_URL}/storage/v1/object/${BUCKET}/${objectName}`;
  const ulRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'apikey': PROD_KEY,
      'Authorization': `Bearer ${PROD_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true'
    },
    body: blob
  });
  
  if (!ulRes.ok) {
    const text = await ulRes.text();
    return { name: objectName, status: 'ul-error', code: ulRes.status, msg: text.substring(0, 100) };
  }
  return { name: objectName, status: 'ok' };
}

async function uploadWithRetry(objectName) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await uploadOne(objectName);
      if (result.status === 'ok') return result;
      if (attempt === MAX_RETRIES) return result;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        return { name: objectName, status: 'exception', msg: err.message?.substring(0, 100) };
      }
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}

async function main() {
  const objectNames = readFileSync('tmp-storage-objects.txt', 'utf8')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
  
  console.log(`Uploading ${objectNames.length} images to production...`);
  
  let success = 0, failed = 0;
  const errors = [];
  
  // Process in batches with concurrency
  for (let i = 0; i < objectNames.length; i += CONCURRENCY) {
    const batch = objectNames.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(uploadWithRetry));
    
    for (const r of results) {
      if (r.status === 'ok') {
        success++;
      } else {
        failed++;
        errors.push(r);
      }
    }
    
    const total = success + failed;
    if (total % 50 === 0 || total === objectNames.length) {
      console.log(`  Progress: ${total}/${objectNames.length} (${success} ok, ${failed} failed)`);
    }
  }
  
  console.log(`\nDone: ${success} uploaded, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\nErrors:');
    for (const e of errors.slice(0, 20)) {
      console.log(`  ${e.name}: ${e.status} ${e.code || ''} ${e.msg || ''}`);
    }
    if (errors.length > 20) console.log(`  ... and ${errors.length - 20} more`);
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
