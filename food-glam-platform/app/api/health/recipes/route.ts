import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'

/**
 * GET /api/health/recipes?category=food|drink
 * Returns user's own health recipes + public ones from others.
 */
export async function GET(req: NextRequest) {
  try {
    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 })

    const category = req.nextUrl.searchParams.get('category') || null

    let query = supabase
      .from('health_recipes')
      .select('*')
      .or(`user_id.eq.${user.id},is_public.eq.true`)
      .order('created_at', { ascending: false })

    if (category === 'food' || category === 'drink') {
      query = query.eq('category', category)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ recipes: data ?? [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/health/recipes
 * Creates a new health recipe.
 * Body: { category, title, description?, ingredients?, preparation?, calories_estimated?, tags?, is_public? }
 */
export async function POST(req: NextRequest) {
  try {
    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 })

    const body = await req.json()
    const { category, title, description, ingredients, preparation, calories_estimated, tags, is_public } = body

    if (!category || !['food', 'drink'].includes(category)) {
      return NextResponse.json({ error: 'Categoria trebuie să fie "food" sau "drink"' }, { status: 400 })
    }
    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Titlul este obligatoriu' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('health_recipes')
      .insert({
        user_id: user.id,
        category,
        title: title.trim(),
        description: description?.trim() || null,
        ingredients: Array.isArray(ingredients) ? ingredients : [],
        preparation: preparation?.trim() || null,
        calories_estimated: calories_estimated ? Number(calories_estimated) : null,
        tags: Array.isArray(tags) ? tags : [],
        is_public: !!is_public,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ recipe: data }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * DELETE /api/health/recipes?id=uuid
 * Deletes a health recipe owned by the current user.
 */
export async function DELETE(req: NextRequest) {
  try {
    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Parametrul id este obligatoriu' }, { status: 400 })

    const { error } = await supabase
      .from('health_recipes')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
