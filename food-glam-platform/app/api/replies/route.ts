import { NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'
import { validateContent } from '@/lib/profanity-filter'
import pool from '@/lib/db'

const MAX_COMMENTS_PER_DAY = 1

/* ── GET: List replies for a thread ────────────────────── */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const threadId = searchParams.get('thread_id')
    const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200)

    if (!threadId) {
      return NextResponse.json({ error: 'thread_id is required' }, { status: 400 })
    }

    const { rows } = await pool.query(
      `SELECT id, thread_id, author_id, body, status, created_at
       FROM replies
       WHERE thread_id = $1 AND status = 'active'
       ORDER BY created_at ASC
       LIMIT $2`,
      [threadId, limit],
    )

    return NextResponse.json({ replies: rows })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/* ── POST: Create a reply (1 comment per day limit) ─────── */
export async function POST(req: Request) {
  try {
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, supabase)
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const reqBody = await req.json()
    const { thread_id, body } = reqBody

    if (!thread_id || typeof thread_id !== 'string') {
      return NextResponse.json({ error: 'thread_id is required' }, { status: 400 })
    }
    if (!body || typeof body !== 'string' || !body.trim()) {
      return NextResponse.json({ error: 'Reply body is required' }, { status: 400 })
    }

    // Profanity check
    const profanityError = validateContent(body)
    if (profanityError) return NextResponse.json({ error: profanityError }, { status: 400 })

    // Verify thread exists and is not locked
    const { rows: threadRows } = await pool.query(
      `SELECT id, is_locked FROM threads WHERE id = $1 AND status = 'active'`,
      [thread_id],
    )
    if (threadRows.length === 0) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }
    if (threadRows[0].is_locked) {
      return NextResponse.json({ error: 'This thread is locked' }, { status: 403 })
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
      `INSERT INTO replies (thread_id, author_id, body, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING id, thread_id, created_at`,
      [thread_id, user.id, body.trim()],
    )

    return NextResponse.json({ ok: true, id: created.id, thread_id: created.thread_id }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
