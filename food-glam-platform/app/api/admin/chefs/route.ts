import { NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'

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

type ChefStatus = 'active' | 'suspended' | 'banned'
type ChefTier   = 'pro' | 'amateur' | 'user'

function mapSanctionToStatus(sanctions: any[]): ChefStatus {
  if (!sanctions || sanctions.length === 0) return 'active'
  
  // Check for active bans
  const now = new Date().toISOString()
  const activeBan = sanctions.find(s => 
    s.type === 'ban' && (!s.expires_at || s.expires_at > now)
  )
  if (activeBan) return 'banned'
  
  // Check for active suspensions
  const activeSuspend = sanctions.find(s => 
    s.type === 'suspend' && (!s.expires_at || s.expires_at > now)
  )
  if (activeSuspend) return 'suspended'
  
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

  // Get profiles that have at least 1 active recipe (they're "chefs")
  const { data: chefProfiles, error: profileError } = await supabase
    .from('profiles')
    .select('*')

  if (profileError) {
    console.error('Error fetching profiles:', profileError)
    return NextResponse.json({ error: 'Failed to fetch chefs' }, { status: 500 })
  }

  // Filter and enrich chefs with recipe counts, votes, and followers
  const chefs = await Promise.all((chefProfiles || []).map(async (profile: any) => {
    // Get recipe count
    const { count: recipeCount } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('created_by', profile.id)
      .eq('type', 'recipe')
      .eq('status', 'active')

    // Skip if no recipes (not a chef)
    if (!recipeCount || recipeCount === 0) return null

    // Get total votes on their recipes
    const { data: recipes } = await supabase
      .from('posts')
      .select('id')
      .eq('created_by', profile.id)
      .eq('type', 'recipe')
      .eq('status', 'active')

    let totalVotes = 0
    if (recipes && recipes.length > 0) {
      const recipeIds = recipes.map(r => r.id)
      const { count: voteCount } = await supabase
        .from('votes')
        .select('*', { count: 'exact', head: true })
        .in('post_id', recipeIds)
      totalVotes = voteCount || 0
    }

    // Get follower count
    const { count: followerCount } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', profile.id)

    // Get user sanctions to determine status
    const { data: sanctions } = await supabase
      .from('user_sanctions')
      .select('*')
      .eq('user_id', profile.id)

    const chefStatus = mapSanctionToStatus(sanctions || [])

    // Filter by status if requested
    if (status && status !== 'all' && chefStatus !== status) {
      return null
    }

    // Search filter
    if (q && !profile.display_name?.toLowerCase().includes(q) && !profile.handle?.toLowerCase().includes(q)) {
      return null
    }

    return {
      id: profile.id,
      display_name: profile.display_name || 'Unknown',
      handle: profile.handle || '',
      avatar_url: profile.avatar_url || null,
      status: chefStatus,
      tier: 'user' as ChefTier, // Default tier, could be extended with a tier column
      notes: '', // Notes field doesn't exist in profiles table
      recipe_count: recipeCount,
      total_votes: totalVotes,
      joined_at: profile.created_at,
      followers: followerCount || 0,
    }
  }))

  // Filter out nulls and apply pagination
  const filteredChefs = chefs.filter(c => c !== null)
  const paginatedChefs = filteredChefs.slice(offset, offset + limit)

  return NextResponse.json({ chefs: paginatedChefs, total: filteredChefs.length })
}

export async function PUT(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const supabase = createServiceSupabaseClient()
  const body = await req.json() as { id: string; status?: ChefStatus; notes?: string; tier?: ChefTier }

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
    } else if (body.status === 'suspended') {
      // Create a suspend sanction
      await supabase
        .from('user_sanctions')
        .insert({
          user_id: body.id,
          type: 'suspend',
          reason: 'Admin suspension',
          created_by: admin.id,
        })
    } else if (body.status === 'banned') {
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

export async function DELETE(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const supabase = createServiceSupabaseClient()
  const body = await req.json() as { id: string }

  // Create a ban sanction
  const { error } = await supabase
    .from('user_sanctions')
    .insert({
      user_id: body.id,
      type: 'ban',
      reason: 'Admin ban',
      created_by: admin.id,
    })

  if (error) {
    console.error('Error banning chef:', error)
    return NextResponse.json({ error: 'Failed to ban chef' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
