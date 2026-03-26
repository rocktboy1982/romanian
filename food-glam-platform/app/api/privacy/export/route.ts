/**
 * GET /api/privacy/export
 *
 * GDPR Data Export — returns ALL data belonging to the authenticated user
 * as a downloadable JSON file.
 *
 * SECURITY:
 * - Auth required (Bearer token / cookie session)
 * - User identity is ALWAYS derived from the auth token, never from request params
 * - Service client is used for DB queries, but every query filters by user.id
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'

export async function GET(req: NextRequest) {
  try {
    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)

    if (!user) {
      return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 })
    }

    const uid = user.id

    // Fetch all user data in parallel for performance
    const [
      profileRes,
      postsRes,
      collectionsRes,
      pantryRes,
      mealPlansRes,
      shoppingListsRes,
      votesRes,
      followsRes,
      threadsRes,
      repliesRes,
      healthProfileRes,
      hydrationLogsRes,
      mealLogsRes,
      fastingLogsRes,
      weightLogsRes,
    ] = await Promise.all([
      // profiles
      supabase
        .from('profiles')
        .select('id, display_name, handle, bio, avatar_url, banner_url, created_at, account_status')
        .eq('id', uid)
        .single(),

      // posts (recipes, cocktails, messages)
      supabase
        .from('posts')
        .select('id, title, type, status, created_at, updated_at')
        .eq('created_by', uid),

      // collections
      supabase
        .from('collections')
        .select('*')
        .eq('user_id', uid),

      // pantry items
      supabase
        .from('pantry')
        .select('*')
        .eq('user_id', uid),

      // meal plans
      supabase
        .from('meal_plans')
        .select('*')
        .eq('user_id', uid),

      // shopping lists (with nested items)
      supabase
        .from('shopping_lists')
        .select('*, shopping_list_items(*)')
        .eq('user_id', uid),

      // votes
      supabase
        .from('votes')
        .select('*')
        .eq('user_id', uid),

      // follows
      supabase
        .from('follows')
        .select('*')
        .eq('follower_id', uid),

      // threads
      supabase
        .from('threads')
        .select('id, title, body, status, created_at')
        .eq('author_id', uid),

      // replies
      supabase
        .from('replies')
        .select('id, thread_id, body, status, created_at')
        .eq('author_id', uid),

      // health profile
      supabase
        .from('user_health_profiles')
        .select('*')
        .eq('user_id', uid)
        .maybeSingle(),

      // hydration logs
      supabase
        .from('user_hydration_logs')
        .select('*')
        .eq('user_id', uid)
        .order('logged_at', { ascending: false }),

      // meal logs
      supabase
        .from('user_meal_logs')
        .select('*')
        .eq('user_id', uid)
        .order('logged_at', { ascending: false }),

      // fasting logs
      supabase
        .from('user_fasting_logs')
        .select('*')
        .eq('user_id', uid)
        .order('logged_at', { ascending: false }),

      // weight logs
      supabase
        .from('user_weight_logs')
        .select('*')
        .eq('user_id', uid)
        .order('logged_at', { ascending: false }),
    ])

    const exportDate = new Date().toISOString()

    const exportData = {
      _meta: {
        platform: 'MareChef.ro',
        exported_at: exportDate,
        user_id: uid,
        gdpr_note:
          'Acest fișier conține toate datele tale personale stocate pe MareChef.ro, conform dreptului de portabilitate a datelor (GDPR Art. 20).',
      },
      profil: profileRes.data ?? null,
      postari: postsRes.data ?? [],
      colectii: collectionsRes.data ?? [],
      camara: pantryRes.data ?? [],
      planuri_de_masa: mealPlansRes.data ?? [],
      liste_cumparaturi: shoppingListsRes.data ?? [],
      voturi: votesRes.data ?? [],
      urmari: followsRes.data ?? [],
      discutii: threadsRes.data ?? [],
      raspunsuri: repliesRes.data ?? [],
      profil_sanatate: healthProfileRes.data ?? null,
      jurnal_hidratare: hydrationLogsRes.data ?? [],
      jurnal_mese: mealLogsRes.data ?? [],
      jurnal_post: fastingLogsRes.data ?? [],
      jurnal_greutate: weightLogsRes.data ?? [],
    }

    const fileName = `marechef-export-${exportDate.split('T')[0]}.json`
    const body = JSON.stringify(exportData, null, 2)

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
