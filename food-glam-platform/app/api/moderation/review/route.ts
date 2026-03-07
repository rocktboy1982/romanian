import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

interface ReviewBody {
  id: string
  action: 'approve' | 'reject'
  reason?: string
}

export async function POST(req: Request) {
  try {
    const body: ReviewBody = await req.json()
    const { id, action } = body
    if (!id || !action) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // moderator role check — verify actual role value
    const { data: roles } = await supabase.from('app_roles').select('role').eq('user_id', user.id).in('role', ['moderator', 'admin']).limit(1)
    if (!roles || roles.length === 0) return NextResponse.json({ error: 'Moderator access required' }, { status: 403 })

    if (action === 'approve') {
      // fetch submission
      const { data: submission } = await supabase.from('submissions').select('*').eq('id', id).limit(1).single()
      if (!submission) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })

      const sub = submission as Record<string, unknown>

      // create a post from submission
      const postInsert: Record<string, unknown> = {
        title: sub.title,
        type: sub.type,
        slug: null,
        approach_id: null,
        created_by: (sub.created_by as string) || user.id,
        status: 'active',
        recipe_json: sub.content || null,
        video_url: sub.url || null,
        hero_image_url: null,
        diet_tags: [],
        food_tags: [],
      }

      const { data: postData, error: postErr } = await supabase.from('posts').insert(postInsert).select('id').single()
      if (postErr) return NextResponse.json({ error: postErr.message }, { status: 500 })

      const updates: Record<string, unknown> = { status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() }
      const { error: updErr } = await supabase.from('submissions').update(updates).eq('id', id)
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

      // Log moderation action
      await supabase.from('moderation_actions').insert({
        entity_type: 'post',
        entity_id: postData?.id ?? id,
        action: 'approve',
        acted_by: user.id,
      })

      return NextResponse.json({ ok: true, postId: postData?.id })
    }

    // reject path
    const updates: Record<string, unknown> = { status: 'rejected', reviewed_by: user.id, reviewed_at: new Date().toISOString() }
    if (body.reason) updates.rejection_reason = body.reason
    const { error } = await supabase.from('submissions').update(updates).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Log moderation action
    await supabase.from('moderation_actions').insert({
      entity_type: 'post',
      entity_id: id,
      action: 'reject',
      reason: body.reason || null,
      acted_by: user.id,
    })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
