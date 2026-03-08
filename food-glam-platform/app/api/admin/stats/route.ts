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

export async function GET(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  
  const supabase = createServiceSupabaseClient()
  
  // Get today's date for filtering
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayISO = today.toISOString()
  
  // Get last week's date
  const lastWeek = new Date(today)
  lastWeek.setDate(lastWeek.getDate() - 7)
  const lastWeekISO = lastWeek.toISOString()
  
  // Get this week's date (7 days ago from today)
  const thisWeekStart = new Date(today)
  thisWeekStart.setDate(thisWeekStart.getDate() - 7)
  const thisWeekISO = thisWeekStart.toISOString()
  
  // 1. Total active recipes
  const { count: totalRecipes } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'recipe')
    .eq('status', 'active')
  
  // 2. Pending review
  const { count: pendingReview } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending_review')
  
  // 3. Active chefs (distinct users with active posts)
  const { data: activeChefs } = await supabase
    .from('posts')
    .select('created_by', { count: 'exact' })
    .eq('status', 'active')
  const uniqueChefs = new Set(activeChefs?.map(p => p.created_by) || [])
  
  // 4. Banned chefs (users with active ban sanctions)
  const { count: bannedChefs } = await supabase
    .from('user_sanctions')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'ban')
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
  
  // 5. Total votes
  const { count: totalVotes } = await supabase
    .from('votes')
    .select('*', { count: 'exact', head: true })
  
  // 6. Total comments/replies (using posts with type='comment' or similar)
  // For now, count all non-recipe posts as comments
  const { count: totalComments } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .neq('type', 'recipe')
  
  // 7. Reported content (open reports)
  const { count: reportedContent } = await supabase
    .from('reports')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'open')
  
  // 8. Approved today
  const { count: approvedToday } = await supabase
    .from('moderation_actions')
    .select('*', { count: 'exact', head: true })
    .eq('action', 'approve')
    .gte('created_at', todayISO)
  
  // 9. Rejected today
  const { count: rejectedToday } = await supabase
    .from('moderation_actions')
    .select('*', { count: 'exact', head: true })
    .eq('action', 'reject')
    .gte('created_at', todayISO)
  
  // 10. New users today
  const { count: newUsersToday } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', todayISO)
  
  // 11. Weekly growth (posts this week vs last week)
  const { count: thisWeekPosts } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'recipe')
    .gte('created_at', thisWeekISO)
  
  const { count: lastWeekPosts } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'recipe')
    .gte('created_at', lastWeekISO)
    .lt('created_at', thisWeekISO)
  
  const weeklyGrowth = lastWeekPosts && lastWeekPosts > 0 
    ? ((((thisWeekPosts || 0) - (lastWeekPosts || 0)) / (lastWeekPosts || 1)) * 100).toFixed(1)
    : 0
  
  const stats = {
    totalRecipes: totalRecipes || 0,
    pendingReview: pendingReview || 0,
    activeChefs: uniqueChefs.size,
    bannedChefs: bannedChefs || 0,
    totalVotes: totalVotes || 0,
    totalComments: totalComments || 0,
    reportedContent: reportedContent || 0,
    approvedToday: approvedToday || 0,
    rejectedToday: rejectedToday || 0,
    newUsersToday: newUsersToday || 0,
    weeklyGrowth: parseFloat(weeklyGrowth as string),
  }
  
  return NextResponse.json(stats)
}
