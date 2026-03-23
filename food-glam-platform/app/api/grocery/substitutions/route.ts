import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'

/** GET /api/grocery/substitutions — list user's substitution preferences */
export async function GET(req: Request) {
  try {
    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { data, error } = await supabase
      .from('user_substitution_prefs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** PATCH /api/grocery/substitutions — upsert a substitution preference
 *  Body: { original_canonical, substitute_canonical, accepted, budget_tier? }
 */
export async function PATCH(req: Request) {
  try {
    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await req.json() as {
      original_canonical: string
      substitute_canonical: string
      accepted: boolean
      budget_tier?: string
    }

    if (!body.original_canonical || !body.substitute_canonical) {
      return NextResponse.json({ error: 'original_canonical and substitute_canonical required' }, { status: 400 })
    }

    const tier = body.budget_tier ?? 'normal'

    const { data, error } = await supabase
      .from('user_substitution_prefs')
      .upsert({
        user_id: user.id,
        original_canonical: body.original_canonical,
        substitute_canonical: body.substitute_canonical,
        accepted: body.accepted,
        budget_tier: tier,
      }, { onConflict: 'user_id,original_canonical,budget_tier' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** DELETE /api/grocery/substitutions — remove a substitution preference
 *  Body: { id } or { original_canonical, budget_tier? }
 */
export async function DELETE(req: Request) {
  try {
    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await req.json() as {
      id?: string
      original_canonical?: string
      budget_tier?: string
    }

    if (body.id) {
      const { error } = await supabase
        .from('user_substitution_prefs')
        .delete()
        .eq('id', body.id)
        .eq('user_id', user.id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else if (body.original_canonical) {
      let query = supabase
        .from('user_substitution_prefs')
        .delete()
        .eq('user_id', user.id)
        .eq('original_canonical', body.original_canonical)

      if (body.budget_tier) {
        query = query.eq('budget_tier', body.budget_tier)
      }

      const { error } = await query
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      return NextResponse.json({ error: 'id or original_canonical required' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
