import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'

export async function GET(req: NextRequest) {
  const authClient = createServerSupabaseClient()
  const user = await getRequestUser(req, authClient)
  if (!user) return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 })

  const supabase = createServiceSupabaseClient()
  const { data, error } = await supabase
    .from('meal_plans')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { title, start_date, end_date } = body as {
    title: string
    start_date?: string
    end_date?: string
  }

  if (!title) {
    return NextResponse.json({ error: 'Titlul este obligatoriu' }, { status: 400 })
  }

  const authClient = createServerSupabaseClient()
  const user = await getRequestUser(req, authClient)
  if (!user) return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 })

  const supabase = createServiceSupabaseClient()

  // Store start_date/end_date and entries inside meals JSONB
  const mealsInit = {
    _meta: { start_date: start_date || null, end_date: end_date || null },
    entries: [] as MealEntry[]
  }

  const { data, error } = await supabase
    .from('meal_plans')
    .insert({ user_id: user.id, title, meals: mealsInit })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, title, start_date, end_date } = body as {
    id: string
    title?: string
    start_date?: string
    end_date?: string
  }

  if (!id) {
    return NextResponse.json({ error: 'ID obligatoriu' }, { status: 400 })
  }

  const authClient = createServerSupabaseClient()
  const user = await getRequestUser(req, authClient)
  if (!user) return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 })

  const supabase = createServiceSupabaseClient()

  // Fetch current plan to merge meta
  const { data: existing, error: fetchErr } = await supabase
    .from('meal_plans')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  }

  const meals = (existing.meals as MealsData) || { _meta: {}, entries: [] }
  const meta = meals._meta || {}

  const updatePayload: Record<string, unknown> = {}
  if (title !== undefined) updatePayload.title = title
  if (start_date !== undefined || end_date !== undefined) {
    updatePayload.meals = {
      ...meals,
      _meta: {
        ...meta,
        ...(start_date !== undefined ? { start_date } : {}),
        ...(end_date !== undefined ? { end_date } : {}),
      }
    }
  }

  const { data, error } = await supabase
    .from('meal_plans')
    .update(updatePayload)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const body = await req.json()
  const { id } = body as { id: string }

  if (!id) {
    return NextResponse.json({ error: 'Plan id is required' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { error } = await supabase
    .from('meal_plans')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

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
