import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'
import {
  extractIngredientsFromJson,
  normalizeIngredientKey,
  type RecipeIngredient,
} from '@/lib/ingredient-normalizer'

// ── Types ──
interface MealEntry {
  id: string
  date: string
  meal_slot: string
  post_id: string
  servings: number
  recipe_title?: string
  recipe_image?: string
}

interface MealsData {
  _meta: { start_date?: string | null; end_date?: string | null }
  entries: MealEntry[]
}

interface ShoppingListItem {
  name: string
  amount: number
  unit: string
  recipe_titles: string[]
}

/**
 * GET /api/meal-plans/[id]/shopping-list?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Generates aggregated shopping list from meal plan entries.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const supabase = createServiceSupabaseClient()
  const user = await getRequestUser(req, supabase)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // Fetch the meal plan
  const { data: plan, error: planErr } = await supabase
    .from('meal_plans')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (planErr || !plan) {
    return NextResponse.json({ error: 'Meal plan not found' }, { status: 404 })
  }

  const meals = (plan.meals as MealsData) || { _meta: {}, entries: [] }
  let entries = meals.entries || []

  // Filter by date range
  if (from) entries = entries.filter(e => e.date >= from)
  if (to) entries = entries.filter(e => e.date <= to)

  if (entries.length === 0) {
    return NextResponse.json({ items: [], entry_count: 0 })
  }

  // Fetch recipe data for all unique post_ids
  const postIds = Array.from(new Set(entries.map(e => e.post_id)))
  const { data: posts } = await supabase
    .from('posts')
    .select('id, title, recipe_json')
    .in('id', postIds)

  const postsMap = new Map<string, { title: string; recipe_json: Record<string, unknown> | null }>(
    (posts || []).map(p => [p.id, { title: p.title, recipe_json: p.recipe_json as Record<string, unknown> | null }])
  )

  // Aggregate ingredients
  const ingredientMap = new Map<string, ShoppingListItem>()

  for (const entry of entries) {
    const post = postsMap.get(entry.post_id)
    if (!post?.recipe_json) continue

    const recipeJson = post.recipe_json
    const baseServings = (recipeJson.servings as number) || (recipeJson.yield as number) || 1
    const multiplier = entry.servings / baseServings

     // Extract ingredients from recipe_json
     const ingredients = extractIngredientsFromJson(recipeJson)

    for (const ing of ingredients) {
      const key = normalizeIngredientKey(ing.name, ing.unit || '')
      const existing = ingredientMap.get(key)

      if (existing) {
        existing.amount += (ing.amount || 0) * multiplier
        if (!existing.recipe_titles.includes(post.title)) {
          existing.recipe_titles.push(post.title)
        }
      } else {
        ingredientMap.set(key, {
          name: ing.name,
          amount: (ing.amount || 0) * multiplier,
          unit: ing.unit || '',
          recipe_titles: [post.title],
        })
      }
    }
  }

  const items = Array.from(ingredientMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  )

  return NextResponse.json({ items, entry_count: entries.length })
}
