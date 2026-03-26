import { requireAdmin, ADMIN_EMAILS } from '@/lib/require-admin'
import { NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase-server'

type UserStatus = 'active' | 'warned' | 'blocked' | 'deleted'

function mapSanctionToStatus(sanctions: { type: string; expires_at: string | null }[]): UserStatus {
  if (!sanctions || sanctions.length === 0) return 'active'

  const now = new Date().toISOString()
  const activeBan = sanctions.find(s =>
    s.type === 'ban' && (!s.expires_at || s.expires_at > now)
  )
  if (activeBan) return 'blocked'

  const activeWarn = sanctions.find(s =>
    s.type === 'warn' && (!s.expires_at || s.expires_at > now)
  )
  if (activeWarn) return 'warned'

  return 'active'
}

export async function GET(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const supabase = createServiceSupabaseClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const q = searchParams.get('q')?.toLowerCase()
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')

  // Fetch auth users list (includes email, last_sign_in_at, provider info)
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })

  if (authError) {
    console.error('Error fetching auth users:', authError)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }

  const authUsers = authData?.users ?? []

  // Build auth user map keyed by id
  const authMap = new Map(authUsers.map(u => [u.id, u]))

  // Build set of real auth user IDs (users who actually signed in)
  const realUserIds = new Set(authUsers.map(u => u.id))

  // Build query for profiles — exclude generic chef profiles (chef_country) that have no real auth user
  let query = supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .not('handle', 'like', 'chef_%')

  // Search by display_name, handle, or email
  if (q) {
    // When searching, include chef profiles too (in case admin specifically searches for one)
    query = supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .or(`display_name.ilike.%${q}%,handle.ilike.%${q}%,email.ilike.%${q}%`)
  }

  // Pagination
  query = query.range(offset, offset + limit - 1)

  const { data: profiles, count, error } = await query

  if (error) {
    console.error('Error fetching profiles:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }

  // Get recipe counts and sanctions for each user
  const users = await Promise.all((profiles || []).map(async (profile: Record<string, unknown>) => {
    const profileId = profile.id as string

    // Get recipe count
    const { count: recipeCount } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('created_by', profileId)
      .eq('type', 'recipe')
      .eq('status', 'active')

    // Get user sanctions to determine status
    const { data: sanctions } = await supabase
      .from('user_sanctions')
      .select('type, expires_at')
      .eq('user_id', profileId)

    const userStatus = mapSanctionToStatus(sanctions || [])

    // Filter by status if requested
    if (status && status !== 'all' && userStatus !== status) {
      return null
    }

    // Merge auth data
    const authUser = authMap.get(profileId)
    const provider = authUser?.app_metadata?.provider ?? 'email'
    const lastSignInAt = authUser?.last_sign_in_at ?? null
    const email = (profile.email as string) || authUser?.email || ''
    const isModerator = (profile.is_moderator as boolean) ?? false
    const isCertifiedCreator = (profile.is_certified_creator as boolean) ?? false
    const isAdmin = ADMIN_EMAILS.includes(email)

    return {
      id: profileId,
      display_name: (profile.display_name as string) || 'Unknown',
      handle: (profile.handle as string) || '',
      avatar_url: (profile.avatar_url as string | null) ?? null,
      email,
      status: userStatus,
      notes: '',
      joined_at: profile.created_at as string,
      recipe_count: recipeCount || 0,
      is_moderator: isModerator,
      is_certified_creator: isCertifiedCreator,
      is_admin: isAdmin,
      provider,
      last_sign_in_at: lastSignInAt,
    }
  }))

  // Filter out nulls from status filtering
  const filteredUsers = users.filter(u => u !== null)

  return NextResponse.json({ users: filteredUsers, total: count ?? filteredUsers.length })
}

export async function PATCH(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const supabase = createServiceSupabaseClient()
  const body = await req.json() as { id: string; is_moderator?: boolean; is_certified_creator?: boolean }

  if (typeof body.is_moderator === 'boolean') {
    const { error } = await supabase
      .from('profiles')
      .update({ is_moderator: body.is_moderator })
      .eq('id', body.id)

    if (error) {
      console.error('Error updating moderator status:', error)
      return NextResponse.json({ error: 'Failed to update moderator status' }, { status: 500 })
    }
  }

  if (typeof body.is_certified_creator === 'boolean') {
    const { error } = await supabase
      .from('profiles')
      .update({ is_certified_creator: body.is_certified_creator })
      .eq('id', body.id)

    if (error) {
      console.error('Error updating certified creator status:', error)
      return NextResponse.json({ error: 'Failed to update certified creator status' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}

export async function PUT(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const supabase = createServiceSupabaseClient()
  const body = await req.json() as { id: string; status?: UserStatus; notes?: string; tier?: 'pro' | 'amateur' | 'user' }

  // Handle status changes via user_sanctions
  if (body.status) {
    const now = new Date().toISOString()

    if (body.status === 'active') {
      // Remove active sanctions
      await supabase
        .from('user_sanctions')
        .delete()
        .eq('user_id', body.id)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
    } else if (body.status === 'warned') {
      // Create a warn sanction
      await supabase
        .from('user_sanctions')
        .insert({
          user_id: body.id,
          type: 'warn',
          reason: 'Admin warning',
          created_by: admin.id,
        })
    } else if (body.status === 'blocked') {
      // Create a ban sanction
      await supabase
        .from('user_sanctions')
        .insert({
          user_id: body.id,
          type: 'ban',
          reason: 'Admin ban',
          created_by: admin.id,
        })
    }
  }

  return NextResponse.json({ ok: true })
}
