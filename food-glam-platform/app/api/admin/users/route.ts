import { NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'

type UserStatus = 'active' | 'warned' | 'blocked' | 'deleted'

async function requireAdmin(req: Request) {
  const supabase = createServiceSupabaseClient()
  const user = await getRequestUser(req, supabase)
  if (!user) return null
  
  // Check app_roles for admin/moderator
  const { data: roles } = await supabase
    .from('app_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['admin', 'moderator'])
    .limit(1)
  
  if (roles && roles.length > 0) return user
  
  // Fallback: check is_moderator flag
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_moderator')
    .eq('id', user.id)
    .single()
  
  if (profile?.is_moderator) return user
  return null
}

function mapSanctionToStatus(sanctions: any[]): UserStatus {
  if (!sanctions || sanctions.length === 0) return 'active'
  
  // Check for active bans
  const now = new Date().toISOString()
  const activeBan = sanctions.find(s => 
    s.type === 'ban' && (!s.expires_at || s.expires_at > now)
  )
  if (activeBan) return 'blocked'
  
  // Check for active warns
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

  // Build query for profiles
  let query = supabase
    .from('profiles')
    .select('*', { count: 'exact' })

  // Search by display_name, handle, or email
  if (q) {
    query = query.or(`display_name.ilike.%${q}%,handle.ilike.%${q}%,email.ilike.%${q}%`)
  }

  // Pagination
  query = query.range(offset, offset + limit - 1)

  const { data: profiles, count, error } = await query

  if (error) {
    console.error('Error fetching profiles:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }

  // Get recipe counts and sanctions for each user
  const users = await Promise.all((profiles || []).map(async (profile: any) => {
    // Get recipe count
    const { count: recipeCount } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('created_by', profile.id)
      .eq('type', 'recipe')
      .eq('status', 'active')

    // Get user sanctions to determine status
    const { data: sanctions } = await supabase
      .from('user_sanctions')
      .select('*')
      .eq('user_id', profile.id)

    const userStatus = mapSanctionToStatus(sanctions || [])

    // Filter by status if requested
    if (status && status !== 'all' && userStatus !== status) {
      return null
    }

    return {
      id: profile.id,
      display_name: profile.display_name || 'Unknown',
      handle: profile.handle || '',
      avatar_url: profile.avatar_url || null,
      email: profile.email || '',
      status: userStatus,
      notes: '', // Notes field doesn't exist in profiles table
      joined_at: profile.created_at,
      recipe_count: recipeCount || 0,
    }
  }))

  // Filter out nulls from status filtering
  const filteredUsers = users.filter(u => u !== null)

  return NextResponse.json({ users: filteredUsers, total: filteredUsers.length })
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
