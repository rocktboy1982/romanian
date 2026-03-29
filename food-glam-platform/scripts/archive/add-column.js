// Quick script to add source_url column via supabase-js rpc
// Run from project root: node scripts/add-column.js

const { createClient } = require('@supabase/supabase-js')
// SUPABASE_URL from env — set NEXT_PUBLIC_SUPABASE_URL (production) or LOCAL_SUPABASE_URL (local dev)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.LOCAL_SUPABASE_URL
const supabase = createClient(
  SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

async function main() {
  // Test if column already exists by trying to select it
  const { error } = await supabase.from('posts').select('source_url').limit(1)
  if (!error) {
    console.log('source_url column already exists')
    return
  }
  
  console.log('Column does not exist. Attempting to add via pg_net...')
  console.log('Please run this SQL in Supabase Studio at http://127.0.0.1:54323 :')
  console.log('')
  console.log('  ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS source_url text;')
  console.log('')
}

main()
