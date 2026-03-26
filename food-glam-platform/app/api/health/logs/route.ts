import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'

function toDateString(d: Date): string {
  return d.toISOString().split('T')[0]
}

/** GET /api/health/logs?days=7  or  ?from=2026-03-20&to=2026-03-26 */
export async function GET(req: NextRequest) {
  try {
    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 })

    const params = req.nextUrl.searchParams
    let from: string
    let to: string

    if (params.get('from') && params.get('to')) {
      from = params.get('from')!
      to = params.get('to')!
    } else {
      const days = parseInt(params.get('days') || '7', 10)
      const toDate = new Date()
      const fromDate = new Date()
      fromDate.setDate(fromDate.getDate() - (days - 1))
      from = toDateString(fromDate)
      to = toDateString(toDate)
    }

    const [hydration, meals, fasting, weight] = await Promise.all([
      supabase
        .from('user_hydration_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('log_date', from)
        .lte('log_date', to)
        .order('logged_at', { ascending: false }),

      supabase
        .from('user_meal_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('meal_date', from)
        .lte('meal_date', to)
        .order('logged_at', { ascending: false }),

      supabase
        .from('user_fasting_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('log_date', from)
        .lte('log_date', to)
        .order('log_date', { ascending: false }),

      supabase
        .from('user_weight_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('log_date', from)
        .lte('log_date', to)
        .order('log_date', { ascending: false }),
    ])

    if (hydration.error) return NextResponse.json({ error: hydration.error.message }, { status: 500 })
    if (meals.error) return NextResponse.json({ error: meals.error.message }, { status: 500 })
    if (fasting.error) return NextResponse.json({ error: fasting.error.message }, { status: 500 })
    if (weight.error) return NextResponse.json({ error: weight.error.message }, { status: 500 })

    return NextResponse.json({
      from,
      to,
      hydration: hydration.data ?? [],
      meals: meals.data ?? [],
      fasting: fasting.data ?? [],
      weight: weight.data ?? [],
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** POST /api/health/logs — create a log entry */
export async function POST(req: NextRequest) {
  try {
    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 })

    const body = await req.json()
    const { type, ...data } = body as {
      type: 'hydration' | 'meal' | 'fasting' | 'weight'
      [key: string]: unknown
    }

    if (!type) return NextResponse.json({ error: 'type este obligatoriu' }, { status: 400 })

    const today = toDateString(new Date())
    let result

    switch (type) {
      case 'hydration': {
        const { amount_ml, drink_type = 'apa' } = data as { amount_ml: number; drink_type?: string }
        if (!amount_ml || Number(amount_ml) <= 0) {
          return NextResponse.json({ error: 'amount_ml este obligatoriu' }, { status: 400 })
        }
        result = await supabase
          .from('user_hydration_logs')
          .insert({
            user_id: user.id,
            log_date: today,
            amount_ml: Number(amount_ml),
            drink_type,
            logged_at: new Date().toISOString(),
          })
          .select()
          .single()
        break
      }

      case 'meal': {
        const { meal_type, recipe_title, recipe_id, calories_estimated, notes } = data as {
          meal_type: string
          recipe_title: string
          recipe_id?: string
          calories_estimated?: number
          notes?: string
        }
        if (!meal_type || !recipe_title) {
          return NextResponse.json({ error: 'meal_type și recipe_title sunt obligatorii' }, { status: 400 })
        }
        result = await supabase
          .from('user_meal_logs')
          .insert({
            user_id: user.id,
            meal_date: today,
            meal_type,
            recipe_title,
            recipe_id: recipe_id || null,
            calories_estimated: calories_estimated != null ? Number(calories_estimated) : null,
            notes: notes || null,
            logged_at: new Date().toISOString(),
          })
          .select()
          .single()
        break
      }

      case 'fasting': {
        const { achieved_hours, target_hours, completed, fast_start, fast_end } = data as {
          achieved_hours: number
          target_hours: number
          completed: boolean
          fast_start?: string
          fast_end?: string
        }
        result = await supabase
          .from('user_fasting_logs')
          .insert({
            user_id: user.id,
            log_date: today,
            fast_start: fast_start || null,
            fast_end: fast_end || null,
            achieved_hours: Number(achieved_hours) || 0,
            target_hours: Number(target_hours) || 16,
            completed: !!completed,
            logged_at: new Date().toISOString(),
          })
          .select()
          .single()
        break
      }

      case 'weight': {
        const { weight_kg } = data as { weight_kg: number }
        if (!weight_kg || Number(weight_kg) <= 0) {
          return NextResponse.json({ error: 'weight_kg este obligatoriu' }, { status: 400 })
        }
        result = await supabase
          .from('user_weight_logs')
          .insert({
            user_id: user.id,
            log_date: today,
            weight_kg: Number(weight_kg),
            logged_at: new Date().toISOString(),
          })
          .select()
          .single()
        break
      }

      default:
        return NextResponse.json({ error: 'tip invalid' }, { status: 400 })
    }

    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
    return NextResponse.json({ ok: true, data: result.data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
