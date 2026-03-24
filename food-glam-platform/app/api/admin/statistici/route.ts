import { requireAdmin } from '@/lib/require-admin'
import { NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase-server'


export async function GET(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const supabase = createServiceSupabaseClient()

  // 1. Total recipes (active)
  const { count: totalRecipes } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'recipe')
    .eq('status', 'active')

  // 2. Total cocktails (active)
  const { count: totalCocktails } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'cocktail')
    .eq('status', 'active')

  // 3. Type breakdown (all active posts by type)
  const { data: typeData } = await supabase
    .from('posts')
    .select('type')
    .eq('status', 'active')

  const typeCounts: Record<string, number> = {}
  for (const p of typeData || []) {
    const t = (p.type as string) || 'other'
    typeCounts[t] = (typeCounts[t] || 0) + 1
  }
  const typeBreakdown = Object.entries(typeCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)

  // 4. Recipes by country/region — using food_tags[0] or country field
  const { data: regionData } = await supabase
    .from('posts')
    .select('food_tags, country')
    .eq('type', 'recipe')
    .eq('status', 'active')

  const countryCounts: Record<string, number> = {}
  for (const r of regionData || []) {
    // Try 'country' field first, then first food_tag
    const country = (r as Record<string, unknown>).country as string | null
      || ((r.food_tags as string[] | null)?.[0])
      || 'necunoscut'
    countryCounts[country] = (countryCounts[country] || 0) + 1
  }
  const recipesByCountry = Object.entries(countryCounts)
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  // 5. Weekly user growth — last 4 weeks
  const weeklyGrowth: { week: string; count: number }[] = []
  for (let i = 3; i >= 0; i--) {
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - (i + 1) * 7)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date()
    weekEnd.setDate(weekEnd.getDate() - i * 7)
    weekEnd.setHours(23, 59, 59, 999)

    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekStart.toISOString())
      .lte('created_at', weekEnd.toISOString())

    const label = `S-${4 - i}`
    weeklyGrowth.push({ week: label, count: count || 0 })
  }

  // 6. Most viewed/popular by quality_score
  const { data: topByScore } = await supabase
    .from('posts')
    .select('title, slug, quality_score')
    .eq('type', 'recipe')
    .eq('status', 'active')
    .not('quality_score', 'is', null)
    .order('quality_score', { ascending: false })
    .limit(10)

  const mostViewed = (topByScore || []).map(p => ({
    title: p.title || 'Fără titlu',
    slug: p.slug || '',
    quality_score: p.quality_score as number,
  }))

  return NextResponse.json({
    totalRecipes: totalRecipes || 0,
    totalCocktails: totalCocktails || 0,
    typeBreakdown,
    recipesByCountry,
    weeklyGrowth,
    mostViewed,
  })
}
