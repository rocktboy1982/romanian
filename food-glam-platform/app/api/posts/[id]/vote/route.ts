import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authClient = createServerSupabaseClient()
    const user = await getRequestUser(req, authClient)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { value } = await req.json()

    if (typeof value !== 'number' || ![1, -1].includes(value)) {
      return NextResponse.json({ error: 'Invalid vote value' }, { status: 400 })
    }

    const { id: postId } = await params

    const supabase = createServiceSupabaseClient()

    const { data: existingVote, error: existingError } = await supabase
      .from('votes')
      .select('*')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .single()

    if (existingVote) {
      const { error: updateError } = await supabase
        .from('votes')
        .update({ value })
        .eq('post_id', postId)
        .eq('user_id', user.id)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
    } else {
      const { error: insertError } = await supabase
        .from('votes')
        .insert({
          post_id: postId,
          user_id: user.id,
          value
        })

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
    }

    const { data: voteCounts, error: voteCountsError } = await supabase
      .from('votes')
      .select('value')
      .eq('post_id', postId)

    const netVotes = voteCounts?.reduce((sum, vote) => sum + (vote.value || 0), 0) || 0

    return NextResponse.json({
      success: true,
      netVotes,
      userVote: value
    })
  } catch (err: any) {
    console.error('Vote API error:', err)
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 }
    )
  }
}
