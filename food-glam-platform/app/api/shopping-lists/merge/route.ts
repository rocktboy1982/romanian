import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'

export async function POST(req: Request) {
  try {
    const { sourceId, targetId } = await req.json()
    
    if (!sourceId || !targetId) {
      return NextResponse.json(
        { error: 'sourceId and targetId are required' },
        { status: 400 }
      )
    }

    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Verify source list belongs to user
    const { data: sourceList, error: sourceError } = await supabase
      .from('shopping_lists')
      .select('id')
      .eq('id', sourceId)
      .eq('user_id', user.id)
      .single()

    if (sourceError || !sourceList) {
      return NextResponse.json(
        { error: 'Source list not found or does not belong to you' },
        { status: 404 }
      )
    }

    // Verify target list belongs to user
    const { data: targetList, error: targetError } = await supabase
      .from('shopping_lists')
      .select('id')
      .eq('id', targetId)
      .eq('user_id', user.id)
      .single()

    if (targetError || !targetList) {
      return NextResponse.json(
        { error: 'Target list not found or does not belong to you' },
        { status: 404 }
      )
    }

    // Move all items from source to target
    const { error: moveError } = await supabase
      .from('shopping_list_items')
      .update({ shopping_list_id: targetId })
      .eq('shopping_list_id', sourceId)

    if (moveError) {
      return NextResponse.json(
        { error: 'Failed to merge items' },
        { status: 500 }
      )
    }

    // Delete source list
    const { error: deleteError } = await supabase
      .from('shopping_lists')
      .delete()
      .eq('id', sourceId)

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete source list' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, targetId })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
