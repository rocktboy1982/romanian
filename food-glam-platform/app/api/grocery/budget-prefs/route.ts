import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'

interface BudgetPrefs {
  default_budget_tier: string
  pack_size_optimisation: boolean
  substitutions_enabled: boolean
}

const DEFAULT_PREFS: BudgetPrefs = {
  default_budget_tier: 'normal',
  pack_size_optimisation: true,
  substitutions_enabled: true,
}

/** GET /api/grocery/budget-prefs */
export async function GET(req: Request) {
  try {
    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { data, error } = await supabase
      .from('user_grocery_prefs')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (!data) {
      return NextResponse.json(DEFAULT_PREFS)
    }

    return NextResponse.json({
      default_budget_tier: data.default_budget_tier,
      pack_size_optimisation: data.pack_size_optimisation,
      substitutions_enabled: data.substitutions_enabled,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** PATCH /api/grocery/budget-prefs */
export async function PATCH(req: Request) {
  try {
    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await req.json() as Partial<BudgetPrefs>

    const { data, error } = await supabase
      .from('user_grocery_prefs')
      .upsert({
        user_id: user.id,
        default_budget_tier: body.default_budget_tier ?? 'normal',
        pack_size_optimisation: body.pack_size_optimisation ?? true,
        substitutions_enabled: body.substitutions_enabled ?? true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      default_budget_tier: data.default_budget_tier,
      pack_size_optimisation: data.pack_size_optimisation,
      substitutions_enabled: data.substitutions_enabled,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
