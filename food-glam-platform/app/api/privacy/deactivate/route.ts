/**
 * POST /api/privacy/deactivate
 *
 * GDPR Account Deactivation — marks the account for deletion after 30 days.
 *
 * SECURITY:
 * - Auth required (Bearer token / cookie session)
 * - User identity derived from auth token ONLY — no user_id accepted from body
 * - Admin accounts cannot be deactivated
 * - Confirmation text must match exactly on server side
 * - No data is deleted immediately — account is flagged for deletion after 30 days
 *
 * A cron job or Supabase Edge Function must be scheduled to permanently delete
 * accounts where scheduled_deletion_at < NOW(). See the migration file at
 * supabase/migrations/20260326000000_add_account_status.sql for the full SQL.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'
import { ADMIN_EMAILS } from '@/lib/require-admin'

const REQUIRED_CONFIRMATION = 'ȘTERG CONTUL'

export async function POST(req: NextRequest) {
  try {
    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)

    if (!user) {
      return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 })
    }

    // Admin accounts cannot be deactivated via this endpoint
    if (ADMIN_EMAILS.includes(user.email)) {
      return NextResponse.json(
        { error: 'Conturile de administrator nu pot fi dezactivate prin acest formular.' },
        { status: 403 },
      )
    }

    // Parse and validate request body
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Corp de cerere invalid.' }, { status: 400 })
    }

    const { confirmation } = body as { confirmation?: string }

    // Server-side confirmation check (must match exactly, including diacritics)
    if (!confirmation || confirmation !== REQUIRED_CONFIRMATION) {
      return NextResponse.json(
        {
          error: `Textul de confirmare este incorect. Trebuie să tastezi exact: "${REQUIRED_CONFIRMATION}"`,
        },
        { status: 400 },
      )
    }

    const now = new Date()
    const scheduledDeletion = new Date(now)
    scheduledDeletion.setDate(scheduledDeletion.getDate() + 30)

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        account_status: 'deactivated',
        deactivated_at: now.toISOString(),
        scheduled_deletion_at: scheduledDeletion.toISOString(),
      })
      .eq('id', user.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      scheduled_deletion_at: scheduledDeletion.toISOString(),
      message:
        'Contul tău a fost dezactivat. Datele tale vor fi șterse permanent după 30 de zile. Te poți răzgândi logându-te din nou.',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
