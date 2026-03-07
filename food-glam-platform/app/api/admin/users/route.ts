import { NextResponse } from 'next/server'
import { MOCK_RECIPES } from '@/lib/mock-data'
import { createServerSupabaseClient } from '@/lib/supabase-server'

type UserStatus = 'active' | 'warned' | 'blocked' | 'deleted'

const userStatusOverrides: Record<string, UserStatus> = {}
const userNotes: Record<string, string> = {}

/** Derive unique users from mock recipes (same source as chefs, treated as regular users here) */
function buildUsers() {
  const seen = new Set<string>()
  return MOCK_RECIPES
    .filter(r => { const fresh = !seen.has(r.created_by.id); seen.add(r.created_by.id); return fresh })
    .map((r, i) => ({
      id: r.created_by.id,
      display_name: r.created_by.display_name,
      handle: r.created_by.handle,
      avatar_url: r.created_by.avatar_url,
      email: `${r.created_by.handle.replace('@', '')}@example.com`,
      status: (userStatusOverrides[r.created_by.id] ?? 'active') as UserStatus,
      notes: userNotes[r.created_by.id] ?? '',
      joined_at: new Date(Date.now() - (i + 1) * 12 * 86400000).toISOString(),
      recipe_count: MOCK_RECIPES.filter(x => x.created_by.id === r.created_by.id).length,
    }))
}

async function requireAdmin(req: Request) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: roles } = await supabase.from('app_roles').select('role').eq('user_id', user.id).eq('role', 'admin').limit(1)
  if (!roles || roles.length === 0) return null
  return user
}

export async function GET(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const q = searchParams.get('q')?.toLowerCase()

  let users = buildUsers()
  if (status && status !== 'all') users = users.filter(u => u.status === status)
  if (q) users = users.filter(u =>
    u.display_name.toLowerCase().includes(q) ||
    u.handle.toLowerCase().includes(q) ||
    u.email.toLowerCase().includes(q)
  )
  return NextResponse.json({ users, total: users.length })
}

export async function PUT(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const body = await req.json() as { id: string; status?: UserStatus; notes?: string; tier?: 'pro' | 'amateur' | 'user' }
  if (body.status) userStatusOverrides[body.id] = body.status
  if (body.notes !== undefined) userNotes[body.id] = body.notes
  return NextResponse.json({ ok: true })
}
