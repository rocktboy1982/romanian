import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit } from '@/lib/rate-limit'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    // Rate limit: 100 requests per minute per IP
    const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim()
    const { success } = rateLimit(`profile:${ip}`, 100, 60 * 1000)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { handle } = await params
    const supabase = await createServerSupabaseClient()

    // Get current user for follow status
    const { data: { user } } = await supabase.auth.getUser()

    // Fetch profile by handle
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, handle, display_name, bio, avatar_url, banner_url, created_at')
      .eq('handle', handle)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Count followers
    const { count: followerCount } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('followed_id', profile.id)

    // Count following
    const { count: followingCount } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', profile.id)

    // Count posts
    const { count: postCount } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('created_by', profile.id)
      .eq('status', 'active')

    // Check if current user follows this profile
    let isFollowing = false
    if (user && user.id !== profile.id) {
      const { data: followRow } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', user.id)
        .eq('followed_id', profile.id)
        .maybeSingle()

      isFollowing = !!followRow
    }

    return NextResponse.json({
      profile: {
        ...profile,
        follower_count: followerCount ?? 0,
        following_count: followingCount ?? 0,
        post_count: postCount ?? 0,
        is_following: isFollowing,
        is_own_profile: user?.id === profile.id,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Profile API error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
