import { NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'
import { validateContent } from '@/lib/profanity-filter'
import pool from '@/lib/db'

const MAX_COMMENTS_PER_DAY = 1

/* ── GET: List threads ──────────────────────────────────── */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const channelId = searchParams.get('channel_id')
    const limit = Math.min(Number(searchParams.get('limit') ?? 20), 100)

    const params: (string | number)[] = [limit]
    let where = "WHERE status = 'active'"
    if (channelId) {
      where += ' AND channel_id = $2'
      params.push(channelId)
    }

    const { rows } = await pool.query(
      `SELECT id, channel_id, author_id, title, body, status, is_pinned, is_locked, created_at
       FROM threads ${where}
       ORDER BY is_pinned DESC, created_at DESC
       LIMIT $1`,
      params,
    )

    return NextResponse.json({ threads: rows })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/* ── POST: Create a thread (1 per day limit) ────────────── */
export async function POST(req: Request) {
  try {
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, supabase)
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const body = await req.json()
    const { title, body: threadBody, channel_id } = body

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Profanity check
    const titleCheck = validateContent(title)
    if (titleCheck) return NextResponse.json({ error: titleCheck }, { status: 400 })
    if (threadBody) {
      const bodyCheck = validateContent(threadBody)
      if (bodyCheck) return NextResponse.json({ error: bodyCheck }, { status: 400 })
    }

    // Rate limit: 1 comment (thread or reply) per day
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { rows: [{ total }] } = await pool.query(
      `SELECT (
        (SELECT COUNT(*) FROM threads WHERE author_id = $1 AND created_at >= $2) +
        (SELECT COUNT(*) FROM replies WHERE author_id = $1 AND created_at >= $2)
      )::int AS total`,
      [user.id, oneDayAgo],
    )

    if (total >= MAX_COMMENTS_PER_DAY) {
      return NextResponse.json(
        { error: 'You can only post 1 comment per day. Try again tomorrow.' },
        { status: 429 },
      )
    }

    const { rows: [created] } = await pool.query(
      `INSERT INTO threads (author_id, title, body, channel_id, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING id`,
      [user.id, title.trim(), threadBody?.trim() || null, channel_id || null],
    )

    return NextResponse.json({ ok: true, id: created.id }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
