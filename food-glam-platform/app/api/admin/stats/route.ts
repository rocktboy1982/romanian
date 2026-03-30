import { requireAdmin } from '@/lib/require-admin'
import { NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase-server'


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
  let bannedChefs = 0
  try {
    const { count } = await supabase
      .from('user_sanctions')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'ban')
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    bannedChefs = count ?? 0
  } catch { /* table may not exist */ }

  // 5. Total votes
  const { count: totalVotes } = await supabase
    .from('votes')
    .select('*', { count: 'exact', head: true })

  // 6. Total comments/replies
  const { count: totalComments } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .neq('type', 'recipe')

  // 7. Reported content (table may not exist)
  let reportedContent = 0
  try {
    const { count } = await supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'open')
    reportedContent = count ?? 0
  } catch { /* table may not exist */ }

  // 8. Approved today (table may not exist)
  let approvedToday = 0
  try {
    const { count } = await supabase.from('moderation_actions').select('*', { count: 'exact', head: true }).eq('action', 'approve').gte('created_at', todayISO)
    approvedToday = count ?? 0
  } catch { /* table may not exist */ }

  // 9. Rejected today (table may not exist)
  let rejectedToday = 0
  try {
    const { count } = await supabase.from('moderation_actions').select('*', { count: 'exact', head: true }).eq('action', 'reject').gte('created_at', todayISO)
    rejectedToday = count ?? 0
  } catch { /* table may not exist */ }

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

  // 12. Total users (exclude Chef bot profiles with @seed.local or example.com emails)
  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .not('email', 'like', '%@seed.local')
    .not('email', 'like', '%@example.com')
    .neq('email', '')

  // 13. New users this week (real users only)
  const { count: newUsersThisWeek } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .not('email', 'like', '%@seed.local')
    .not('email', 'like', '%@example.com')
    .neq('email', '')
    .gte('created_at', thisWeekISO)

  // 14. Active users last 7 days (signed in — from auth via admin API)
  // We approximate using profiles updated in last 7 days as a proxy
  // The real last_sign_in_at is only in auth.users which requires admin API
  let activeUsersLast7Days = 0
  try {
    const { data: authData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (authData?.users) {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      activeUsersLast7Days = authData.users.filter(u =>
        u.last_sign_in_at && new Date(u.last_sign_in_at) >= sevenDaysAgo
      ).length
    }
  } catch { /* ignore if auth admin API not available */ }

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
    totalUsers: totalUsers || 0,
    newUsersThisWeek: newUsersThisWeek || 0,
    activeUsersLast7Days,
  }

  return NextResponse.json(stats)
}
