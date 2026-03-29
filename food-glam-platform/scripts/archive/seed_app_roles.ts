import { createClient } from '@supabase/supabase-js';

// Usage: node ./scripts/seed_app_roles.js <SUPABASE_URL> <SUPABASE_SERVICE_KEY> <USER_ID>

const [,, SUPABASE_URL, SUPABASE_SERVICE_KEY, USER_ID, ROLE] = process.argv;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !USER_ID) {
  console.error('Usage: node seed_app_roles.js <SUPABASE_URL> <SUPABASE_SERVICE_KEY> <USER_ID> [role]');
  process.exit(1);
}

const role = ROLE || 'moderator';

async function run() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data, error } = await supabase.from('app_roles').upsert({ user_id: USER_ID, role });
  if (error) {
    console.error('Seed failed', error);
    process.exit(2);
  }
  console.log('Seeded app_roles:', data);
}

run();
