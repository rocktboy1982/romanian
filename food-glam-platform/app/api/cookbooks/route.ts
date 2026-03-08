import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl
    const cuisine_id = url.searchParams.get('cuisine_id')?.trim() || ''
    const food_style_id = url.searchParams.get('food_style_id')?.trim() || ''

    const supabase = await createServerSupabaseClient()

    let query = supabase
      .from('cookbooks')
      .select(`
        id,
        title,
        slug,
        description,
        cover_image_url,
        cuisine_id,
        food_style_id,
        is_public,
        created_at,
        owner:profiles(id, display_name, handle, avatar_url),
        cuisines(id, name, slug),
        food_styles(id, name, slug)
      `)
      .eq('is_public', true)
      .order('created_at', { ascending: false })

    if (cuisine_id) query = query.eq('cuisine_id', cuisine_id)
    if (food_style_id) query = query.eq('food_style_id', food_style_id)

    const { data: cookbooks, error } = await query

    if (error) {
      return NextResponse.json({ data: null, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: cookbooks, error: null }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { data: null, error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    )
  }
}
