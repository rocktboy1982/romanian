import { NextResponse } from 'next/server'
import { MOCK_RECIPES } from '@/lib/mock-data'
import { createServerSupabaseClient } from '@/lib/supabase-server'

async function requireAdmin(req: Request) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: roles } = await supabase.from('app_roles').select('role').eq('user_id', user.id).eq('role', 'admin').limit(1)
  if (!roles || roles.length === 0) return null
  return user
}

// In-memory store for demo (survives hot-reload, resets on server restart)
type ContentStatus = 'active' | 'pending' | 'rejected' | 'removed'
const statusOverrides: Record<string, ContentStatus> = {}

function buildContent() {
  return MOCK_RECIPES.map(r => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    type: 'recipe',
    status: (statusOverrides[r.id] ?? 'active') as ContentStatus,
    hero_image_url: r.hero_image_url,
    votes: r.votes,
    comments: r.comments,
    is_tested: r.is_tested,
    quality_score: r.quality_score,
    dietTags: r.dietTags,
    region: r.region,
    created_at: new Date(Date.now() - Math.random() * 30 * 86400000).toISOString(),
    created_by: r.created_by,
  }))
}

export async function GET(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const q = searchParams.get('q')?.toLowerCase()

  let items = buildContent()
  if (status && status !== 'all') items = items.filter(i => i.status === status)
  if (q) items = items.filter(i => i.title.toLowerCase().includes(q) || i.created_by.display_name.toLowerCase().includes(q))

  return NextResponse.json({ items, total: items.length })
}

export async function PUT(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const body = await req.json() as { id: string | string[]; status: ContentStatus }
  const ids = Array.isArray(body.id) ? body.id : [body.id]
  ids.forEach(id => { statusOverrides[id] = body.status })
  return NextResponse.json({ ok: true, updated: ids })
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const body = await req.json() as { id: string | string[] }
  const ids = Array.isArray(body.id) ? body.id : [body.id]
  ids.forEach(id => { statusOverrides[id] = 'removed' })
  return NextResponse.json({ ok: true, removed: ids })
}
