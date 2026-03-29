import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'

export async function POST(req: Request) {
  try {
    const authClient = createServerSupabaseClient()
    const user = await getRequestUser(req, authClient)

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await req.json()
    const { followed_id } = body as { followed_id: string }

    if (!followed_id) {
      return NextResponse.json({ error: 'followed_id is required' }, { status: 400 })
    }

    if (followed_id === user.id) {
      return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 })
    }

    const supabase = createServiceSupabaseClient()

    // Check if already following
    const { data: existing } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', user.id)
      .eq('followed_id', followed_id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ message: 'Already following' }, { status: 200 })
    }

    const { error: insertError } = await supabase
      .from('follows')
      .insert({ follower_id: user.id, followed_id })

    if (insertError) {
      console.error('Follow insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Return updated follower count
    const { count } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('followed_id', followed_id)

    return NextResponse.json({
      message: 'Followed successfully',
      follower_count: count ?? 0,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Follow API error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const authClient = createServerSupabaseClient()
    const user = await getRequestUser(req, authClient)

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await req.json()
    const { followed_id } = body as { followed_id: string }

    if (!followed_id) {
      return NextResponse.json({ error: 'followed_id is required' }, { status: 400 })
    }

    const supabase = createServiceSupabaseClient()

    const { error: deleteError } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('followed_id', followed_id)

    if (deleteError) {
      console.error('Unfollow delete error:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // Return updated follower count
    const { count } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('followed_id', followed_id)

    return NextResponse.json({
      message: 'Unfollowed successfully',
      follower_count: count ?? 0,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Unfollow API error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
