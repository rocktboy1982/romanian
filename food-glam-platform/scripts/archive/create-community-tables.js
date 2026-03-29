const { Pool } = require('pg')

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '54322'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'postgres',
})

async function main() {
  const client = await pool.connect()
  try {
    // Create threads table
    await client.query(`
      CREATE TABLE IF NOT EXISTS threads (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        channel_id uuid,
        author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        title text NOT NULL,
        body text,
        status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'hidden')),
        is_pinned boolean NOT NULL DEFAULT false,
        is_locked boolean NOT NULL DEFAULT false,
        created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('threads table: OK')

    // Create replies table
    await client.query(`
      CREATE TABLE IF NOT EXISTS replies (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        thread_id uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        body text NOT NULL,
        status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'hidden')),
        created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('replies table: OK')

    // Create channel_settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS channel_settings (
        owner_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
        discord_invite_url text,
        community_enabled boolean NOT NULL DEFAULT true,
        community_mode text NOT NULL DEFAULT 'open' CHECK (community_mode IN ('disabled', 'open', 'moderated'))
      )
    `)
    console.log('channel_settings table: OK')

    // Indexes
    await client.query('CREATE INDEX IF NOT EXISTS threads_channel_id_idx ON threads (channel_id)')
    await client.query('CREATE INDEX IF NOT EXISTS threads_author_id_idx ON threads (author_id)')
    await client.query('CREATE INDEX IF NOT EXISTS threads_status_idx ON threads (status)')
    await client.query('CREATE INDEX IF NOT EXISTS threads_created_at_idx ON threads (created_at DESC)')
    await client.query('CREATE INDEX IF NOT EXISTS replies_thread_id_idx ON replies (thread_id)')
    await client.query('CREATE INDEX IF NOT EXISTS replies_author_id_idx ON replies (author_id)')
    await client.query('CREATE INDEX IF NOT EXISTS replies_status_idx ON replies (status)')
    console.log('indexes: OK')

    // RLS
    await client.query('ALTER TABLE threads ENABLE ROW LEVEL SECURITY')
    await client.query('ALTER TABLE replies ENABLE ROW LEVEL SECURITY')
    await client.query('ALTER TABLE channel_settings ENABLE ROW LEVEL SECURITY')
    console.log('RLS: OK')

    // Policies (drop first for idempotency)
    await client.query("DROP POLICY IF EXISTS threads_all ON threads")
    await client.query("CREATE POLICY threads_all ON threads FOR ALL USING (true) WITH CHECK (true)")
    await client.query("DROP POLICY IF EXISTS replies_all ON replies")
    await client.query("CREATE POLICY replies_all ON replies FOR ALL USING (true) WITH CHECK (true)")
    await client.query("DROP POLICY IF EXISTS channel_settings_all ON channel_settings")
    await client.query("CREATE POLICY channel_settings_all ON channel_settings FOR ALL USING (true) WITH CHECK (true)")
    console.log('policies: OK')

    // Grants
    await client.query('GRANT ALL ON threads TO anon, authenticated, service_role')
    await client.query('GRANT ALL ON replies TO anon, authenticated, service_role')
    await client.query('GRANT ALL ON channel_settings TO anon, authenticated, service_role')
    console.log('grants: OK')

    // Verify
    const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('threads','replies','channel_settings') ORDER BY table_name")
    console.log('Verified tables:', res.rows.map(r => r.table_name))
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(e => { console.error(e.message); process.exit(1) })
