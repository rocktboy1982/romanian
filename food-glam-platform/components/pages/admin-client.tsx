'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import FallbackImage from '@/components/FallbackImage'
import Link from 'next/link'
import { supabase } from '@/lib/supabase-client'

/* ─── types ─────────────────────────────────────────────────────────────── */

type ContentStatus = 'active' | 'pending' | 'rejected' | 'removed'
type ChefStatus    = 'active' | 'suspended' | 'banned'
type UserStatus    = 'active' | 'warned' | 'blocked' | 'deleted'
type AdminTab      = 'dashboard' | 'content' | 'chefs' | 'users' | 'reports' | 'settings' | 'analytics' | 'audit' | 'statistici'
type ReportCategory = 'all' | 'spam' | 'hate' | 'harassment' | 'copyright' | 'misinfo' | 'other'
type UserRoleFilter = 'all' | 'active' | 'warned' | 'blocked' | 'deleted' | 'admins' | 'moderators' | 'banned'

interface Stats {
  totalRecipes: number
  pendingReview: number
  activeChefs: number
  bannedChefs: number
  totalVotes: number
  totalComments: number
  reportedContent: number
  approvedToday: number
  rejectedToday: number
  newUsersToday: number
  weeklyGrowth: number
  totalUsers: number
  newUsersThisWeek: number
  activeUsersLast7Days: number
}

interface ContentItem {
  id: string
  slug: string
  title: string
  type: string
  status: ContentStatus
  hero_image_url: string
  votes: number
  comments: number
  is_tested: boolean
  quality_score: number | null
  dietTags: string[]
  region: string
  created_at: string
  created_by: { id: string; display_name: string; handle: string; avatar_url: string | null }
}

interface Chef {
  id: string
  display_name: string
  handle: string
  avatar_url: string | null
  status: ChefStatus
  tier: 'pro' | 'amateur' | 'user'
  notes: string
  recipe_count: number
  total_votes: number
  joined_at: string
  followers: number
  featured?: boolean
}

interface AdminUser {
  id: string
  display_name: string
  handle: string
  avatar_url: string | null
  email: string
  status: UserStatus
  notes: string
  joined_at: string
  recipe_count: number
  pantry_count?: number
  saved_recipes_count?: number
  tier?: 'pro' | 'amateur' | 'user'
  warned_at?: string
  is_moderator?: boolean
  is_admin?: boolean
  provider?: string
  last_sign_in_at?: string | null
}

interface ReportItem {
  id: string
  title: string
  reason: string
  category: Exclude<ReportCategory, 'all'>
  reporter: string
  reporterId: string
  date: string
  img: string
  slug: string
  status: 'open' | 'dismissed' | 'actioned'
  contentOwnerId?: string
  contentOwnerName?: string
}

interface AuditEntry {
  id: string
  ts: string
  actor: string
  action: string
  target: string
  detail: string
  severity: 'info' | 'warn' | 'danger'
}

/* ─── mock reports ───────────────────────────────────────────────────────── */

const MOCK_REPORTS: ReportItem[] = []

/* ─── admin email list (client-side gate) ────────────────────────────────── */

const ADMIN_EMAILS = ['iancu1982@gmail.com']

/* ─── helpers ────────────────────────────────────────────────────────────── */

const STATUS_COLORS: Record<ContentStatus | ChefStatus | UserStatus, string> = {
  active:    'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  pending:   'bg-amber-500/20    text-amber-300    border-amber-500/30',
  rejected:  'bg-red-500/20      text-red-300      border-red-500/30',
  removed:   'bg-zinc-500/20     text-zinc-400     border-zinc-500/30',
  suspended: 'bg-orange-500/20   text-orange-300   border-orange-500/30',
  banned:    'bg-red-600/30      text-red-300      border-red-600/40',
  warned:    'bg-yellow-500/20   text-yellow-300   border-yellow-500/30',
  blocked:   'bg-red-500/20      text-red-300      border-red-500/30',
  deleted:   'bg-zinc-700/30     text-zinc-500     border-zinc-700/40',
}

function Badge({ status }: { status: ContentStatus | ChefStatus | UserStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_COLORS[status]}`}>
      {status}
    </span>
  )
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-1" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.07)' }}>
      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#555' }}>{label}</span>
      <span className="text-3xl font-bold ff-display" style={{ color: accent ?? '#f0f0f0' }}>{value}</span>
      {sub && <span className="text-xs" style={{ color: '#555' }}>{sub}</span>}
    </div>
  )
}

function ConfirmModal({ message, onConfirm, onCancel, confirmLabel = 'Confirmă', danger = true }: {
  message: string; onConfirm: () => void; onCancel: () => void; confirmLabel?: string; danger?: boolean
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="rounded-2xl p-6 w-full max-w-sm" style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)' }}>
         <p className="text-base font-semibold mb-6 text-center">{message}</p>
         <div className="flex gap-3">
           <button onClick={onCancel}
             className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
             style={{ background: 'rgba(255,255,255,0.08)', color: '#aaa' }}>
             Anulează
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: danger ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'linear-gradient(135deg,#ff9500,#ff6b00)', color: '#fff' }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function Toast({ message, type, onDone }: { message: string; type: 'success' | 'error' | 'info'; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t) }, [onDone])
  const colors = { success: '#22c55e', error: '#ef4444', info: '#3b82f6' }
  return (
    <div className="fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl"
      style={{ background: '#1e1e1e', border: `1px solid ${colors[type]}40`, minWidth: 240 }}>
      <span style={{ color: colors[type], fontSize: 18 }}>
        {type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}
      </span>
      <span className="text-sm">{message}</span>
    </div>
  )
}

/* ─── promote modal ──────────────────────────────────────────────────────── */

function PromoteModal({ user, onPromote, onClose }: {
  user: AdminUser
  onPromote: (userId: string, tier: 'amateur' | 'pro') => void
  onClose: () => void
}) {
  const [tier, setTier] = useState<'amateur' | 'pro'>('amateur')
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="rounded-2xl p-6 w-full max-w-sm" style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)' }}>
         <h3 className="text-base font-bold mb-1">Promovare la Bucătar</h3>
         <p className="text-sm mb-5" style={{ color: '#777' }}>Atribuie un nivel de bucătar pentru <strong style={{ color: '#f0f0f0' }}>{user.display_name}</strong></p>
         <div className="flex gap-3 mb-6">
           {(['amateur', 'pro'] as const).map(t => (
             <button key={t} onClick={() => setTier(t)}
               className="flex-1 py-3 rounded-xl text-sm font-bold transition-all flex flex-col items-center gap-1"
               style={tier === t
                 ? t === 'pro'
                   ? { background: 'rgba(255,77,109,0.25)', color: '#ff4d6d', border: '2px solid rgba(255,77,109,0.5)' }
                   : { background: 'rgba(224,224,224,0.15)', color: '#e0e0e0', border: '2px solid rgba(255,255,255,0.35)' }
                 : { background: 'rgba(255,255,255,0.05)', color: '#555', border: '2px solid rgba(255,255,255,0.08)' }}>
               <span style={{ fontSize: 20 }}>{t === 'pro' ? '🔴' : '⬜'}</span>
               {t === 'pro' ? 'Bucătar Profesionist' : 'Amateur / Influencer'}
             </button>
           ))}
         </div>
         <div className="flex gap-3">
           <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
             style={{ background: 'rgba(255,255,255,0.08)', color: '#aaa' }}>Anulează</button>
           <button onClick={() => { onPromote(user.id, tier); onClose() }}
             className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
             style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff' }}>
             Promovează →
           </button>
         </div>
       </div>
     </div>
   )
 }

/* ══════════════════════════════════════════════════════════════════════════
   TOGGLE COMPONENT
═══════════════════════════════════════════════════════════════════════════ */

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} className="w-11 h-6 rounded-full relative transition-colors" style={{ background: on ? '#22c55e' : 'rgba(255,255,255,0.15)' }}>
      <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform" style={{ transform: on ? 'translateX(20px)' : 'translateX(0)' }} />
    </button>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════ */

let _cachedToken: string | null = null

async function getAdminToken(): Promise<string | null> {
  if (_cachedToken) return _cachedToken
  // Try localStorage directly first
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
    for (const key of keys) {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      if (parsed?.access_token) {
        _cachedToken = parsed.access_token
        return _cachedToken
      }
    }
  } catch { /* ignore */ }
  // Fallback to Supabase client
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token ?? null
  _cachedToken = token
  return token
}

async function adminFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAdminToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  } else {
    // Dev fallback: send mock user id
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("mock_user") : null
      const mockId = raw ? (JSON.parse(raw).id || "a0000000-0000-0000-0000-000000000001") : "a0000000-0000-0000-0000-000000000001"
      headers["x-mock-user-id"] = mockId
    } catch { /* ignore */ }
  }
  return fetch(url, { ...options, headers })
}

export default function AdminClient() {
  const [tab, setTab] = useState<AdminTab>('dashboard')
  const [stats, setStats] = useState<Stats | null>(null)

  /* auth state */
  const [authChecked, setAuthChecked] = useState(false)
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [authEmail, setAuthEmail] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const checkAuth = () => {
      if (!mounted) return

      // Read session directly from localStorage — most reliable across page navigations
      let email: string | null = null
      let token: string | null = null

      try {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
        for (const key of keys) {
          const raw = localStorage.getItem(key)
          if (!raw) continue
          const parsed = JSON.parse(raw)
          if (parsed?.user?.email) {
            email = parsed.user.email
            token = parsed.access_token || null
            break
          }
        }
      } catch { /* ignore */ }

      // Fallback: try Supabase client
      if (!email) {
        supabase.auth.getSession().then(({ data }) => {
          if (!mounted) return
          const sess = data.session
          const e = sess?.user?.email ?? null
          setAuthEmail(e)
          setIsAdminUser(!!e && ADMIN_EMAILS.includes(e))
          _cachedToken = sess?.access_token ?? null
          setAuthChecked(true)
        })
        return
      }

      setAuthEmail(email)
      setIsAdminUser(ADMIN_EMAILS.includes(email))
      _cachedToken = token
      setAuthChecked(true)
    }

    // Check immediately
    checkAuth()

    // Also listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => checkAuth())

    // Retry after 2s in case localStorage wasn't ready
    const timer = setTimeout(checkAuth, 2000)

    return () => { mounted = false; subscription?.unsubscribe(); clearTimeout(timer) }
  }, [])

  /* content state */
  const [content, setContent] = useState<ContentItem[]>([])
  const [contentFilter, setContentFilter] = useState<ContentStatus | 'all'>('all')
  const [contentSearch, setContentSearch] = useState('')
  const [selectedContent, setSelectedContent] = useState<Set<string>>(new Set())
  const [contentLoading, setContentLoading] = useState(false)

  /* chef state */
  const [chefs, setChefs] = useState<Chef[]>([])
  const [chefFilter, setChefFilter] = useState<ChefStatus | 'all'>('all')
  const [chefSearch, setChefSearch] = useState('')
  const [selectedChefs, setSelectedChefs] = useState<Set<string>>(new Set())
  const [chefsLoading, setChefsLoading] = useState(false)
  const [editingChef, setEditingChef] = useState<Chef | null>(null)
  const [chefNotesDraft, setChefNotesDraft] = useState('')
  const [featuredChefs, setFeaturedChefs] = useState<Set<string>>(new Set())
  const [bulkChefTier, setBulkChefTier] = useState<'pro' | 'amateur' | 'user' | ''>('')

  /* users state */
  const [users, setUsers] = useState<AdminUser[]>([])
  const [userFilter, setUserFilter] = useState<UserRoleFilter>('all')
  const [userSearch, setUserSearch] = useState('')
  const [usersLoading, setUsersLoading] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [userNotesDraft, setUserNotesDraft] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [promotingUser, setPromotingUser] = useState<AdminUser | null>(null)

  /* statistici state */
  const [statisticiLoading, setStatisticiLoading] = useState(false)
  const [statisticiData, setStatisticiData] = useState<{
    recipesByCountry: { country: string; count: number }[]
    typeBreakdown: { type: string; count: number }[]
    weeklyGrowth: { week: string; count: number }[]
    mostViewed: { title: string; quality_score: number; slug: string }[]
    totalCocktails: number
    totalRecipes: number
  } | null>(null)

  /* reports state */
  const [reports, setReports] = useState<ReportItem[]>(MOCK_REPORTS)
  const [reportCategory, setReportCategory] = useState<ReportCategory>('all')
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set())

  /* fetch reports from API */
  useEffect(() => {
    if (tab !== 'reports') return
    adminFetch('/api/reports?status=open')
      .then(r => r.json())
      .then(data => {
        const mapped = (data.reports || []).map((r: { id: string; entity_type: string; entity_id: string; reporter_id: string; category: string; details: string | null; status: string; created_at: string }) => ({
          id: r.id,
          title: r.entity_id,
          reason: r.details || r.category,
          category: (['spam', 'hate', 'harassment', 'copyright', 'misinfo', 'other'].includes(r.category) ? r.category : 'other') as Exclude<ReportCategory, 'all'>,
          reporter: r.reporter_id?.slice(0, 8) || 'anonim',
          reporterId: r.reporter_id || '',
          date: new Date(r.created_at).toLocaleDateString('ro-RO'),
          img: '',
          slug: r.entity_id,
          status: (r.status === 'open' ? 'open' : 'actioned') as 'open' | 'actioned',
        }))
        setReports(mapped)
      })
      .catch(() => {})
  }, [tab])

  /* audit log */
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const auditCounter = useRef(0)

  /* settings state */
  const [settings, setSettings] = useState({
    maintenanceMode: false,
    registrationsOpen: true,
    recipeSubmissions: true,
    reportThreshold: 20,
    warningCooldown: 24,
    features: { cookMode: true, shoppingLists: true, mealPlans: true, pantry: true, communityForum: true }
  })

  /* analytics state */
  const [analytics, setAnalytics] = useState<{
    topRecipes: { title: string; votes: number; slug: string }[]
    recipesPerRegion: { region: string; count: number }[]
    recentActivity: { date: string; recipes: number; votes: number }[]
  } | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  /* sanctions state */
  const [sanctions, setSanctions] = useState<Array<{
    id: string; user_id: string; user_name: string; type: string; reason: string; created_at: string; expires_at: string | null
  }>>([])

  /* ui state */
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void; confirmLabel?: string; danger?: boolean } | null>(null)
  const [previewItem, setPreviewItem] = useState<ContentItem | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
  }, [])

  const addAudit = useCallback((action: string, target: string, detail: string, severity: AuditEntry['severity'] = 'info') => {
    const entry: AuditEntry = {
      id: `audit-${++auditCounter.current}`,
      ts: new Date().toISOString(),
      actor: 'admin',
      action,
      target,
      detail,
      severity,
    }
    setAuditLog(prev => [entry, ...prev].slice(0, 100))
  }, [])

  /* ── fetch stats (only after auth is confirmed) ── */
  useEffect(() => {
    if (!isAdminUser) return
    adminFetch('/api/admin/stats').then(r => r.json()).then(setStats).catch(() => {})
  }, [isAdminUser])

  /* ── fetch content ── */
  const fetchContent = useCallback(async () => {
    setContentLoading(true)
    try {
      const params = new URLSearchParams()
      if (contentFilter !== 'all') params.set('status', contentFilter)
      if (contentSearch) params.set('q', contentSearch)
      const res = await adminFetch(`/api/admin/content?${params}`)
      const data = await res.json()
      setContent(data.items ?? [])
    } finally {
      setContentLoading(false)
    }
  }, [contentFilter, contentSearch])

  useEffect(() => { if (tab === 'content') fetchContent() }, [tab, fetchContent])

  /* ── fetch chefs ── */
  const fetchChefs = useCallback(async () => {
    setChefsLoading(true)
    try {
      const params = new URLSearchParams()
      if (chefFilter !== 'all') params.set('status', chefFilter)
      if (chefSearch) params.set('q', chefSearch)
      const res = await adminFetch(`/api/admin/chefs?${params}`)
      const data = await res.json()
      setChefs(data.chefs ?? [])
    } finally {
      setChefsLoading(false)
    }
  }, [chefFilter, chefSearch])

  useEffect(() => { if (tab === 'chefs') fetchChefs() }, [tab, fetchChefs])

  /* ── fetch users ── */
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const params = new URLSearchParams()
      // Map role filters to status or role params
      if (userFilter === 'admins') params.set('role', 'admin')
      else if (userFilter === 'moderators') params.set('role', 'moderator')
      else if (userFilter === 'banned') params.set('status', 'blocked')
      else if (userFilter !== 'all') params.set('status', userFilter)
      if (userSearch) params.set('q', userSearch)
      const res = await adminFetch(`/api/admin/users?${params}`)
      const data = await res.json()
      let fetched: AdminUser[] = data.users ?? []
      // Client-side filter for admins/moderators
      if (userFilter === 'admins') fetched = fetched.filter(u => u.is_admin)
      if (userFilter === 'moderators') fetched = fetched.filter(u => u.is_moderator && !u.is_admin)
      setUsers(fetched)
    } finally { setUsersLoading(false) }
  }, [userFilter, userSearch])

  useEffect(() => { if (tab === 'users') fetchUsers() }, [tab, fetchUsers])

  /* ── fetch analytics ── */
  useEffect(() => {
    if (tab !== 'analytics') return
    setAnalyticsLoading(true)
    adminFetch('/api/admin/analytics').then(r => r.json()).then(setAnalytics).catch(() => {}).finally(() => setAnalyticsLoading(false))
  }, [tab])

  /* ── fetch statistici ── */
  useEffect(() => {
    if (tab !== 'statistici') return
    setStatisticiLoading(true)
    adminFetch('/api/admin/statistici').then(r => r.json()).then(setStatisticiData).catch(() => {}).finally(() => setStatisticiLoading(false))
  }, [tab])

  /* ── fetch sanctions ── */
  useEffect(() => {
    if (tab !== 'users') return
    adminFetch('/api/admin/sanctions').then(r => r.json()).then(d => setSanctions(d.sanctions || [])).catch(() => {})
  }, [tab])

  /* ── content actions ── */
  const setContentStatus = useCallback(async (ids: string[], status: ContentStatus) => {
    try {
      await adminFetch('/api/admin/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ids, status }),
      })
      showToast(`${ids.length} item(s) set to "${status}"`)
      addAudit(`Content ${status}`, `${ids.length} item(s)`, `Bulk status change → ${status}`, status === 'rejected' || status === 'removed' ? 'warn' : 'info')
      setSelectedContent(new Set())
      fetchContent()
    } catch {
      showToast('Action failed', 'error')
    }
  }, [fetchContent, showToast, addAudit])

  const removeContent = useCallback((ids: string[]) => {
    setConfirm({
      message: `Permanently remove ${ids.length} item(s)? This cannot be undone.`,
      onConfirm: async () => {
        setConfirm(null)
        try {
          await adminFetch('/api/admin/content', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: ids }),
          })
          showToast(`Removed ${ids.length} item(s)`)
          addAudit('Content removed', `${ids.length} item(s)`, 'Permanently deleted', 'danger')
          setSelectedContent(new Set())
          fetchContent()
        } catch {
          showToast('Remove failed', 'error')
        }
      },
    })
  }, [fetchContent, showToast, addAudit])

  /* ── chef actions ── */
  const setChefStatus = useCallback(async (id: string, status: ChefStatus) => {
    const chef = chefs.find(c => c.id === id)
    const verb = status === 'banned' ? 'Ban' : status === 'suspended' ? 'Suspend' : 'Restore'
    setConfirm({
      message: `${verb} ${chef?.display_name ?? 'this chef'}?`,
      danger: status !== 'active',
      onConfirm: async () => {
        setConfirm(null)
        try {
          await adminFetch('/api/admin/chefs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
          showToast(`Chef ${verb.toLowerCase()}d`)
          addAudit(`Chef ${status}`, chef?.display_name ?? id, `Status → ${status}`, status === 'banned' ? 'danger' : status === 'suspended' ? 'warn' : 'info')
          fetchChefs()
        } catch { showToast('Action failed', 'error') }
      },
    })
  }, [chefs, fetchChefs, showToast, addAudit])

  const setChefTier = useCallback(async (id: string, tier: 'pro' | 'amateur' | 'user') => {
    const chef = chefs.find(c => c.id === id)
    await adminFetch('/api/admin/chefs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, tier }) })
    setChefs(prev => prev.map(c => c.id === id ? { ...c, tier } : c))
    showToast('Tier updated')
    addAudit('Tier changed', chef?.display_name ?? id, `→ ${tier}`, 'info')
  }, [chefs, showToast, addAudit])

  const toggleChefFeatured = useCallback((id: string, name: string) => {
    setFeaturedChefs(prev => {
      const n = new Set(prev)
      if (n.has(id)) { n.delete(id); showToast('Removed from featured'); addAudit('Chef unfeatured', name, '', 'info') }
      else { n.add(id); showToast('Chef featured on homepage'); addAudit('Chef featured', name, 'Pinned to homepage', 'info') }
      return n
    })
  }, [showToast, addAudit])

  const warnChef = useCallback((id: string, name: string) => {
    setConfirm({
      message: `Send a formal warning to ${name}? They will be notified.`,
      confirmLabel: 'Send Warning',
      danger: false,
      onConfirm: () => {
        setConfirm(null)
        showToast(`Warning sent to ${name}`, 'info')
        addAudit('Chef warned', name, 'Formal warning issued', 'warn')
      },
    })
  }, [showToast, addAudit])

  const saveChefNotes = useCallback(async (id: string, notes: string) => {
    try {
      await adminFetch('/api/admin/chefs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, notes }) })
      showToast('Notes saved'); setEditingChef(null); fetchChefs()
    } catch { showToast('Save failed', 'error') }
  }, [fetchChefs, showToast])

  const bulkChefTierApply = useCallback(async () => {
    if (!bulkChefTier || selectedChefs.size === 0) return
    const tier = bulkChefTier as 'pro' | 'amateur' | 'user'
    await Promise.all(Array.from(selectedChefs).map(id =>
      adminFetch('/api/admin/chefs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, tier }) })
    ))
    setChefs(prev => prev.map(c => selectedChefs.has(c.id) ? { ...c, tier } : c))
    showToast(`${selectedChefs.size} chefs set to "${tier}"`)
    addAudit('Bulk tier change', `${selectedChefs.size} chefs`, `→ ${tier}`, 'warn')
    setSelectedChefs(new Set())
    setBulkChefTier('')
  }, [bulkChefTier, selectedChefs, showToast, addAudit])

  /* ── user actions ── */
  const setUserStatus = useCallback(async (id: string, status: UserStatus) => {
    const user = users.find(u => u.id === id)
    const labels: Record<UserStatus, string> = { active: 'Restaurează', warned: 'Avertizează', blocked: 'Blochează', deleted: 'Șterge' }
    const verb = labels[status]
    setConfirm({
      message: `${verb} ${user?.display_name ?? 'acest utilizator'}?${status === 'deleted' ? ' Această acțiune este ireversibilă.' : ''}`,
      confirmLabel: verb,
      danger: status === 'blocked' || status === 'deleted',
      onConfirm: async () => {
        setConfirm(null)
        try {
          await adminFetch('/api/admin/users', { method: 'PUT', body: JSON.stringify({ id, status }) })
          const statusLabels: Record<UserStatus, string> = { active: 'restaurat', warned: 'avertizat', blocked: 'blocat', deleted: 'șters' }
          showToast(`Utilizator ${statusLabels[status]}`)
          addAudit(`Utilizator ${status}`, user?.display_name ?? id, `Status → ${status}`, status === 'deleted' ? 'danger' : status === 'blocked' ? 'warn' : 'info')
          fetchUsers()
        } catch { showToast('Action failed', 'error') }
      },
    })
  }, [users, fetchUsers, showToast, addAudit])

  const promoteUser = useCallback(async (userId: string, tier: 'amateur' | 'pro') => {
    const user = users.find(u => u.id === userId)
    try {
      await adminFetch('/api/admin/users', { method: 'PUT', body: JSON.stringify({ id: userId, tier }) })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, tier } : u))
      showToast(`${user?.display_name ?? 'Utilizatorul'} a fost promovat la ${tier === 'pro' ? 'bucătar profesionist' : 'amateur'}!`)
      addAudit('Utilizator promovat', user?.display_name ?? userId, `→ ${tier} chef`, 'info')
    } catch { showToast('Promovare eșuată', 'error') }
  }, [users, showToast, addAudit])

  const bulkBlockUsers = useCallback(() => {
    if (selectedUsers.size === 0) return
    setConfirm({
      message: `Blochează ${selectedUsers.size} utilizator(i) selectați?`,
      danger: true,
      onConfirm: async () => {
        setConfirm(null)
        await Promise.all(Array.from(selectedUsers).map(id =>
          adminFetch('/api/admin/users', { method: 'PUT', body: JSON.stringify({ id, status: 'blocked' }) })
        ))
        showToast(`${selectedUsers.size} utilizatori blocați`)
        addAudit('Blocare în masă', `${selectedUsers.size} utilizatori`, '', 'danger')
        setSelectedUsers(new Set())
        fetchUsers()
      },
    })
  }, [selectedUsers, fetchUsers, showToast, addAudit])

  const saveUserNotes = useCallback(async (id: string, notes: string) => {
    try {
      await adminFetch('/api/admin/users', { method: 'PUT', body: JSON.stringify({ id, notes }) })
      showToast('Notițe salvate'); setEditingUser(null); fetchUsers()
    } catch { showToast('Eroare la salvare', 'error') }
  }, [fetchUsers, showToast])

  const toggleModerator = useCallback(async (id: string, currentValue: boolean) => {
    const user = users.find(u => u.id === id)
    const newValue = !currentValue
    try {
      await adminFetch('/api/admin/users', {
        method: 'PATCH',
        body: JSON.stringify({ id, is_moderator: newValue }),
      })
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_moderator: newValue } : u))
      showToast(newValue ? `${user?.display_name ?? 'Utilizatorul'} este acum moderator` : `${user?.display_name ?? 'Utilizatorul'} nu mai este moderator`, 'success')
      addAudit(newValue ? 'Moderator acordat' : 'Moderator revocat', user?.display_name ?? id, '', newValue ? 'warn' : 'info')
    } catch { showToast('Eroare la actualizare', 'error') }
  }, [users, showToast, addAudit])

  /* ── send email placeholder ── */
  const sendEmailPlaceholder = useCallback((userName: string) => {
    showToast('Funcție în dezvoltare', 'info')
    addAudit('Email trimis', userName, 'Funcție în dezvoltare', 'info')
  }, [showToast, addAudit])

  /* ── ban user from report ── */
  const banUserFromReport = useCallback(async (userId: string, userName: string) => {
    setConfirm({
      message: `Suspendă permanent contul lui ${userName}? Această acțiune este definitivă.`,
      confirmLabel: 'Suspendă',
      danger: true,
      onConfirm: async () => {
        setConfirm(null)
        try {
          await adminFetch('/api/admin/users', { method: 'PUT', body: JSON.stringify({ id: userId, status: 'blocked' }) })
          showToast(`${userName} a fost suspendat`)
          addAudit('Utilizator suspendat (din raport)', userName, '', 'danger')
        } catch { showToast('Eroare la suspendare', 'error') }
      },
    })
  }, [showToast, addAudit])

  /* ── report actions ── */
  const dismissReport = useCallback(async (id: string, title: string) => {
    try {
      await adminFetch('/api/reports', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'closed' }) })
    } catch { /* ignore */ }
    setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'dismissed' as const } : r))
    showToast('Raport respins', 'info')
    addAudit('Raport respins', title, '', 'info')
  }, [showToast, addAudit])

  const actionReport = useCallback((id: string, title: string) => {
    setConfirm({
      message: `Remove reported content "${title}"?`,
      danger: true,
      onConfirm: () => {
        setConfirm(null)
        setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'actioned' as const } : r))
        showToast('Content removed and report resolved')
        addAudit('Report actioned', title, 'Content removed', 'danger')
      },
    })
  }, [showToast, addAudit])

  const bulkDismissReports = useCallback(() => {
    if (selectedReports.size === 0) return
    setReports(prev => prev.map(r => selectedReports.has(r.id) ? { ...r, status: 'dismissed' as const } : r))
    showToast(`${selectedReports.size} reports dismissed`, 'info')
    addAudit('Bulk dismiss', `${selectedReports.size} reports`, '', 'info')
    setSelectedReports(new Set())
   }, [selectedReports, showToast, addAudit])

  const removeSanction = useCallback(async (id: string, userName: string) => {
    setConfirm({
      message: `Revocă sancțiunea pentru ${userName}?`,
      confirmLabel: 'Revocă',
      danger: false,
      onConfirm: async () => {
        setConfirm(null)
        try {
          await adminFetch('/api/admin/sanctions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
          setSanctions(prev => prev.filter(s => s.id !== id))
          showToast(`Sancțiune revocată pentru ${userName}`)
          addAudit('Sancțiune revocată', userName, '', 'info')
        } catch { showToast('Eroare la revocare', 'error') }
      }
    })
  }, [showToast, addAudit])

  /* ── select helpers ── */
  const toggleSelectContent  = (id: string) => setSelectedContent(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selectAllContent     = () => setSelectedContent(selectedContent.size === content.length ? new Set() : new Set(content.map(c => c.id)))
  const toggleSelectChef     = (id: string) => setSelectedChefs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selectAllChefs       = () => setSelectedChefs(selectedChefs.size === chefs.length ? new Set() : new Set(chefs.map(c => c.id)))
  const toggleSelectUser     = (id: string) => setSelectedUsers(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selectAllUsers       = () => setSelectedUsers(selectedUsers.size === users.length ? new Set() : new Set(users.map(u => u.id)))
  const toggleSelectReport   = (id: string) => setSelectedReports(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  /* ── derived ── */
  const filteredReports = reports.filter(r =>
    (reportCategory === 'all' || r.category === reportCategory) && r.status === 'open'
  )
  const openReportCount = reports.filter(r => r.status === 'open').length

  /* ─────────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────────── */

  // Auth loading state
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0d0d' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: '#ff4d6d', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: '#555' }}>Se verifică accesul...</p>
        </div>
      </div>
    )
  }

  // Access denied — show debug info to help diagnose
  if (!isAdminUser) {
    // Collect debug info
    let debugInfo = '';
    try {
      const sbKeys = Object.keys(localStorage).filter(k => k.startsWith('sb-'));
      const hasToken = sbKeys.some(k => {
        try { return !!JSON.parse(localStorage.getItem(k) || '{}')?.access_token } catch { return false }
      });
      debugInfo = `Keys: ${sbKeys.join(', ') || 'none'} | Token: ${hasToken ? 'yes' : 'no'} | Email: ${authEmail || 'null'}`;
    } catch { debugInfo = 'localStorage error'; }

    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0d0d' }}>
        <div className="text-center max-w-sm mx-auto px-6">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="ff-display text-2xl font-bold mb-2" style={{ color: '#f0f0f0' }}>Acces Restricționat</h1>
          <p className="text-sm mb-6" style={{ color: '#555' }}>
            {authEmail
              ? `Contul ${authEmail} nu are acces la panoul de administrare.`
              : 'Trebuie să fii autentificat cu un cont de administrator.'}
          </p>
          <p className="text-xs mb-4" style={{ color: '#333', fontFamily: 'monospace', wordBreak: 'break-all' }}>{debugInfo}
          </p>
          <Link href="/" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff' }}>
            Înapoi la site
          </Link>
        </div>
      </div>
    )
  }

  const TABS: { id: AdminTab; label: string; icon: string }[] = [
    { id: 'dashboard',  label: 'Panou Principal', icon: '📊' },
    { id: 'content',    label: 'Conținut',        icon: '🍽️' },
    { id: 'chefs',      label: 'Bucătari',        icon: '👨‍🍳' },
    { id: 'users',      label: 'Utilizatori',     icon: '👥' },
    { id: 'reports',    label: 'Rapoarte',        icon: '🚩' },
    { id: 'statistici', label: 'Statistici',      icon: '📉' },
    { id: 'analytics',  label: 'Analiză',         icon: '📈' },
    { id: 'settings',   label: 'Setări',          icon: '⚙️' },
    { id: 'audit',      label: 'Jurnal Audit',    icon: '🗂️' },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@400;500;600&display=swap');
        .ff-display { font-family: 'Syne', sans-serif; }
        .ff-body { font-family: 'Inter', sans-serif; }
        .admin-row { transition: background 0.15s; }
        .admin-row:hover { background: rgba(255,255,255,0.04) !important; }
        .admin-input { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #f0f0f0; border-radius: 10px; padding: 8px 12px; font-size: 13px; outline: none; width: 100%; }
        .admin-input:focus { border-color: rgba(255,149,0,0.5); }
        .admin-input::placeholder { color: #555; }
        .chip { display: inline-flex; align-items: center; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid; transition: all 0.15s; }
        .action-btn { padding: 5px 10px; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; border: 1px solid; transition: all 0.15s; white-space: nowrap; }
      `}</style>

      <div className="ff-body min-h-screen" style={{ background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>

        {/* ── Top bar ── */}
        <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4"
          style={{ background: 'rgba(13,13,13,0.92)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
           <div className="flex items-center gap-3">
             <Link href="/" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">← Înapoi la site</Link>
             <span className="text-gray-700">|</span>
             <span className="ff-display text-xl font-bold" style={{ background: 'linear-gradient(90deg,#ff4d6d,#ff9500)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
               Panou Administrare
             </span>
           </div>
           <div className="flex items-center gap-3">
             {auditLog.length > 0 && (
               <button onClick={() => setTab('audit')} className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
                 style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' }}>
                 🗂️ {auditLog.length} acțiuni înregistrate
               </button>
             )}
             {authEmail && (
               <span className="text-xs hidden md:block" style={{ color: '#555' }}>{authEmail}</span>
             )}
             <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
               style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
               Admin
             </div>
           </div>
        </header>

        {/* ── Quick actions bar ── */}
        <div className="flex flex-wrap gap-2 px-6 py-3 border-b" style={{ background: 'rgba(13,13,13,0.7)', borderColor: 'rgba(255,255,255,0.05)' }}>
          <span className="text-xs font-bold uppercase tracking-widest self-center mr-1" style={{ color: '#444' }}>Acțiuni Rapide:</span>
          <a href="/admin" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{ background: 'linear-gradient(135deg,rgba(255,77,109,0.2),rgba(255,149,0,0.2))', color: '#ff9500', border: '1px solid rgba(255,149,0,0.3)', textDecoration: 'none' }}>
            Importă rețete
          </a>
          <a href="/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#aaa', border: '1px solid rgba(255,255,255,0.1)', textDecoration: 'none' }}>
            Verifică site-ul
          </a>
          <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{ background: 'rgba(66,133,244,0.12)', color: '#60a5fa', border: '1px solid rgba(66,133,244,0.25)', textDecoration: 'none' }}>
            Google Analytics
          </a>
          <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{ background: 'rgba(62,207,142,0.12)', color: '#34d399', border: '1px solid rgba(62,207,142,0.25)', textDecoration: 'none' }}>
            Supabase
          </a>
        </div>

        {/* ── Tab nav ── */}
        <div className="flex gap-1 px-6 pt-5 pb-0 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex-shrink-0"
              style={tab === t.id
                ? { background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }
                : { background: 'transparent', color: '#666', border: '1px solid transparent' }}>
              <span>{t.icon}</span>
              {t.label}
              {t.id === 'content' && stats?.pendingReview ? (
                <span className="ml-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ background: '#ff4d6d', color: '#fff' }}>{stats.pendingReview}</span>
              ) : null}
              {t.id === 'reports' && openReportCount > 0 ? (
                <span className="ml-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ background: '#ff9500', color: '#fff' }}>{openReportCount}</span>
              ) : null}
              {t.id === 'audit' && auditLog.length > 0 ? (
                <span className="ml-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ background: '#3b82f6', color: '#fff' }}>{auditLog.length}</span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="px-6 py-6">

          {/* ════════════════════════════════
              DASHBOARD TAB
          ════════════════════════════════ */}
           {tab === 'dashboard' && (
             <div>
               <h2 className="ff-display text-2xl font-bold mb-6">Privire Generală</h2>

               {!stats ? (
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                   {Array.from({ length: 8 }).map((_, i) => (
                     <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: '#1a1a1a' }} />
                   ))}
                 </div>
               ) : (
                 <>
                   {/* User stats */}
                   <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                     <StatCard label="Total Utilizatori"  value={stats.totalUsers}              sub="înregistrați" accent="#3b82f6" />
                     <StatCard label="Utilizatori Noi (7 zile)" value={stats.newUsersThisWeek}  sub="această săptămână" accent="#22c55e" />
                     <StatCard label="Activi (7 zile)"   value={stats.activeUsersLast7Days}     sub="ultimele 7 zile" accent="#ff9500" />
                   </div>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                     <StatCard label="Total Rețete"   value={stats.totalRecipes}   sub="total" />
                     <StatCard label="În Așteptare"  value={stats.pendingReview}  sub="necesită acțiune" accent="#ff9500" />
                     <StatCard label="Bucătari Activi"    value={stats.activeChefs}    sub="creatori" />
                     <StatCard label="Conturi Banate" value={stats.bannedChefs}    sub="eliminați" accent="#ef4444" />
                   </div>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                     <StatCard label="Total Voturi"   value={stats.totalVotes.toLocaleString()} sub="interacțiune comunitate" />
                     <StatCard label="Comentarii"      value={stats.totalComments}  sub="toate postările" />
                     <StatCard label="Rapoarte Deschise"  value={openReportCount}      sub="conținut semnalat" accent="#f59e0b" />
                     <StatCard label="Creștere Săptămânală" value={`+${stats.weeklyGrowth}%`} sub="utilizatori noi" accent="#22c55e" />
                   </div>

                   <div className="grid md:grid-cols-2 gap-4 mb-6">
                     {/* Today's activity */}
                     <div className="rounded-2xl p-5" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.07)' }}>
                       <h3 className="ff-display font-bold mb-4 text-sm uppercase tracking-widest" style={{ color: '#555' }}>Activitatea de Azi</h3>
                       <div className="grid grid-cols-3 gap-4">
                         <div className="text-center">
                           <div className="text-2xl font-bold text-emerald-400">{stats.approvedToday}</div>
                           <div className="text-xs mt-1" style={{ color: '#555' }}>Aprobate</div>
                         </div>
                         <div className="text-center">
                           <div className="text-2xl font-bold text-red-400">{stats.rejectedToday}</div>
                           <div className="text-xs mt-1" style={{ color: '#555' }}>Respinse</div>
                         </div>
                         <div className="text-center">
                           <div className="text-2xl font-bold text-blue-400">{stats.newUsersToday}</div>
                           <div className="text-xs mt-1" style={{ color: '#555' }}>Utilizatori Noi</div>
                         </div>
                       </div>
                    </div>

                     {/* Recent audit activity */}
                     <div className="rounded-2xl p-5" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.07)' }}>
                       <h3 className="ff-display font-bold mb-3 text-sm uppercase tracking-widest" style={{ color: '#555' }}>Acțiuni Recente</h3>
                       {auditLog.length === 0 ? (
                         <p className="text-xs" style={{ color: '#444' }}>Nicio acțiune în această sesiune.</p>
                       ) : (
                         <div className="space-y-2">
                           {auditLog.slice(0, 5).map(e => (
                             <div key={e.id} className="flex items-center gap-2 text-xs">
                               <span style={{ color: e.severity === 'danger' ? '#ef4444' : e.severity === 'warn' ? '#f59e0b' : '#3b82f6', fontSize: 12 }}>
                                 {e.severity === 'danger' ? '🔴' : e.severity === 'warn' ? '🟡' : '🔵'}
                               </span>
                               <span className="font-semibold" style={{ color: '#ccc' }}>{e.action}</span>
                               <span style={{ color: '#555' }}>{e.target}</span>
                               <span className="ml-auto" style={{ color: '#444' }}>{new Date(e.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                             </div>
                           ))}
                           {auditLog.length > 5 && (
                             <button onClick={() => setTab('audit')} className="text-xs mt-1" style={{ color: '#ff9500' }}>
                               Vezi toate {auditLog.length} intrările →
                             </button>
                           )}
                         </div>
                       )}
                     </div>
                   </div>

                   {/* Quick actions */}
                   <div className="flex flex-wrap gap-3">
                     <button onClick={() => setTab('content')}
                       className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                       style={{ background: 'rgba(255,149,0,0.15)', color: '#ff9500', border: '1px solid rgba(255,149,0,0.3)' }}>
                       🍽️ Verifică {stats.pendingReview} rețete în așteptare
                     </button>
                     <button onClick={() => setTab('reports')}
                       className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                       style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                       🚩 Verifică {openReportCount} rapoarte deschise
                     </button>
                     <button onClick={() => setTab('chefs')}
                       className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                       style={{ background: 'rgba(255,255,255,0.07)', color: '#ccc', border: '1px solid rgba(255,255,255,0.1)' }}>
                       👨‍🍳 Gestionare bucătari
                     </button>
                     <button onClick={() => setTab('users')}
                       className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                       style={{ background: 'rgba(255,255,255,0.07)', color: '#ccc', border: '1px solid rgba(255,255,255,0.1)' }}>
                       👥 Gestionare utilizatori
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ════════════════════════════════
              CONTENT TAB
          ════════════════════════════════ */}
           {tab === 'content' && (
             <div>
               <div className="flex items-center justify-between mb-5">
                 <h2 className="ff-display text-2xl font-bold">Moderare Conținut</h2>
                 <span className="text-xs" style={{ color: '#555' }}>{content.length} elemente</span>
               </div>

               {/* Content counts summary */}
               {stats && (
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                   <StatCard label="Total Rețete"     value={stats.totalRecipes}  sub="rețete active" accent="#ff4d6d" />
                   <StatCard label="În Așteptare"     value={stats.pendingReview} sub="necesită acțiune" accent="#ff9500" />
                   <StatCard label="Semnalate"        value={stats.reportedContent} sub="rapoarte deschise" accent="#f59e0b" />
                   <StatCard label="Aprobate Azi"     value={stats.approvedToday} sub="astăzi" accent="#22c55e" />
                 </div>
               )}

               {/* Recent content (last 10) info box */}
               <div className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl text-xs"
                 style={{ background: 'rgba(255,149,0,0.06)', border: '1px solid rgba(255,149,0,0.15)', color: '#888' }}>
                 Listând cele mai recente {content.length} elemente. Folosiți căutarea și filtrele pentru a găsi conținut specific.
               </div>

               <div className="flex flex-wrap gap-3 mb-5">
                 <input
                   className="admin-input"
                   style={{ maxWidth: 260 }}
                   placeholder="Caută titlu sau bucătar…"
                   value={contentSearch}
                   onChange={e => setContentSearch(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && fetchContent()}
                 />
                {(['all', 'active', 'pending', 'rejected', 'removed'] as const).map(s => (
                  <button key={s} onClick={() => setContentFilter(s)}
                    className="chip"
                    style={contentFilter === s
                      ? { background: 'rgba(255,149,0,0.2)', color: '#ff9500', borderColor: 'rgba(255,149,0,0.4)' }
                      : { background: 'rgba(255,255,255,0.05)', color: '#777', borderColor: 'rgba(255,255,255,0.1)' }}>
                    {s}
                  </button>
                ))}
              </div>

               {selectedContent.size > 0 && (
                 <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-xl"
                   style={{ background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.25)' }}>
                   <span className="text-sm font-semibold text-amber-400">{selectedContent.size} selectate</span>
                   <div className="flex gap-2 ml-auto">
                     <button onClick={() => setContentStatus(Array.from(selectedContent), 'active')}
                       className="action-btn"
                       style={{ background: 'rgba(34,197,94,0.2)', color: '#22c55e', borderColor: 'rgba(34,197,94,0.3)' }}>
                       ✓ Aprobă tot
                     </button>
                     <button onClick={() => setContentStatus(Array.from(selectedContent), 'rejected')}
                       className="action-btn"
                       style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>
                       ✕ Respinge tot
                     </button>
                     <button onClick={() => removeContent(Array.from(selectedContent))}
                       className="action-btn"
                       style={{ background: 'rgba(239,68,68,0.3)', color: '#fca5a5', borderColor: 'rgba(239,68,68,0.4)' }}>
                       🗑 Elimină tot
                     </button>
                   </div>
                 </div>
               )}

              {contentLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: '#1a1a1a' }} />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                   <div className="grid gap-4 px-4 py-3 text-xs font-bold uppercase tracking-wider"
                     style={{ background: '#161616', color: '#444', gridTemplateColumns: '36px 56px 1fr 120px 80px 80px 160px' }}>
                     <label className="flex items-center cursor-pointer">
                       <input type="checkbox" checked={selectedContent.size === content.length && content.length > 0}
                         onChange={selectAllContent} style={{ accentColor: '#ff9500' }} />
                     </label>
                     <span></span>
                     <span>Titlu / Bucătar</span>
                     <span>Stare</span>
                     <span>Voturi</span>
                     <span>Dată</span>
                     <span>Acțiuni</span>
                   </div>

                   {content.length === 0 && (
                     <div className="py-12 text-center text-sm" style={{ color: '#555' }}>Niciun conținut găsit</div>
                   )}

                  {content.map(item => (
                    <div key={item.id}>
                      <div
                        className="admin-row grid gap-4 px-4 py-3 items-center"
                        style={{ gridTemplateColumns: '36px 56px 1fr 120px 80px 80px 160px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'transparent' }}>
                        <label className="flex items-center cursor-pointer">
                          <input type="checkbox" checked={selectedContent.has(item.id)}
                            onChange={() => toggleSelectContent(item.id)} style={{ accentColor: '#ff9500' }} />
                        </label>
                          <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 relative">
                            <FallbackImage src={item.hero_image_url} alt="" fill className="object-cover" sizes="48px" fallbackEmoji="🍽️" />
                         </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">{item.title}</div>
                           <div className="text-xs truncate flex items-center gap-1.5 mt-0.5" style={{ color: '#666' }}>
                              {item.created_by.avatar_url && (
                                <FallbackImage src={item.created_by.avatar_url} alt="" width={16} height={16} className="w-4 h-4 rounded-full object-cover" fallbackEmoji="👨‍🍳" />
                             )}
                             {item.created_by.display_name}
                           </div>
                        </div>
                        <Badge status={item.status} />
                        <span className="text-sm" style={{ color: '#888' }}>❤️ {item.votes}</span>
                        <span className="text-xs" style={{ color: '#555' }}>{new Date(item.created_at).toLocaleDateString()}</span>
                        <div className="flex gap-1.5 flex-wrap">
                          <button onClick={() => setPreviewItem(previewItem?.id === item.id ? null : item)}
                            className="action-btn"
                            style={{ background: 'rgba(255,255,255,0.07)', color: '#aaa', borderColor: 'rgba(255,255,255,0.1)' }}>
                            {previewItem?.id === item.id ? 'Close' : 'Preview'}
                          </button>
                          {item.status !== 'active' && (
                            <button onClick={() => setContentStatus([item.id], 'active')}
                              className="action-btn"
                              style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', borderColor: 'rgba(34,197,94,0.25)' }}>
                              ✓ Approve
                            </button>
                          )}
                          {item.status !== 'rejected' && (
                            <button onClick={() => setContentStatus([item.id], 'rejected')}
                              className="action-btn"
                              style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', borderColor: 'rgba(239,68,68,0.25)' }}>
                              Reject
                            </button>
                          )}
                          {item.status !== 'removed' && (
                            <button onClick={() => removeContent([item.id])}
                              className="action-btn"
                              style={{ background: 'rgba(239,68,68,0.25)', color: '#fca5a5', borderColor: 'rgba(239,68,68,0.35)' }}>
                              🗑 Remove
                            </button>
                          )}
                        </div>
                      </div>
                       {previewItem?.id === item.id && (
                          <div className="mx-3 mb-3 rounded-2xl p-5 flex gap-5"
                            style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <FallbackImage src={item.hero_image_url} alt="" width={160} height={128} className="object-cover rounded-xl flex-shrink-0" fallbackEmoji="🍽️" />
                           <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="ff-display font-bold text-lg">{item.title}</span>
                              <Badge status={item.status} />
                            </div>
                            <div className="flex gap-4 text-xs mb-3" style={{ color: '#666' }}>
                              <span>Region: {item.region}</span>
                              <span>Votes: {item.votes}</span>
                              <span>Comments: {item.comments}</span>
                              {item.quality_score != null && <span>Score: ⭐{item.quality_score}</span>}
                              {item.is_tested && <span className="text-emerald-500">✓ Tested</span>}
                            </div>
                            <div className="flex gap-2 flex-wrap mb-3">
                              {item.dietTags.map(t => (
                                <span key={t} className="text-[11px] px-2 py-0.5 rounded-full"
                                  style={{ background: 'rgba(255,255,255,0.08)', color: '#aaa' }}>{t}</span>
                              ))}
                            </div>
                            <Link href={`/recipes/${item.slug}`} target="_blank"
                              className="text-xs font-semibold" style={{ color: '#ff9500' }}>
                              Open recipe page →
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════
              CHEFS TAB
          ════════════════════════════════ */}
          {tab === 'chefs' && (
             <div>
               <div className="flex items-center justify-between mb-5">
                 <h2 className="ff-display text-2xl font-bold">Gestionare Bucătari</h2>
                 <span className="text-xs" style={{ color: '#555' }}>{chefs.length} bucătari</span>
               </div>

               <div className="flex flex-wrap gap-3 mb-5">
                 <input
                   className="admin-input"
                   style={{ maxWidth: 260 }}
                   placeholder="Caută nume sau handle…"
                   value={chefSearch}
                   onChange={e => setChefSearch(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && fetchChefs()}
                 />
                {(['all', 'active', 'suspended', 'banned'] as const).map(s => (
                  <button key={s} onClick={() => setChefFilter(s)}
                    className="chip"
                    style={chefFilter === s
                      ? { background: 'rgba(255,149,0,0.2)', color: '#ff9500', borderColor: 'rgba(255,149,0,0.4)' }
                      : { background: 'rgba(255,255,255,0.05)', color: '#777', borderColor: 'rgba(255,255,255,0.1)' }}>
                    {s}
                  </button>
                ))}
              </div>

               {/* Bulk chef actions bar */}
               {selectedChefs.size > 0 && (
                 <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-xl flex-wrap"
                   style={{ background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.2)' }}>
                   <span className="text-sm font-semibold text-amber-400">{selectedChefs.size} selectați</span>
                   <div className="flex items-center gap-2 ml-auto flex-wrap">
                     <select
                       value={bulkChefTier}
                       onChange={e => setBulkChefTier(e.target.value as 'pro' | 'amateur' | 'user' | '')}
                       className="admin-input"
                       style={{ width: 'auto', padding: '4px 10px', fontSize: 12 }}>
                       <option value="">Setează nivel…</option>
                       <option value="pro">🔴 Pro</option>
                       <option value="amateur">⬜ Amateur</option>
                       <option value="user">○ User</option>
                     </select>
                     <button onClick={bulkChefTierApply} disabled={!bulkChefTier}
                       className="action-btn"
                       style={{ background: bulkChefTier ? 'rgba(255,149,0,0.2)' : 'rgba(255,255,255,0.05)', color: bulkChefTier ? '#ff9500' : '#555', borderColor: 'rgba(255,149,0,0.3)' }}>
                       Aplică nivel
                     </button>
                    <button onClick={() => setSelectedChefs(new Set())}
                      className="action-btn"
                      style={{ background: 'rgba(255,255,255,0.07)', color: '#aaa', borderColor: 'rgba(255,255,255,0.1)' }}>
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {chefsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: '#1a1a1a' }} />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Select-all header */}
                  {chefs.length > 0 && (
                    <div className="flex items-center gap-3 px-2 pb-1">
                      <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: '#555' }}>
                        <input type="checkbox"
                          checked={selectedChefs.size === chefs.length && chefs.length > 0}
                          onChange={selectAllChefs}
                          style={{ accentColor: '#ff9500' }} />
                        Select all
                      </label>
                    </div>
                  )}
                  {chefs.length === 0 && (
                    <div className="py-12 text-center text-sm" style={{ color: '#555' }}>No chefs found</div>
                  )}
                  {chefs.map(chef => (
                    <div key={chef.id}>
                      <div className="admin-row rounded-2xl px-5 py-4 flex items-center gap-4"
                        style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.07)' }}>
                        {/* select */}
                        <input type="checkbox" checked={selectedChefs.has(chef.id)} onChange={() => toggleSelectChef(chef.id)}
                          style={{ accentColor: '#ff9500', flexShrink: 0 }} />

                         {/* avatar */}
                         <div className="relative flex-shrink-0">
                           <Image
                             src={chef.avatar_url ?? `https://i.pravatar.cc/80?u=${chef.id}`}
                             alt={chef.display_name}
                             width={56}
                             height={56}
                             className="w-14 h-14 rounded-full object-cover"
                             style={{ border: chef.status === 'banned' ? '2px solid #ef4444' : chef.status === 'suspended' ? '2px solid #f59e0b' : '2px solid rgba(255,255,255,0.1)' }}
                           />
                          {featuredChefs.has(chef.id) && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                              style={{ background: '#ff9500' }}>⭐</div>
                          )}
                          {chef.status === 'banned' && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                              style={{ background: '#ef4444' }}>🚫</div>
                          )}
                        </div>

                        {/* info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold">{chef.display_name}</span>
                            <Badge status={chef.status} />
                            {chef.tier === 'pro' && <span title="Pro" style={{ fontSize: 11 }}>🔴 Pro</span>}
                            {chef.tier === 'amateur' && <span title="Amateur" style={{ fontSize: 11, opacity: 0.7 }}>⬜ Amat.</span>}
                            {featuredChefs.has(chef.id) && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                                style={{ background: 'rgba(255,149,0,0.2)', color: '#ff9500', border: '1px solid rgba(255,149,0,0.3)' }}>
                                ⭐ Featured
                              </span>
                            )}
                          </div>
                          <div className="text-xs flex gap-4 flex-wrap" style={{ color: '#666' }}>
                            <span>{chef.handle}</span>
                            <span>📖 {chef.recipe_count} recipes</span>
                            <span>❤️ {chef.total_votes.toLocaleString()} votes</span>
                            <span>👥 {chef.followers >= 1000 ? `${Math.round(chef.followers / 1000)}K` : chef.followers} followers</span>
                            <span>Joined {new Date(chef.joined_at).toLocaleDateString()}</span>
                          </div>
                          {chef.notes && (
                            <div className="mt-1.5 text-xs px-2 py-1 rounded-lg inline-block"
                              style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
                              📝 {chef.notes}
                            </div>
                          )}
                        </div>

                        {/* actions */}
                        <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end" style={{ maxWidth: 300 }}>
                          {/* Tier selector */}
                          <div className="flex gap-1 mr-1">
                            {(['user', 'amateur', 'pro'] as const).map(t => (
                              <button key={t} onClick={() => setChefTier(chef.id, t)}
                                className="px-2 py-1 rounded-lg text-[10px] font-bold transition-all"
                                style={chef.tier === t
                                  ? t === 'pro'
                                    ? { background: 'rgba(255,77,109,0.3)', color: '#ff4d6d', border: '1px solid rgba(255,77,109,0.5)' }
                                    : t === 'amateur'
                                      ? { background: 'rgba(224,224,224,0.2)', color: '#e0e0e0', border: '1px solid rgba(255,255,255,0.4)' }
                                      : { background: 'rgba(255,255,255,0.12)', color: '#888', border: '1px solid rgba(255,255,255,0.2)' }
                                  : { background: 'rgba(255,255,255,0.04)', color: '#444', border: '1px solid rgba(255,255,255,0.07)' }}>
                                {t === 'pro' ? '🔴' : t === 'amateur' ? '⬜' : '○'}
                              </button>
                            ))}
                          </div>
                          <Link href={`/chefs/${chef.handle.replace('@', '')}`} target="_blank"
                            className="action-btn flex items-center"
                            style={{ background: 'rgba(255,255,255,0.06)', color: '#888', borderColor: 'rgba(255,255,255,0.1)', textDecoration: 'none' }}>
                            👁 View
                          </Link>
                          <button
                            onClick={() => toggleChefFeatured(chef.id, chef.display_name)}
                            className="action-btn"
                            style={featuredChefs.has(chef.id)
                              ? { background: 'rgba(255,149,0,0.2)', color: '#ff9500', borderColor: 'rgba(255,149,0,0.4)' }
                              : { background: 'rgba(255,255,255,0.06)', color: '#888', borderColor: 'rgba(255,255,255,0.1)' }}>
                            {featuredChefs.has(chef.id) ? '★ Unfeature' : '☆ Feature'}
                          </button>
                          <button
                            onClick={() => warnChef(chef.id, chef.display_name)}
                            className="action-btn"
                            style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', borderColor: 'rgba(245,158,11,0.3)' }}>
                            ⚠️ Warn
                          </button>
                          <button
                            onClick={() => { setEditingChef(editingChef?.id === chef.id ? null : chef); setChefNotesDraft(chef.notes) }}
                            className="action-btn"
                            style={{ background: 'rgba(255,255,255,0.07)', color: '#aaa', borderColor: 'rgba(255,255,255,0.1)' }}>
                            📝 Notes
                          </button>
                          {chef.status === 'active' && (
                            <button onClick={() => setChefStatus(chef.id, 'suspended')}
                              className="action-btn"
                              style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', borderColor: 'rgba(245,158,11,0.3)' }}>
                              ⏸ Suspend
                            </button>
                          )}
                          {chef.status === 'suspended' && (
                            <button onClick={() => setChefStatus(chef.id, 'active')}
                              className="action-btn"
                              style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', borderColor: 'rgba(34,197,94,0.3)' }}>
                              ▶ Restore
                            </button>
                          )}
                          {chef.status !== 'banned' && (
                            <button onClick={() => setChefStatus(chef.id, 'banned')}
                              className="action-btn"
                              style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>
                              🚫 Ban
                            </button>
                          )}
                          {chef.status === 'banned' && (
                            <button onClick={() => setChefStatus(chef.id, 'active')}
                              className="action-btn"
                              style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', borderColor: 'rgba(34,197,94,0.3)' }}>
                              ✓ Unban
                            </button>
                          )}
                        </div>
                      </div>

                      {/* inline notes editor */}
                      {editingChef?.id === chef.id && (
                        <div className="mx-2 mb-2 px-4 py-4 rounded-b-2xl"
                          style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.07)', borderTop: 'none' }}>
                          <label className="block text-xs font-semibold mb-2" style={{ color: '#777' }}>Internal notes (not visible to chef)</label>
                          <textarea
                            className="admin-input resize-none"
                            rows={3}
                            value={chefNotesDraft}
                            onChange={e => setChefNotesDraft(e.target.value)}
                            placeholder="Add moderation notes, reason for action, etc…"
                          />
                          <div className="flex gap-2 mt-3 justify-end">
                            <button onClick={() => setEditingChef(null)}
                              className="px-4 py-1.5 rounded-lg text-xs font-semibold"
                              style={{ background: 'rgba(255,255,255,0.07)', color: '#777' }}>
                              Cancel
                            </button>
                            <button onClick={() => saveChefNotes(chef.id, chefNotesDraft)}
                              className="px-4 py-1.5 rounded-lg text-xs font-semibold"
                              style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff' }}>
                              Save notes
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════
              USERS TAB
          ════════════════════════════════ */}
           {tab === 'users' && (
             <div>
               <div className="flex items-center justify-between mb-5">
                 <h2 className="ff-display text-2xl font-bold">Gestionare Utilizatori</h2>
                 <span className="text-sm" style={{ color: '#555' }}>{users.length} utilizatori</span>
               </div>
               <div className="flex gap-3 mb-4 flex-wrap">
                 <input className="admin-input flex-1 min-w-[180px]" placeholder="Caută utilizatori…"
                   value={userSearch} onChange={e => setUserSearch(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && fetchUsers()} />
                 {([
                   { id: 'all',        label: 'Toți' },
                   { id: 'active',     label: '✓ Activi' },
                   { id: 'admins',     label: 'Admini' },
                   { id: 'moderators', label: 'Moderatori' },
                   { id: 'banned',     label: '🚫 Suspendați' },
                   { id: 'warned',     label: '⚠️ Avertizați' },
                   { id: 'deleted',    label: '🗑 Șterși' },
                 ] as const).map(s => (
                   <button key={s.id} onClick={() => setUserFilter(s.id)} className="chip"
                     style={userFilter === s.id
                       ? s.id === 'admins'
                         ? { background: 'rgba(255,77,109,0.2)', color: '#ff4d6d', borderColor: 'rgba(255,77,109,0.4)' }
                         : s.id === 'moderators'
                           ? { background: 'rgba(59,130,246,0.2)', color: '#60a5fa', borderColor: 'rgba(59,130,246,0.4)' }
                           : s.id === 'banned'
                             ? { background: 'rgba(239,68,68,0.2)', color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)' }
                             : { background: 'rgba(255,149,0,0.2)', color: '#ff9500', borderColor: 'rgba(255,149,0,0.4)' }
                       : { background: 'rgba(255,255,255,0.04)', color: '#666', borderColor: 'rgba(255,255,255,0.08)' }}>
                     {s.label}
                   </button>
                 ))}
               </div>

               {/* Bulk user actions bar */}
               {selectedUsers.size > 0 && (
                 <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-xl flex-wrap"
                   style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                   <span className="text-sm font-semibold" style={{ color: '#ef4444' }}>{selectedUsers.size} selectați</span>
                   <div className="flex gap-2 ml-auto">
                     <button onClick={bulkBlockUsers}
                       className="action-btn"
                       style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>
                       🚫 Blochează tot
                     </button>
                     <button onClick={() => setSelectedUsers(new Set())}
                       className="action-btn"
                       style={{ background: 'rgba(255,255,255,0.07)', color: '#aaa', borderColor: 'rgba(255,255,255,0.1)' }}>
                       Șterge
                     </button>
                   </div>
                 </div>
               )}

               {usersLoading ? (
                 <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: '#1a1a1a' }} />)}</div>
               ) : users.length === 0 ? (
                 <div className="py-12 text-center text-sm" style={{ color: '#555' }}>Niciun utilizator găsit</div>
               ) : (
                 <div className="space-y-3">
                   {/* Select-all */}
                   <div className="flex items-center gap-3 px-2 pb-1">
                     <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: '#555' }}>
                       <input type="checkbox"
                         checked={selectedUsers.size === users.length && users.length > 0}
                         onChange={selectAllUsers} style={{ accentColor: '#ff9500' }} />
                       Selectează tot
                     </label>
                   </div>
                  {users.map(user => (
                    <div key={user.id}>
                      <div className="admin-row rounded-2xl px-5 py-4 flex items-center gap-4"
                        style={{ background: '#161616', border: user.status === 'blocked' || user.status === 'deleted' ? '1px solid rgba(239,68,68,0.25)' : user.status === 'warned' ? '1px solid rgba(245,158,11,0.25)' : '1px solid rgba(255,255,255,0.07)' }}>

                        {/* select */}
                        <input type="checkbox" checked={selectedUsers.has(user.id)} onChange={() => toggleSelectUser(user.id)}
                          style={{ accentColor: '#ff9500', flexShrink: 0 }} />

                         <div className="relative flex-shrink-0">
                           <Image src={user.avatar_url ?? `https://i.pravatar.cc/80?u=${user.id}`} alt={user.display_name}
                             width={48}
                             height={48}
                             className="w-12 h-12 rounded-full object-cover"
                             style={{ border: user.status === 'blocked' ? '2px solid #ef4444' : user.status === 'warned' ? '2px solid #f59e0b' : '2px solid rgba(255,255,255,0.1)' }} />
                          {(user.status === 'blocked' || user.status === 'deleted') && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px]" style={{ background: '#ef4444' }}>🚫</div>
                          )}
                          {user.status === 'warned' && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px]" style={{ background: '#f59e0b' }}>⚠</div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="font-bold">{user.display_name}</span>
                            <Badge status={user.status} />
                            {user.is_admin && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                                style={{ background: 'rgba(255,77,109,0.2)', color: '#ff4d6d', border: '1px solid rgba(255,77,109,0.4)' }}>
                                Admin
                              </span>
                            )}
                            {user.is_moderator && !user.is_admin && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                                style={{ background: 'rgba(59,130,246,0.2)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.4)' }}>
                                Moderator
                              </span>
                            )}
                            {user.tier && user.tier !== 'user' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                                style={{ background: user.tier === 'pro' ? 'rgba(255,77,109,0.2)' : 'rgba(255,255,255,0.1)', color: user.tier === 'pro' ? '#ff4d6d' : '#ccc', border: '1px solid rgba(255,255,255,0.15)' }}>
                                {user.tier === 'pro' ? 'Pro Chef' : 'Amateur'}
                              </span>
                            )}
                          </div>
                          <div className="text-xs flex gap-3 flex-wrap" style={{ color: '#666' }}>
                            <span>{user.handle}</span>
                            <span style={{ color: '#444' }}>{user.email}</span>
                            {user.provider && user.provider !== 'email' && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                                style={{ background: 'rgba(66,133,244,0.15)', color: '#60a5fa', border: '1px solid rgba(66,133,244,0.3)' }}>
                                {user.provider === 'google' ? 'Google' : user.provider}
                              </span>
                            )}
                            <span>📖 {user.recipe_count} rețete</span>
                            {user.pantry_count !== undefined && <span>🥕 {user.pantry_count} cămară</span>}
                            {user.saved_recipes_count !== undefined && <span>❤️ {user.saved_recipes_count} salvate</span>}
                            <span>Înregistrat {new Date(user.joined_at).toLocaleDateString('ro-RO')}</span>
                            {user.last_sign_in_at && (
                              <span style={{ color: '#555' }}>Ultima autentificare: {new Date(user.last_sign_in_at).toLocaleDateString('ro-RO')}</span>
                            )}
                          </div>
                          {user.notes && (
                            <div className="mt-1 text-xs px-2 py-0.5 rounded-lg inline-block"
                              style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
                              {user.notes}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end" style={{ maxWidth: 320 }}>
                           {/* Trimite email placeholder */}
                           <button onClick={() => sendEmailPlaceholder(user.display_name)}
                             className="action-btn"
                             style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', borderColor: 'rgba(59,130,246,0.25)' }}>
                             Trimite email
                           </button>
                           {/* Moderator toggle — only for non-admin users */}
                           {!user.is_admin && (
                             <button onClick={() => toggleModerator(user.id, !!user.is_moderator)}
                               className="action-btn"
                               style={user.is_moderator
                                 ? { background: 'rgba(59,130,246,0.2)', color: '#60a5fa', borderColor: 'rgba(59,130,246,0.4)' }
                                 : { background: 'rgba(255,255,255,0.06)', color: '#888', borderColor: 'rgba(255,255,255,0.1)' }}>
                               {user.is_moderator ? 'Moderator ON' : 'Moderator OFF'}
                             </button>
                           )}
                           {/* Promote to chef */}
                           {(!user.tier || user.tier === 'user') && user.status === 'active' && (
                             <button onClick={() => setPromotingUser(user)}
                               className="action-btn"
                               style={{ background: 'rgba(255,149,0,0.15)', color: '#ff9500', borderColor: 'rgba(255,149,0,0.3)' }}>
                               Fă Bucătar
                             </button>
                           )}
                           {user.tier && user.tier !== 'user' && (
                             <button onClick={() => setUserStatus(user.id, 'active')}
                               className="action-btn"
                               style={{ background: 'rgba(255,255,255,0.06)', color: '#888', borderColor: 'rgba(255,255,255,0.1)' }}
                               title="Retrogradează la utilizator obișnuit">
                               Retrogradează
                             </button>
                           )}
                           <button onClick={() => { setEditingUser(editingUser?.id === user.id ? null : user); setUserNotesDraft(user.notes) }}
                             className="action-btn"
                             style={{ background: 'rgba(255,255,255,0.07)', color: '#aaa', borderColor: 'rgba(255,255,255,0.1)' }}>
                             Notițe
                           </button>
                           {user.status !== 'warned' && user.status !== 'blocked' && user.status !== 'deleted' && (
                             <button onClick={() => setUserStatus(user.id, 'warned')}
                               className="action-btn"
                               style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', borderColor: 'rgba(245,158,11,0.3)' }}>
                               Avertizează
                             </button>
                           )}
                           {user.status !== 'blocked' && user.status !== 'deleted' ? (
                             <button onClick={() => setUserStatus(user.id, 'blocked')}
                               className="action-btn"
                               style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>
                               🚫 Blochează
                             </button>
                           ) : user.status === 'blocked' ? (
                             <button onClick={() => setUserStatus(user.id, 'active')}
                               className="action-btn"
                               style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', borderColor: 'rgba(34,197,94,0.3)' }}>
                               ▶ Restaurează
                             </button>
                           ) : null}
                           {user.status !== 'deleted' && (
                             <button onClick={() => setUserStatus(user.id, 'deleted')}
                               className="action-btn"
                               style={{ background: 'rgba(239,68,68,0.25)', color: '#fca5a5', borderColor: 'rgba(239,68,68,0.35)' }}>
                               🗑 Șterge
                             </button>
                           )}
                        </div>
                      </div>

                       {editingUser?.id === user.id && (
                         <div className="mx-2 mb-2 px-4 py-4 rounded-b-2xl"
                           style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.07)', borderTop: 'none' }}>
                           <label className="block text-xs font-semibold mb-2" style={{ color: '#777' }}>Notițe interne (nu sunt vizibile utilizatorului)</label>
                           <textarea className="admin-input resize-none" rows={3} value={userNotesDraft}
                             onChange={e => setUserNotesDraft(e.target.value)} placeholder="Motiv pentru acțiune, avertismente, etc…" />
                           <div className="flex gap-2 mt-3 justify-end">
                             <button onClick={() => setEditingUser(null)} className="px-4 py-1.5 rounded-lg text-xs font-semibold"
                               style={{ background: 'rgba(255,255,255,0.07)', color: '#777' }}>Anulează</button>
                             <button onClick={() => saveUserNotes(user.id, userNotesDraft)} className="px-4 py-1.5 rounded-lg text-xs font-semibold"
                               style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff' }}>Salvează notițe</button>
                           </div>
                         </div>
                       )}
                    </div>
                  ))}
                 </div>
               )}

               {/* Sancțiuni Active */}
               <div className="mt-8">
                 <h3 className="ff-display text-lg font-bold mb-4">Sancțiuni Active</h3>
                 {sanctions.length === 0 ? (
                   <div className="text-center py-8 text-sm" style={{ color: '#555' }}>Nicio sancțiune activă</div>
                 ) : (
                   <div className="space-y-2">
                     {sanctions.map(s => (
                       <div key={s.id} className="flex items-center gap-4 px-4 py-3 rounded-xl" style={{ background: '#161616', border: '1px solid rgba(239,68,68,0.15)' }}>
                         <Badge status={s.type === 'ban' ? 'banned' : s.type === 'suspend' ? 'suspended' : 'warned'} />
                         <div className="flex-1 min-w-0">
                           <span className="font-semibold text-sm">{s.user_name}</span>
                           <span className="text-xs ml-2" style={{ color: '#555' }}>{s.reason || 'Fără motiv specificat'}</span>
                         </div>
                         <span className="text-xs flex-shrink-0" style={{ color: '#555' }}>{s.expires_at ? `Expiră: ${new Date(s.expires_at).toLocaleDateString('ro-RO')}` : 'Permanent'}</span>
                         <button onClick={() => removeSanction(s.id, s.user_name)} className="action-btn flex-shrink-0" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', borderColor: 'rgba(34,197,94,0.3)' }}>Revocă</button>
                       </div>
                     ))}
                   </div>
                 )}
               </div>
             </div>
           )}

           {/* ════════════════════════════════
               REPORTS TAB
           ════════════════════════════════ */}
           {tab === 'reports' && (
             <div>
               <div className="flex items-center justify-between mb-5">
                 <h2 className="ff-display text-2xl font-bold">Conținut Semnalat</h2>
                 <div className="flex items-center gap-2">
                   <span className="text-xs" style={{ color: '#555' }}>{openReportCount} deschise</span>
                   {selectedReports.size > 0 && (
                     <button onClick={bulkDismissReports}
                       className="action-btn"
                       style={{ background: 'rgba(255,255,255,0.07)', color: '#aaa', borderColor: 'rgba(255,255,255,0.1)' }}>
                       Respinge {selectedReports.size} selectate
                     </button>
                   )}
                 </div>
               </div>

               {/* Category filter */}
               <div className="flex flex-wrap gap-2 mb-5">
                 {(['all', 'spam', 'hate', 'harassment', 'copyright', 'misinfo', 'other'] as const).map(cat => (
                   <button key={cat} onClick={() => setReportCategory(cat)} className="chip"
                     style={reportCategory === cat
                       ? { background: 'rgba(239,68,68,0.2)', color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)' }
                       : { background: 'rgba(255,255,255,0.05)', color: '#777', borderColor: 'rgba(255,255,255,0.1)' }}>
                     {cat === 'all' ? 'Toate categoriile' : cat === 'spam' ? '📢 Spam' : cat === 'hate' ? '🔞 Ură' : cat === 'harassment' ? '🗣 Hărțuire' : cat === 'copyright' ? '©️ Drepturi' : cat === 'misinfo' ? '❌ Dezinformare' : '⚠️ Altele'}
                     {cat !== 'all' && (
                       <span className="ml-1.5 text-[10px] opacity-70">{reports.filter(r => r.category === cat && r.status === 'open').length}</span>
                     )}
                   </button>
                 ))}
               </div>

               {filteredReports.length === 0 ? (
                 <div className="py-16 text-center">
                   <div className="text-4xl mb-3">✅</div>
                   <div className="text-sm font-semibold" style={{ color: '#22c55e' }}>Nicio raport deschis</div>
                   <div className="text-xs mt-1" style={{ color: '#444' }}>Totul este curat în această categorie</div>
                 </div>
              ) : (
                <div className="space-y-3">
                  {filteredReports.map(report => (
                    <div key={report.id} className="flex items-center gap-4 px-5 py-4 rounded-2xl"
                      style={{ background: '#161616', border: '1px solid rgba(239,68,68,0.2)' }}>
                       <input type="checkbox" checked={selectedReports.has(report.id)} onChange={() => toggleSelectReport(report.id)}
                         style={{ accentColor: '#ff9500', flexShrink: 0 }} />
                       <Image src={report.img} alt="" width={56} height={56} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{report.title}</div>
                        <div className="text-xs mt-0.5 flex items-center gap-2 flex-wrap">
                          <span style={{ color: '#ef4444' }}>🚩 {report.reason}</span>
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                            {report.category}
                          </span>
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: '#555' }}>
                          Reported by {report.reporter} · {report.date}
                        </div>
                      </div>
                       <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                         <Link href={`/recipes/${report.slug}`} target="_blank"
                           className="action-btn flex items-center"
                           style={{ background: 'rgba(255,255,255,0.06)', color: '#888', borderColor: 'rgba(255,255,255,0.1)', textDecoration: 'none' }}>
                           👁 Vizualizare
                         </Link>
                         <button onClick={() => dismissReport(report.id, report.title)}
                           className="action-btn"
                           style={{ background: 'rgba(255,255,255,0.07)', color: '#aaa', borderColor: 'rgba(255,255,255,0.1)' }}>
                           Respinge
                         </button>
                         <button onClick={() => actionReport(report.id, report.title)}
                           className="action-btn"
                           style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>
                           🗑 Elimină conținut
                         </button>
                         {report.reporterId && (
                           <button onClick={() => banUserFromReport(report.reporterId, report.reporter)}
                             className="action-btn"
                             style={{ background: 'rgba(239,68,68,0.3)', color: '#fca5a5', borderColor: 'rgba(239,68,68,0.45)' }}>
                             🚫 Suspendă utilizator
                           </button>
                         )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

               {/* Resolved history */}
               {reports.some(r => r.status !== 'open') && (
                 <div className="mt-6">
                   <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#444' }}>Rezolvate</h3>
                   <div className="space-y-2">
                     {reports.filter(r => r.status !== 'open').map(report => (
                        <div key={report.id} className="flex items-center gap-4 px-4 py-3 rounded-xl opacity-50"
                          style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <Image src={report.img} alt="" width={40} height={40} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                         <div className="flex-1 min-w-0 text-xs">
                           <span className="font-semibold truncate block">{report.title}</span>
                           <span style={{ color: '#555' }}>{report.status === 'dismissed' ? '✓ Respins' : '🗑 Eliminat'} · {report.reason}</span>
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
               )}

               <div className="mt-6 p-4 rounded-xl text-xs text-center" style={{ color: '#444', background: '#161616', border: '1px solid rgba(255,255,255,0.05)' }}>
                 Sistem complet de raportare cu flaguri trimise de utilizatori se conectează la tabelul Supabase <code>reports</code> când este activ.
               </div>
            </div>
           )}

          {/* ════════════════════════════════
              ANALYTICS TAB
          ════════════════════════════════ */}
          {tab === 'analytics' && (
            <div>
              <h2 className="ff-display text-2xl font-bold mb-6">Analiză</h2>
              {analyticsLoading ? (
                <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => (<div key={i} className="h-48 rounded-2xl animate-pulse" style={{ background: '#1a1a1a' }} />))}</div>
              ) : !analytics ? (
                <div className="py-16 text-center"><div className="text-4xl mb-3">📈</div><div className="text-sm font-semibold" style={{ color: '#555' }}>Nu s-au putut încărca datele analitice</div></div>
              ) : (
                <>
                  <div className="rounded-2xl p-5 mb-4" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <h3 className="ff-display font-bold mb-4 text-sm uppercase tracking-widest" style={{ color: '#555' }}>Top 10 Rețete după Voturi</h3>
                    <div className="space-y-2">
                      {analytics.topRecipes.map((r, i) => { const max = analytics.topRecipes[0]?.votes || 1; return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs font-semibold w-6 text-right" style={{ color: '#555' }}>{i + 1}.</span>
                          <span className="text-xs w-44 truncate" style={{ color: '#aaa' }}>{r.title}</span>
                          <div className="flex-1 h-6 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                            <div className="h-full rounded-full transition-all" style={{ width: `${Math.max((r.votes / max) * 100, 2)}%`, background: 'linear-gradient(90deg,#ff4d6d,#ff9500)' }} />
                          </div>
                          <span className="text-xs font-semibold w-12 text-right" style={{ color: '#888' }}>{r.votes}</span>
                        </div>
                      )})}
                      {analytics.topRecipes.length === 0 && <div className="text-xs text-center py-4" style={{ color: '#555' }}>Nicio rețetă cu voturi</div>}
                    </div>
                  </div>
                  <div className="rounded-2xl p-5 mb-4" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <h3 className="ff-display font-bold mb-4 text-sm uppercase tracking-widest" style={{ color: '#555' }}>Rețete pe Regiune</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                      {analytics.recipesPerRegion.map((r, i) => (
                        <div key={i} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div className="text-lg font-bold" style={{ color: '#ff9500' }}>{r.count}</div>
                          <div className="text-[10px] uppercase tracking-wider mt-1 truncate" style={{ color: '#666' }}>{r.region}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl p-5" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <h3 className="ff-display font-bold mb-4 text-sm uppercase tracking-widest" style={{ color: '#555' }}>Activitate Ultimele 7 Zile</h3>
                    <div className="flex items-end gap-2 h-40">
                      {analytics.recentActivity.map((d, i) => { const maxV = Math.max(...analytics.recentActivity.map(x => x.recipes + x.votes), 1); const h = ((d.recipes + d.votes) / maxV) * 100; return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[10px] font-semibold" style={{ color: '#888' }}>{d.recipes + d.votes}</span>
                          <div className="w-full rounded-t-lg transition-all" style={{ height: `${Math.max(h, 4)}%`, background: 'linear-gradient(180deg,#ff4d6d,#ff9500)' }} />
                          <span className="text-[9px]" style={{ color: '#555' }}>{d.date}</span>
                        </div>
                      )})}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ════════════════════════════════
              STATISTICI TAB
          ════════════════════════════════ */}
          {tab === 'statistici' && (
            <div>
              <h2 className="ff-display text-2xl font-bold mb-6">Statistici Platformă</h2>
              {statisticiLoading ? (
                <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-48 rounded-2xl animate-pulse" style={{ background: '#1a1a1a' }} />)}</div>
              ) : !statisticiData ? (
                <div className="py-16 text-center">
                  <div className="text-4xl mb-3">📉</div>
                  <div className="text-sm font-semibold" style={{ color: '#555' }}>Nu s-au putut încărca statisticile</div>
                  <button onClick={() => { setStatisticiLoading(true); adminFetch('/api/admin/statistici').then(r => r.json()).then(setStatisticiData).catch(() => {}).finally(() => setStatisticiLoading(false)) }}
                    className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold"
                    style={{ background: 'rgba(255,149,0,0.2)', color: '#ff9500', border: '1px solid rgba(255,149,0,0.3)' }}>
                    Reîncarcă
                  </button>
                </div>
              ) : (
                <>
                  {/* Tip conținut */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="rounded-2xl p-5 text-center" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="text-3xl font-bold mb-1" style={{ color: '#ff4d6d' }}>{statisticiData.totalRecipes}</div>
                      <div className="text-xs uppercase tracking-widest" style={{ color: '#555' }}>Total Rețete</div>
                    </div>
                    <div className="rounded-2xl p-5 text-center" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="text-3xl font-bold mb-1" style={{ color: '#ff9500' }}>{statisticiData.totalCocktails}</div>
                      <div className="text-xs uppercase tracking-widest" style={{ color: '#555' }}>Total Cocktailuri</div>
                    </div>
                    <div className="rounded-2xl p-5 text-center" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="text-3xl font-bold mb-1" style={{ color: '#22c55e' }}>{statisticiData.totalRecipes + statisticiData.totalCocktails}</div>
                      <div className="text-xs uppercase tracking-widest" style={{ color: '#555' }}>Total Conținut</div>
                    </div>
                    <div className="rounded-2xl p-5 text-center" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="text-3xl font-bold mb-1" style={{ color: '#3b82f6' }}>
                        {statisticiData.totalRecipes + statisticiData.totalCocktails > 0
                          ? `${Math.round((statisticiData.totalCocktails / (statisticiData.totalRecipes + statisticiData.totalCocktails)) * 100)}%`
                          : '0%'}
                      </div>
                      <div className="text-xs uppercase tracking-widest" style={{ color: '#555' }}>Cocktailuri / Total</div>
                    </div>
                  </div>

                  {/* Tip breakdown donut-style */}
                  <div className="rounded-2xl p-5 mb-6" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <h3 className="ff-display font-bold mb-4 text-sm uppercase tracking-widest" style={{ color: '#555' }}>Distribuție pe Tip</h3>
                    <div className="flex flex-col md:flex-row items-center gap-8">
                      {/* CSS donut */}
                      <div className="relative flex-shrink-0" style={{ width: 140, height: 140 }}>
                        {(() => {
                          const total = statisticiData.typeBreakdown.reduce((s, t) => s + t.count, 0) || 1
                          const colors = ['#ff4d6d','#ff9500','#3b82f6','#22c55e','#a855f7','#f59e0b']
                          let cumulative = 0
                          const segments = statisticiData.typeBreakdown.map((t, i) => {
                            const pct = (t.count / total) * 100
                            const start = cumulative
                            cumulative += pct
                            return { ...t, pct, start, color: colors[i % colors.length] }
                          })
                          const r = 50, cx = 70, cy = 70, stroke = 22
                          const circumference = 2 * Math.PI * r
                          return (
                            <svg width="140" height="140" viewBox="0 0 140 140">
                              <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
                              {segments.map((seg, i) => (
                                <circle key={i} cx={cx} cy={cy} r={r} fill="none"
                                  stroke={seg.color} strokeWidth={stroke}
                                  strokeDasharray={`${(seg.pct / 100) * circumference} ${circumference}`}
                                  strokeDashoffset={`${-((seg.start / 100) * circumference - circumference / 4)}`}
                                  style={{ transition: 'all 0.5s' }} />
                              ))}
                              <text x={cx} y={cy - 6} textAnchor="middle" fill="#f0f0f0" fontSize="20" fontWeight="700">{total}</text>
                              <text x={cx} y={cy + 12} textAnchor="middle" fill="#555" fontSize="10">total</text>
                            </svg>
                          )
                        })()}
                      </div>
                      <div className="flex-1 space-y-3 w-full">
                        {statisticiData.typeBreakdown.map((t, i) => {
                          const total = statisticiData.typeBreakdown.reduce((s, x) => s + x.count, 0) || 1
                          const colors = ['#ff4d6d','#ff9500','#3b82f6','#22c55e','#a855f7','#f59e0b']
                          const color = colors[i % colors.length]
                          return (
                            <div key={i} className="flex items-center gap-3">
                              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                              <span className="text-sm capitalize flex-1">{t.type === 'recipe' ? 'Rețete' : t.type === 'cocktail' ? 'Cocktailuri' : t.type}</span>
                              <div className="flex-1 h-4 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)', maxWidth: 200 }}>
                                <div className="h-full rounded-full" style={{ width: `${(t.count / total) * 100}%`, background: color }} />
                              </div>
                              <span className="text-sm font-bold w-12 text-right" style={{ color }}>{t.count}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Rețete pe țară — bar chart CSS */}
                  <div className="rounded-2xl p-5 mb-6" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <h3 className="ff-display font-bold mb-4 text-sm uppercase tracking-widest" style={{ color: '#555' }}>Rețete pe Țară / Regiune (Top 20)</h3>
                    {statisticiData.recipesByCountry.length === 0 ? (
                      <div className="text-xs text-center py-8" style={{ color: '#555' }}>Nicio dată disponibilă</div>
                    ) : (
                      <div className="space-y-2">
                        {statisticiData.recipesByCountry.slice(0, 20).map((item, i) => {
                          const max = statisticiData.recipesByCountry[0]?.count || 1
                          const pct = Math.max((item.count / max) * 100, 2)
                          const hue = (i * 18) % 360
                          const barColor = i === 0 ? '#ff4d6d' : i === 1 ? '#ff9500' : i === 2 ? '#f59e0b' : `hsl(${hue},65%,55%)`
                          return (
                            <div key={i} className="flex items-center gap-3">
                              <span className="text-xs font-bold w-5 text-right flex-shrink-0" style={{ color: '#555' }}>{i + 1}</span>
                              <span className="text-xs w-32 truncate flex-shrink-0 capitalize" style={{ color: '#bbb' }}>{item.country || 'necunoscut'}</span>
                              <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                                <div className="h-full rounded-full flex items-center" style={{ width: `${pct}%`, background: barColor, transition: 'width 0.6s ease' }}>
                                  <span className="text-[10px] font-bold px-2 text-white opacity-90 whitespace-nowrap">{item.count > 5 ? item.count : ''}</span>
                                </div>
                              </div>
                              <span className="text-xs font-bold w-10 text-right flex-shrink-0" style={{ color: barColor }}>{item.count}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Creștere utilizatori săptămânală */}
                  <div className="rounded-2xl p-5 mb-6" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <h3 className="ff-display font-bold mb-4 text-sm uppercase tracking-widest" style={{ color: '#555' }}>Creștere Utilizatori (Ultimele 4 Săptămâni)</h3>
                    {statisticiData.weeklyGrowth.length === 0 ? (
                      <div className="text-xs text-center py-8" style={{ color: '#555' }}>Nicio dată disponibilă</div>
                    ) : (
                      <div className="flex items-end gap-4 h-36">
                        {statisticiData.weeklyGrowth.map((w, i) => {
                          const max = Math.max(...statisticiData.weeklyGrowth.map(x => x.count), 1)
                          const h = Math.max((w.count / max) * 100, 4)
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-2">
                              <span className="text-xs font-bold" style={{ color: '#22c55e' }}>{w.count}</span>
                              <div className="w-full rounded-t-xl" style={{ height: `${h}%`, background: 'linear-gradient(180deg,#22c55e,#16a34a)', transition: 'height 0.5s ease' }} />
                              <span className="text-[10px] text-center" style={{ color: '#555' }}>{w.week}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Cele mai vizualizate (quality_score) */}
                  {statisticiData.mostViewed.length > 0 && (
                    <div className="rounded-2xl p-5" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <h3 className="ff-display font-bold mb-4 text-sm uppercase tracking-widest" style={{ color: '#555' }}>Cele Mai Populare Rețete (quality_score)</h3>
                      <div className="space-y-2">
                        {statisticiData.mostViewed.map((r, i) => {
                          const max = statisticiData.mostViewed[0]?.quality_score || 1
                          return (
                            <div key={i} className="flex items-center gap-3">
                              <span className="text-xs font-bold w-5 text-right flex-shrink-0" style={{ color: '#555' }}>{i + 1}.</span>
                              <Link href={`/recipes/${r.slug}`} target="_blank" className="text-xs w-48 truncate flex-shrink-0" style={{ color: '#bbb', textDecoration: 'none' }}>
                                {r.title}
                              </Link>
                              <div className="flex-1 h-4 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                <div className="h-full rounded-full" style={{ width: `${(r.quality_score / max) * 100}%`, background: 'linear-gradient(90deg,#ff4d6d,#ff9500)' }} />
                              </div>
                              <span className="text-xs font-bold w-10 text-right" style={{ color: '#ff9500' }}>⭐{r.quality_score}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ════════════════════════════════
              SETTINGS TAB
          ════════════════════════════════ */}
          {tab === 'settings' && (
            <div>
              <h2 className="ff-display text-2xl font-bold mb-6">Setări</h2>
              <div className="rounded-2xl p-5 mb-4" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.07)' }}>
                <h3 className="ff-display font-bold mb-4 text-sm uppercase tracking-widest" style={{ color: '#555' }}>Configurare Site</h3>
                <div className="space-y-4">
                  {[
                    { key: 'maintenanceMode' as const, label: 'Mod Întreținere', desc: 'Afișează o pagină de întreținere vizitatorilor' },
                    { key: 'registrationsOpen' as const, label: 'Înregistrări Noi', desc: 'Permite utilizatorilor noi să se înregistreze' },
                    { key: 'recipeSubmissions' as const, label: 'Trimiteri Rețete', desc: 'Permite utilizatorilor să trimită rețete noi' },
                  ].map(item => (
                    <div key={item.key} className="flex items-center justify-between">
                      <div><div className="text-sm font-semibold">{item.label}</div><div className="text-xs" style={{ color: '#555' }}>{item.desc}</div></div>
                      <Toggle on={settings[item.key]} onChange={v => setSettings(prev => ({ ...prev, [item.key]: v }))} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl p-5 mb-4" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.07)' }}>
                <h3 className="ff-display font-bold mb-4 text-sm uppercase tracking-widest" style={{ color: '#555' }}>Praguri Moderare</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold block mb-1">Prag Auto-Dezactivare Rapoarte</label>
                    <div className="text-xs mb-2" style={{ color: '#555' }}>Conținutul este dezactivat automat după acest număr de rapoarte</div>
                    <input type="number" value={settings.reportThreshold} onChange={e => setSettings(prev => ({ ...prev, reportThreshold: parseInt(e.target.value) || 0 }))} className="admin-input" style={{ maxWidth: 120 }} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold block mb-1">Cooldown Avertismente (ore)</label>
                    <div className="text-xs mb-2" style={{ color: '#555' }}>Durata cooldown-ului după un avertisment</div>
                    <input type="number" value={settings.warningCooldown} onChange={e => setSettings(prev => ({ ...prev, warningCooldown: parseInt(e.target.value) || 0 }))} className="admin-input" style={{ maxWidth: 120 }} />
                  </div>
                </div>
              </div>
              <div className="rounded-2xl p-5" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.07)' }}>
                <h3 className="ff-display font-bold mb-4 text-sm uppercase tracking-widest" style={{ color: '#555' }}>Funcționalități</h3>
                <div className="space-y-3">
                  {([
                    { key: 'cookMode' as const, label: 'Mod Cook' },
                    { key: 'shoppingLists' as const, label: 'Liste Cumpărături' },
                    { key: 'mealPlans' as const, label: 'Planuri Masă' },
                    { key: 'pantry' as const, label: 'Cămară' },
                    { key: 'communityForum' as const, label: 'Forum Comunitate' },
                  ]).map(f => (
                    <div key={f.key} className="flex items-center justify-between py-2">
                      <span className="text-sm font-semibold">{f.label}</span>
                      <Toggle on={settings.features[f.key]} onChange={v => setSettings(prev => ({ ...prev, features: { ...prev.features, [f.key]: v } }))} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════
              AUDIT LOG TAB
          ════════════════════════════════ */}
           {tab === 'audit' && (
             <div>
               <div className="flex items-center justify-between mb-5">
                 <h2 className="ff-display text-2xl font-bold">Jurnal Audit</h2>
                 <div className="flex items-center gap-3">
                   <span className="text-xs" style={{ color: '#555' }}>{auditLog.length} intrări în această sesiune</span>
                   {auditLog.length > 0 && (
                     <button onClick={() => setAuditLog([])}
                       className="action-btn"
                       style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>
                       Șterge jurnalul
                     </button>
                   )}
                 </div>
               </div>

               {auditLog.length === 0 ? (
                 <div className="py-16 text-center">
                   <div className="text-4xl mb-3">🗂️</div>
                   <div className="text-sm font-semibold" style={{ color: '#555' }}>Nicio acțiune înregistrată</div>
                   <div className="text-xs mt-1" style={{ color: '#444' }}>Acțiunile din această sesiune vor apărea aici</div>
                 </div>
               ) : (
                 <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                   {/* header */}
                   <div className="grid gap-4 px-4 py-3 text-xs font-bold uppercase tracking-wider"
                     style={{ background: '#161616', color: '#444', gridTemplateColumns: '120px 1fr 160px 80px 100px' }}>
                     <span>Ora</span>
                     <span>Acțiune</span>
                     <span>Țintă</span>
                     <span>Actor</span>
                     <span>Severitate</span>
                   </div>
                  {auditLog.map((entry, i) => (
                    <div key={entry.id}
                      className="admin-row grid gap-4 px-4 py-3 items-center"
                      style={{ gridTemplateColumns: '120px 1fr 160px 80px 100px', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: 'transparent' }}>
                      <span className="text-xs tabular-nums" style={{ color: '#555' }}>
                        {new Date(entry.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <div>
                        <span className="text-sm font-semibold">{entry.action}</span>
                        {entry.detail && <span className="text-xs ml-2" style={{ color: '#555' }}>{entry.detail}</span>}
                      </div>
                      <span className="text-sm truncate" style={{ color: '#888' }}>{entry.target}</span>
                      <span className="text-xs font-semibold" style={{ color: '#555' }}>{entry.actor}</span>
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${
                        entry.severity === 'danger' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        entry.severity === 'warn'   ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      }`}>
                        {entry.severity === 'danger' ? '🔴' : entry.severity === 'warn' ? '🟡' : '🔵'} {entry.severity}
                      </span>
                    </div>
                  ))}
                </div>
              )}

               <div className="mt-4 p-4 rounded-xl text-xs" style={{ color: '#444', background: '#161616', border: '1px solid rgba(255,255,255,0.05)' }}>
                 ℹ Jurnalul de audit este doar pentru sesiune. Când este conectat la Supabase, toate acțiunile admin sunt salvate în tabelul <code>admin_audit_log</code>.
               </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Promote user modal ── */}
      {promotingUser && (
        <PromoteModal
          user={promotingUser}
          onPromote={promoteUser}
          onClose={() => setPromotingUser(null)}
        />
      )}

      {/* ── Confirmation modal ── */}
      {confirm && (
        <ConfirmModal
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}
    </>
  )
}
