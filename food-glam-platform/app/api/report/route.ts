import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

export const REPORT_THRESHOLD = 20

export interface ReportRecord {
  contentId: string
  contentType: 'recipe' | 'cocktail'
  contentTitle: string
  count: number
  deactivated: boolean
  reports: Array<{
    id: string
    reason: string
    detail: string
    reportedAt: string
    reporterHandle: string
  }>
}

/*
 * In-memory store — survives the dev-server process lifetime.
 * When Supabase is wired this becomes a DB write.
 */
export const REPORT_STORE = new Map<string, ReportRecord>()

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 10 reports per hour per IP
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    const { success } = rateLimit(`report:${ip}`, 10, 60 * 60 * 1000)
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await req.json()
    const { contentId, contentType, contentTitle, reason, detail, reporterHandle } = body

    if (!contentId || !contentType || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const existing = REPORT_STORE.get(contentId) ?? {
      contentId,
      contentType,
      contentTitle: contentTitle ?? contentId,
      count: 0,
      deactivated: false,
      reports: [] as ReportRecord['reports'],
    }

    /* prevent double-reporting by the same user in this server session */
    if (existing.reports.some(r => r.reporterHandle === reporterHandle)) {
      return NextResponse.json({ error: 'already_reported', deactivated: existing.deactivated }, { status: 409 })
    }

    existing.reports.push({
      id: `rep_${Date.now()}`,
      reason,
      detail: detail ?? '',
      reportedAt: new Date().toISOString(),
      reporterHandle: reporterHandle ?? 'anonymous',
    })
    existing.count = existing.reports.length

    if (existing.count >= REPORT_THRESHOLD) {
      existing.deactivated = true
    }

    REPORT_STORE.set(contentId, existing)

    return NextResponse.json({
      success: true,
      count: existing.count,
      deactivated: existing.deactivated,
      threshold: REPORT_THRESHOLD,
    })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('contentId')
  if (id) {
    const record = REPORT_STORE.get(id)
    return NextResponse.json(record ?? { count: 0, deactivated: false })
  }
  /* return all for admin */
  return NextResponse.json(Array.from(REPORT_STORE.values()))
}
