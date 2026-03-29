'use strict';
/**
 * Fixes the UUID format in recipes-seed.csv.
 * The pattern c{idx}000000 breaks for 2-digit idx (e.g., c11000000 = 9 hex chars, invalid).
 * New pattern: profile UUID = c0000000-0000-0000-0000-{idx:012d}
 *              cuisine UUID = d0000000-0000-0000-0000-{idx:012d}
 */
const fs = require('fs');

const csvPath = 'data/recipes-seed.csv';
const csv = fs.readFileSync(csvPath, 'utf8');
const lines = csv.split('\n');

// Build the mapping from bad UUIDs to good ones
// The idx is inferred from the pattern: c{N}000000-0000-0000-0000-000000000001
// New format: c0000000-0000-0000-0000-{idx padded to 12}

function fixUuid(uuid) {
  // Match profile: c{1-29}000000-0000-0000-0000-000000000001
  const profileMatch = uuid.match(/^c(\d+)000000-0000-0000-0000-000000000001$/);
  if (profileMatch) {
    const idx = parseInt(profileMatch[1]);
    return `c0000000-0000-0000-0000-${String(idx).padStart(12, '0')}`;
  }
  // Match cuisine: d{1-29}000000-0000-0000-0000-000000000001
  const cuisineMatch = uuid.match(/^d(\d+)000000-0000-0000-0000-000000000001$/);
  if (cuisineMatch) {
    const idx = parseInt(cuisineMatch[1]);
    return `d0000000-0000-0000-0000-${String(idx).padStart(12, '0')}`;
  }
  return uuid;
}

const fixed = lines.map(line => {
  // Replace all UUID-like patterns in each line
  return line.replace(/[cd]\d+000000-0000-0000-0000-000000000001/g, fixUuid);
});

fs.writeFileSync(csvPath, fixed.join('\n'), 'utf8');
console.log('Fixed UUIDs in recipes-seed.csv');

// Verify: show sample UUIDs from first data row
const sampleLine = fixed[1] || '';
const parts = sampleLine.split(',').slice(2, 6);
console.log('Sample UUIDs:', parts);
