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

type ChefStatus = 'active' | 'suspended' | 'banned'
type ChefTier   = 'pro' | 'amateur' | 'user'
const chefStatusOverrides: Record<string, ChefStatus> = {}
const chefTierOverrides:   Record<string, ChefTier>   = {}
const chefNotes: Record<string, string> = {}

// Derive unique chefs from mock recipes
function buildChefs() {
  const seen = new Set<string>()
  return MOCK_RECIPES
    .filter(r => { const s = !seen.has(r.created_by.id); seen.add(r.created_by.id); return s })
    .map((r, i) => ({
      id: r.created_by.id,
      display_name: r.created_by.display_name,
      handle: r.created_by.handle,
      avatar_url: r.created_by.avatar_url,
      status: (chefStatusOverrides[r.created_by.id] ?? 'active') as ChefStatus,
      tier:   (chefTierOverrides[r.created_by.id]  ?? 'user')   as ChefTier,
      notes: chefNotes[r.created_by.id] ?? '',
      recipe_count: MOCK_RECIPES.filter(x => x.created_by.id === r.created_by.id).length,
      total_votes: MOCK_RECIPES.filter(x => x.created_by.id === r.created_by.id).reduce((s, x) => s + x.votes, 0),
      joined_at: new Date(Date.now() - (i + 1) * 15 * 86400000).toISOString(),
      followers: [12400, 38700, 9100, 54200, 21300, 67800, 4500, 31900, 22100, 8800, 41000, 6200][i] ?? 5000,
    }))
}

export async function GET(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const q = searchParams.get('q')?.toLowerCase()

  let chefs = buildChefs()
  if (status && status !== 'all') chefs = chefs.filter(c => c.status === status)
  if (q) chefs = chefs.filter(c =>
    c.display_name.toLowerCase().includes(q) || c.handle.toLowerCase().includes(q)
  )
  return NextResponse.json({ chefs, total: chefs.length })
}

export async function PUT(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const body = await req.json() as { id: string; status?: ChefStatus; notes?: string; tier?: ChefTier }
  if (body.status) chefStatusOverrides[body.id] = body.status
  if (body.tier) chefTierOverrides[body.id] = body.tier
  if (body.notes !== undefined) chefNotes[body.id] = body.notes
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const body = await req.json() as { id: string }
  chefStatusOverrides[body.id] = 'banned'
  return NextResponse.json({ ok: true })
}
