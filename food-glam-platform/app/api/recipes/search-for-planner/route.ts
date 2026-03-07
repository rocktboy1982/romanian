import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * GET /api/recipes/search-for-planner?q=chicken&limit=10
 *
 * Lightweight recipe search for the meal planner.
 * Returns minimal data: id, title, slug, servings, nutrition, hero_image_url
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() || ''
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10'), 30)

  try {
    const supabase = await createServerSupabaseClient()

    let query = supabase
      .from('posts')
      .select('id, title, slug, hero_image_url, recipe_json, diet_tags, food_tags')
      .eq('type', 'recipe')
      .eq('status', 'active')

    if (q) {
      const safeQ = q.replace(/[%_]/g, '')
      query = query.or(`title.ilike.%${safeQ}%,summary.ilike.%${safeQ}%`)
    }

    query = query.order('quality_score', { ascending: false, nullsFirst: false }).limit(limit)

    const { data: posts, error } = await query

    if (error) {
      console.error('Planner search DB error:', error.message)
      return NextResponse.json({ error: 'Search failed' }, { status: 500 })
    }

    const recipes = (posts ?? []).map(post => {
      const rj = (post.recipe_json || {}) as Record<string, unknown>
      const nutrition = (rj.nutrition_per_serving || { calories: 0, protein: 0, carbs: 0, fat: 0 }) as {
        calories: number; protein: number; carbs: number; fat: number
      }

      return {
        id: post.id,
        title: post.title,
        slug: post.slug,
        hero_image_url: post.hero_image_url || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
        servings: (rj.servings as number) || 4,
        cook_time_minutes: (rj.cook_time_minutes as number) || null,
        prep_time_minutes: (rj.prep_time_minutes as number) || null,
        ingredients: (rj.ingredients as string[]) || [],
        nutrition_per_serving: nutrition,
        dietTags: post.diet_tags || [],
        foodTags: post.food_tags || [],
      }
    })

    return NextResponse.json({ recipes })
  } catch (err) {
    console.error('Planner search error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
