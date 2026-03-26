/**
 * POST /api/privacy/reactivate
 *
 * Reactivates a previously deactivated account within the 30-day grace period.
 * Called automatically when a deactivated user logs back in.
 *
 * SECURITY:
 * - Auth required (Bearer token / cookie session)
 * - User identity derived from auth token ONLY
 * - Only the account owner can reactivate their own account
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'

export async function POST(req: NextRequest) {
  try {
    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)

    if (!user) {
      return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 })
    }

    // Check current account status
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('account_status, scheduled_deletion_at')
      .eq('id', user.id)
      .single()

    if (fetchError || !profile) {
      return NextResponse.json({ error: 'Profilul nu a fost găsit.' }, { status: 404 })
    }

    if (profile.account_status !== 'deactivated') {
      return NextResponse.json({
        ok: true,
        message: 'Contul tău este deja activ.',
      })
    }

    // Check if still within the 30-day grace period
    if (profile.scheduled_deletion_at) {
      const deletionDate = new Date(profile.scheduled_deletion_at)
      if (deletionDate < new Date()) {
        return NextResponse.json(
          {
            error:
              'Perioada de grație de 30 de zile a expirat. Datele au fost sau vor fi șterse permanent.',
          },
          { status: 410 },
        )
      }
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        account_status: 'active',
        deactivated_at: null,
        scheduled_deletion_at: null,
      })
      .eq('id', user.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      message: 'Contul tău a fost reactivat cu succes. Bine ai revenit!',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
