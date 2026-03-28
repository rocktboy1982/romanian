import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'

// ── Types for JSONB meals column ──
interface MealEntry {
  id: string
  date: string
  meal_slot: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  post_id: string
  servings: number
  recipe_title?: string
  recipe_image?: string
}

interface MealsMeta {
  start_date?: string | null
  end_date?: string | null
}

interface MealsData {
  _meta: MealsMeta
  entries: MealEntry[]
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36)
}

/**
 * GET /api/meal-plan-entries?meal_plan_id=X&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns entries for a meal plan, optionally filtered by date range.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mealPlanId = searchParams.get('meal_plan_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!mealPlanId) {
    return NextResponse.json({ error: 'meal_plan_id is required' }, { status: 400 })
  }

  const authClient = createServerSupabaseClient()
  const user = await getRequestUser(req, authClient)
  if (!user) return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 })
  const supabase = createServiceSupabaseClient()

  const { data: plan, error } = await supabase
    .from('meal_plans')
    .select('*')
    .eq('id', mealPlanId)
    .eq('user_id', user.id)
    .single()

  if (error || !plan) {
    return NextResponse.json({ error: 'Meal plan not found' }, { status: 404 })
  }

  const meals = (plan.meals as MealsData) || { _meta: {}, entries: [] }
  let entries = meals.entries || []

  // Filter by date range if provided
  if (from) entries = entries.filter(e => e.date >= from)
  if (to) entries = entries.filter(e => e.date <= to)

  return NextResponse.json({
    entries,
    _meta: meals._meta,
  })
}

/**
 * POST /api/meal-plan-entries
 * Body: { meal_plan_id, date, meal_slot, post_id, servings, recipe_title?, recipe_image? }
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { meal_plan_id, date, meal_slot, post_id, servings, recipe_title, recipe_image } = body as {
    meal_plan_id: string
    date: string
    meal_slot: string
    post_id: string
    servings?: number
    recipe_title?: string
    recipe_image?: string
  }

  if (!meal_plan_id || !date || !meal_slot || !post_id) {
    return NextResponse.json({ error: 'meal_plan_id, date, meal_slot, post_id are required' }, { status: 400 })
  }

  const validSlots = ['breakfast', 'lunch', 'dinner', 'snack']
  if (!validSlots.includes(meal_slot)) {
    return NextResponse.json({ error: `meal_slot must be one of: ${validSlots.join(', ')}` }, { status: 400 })
  }

  const authClient = createServerSupabaseClient()
  const user = await getRequestUser(req, authClient)
  if (!user) return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 })
  const supabase = createServiceSupabaseClient()

  const { data: plan, error: fetchErr } = await supabase
    .from('meal_plans')
    .select('*')
    .eq('id', meal_plan_id)
    .eq('user_id', user.id)
    .single()

  if (fetchErr || !plan) {
    return NextResponse.json({ error: 'Meal plan not found' }, { status: 404 })
  }

  const meals = (plan.meals as MealsData) || { _meta: {}, entries: [] }
  const newEntry: MealEntry = {
    id: generateId(),
    date,
    meal_slot: meal_slot as MealEntry['meal_slot'],
    post_id,
    servings: servings ?? 1,
    recipe_title,
    recipe_image,
  }

  const updatedMeals: MealsData = {
    ...meals,
    entries: [...(meals.entries || []), newEntry],
  }

  const { data, error } = await supabase
    .from('meal_plans')
    .update({ meals: updatedMeals })
    .eq('id', meal_plan_id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entry: newEntry, plan: data })
}

/**
 * PATCH /api/meal-plan-entries
 * Body: { meal_plan_id, entry_id, servings }
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { meal_plan_id, entry_id, servings } = body as {
    meal_plan_id: string
    entry_id: string
    servings: number
  }

  if (!meal_plan_id || !entry_id || servings === undefined) {
    return NextResponse.json({ error: 'meal_plan_id, entry_id, servings are required' }, { status: 400 })
  }

  const authClient = createServerSupabaseClient()
  const user = await getRequestUser(req, authClient)
  if (!user) return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 })
  const supabase = createServiceSupabaseClient()

  const { data: plan, error: fetchErr } = await supabase
    .from('meal_plans')
    .select('*')
    .eq('id', meal_plan_id)
    .eq('user_id', user.id)
    .single()

  if (fetchErr || !plan) {
    return NextResponse.json({ error: 'Meal plan not found' }, { status: 404 })
  }

  const meals = (plan.meals as MealsData) || { _meta: {}, entries: [] }
  const entryIdx = meals.entries.findIndex(e => e.id === entry_id)
  if (entryIdx === -1) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
  }

  meals.entries[entryIdx] = { ...meals.entries[entryIdx], servings }

  const { data, error } = await supabase
    .from('meal_plans')
    .update({ meals })
    .eq('id', meal_plan_id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entry: meals.entries[entryIdx], plan: data })
}

/**
 * DELETE /api/meal-plan-entries
 * Body: { meal_plan_id, entry_id }
 */
export async function DELETE(req: NextRequest) {
  const body = await req.json()
  const { meal_plan_id, entry_id } = body as {
    meal_plan_id: string
    entry_id: string
  }

  if (!meal_plan_id || !entry_id) {
    return NextResponse.json({ error: 'meal_plan_id and entry_id are required' }, { status: 400 })
  }

  const authClient = createServerSupabaseClient()
  const user = await getRequestUser(req, authClient)
  if (!user) return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 })
  const supabase = createServiceSupabaseClient()

  const { data: plan, error: fetchErr } = await supabase
    .from('meal_plans')
    .select('*')
    .eq('id', meal_plan_id)
    .eq('user_id', user.id)
    .single()

  if (fetchErr || !plan) {
    return NextResponse.json({ error: 'Meal plan not found' }, { status: 404 })
  }

  const meals = (plan.meals as MealsData) || { _meta: {}, entries: [] }
  const filtered = meals.entries.filter(e => e.id !== entry_id)

  if (filtered.length === meals.entries.length) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
  }

  const updatedMeals: MealsData = { ...meals, entries: filtered }

  const { error } = await supabase
    .from('meal_plans')
    .update({ meals: updatedMeals })
    .eq('id', meal_plan_id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
