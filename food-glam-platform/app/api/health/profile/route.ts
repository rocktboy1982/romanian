import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'

// Activity multipliers (Mifflin-St Jeor)
const ACTIVITY_FACTORS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  heavy: 1.725,
  athlete: 1.9,
}

function calculateBMR(
  weight_kg: number,
  height_cm: number,
  age: number,
  gender: string,
): number {
  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age
  return gender === 'M' ? base + 5 : base - 161
}

function calculateTargets(
  weight_kg: number,
  height_cm: number,
  age: number,
  gender: string,
  activity_level: string,
  goal_weight_kg?: number | null,
): { daily_calorie_target: number; daily_water_goal_ml: number } {
  const bmr = calculateBMR(weight_kg, height_cm, age, gender)
  const factor = ACTIVITY_FACTORS[activity_level] ?? 1.2
  const tdee = Math.round(bmr * factor)

  let daily_calorie_target = tdee
  if (goal_weight_kg != null && goal_weight_kg < weight_kg) {
    daily_calorie_target = tdee - 500  // lose ~0.5 kg/week
  } else if (goal_weight_kg != null && goal_weight_kg > weight_kg) {
    daily_calorie_target = tdee + 300  // lean gain
  }

  const daily_water_goal_ml = Math.round(weight_kg * 30)

  return { daily_calorie_target, daily_water_goal_ml }
}

/** GET /api/health/profile — returns the user's health profile */
export async function GET(req: NextRequest) {
  try {
    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 })

    const { data, error } = await supabase
      .from('user_health_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ profile: data ?? null })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** POST /api/health/profile — upsert health profile, auto-calculate BMR/TDEE */
export async function POST(req: NextRequest) {
  try {
    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 })

    const body = await req.json()
    const {
      age,
      gender,
      height_cm,
      weight_kg,
      goal_weight_kg,
      activity_level,
      fasting_protocol,
      fasting_eating_start,
      fasting_eating_end,
      medical_conditions,
      allergens,
      blood_type,
      is_smoker,
      pregnancy_status,
    } = body as {
      age?: number
      gender?: string
      height_cm?: number
      weight_kg?: number
      goal_weight_kg?: number | null
      activity_level?: string
      fasting_protocol?: string
      fasting_eating_start?: string | null
      fasting_eating_end?: string | null
      medical_conditions?: string[]
      allergens?: string[]
      blood_type?: string
      is_smoker?: boolean
      pregnancy_status?: string
    }

    // Build the upsert payload
    const payload: Record<string, unknown> = { user_id: user.id }

    if (age != null) payload.age = Number(age)
    if (gender) payload.gender = gender
    if (height_cm != null) payload.height_cm = Number(height_cm)
    if (weight_kg != null) payload.weight_kg = Number(weight_kg)
    if (goal_weight_kg !== undefined) payload.goal_weight_kg = goal_weight_kg != null ? Number(goal_weight_kg) : null
    if (activity_level) payload.activity_level = activity_level
    if (fasting_protocol !== undefined) payload.fasting_protocol = fasting_protocol
    if (fasting_eating_start !== undefined) payload.fasting_eating_start = fasting_eating_start || null
    if (fasting_eating_end !== undefined) payload.fasting_eating_end = fasting_eating_end || null
    if (medical_conditions !== undefined) payload.medical_conditions = medical_conditions ?? []
    if (allergens !== undefined) payload.allergens = allergens ?? []
    if (blood_type !== undefined) payload.blood_type = blood_type || 'unknown'
    if (is_smoker !== undefined) payload.is_smoker = Boolean(is_smoker)
    if (pregnancy_status !== undefined) payload.pregnancy_status = pregnancy_status || 'none'

    // Calculate targets if we have enough data
    if (weight_kg != null && height_cm != null && age != null && gender && activity_level) {
      const { daily_calorie_target, daily_water_goal_ml } = calculateTargets(
        Number(weight_kg),
        Number(height_cm),
        Number(age),
        gender,
        activity_level,
        goal_weight_kg != null ? Number(goal_weight_kg) : null,
      )
      payload.daily_calorie_target = daily_calorie_target
      payload.daily_water_goal_ml = daily_water_goal_ml
    }

    const { data, error } = await supabase
      .from('user_health_profiles')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ profile: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
