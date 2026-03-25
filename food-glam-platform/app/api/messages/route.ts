import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'
import { ADMIN_EMAILS } from '@/lib/require-admin'

/* ─── types ─────────────────────────────────────────────────────────────── */

export interface MessageReply {
  id: string
  from_user_id: string
  from_display_name: string
  body: string
  created_at: string
  is_admin: boolean
}

export interface Message {
  id: string
  from_user_id: string
  from_display_name: string
  from_handle: string
  subject: string
  body: string
  is_read: boolean
  created_at: string
  replies: MessageReply[]
}

/* ─── GET ───────────────────────────────────────────────────────────────── */
// Returns messages for current user (user sees their own, admin sees all)
export async function GET(req: Request) {
  try {
    const authClient = createServerSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const supabase = createServiceSupabaseClient()
    const isAdmin = ADMIN_EMAILS.includes(user.email) || process.env.NODE_ENV === 'development'

    // All message data (body + replies) lives in recipe_json
    let query = supabase
      .from('posts')
      .select('id, title, status, created_at, created_by, recipe_json, profiles!created_by(display_name, handle)')
      .eq('type', 'message')
      .order('created_at', { ascending: false })
      .limit(100)

    // Non-admin users only see their own messages
    if (!isAdmin) {
      query = query.eq('created_by', user.id)
    }

    const { data: posts, error } = await query

    if (error) {
      console.error('[messages GET]', error)
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    const messages: Message[] = (posts || []).map((p: Record<string, unknown>) => {
      const profileRaw = p.profiles
      const profile = Array.isArray(profileRaw) ? profileRaw[0] : (profileRaw as Record<string, string> | null)
      const meta = (p.recipe_json as Record<string, unknown>) || {}
      const replies: MessageReply[] = Array.isArray(meta.replies) ? (meta.replies as MessageReply[]) : []
      const statusStr = String(p.status ?? '')

      return {
        id: String(p.id),
        from_user_id: String(p.created_by),
        from_display_name: profile?.display_name || 'Utilizator',
        from_handle: profile?.handle || '',
        subject: String(p.title || '(fără subiect)'),
        // body is stored in recipe_json.body
        body: String(meta.body || ''),
        is_read: statusStr !== 'unread',
        created_at: String(p.created_at),
        replies,
      }
    })

    return NextResponse.json({ messages })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/* ─── POST ──────────────────────────────────────────────────────────────── */
// Create a new message (from user to admin)
export async function POST(req: Request) {
  try {
    const authClient = createServerSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const supabase = createServiceSupabaseClient()
    const reqBody = await req.json()
    const { subject, message } = reqBody

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Mesajul este obligatoriu' }, { status: 400 })
    }

    const subjectText = (subject && typeof subject === 'string' ? subject.trim() : '') || 'Mesaj nou'

    const { data: created, error } = await supabase
      .from('posts')
      .insert({
        type: 'message',
        title: subjectText,
        status: 'unread',
        created_by: user.id,
        // body and replies stored together in recipe_json
        recipe_json: { body: message.trim(), replies: [] },
        slug: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[messages POST]', error)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: created.id }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/* ─── PATCH ─────────────────────────────────────────────────────────────── */
// Mark as read OR add a reply
export async function PATCH(req: Request) {
  try {
    const authClient = createServerSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const supabase = createServiceSupabaseClient()
    const reqBody = await req.json()
    const { id, action, reply_body } = reqBody

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // Fetch existing message
    const { data: post, error: fetchError } = await supabase
      .from('posts')
      .select('id, created_by, status, recipe_json')
      .eq('id', id)
      .eq('type', 'message')
      .single()

    if (fetchError || !post) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    const isAdmin = ADMIN_EMAILS.includes(user.email) || process.env.NODE_ENV === 'development'
    const isOwner = (post as Record<string, unknown>).created_by === user.id

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    if (action === 'mark_read') {
      const { error: updateError } = await supabase
        .from('posts')
        .update({ status: 'read' })
        .eq('id', id)

      if (updateError) {
        return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 })
      }
      return NextResponse.json({ ok: true })
    }

    if (action === 'reply') {
      if (!reply_body || typeof reply_body !== 'string' || !reply_body.trim()) {
        return NextResponse.json({ error: 'Reply body is required' }, { status: 400 })
      }

      // Get replier display name
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single()

      const displayName = (profile as { display_name?: string } | null)?.display_name || (isAdmin ? 'Admin' : 'Utilizator')

      const meta = ((post as Record<string, unknown>).recipe_json as Record<string, unknown>) || {}
      const existingReplies: MessageReply[] = Array.isArray(meta.replies) ? (meta.replies as MessageReply[]) : []

      const newReply: MessageReply = {
        id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        from_user_id: user.id,
        from_display_name: displayName,
        body: (reply_body as string).trim(),
        created_at: new Date().toISOString(),
        is_admin: isAdmin,
      }

      const updatedReplies = [...existingReplies, newReply]
      const currentStatus = String((post as Record<string, unknown>).status ?? '')

      const { error: updateError } = await supabase
        .from('posts')
        .update({
          recipe_json: { ...meta, replies: updatedReplies },
          // Mark as replied when admin responds so user knows there's an answer
          status: isAdmin ? 'replied' : currentStatus,
        })
        .eq('id', id)

      if (updateError) {
        console.error('[messages PATCH reply]', updateError)
        return NextResponse.json({ error: 'Failed to save reply' }, { status: 500 })
      }

      return NextResponse.json({ ok: true, reply: newReply })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
