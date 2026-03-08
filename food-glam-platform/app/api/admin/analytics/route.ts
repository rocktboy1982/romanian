import { NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'

async function requireAdmin(req: Request) {
  const supabase = createServiceSupabaseClient()
  const user = await getRequestUser(req, supabase)
  if (!user) return null
  const { data: roles } = await supabase.from('app_roles').select('role').eq('user_id', user.id).in('role', ['admin', 'moderator']).limit(1)
  if (roles && roles.length > 0) return user
  const { data: profile } = await supabase.from('profiles').select('is_moderator').eq('id', user.id).single()
  if (profile?.is_moderator) return user
  return null
}

export async function GET(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const supabase = createServiceSupabaseClient()

  // Top 10 recipes by vote count
  // We need to count votes per post and join with posts for titles
  const { data: topPosts } = await supabase
    .from('posts')
    .select('id, title, slug')
    .eq('type', 'recipe')
    .eq('status', 'active')
    .limit(100)

  // Get vote counts for these posts
  let topRecipes: { title: string; votes: number; slug: string }[] = []
  if (topPosts && topPosts.length > 0) {
    const ids = topPosts.map(p => p.id)
    const { data: votes } = await supabase
      .from('votes')
      .select('post_id')
      .in('post_id', ids)

    // Count votes per post
    const voteCounts: Record<string, number> = {}
    for (const v of votes || []) {
      voteCounts[v.post_id] = (voteCounts[v.post_id] || 0) + 1
    }

    topRecipes = topPosts
      .map(p => ({ title: p.title || 'Fără titlu', votes: voteCounts[p.id] || 0, slug: p.slug || '' }))
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 10)
  }

  // Recipes per region (using food_tags first element)
  const { data: regionData } = await supabase
    .from('posts')
    .select('food_tags')
    .eq('type', 'recipe')
    .eq('status', 'active')

  const regionCounts: Record<string, number> = {}
  for (const r of regionData || []) {
    const region = (r.food_tags as string[] | null)?.[0] || 'necunoscut'
    regionCounts[region] = (regionCounts[region] || 0) + 1
  }
  const recipesPerRegion = Object.entries(regionCounts)
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)

  // Daily activity - last 7 days
  const days: { date: string; recipes: number; votes: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
    const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString()

    const { count: recipeCount } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'recipe')
      .gte('created_at', dayStart)
      .lt('created_at', dayEnd)

    const { count: voteCount } = await supabase
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', dayStart)
      .lt('created_at', dayEnd)

    days.push({
      date: d.toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' }),
      recipes: recipeCount || 0,
      votes: voteCount || 0,
    })
  }

  return NextResponse.json({ topRecipes, recipesPerRegion, recentActivity: days })
}
