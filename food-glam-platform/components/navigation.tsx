'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'

/* ─── nav items ──────────────────────────────────────────────────────────── */

const NAV_ITEMS = [
  { href: '/',              label: 'Explorează',    icon: '🏠' },
  { href: '/cookbooks',     label: 'Cărți de bucate',  icon: '📖' },
  { href: '/cocktailbooks', label: 'Cocktailuri',  icon: '🍹' },
  { href: '/plan',          label: 'Plan de masă',  icon: '📅' },
  { href: '/me/preferred',  label: '⭐ Preferate', icon: '⭐' },
  { href: '/me/cookbook',   label: 'Cartea mea', icon: '🍴' },

  { href: '/chefs/me/new-post', label: '+ Postare Chef',   icon: '✍️' },
  { href: '/submit/recipe',    label: '+ Adaugă rețetă',   icon: '🍽️' },
  { href: '/submit/cocktail',   label: '+ Adaugă băutură', icon: '🍹' },
]

const MOBILE_TABS = [
  { href: '/',                 icon: '🏠', label: 'Acasă'     },
  { href: '/search',           icon: '🔍', label: 'Explorează'  },
  { href: '/me/scan',          icon: '📷', label: 'Scanează'     },
  { href: '/me/grocery',       icon: '🛒', label: 'Cumpărături'     },
  { href: '/me',               icon: '👤', label: 'Profil'  },
]

/* ─── mock-user helper (localStorage, no Supabase required) ─────────────── */

interface MockUser { id: string; display_name: string; handle: string; avatar_url: string | null }

function useMockUser() {
  const [user, setUser] = useState<MockUser | null>(null)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    try {
      let raw = localStorage.getItem('mock_user')
      // Auto-seed a demo user so the site works without Google sign-in
      if (!raw) {
        const demo: MockUser = {
          id: 'a0000000-0000-0000-0000-000000000001',
          display_name: 'Chef Anna',
          handle: 'chef_anna',
          avatar_url: null,
        }
        localStorage.setItem('mock_user', JSON.stringify(demo))
        raw = JSON.stringify(demo)
      }
      if (raw) {
        const parsed = JSON.parse(raw)
        // Migrate stale non-UUID mock user ids to Chef Anna
        if (parsed.id === 'mock-user-demo' || (parsed.id && !/^[0-9a-f]{8}-/.test(parsed.id))) {
          parsed.id = 'a0000000-0000-0000-0000-000000000001'
          parsed.display_name = 'Chef Anna'
          parsed.handle = 'chef_anna'
          localStorage.setItem('mock_user', JSON.stringify(parsed))
        }
        // normalize: some code sets 'name' instead of 'display_name'
        if (!parsed.display_name && parsed.name) parsed.display_name = parsed.name
        if (!parsed.display_name) parsed.display_name = 'User'
        if (!parsed.handle) parsed.handle = 'user'
        setUser(parsed)
      }
    } catch { /* ignore */ }
    setHydrated(true)
  }, [])
  const signOut = () => { localStorage.removeItem('mock_user'); setUser(null) }
  return { user, hydrated, signOut }
}

/* ══════════════════════════════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════════════════════════════ */

export function Navigation() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, hydrated, signOut } = useMockUser()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchVal, setSearchVal] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  /* close mobile menu on route change */
  useEffect(() => { setMobileOpen(false) }, [pathname])

  /* translate hint */
  useEffect(() => {
    const lang = navigator.language || ''
    const dismissed = sessionStorage.getItem('translate-hint-dismissed')
    if (!dismissed && !lang.toLowerCase().startsWith('en')) {
      const el = document.getElementById('translate-hint')
      if (el) el.classList.remove('hidden')
    }
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchVal.trim()) router.push(`/search?q=${encodeURIComponent(searchVal.trim())}`)
  }

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <>
      {/* ── translate hint ─────────────────────────────────────────────── */}
      <div
        id="translate-hint"
        className="hidden text-xs text-center py-1.5 px-4"
        style={{ background: '#1a1a2e', color: '#a0aec0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        🌍 Acest site este disponibil în limba română.
        <button
          className="ml-2 underline opacity-70 hover:opacity-100"
          onClick={() => {
            const el = document.getElementById('translate-hint')
            if (el) { el.style.display = 'none'; sessionStorage.setItem('translate-hint-dismissed', '1') }
          }}
        >
          Închide
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          DESKTOP HEADER — full-black, two-row
      ═══════════════════════════════════════════════════════════════════════ */}
      <header
        className="hidden md:block sticky top-0 z-50"
        style={{ background: '#000', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* ── Row 1: logo + search + auth ─────────────────────────────── */}
        <div className="flex items-center gap-4 px-6 py-3">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0 flex items-center gap-2">
            <img src="/logo.svg" alt="MareChef.ro" className="h-9 w-auto" />
          </Link>

          {/* Search bar — expands to fill available space */}
          <form onSubmit={handleSearch} className="flex-1 max-w-xl mx-auto">
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-full"
              style={{ background: '#111', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={searchVal}
                onChange={e => setSearchVal(e.target.value)}
                placeholder="Caută preparate, bucătari, bucătării..."
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: '#f0f0f0' }}
              />
              {searchVal && (
                <button
                  type="button"
                  onClick={() => setSearchVal('')}
                  style={{ color: '#555', fontSize: 16, lineHeight: 1 }}
                >
                  ×
                </button>
              )}
            </div>
          </form>

          {/* Auth area */}
          <div className="flex-shrink-0 flex items-center gap-3">
            {hydrated && user ? (
              <>
                <Link
                  href="/me"
                  className="flex items-center gap-2 text-sm font-medium"
                  style={{ color: '#ccc' }}
                >
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff' }}
                    >
                      {(user.display_name ?? 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="hidden lg:inline">{user.display_name ?? 'User'}</span>
                </Link>
                 <button
                   onClick={signOut}
                   className="text-xs px-3 py-1.5 rounded-full transition-all"
                   style={{ background: 'rgba(255,255,255,0.07)', color: '#888', border: '1px solid rgba(255,255,255,0.1)' }}
                 >
                   Deconectare
                 </button>
              </>
            ) : (
              hydrated && (
               <Link
                   href="/auth/signin"
                   className="text-sm font-semibold px-4 py-2 rounded-full transition-all"
                   style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff' }}
                 >
                   Autentificare
                 </Link>
              )
            )}
          </div>
        </div>

        {/* ── Row 2: nav links ─────────────────────────────────────────── */}
        <div
          className="flex items-center gap-1 px-6 pb-1"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          {NAV_ITEMS.map(item => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap"
                style={active
                  ? { background: 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff' }
                  : { color: '#999', background: 'transparent' }
                }
              >
                {item.label}
              </Link>
            )
          })}

          {/* spacer */}
          <div className="flex-1" />

           {/* secondary links */}
           <Link href="/search" className="text-xs px-2 py-1" style={{ color: '#555' }}>Toate rețetele</Link>
           <Link href="/rankings" className="text-xs px-2 py-1" style={{ color: '#555' }}>Clasament</Link>
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════════════════
          MOBILE HEADER — logo + hamburger
      ═══════════════════════════════════════════════════════════════════════ */}
      <header
        className="md:hidden sticky top-0 z-50 flex items-center justify-between px-4 py-3"
        style={{
          background: 'rgba(0,0,0,0.95)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <Link href="/" className="flex items-center gap-2">
          <img src="/logo.svg" alt="MareChef.ro" className="h-7 w-auto" />
        </Link>

        {/* inline search on mobile */}
        <form onSubmit={handleSearch} className="flex-1 mx-3">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
             <input
               type="text"
               value={searchVal}
               onChange={e => setSearchVal(e.target.value)}
               placeholder="Caută..."
               className="flex-1 bg-transparent text-sm outline-none min-w-0"
               style={{ color: '#f0f0f0' }}
             />
          </div>
        </form>

        {/* hamburger */}
        <button
          onClick={() => setMobileOpen(v => !v)}
          className="flex flex-col gap-1.5 p-2"
           aria-label="Meniu"
        >
          <span className="block w-5 h-0.5 rounded transition-all" style={{ background: mobileOpen ? '#ff4d6d' : '#ccc' }} />
          <span className="block w-5 h-0.5 rounded transition-all" style={{ background: mobileOpen ? '#ff9500' : '#ccc', opacity: mobileOpen ? 0 : 1 }} />
          <span className="block w-5 h-0.5 rounded transition-all" style={{ background: mobileOpen ? '#ff4d6d' : '#ccc' }} />
        </button>
      </header>

      {/* ── Mobile slide-down menu ───────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed top-[57px] left-0 right-0 z-40 py-4"
          style={{ background: '#000', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors"
              style={isActive(item.href)
                ? { color: '#ff9500', background: 'rgba(255,149,0,0.06)' }
                : { color: '#ccc' }
              }
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
          <div className="px-5 pt-3 mt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            {hydrated && user ? (
               <div className="flex items-center justify-between">
                 <span className="text-sm" style={{ color: '#888' }}>{user.display_name}</span>
                 <button onClick={signOut} className="text-xs" style={{ color: '#ff4d6d' }}>Deconectare</button>
               </div>
             ) : (
               <Link
                 href="/auth/signin"
                 className="block text-center py-2 rounded-xl text-sm font-semibold"
                 style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff' }}
               >
                 Autentificare
               </Link>
             )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MOBILE BOTTOM TAB BAR
      ═══════════════════════════════════════════════════════════════════════ */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-1 py-2"
        style={{
          background: 'rgba(0,0,0,0.97)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {MOBILE_TABS.map(item => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-0.5 px-3 py-1"
            >
              <span className="text-lg" style={{ opacity: active ? 1 : 0.5 }}>{item.icon}</span>
              <span
                className="text-[9px] tracking-wide"
                style={{ color: active ? '#ff9500' : '#666' }}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
