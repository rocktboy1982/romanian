"use client";

import { useEffect, useState } from "react";
import Image from 'next/image'
import FallbackImage from '@/components/FallbackImage'
import { useFeatureFlags } from "@/components/feature-flags-provider";
import { useTheme } from "@/components/theme-provider";
import { supabase } from "@/lib/supabase-client";
import SignInButton from "@/components/auth/signin-button";
import Link from "next/link";

interface MockUser { id: string; display_name: string; handle: string; avatar_url: string | null }

interface Profile {
  id: string
  email: string
  display_name: string
  handle: string
  bio: string | null
  avatar_url: string | null
  banner_url: string | null
}

export default function MeClientPage() {
  const { flags, loading, setOverride } = useFeatureFlags();
  const { theme, setTheme } = useTheme();
  const healthMode = !!flags.healthMode;
  const powerMode = !!flags.powerMode;

  const [user, setUser] = useState<{ email?: string; user_metadata?: { full_name?: string }; id: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [mockUser, setMockUser] = useState<MockUser | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Load mock user from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('mock_user');
      if (raw) setMockUser(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { session: _sess } } = await supabase.auth.getSession(); const data = { user: _sess?.user ?? null };
        if (!mounted) return;
        setUser(data.user ?? null);

        // If authenticated, fetch real profile from API
        if (data.user) {
          if (mounted) setProfileLoading(true)
          try {
            const { data: { session } } = await supabase.auth.getSession()
            const profileHeaders: Record<string, string> = {}
            if (session?.access_token) profileHeaders['Authorization'] = `Bearer ${session.access_token}`
            const res = await fetch('/api/profiles/me', { headers: profileHeaders })
            if (res.ok) {
              const profileData = await res.json()
              if (mounted && profileData.profile) {
                setProfile(profileData.profile)
              }
            }
          } catch (err) {
            console.error('Failed to fetch profile:', err)
          } finally {
            if (mounted) setProfileLoading(false)
          }
        }
      } catch (e) {
        console.error(e);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        // Fetch profile when auth state changes
        if (mounted) setProfileLoading(true)
        const profileHeaders: Record<string, string> = {}
        if (session?.access_token) profileHeaders['Authorization'] = `Bearer ${session.access_token}`
        fetch('/api/profiles/me', { headers: profileHeaders })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (mounted && data?.profile) {
              setProfile(data.profile)
            }
          })
          .catch(err => console.error('Failed to fetch profile:', err))
          .finally(() => { if (mounted) setProfileLoading(false) })
      } else {
        setProfile(null)
        if (mounted) setProfileLoading(false)
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <div className="container mx-auto px-4 py-8">Se încarcă profilul...</div>;
  }

  const toggle = (key: string, current: boolean) => {
    setOverride?.(key, !current);
  };

  return (
    <main className="min-h-screen" style={{ background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
      <div className="container mx-auto px-4 py-6 pb-24 flex flex-col gap-6 max-w-2xl">
        
        {/* ===== PROFILE CARD (COMPACT) ===== */}
        <section className="flex flex-col gap-3">
            {/* When authenticated, never fall back to mock/Chef Anna — wait for real profile */}
          {profileLoading ? (
            <div className="flex items-center gap-3 opacity-60">
              <div className="w-12 h-12 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.1)' }} />
              <div className="flex flex-col gap-1.5">
                <div className="w-28 h-3 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.1)' }} />
                <div className="w-20 h-3 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.07)' }} />
              </div>
            </div>
          ) : (profile || (!user && mockUser)) ? (
            <>
              {/* Profile header: Avatar + Name + Handle in one row */}
              {/* When authenticated: use real profile only. When guest: use mockUser. */}
              {(() => {
                const displayedProfile = profile ?? (user ? null : mockUser)
                if (!displayedProfile) return null
                return (
                  <>
                    <div className="flex items-center gap-4">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-lg select-none font-bold overflow-hidden flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff' }}
                      >
                        {displayedProfile.avatar_url
                          ? <FallbackImage src={displayedProfile.avatar_url} alt="" className="w-full h-full object-cover" fallbackEmoji="👨‍🍳" />
                          : displayedProfile.display_name?.charAt(0).toUpperCase() ?? '👤'}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-base" style={{ color: 'hsl(var(--foreground))' }}>
                          {displayedProfile.display_name}
                        </p>
                        <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
                          @{displayedProfile.handle}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 text-sm">
                      <Link
                        href={`/chefs/${displayedProfile.handle}`}
                        className="inline-block text-xs font-semibold opacity-75 hover:opacity-100 transition-opacity"
                      >
                        Vezi profilul bucătarului →
                      </Link>
                      {user && (
                        <Link
                          href="/me/profile/edit"
                          className="inline-block text-xs font-semibold opacity-75 hover:opacity-100 transition-opacity"
                        >
                          Editează →
                        </Link>
                      )}
                    </div>
                  </>
                )
              })()}
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <SignInButton />
            </div>
          )}
        </section>

        {/* ===== QUICK ACTIONS ===== */}
        {user && (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60 px-2">Acțiuni rapide</h2>
            <nav className="flex flex-col gap-1">
              <Link
                href="/me/posts"
                className="h-12 px-4 rounded-lg flex items-center gap-3 transition-colors"
                style={{
                  background: 'rgba(255, 77, 109, 0.08)',
                  color: 'hsl(var(--foreground))',
                  borderBottom: '1px solid rgba(255,255,255,0.08)'
                }}
              >
                <span className="text-lg">📝</span>
                <span className="text-sm font-medium">Rețetele mele</span>
              </Link>
              <Link
                href="/me/preferred"
                className="h-12 px-4 rounded-lg flex items-center gap-3 transition-colors"
                style={{
                  color: 'hsl(var(--foreground))',
                  borderBottom: '1px solid rgba(255,255,255,0.08)'
                }}
              >
                <span className="text-lg">⭐</span>
                <span className="text-sm font-medium">Preferate</span>
              </Link>
              <Link
                href="/me/cookbook"
                className="h-12 px-4 rounded-lg flex items-center gap-3 transition-colors"
                style={{
                  color: 'hsl(var(--foreground))',
                  borderBottom: '1px solid rgba(255,255,255,0.08)'
                }}
              >
                <span className="text-lg">📖</span>
                <span className="text-sm font-medium">Cartea mea de bucate</span>
              </Link>
              <Link
                href="/me/pantry"
                className="h-12 px-4 rounded-lg flex items-center gap-3 transition-colors"
                style={{
                  color: 'hsl(var(--foreground))',
                  borderBottom: '1px solid rgba(255,255,255,0.08)'
                }}
              >
                <span className="text-lg">🏠</span>
                <span className="text-sm font-medium">Cămara mea</span>
              </Link>
              <Link
                href="/me/bar"
                className="h-12 px-4 rounded-lg flex items-center gap-3 transition-colors"
                style={{
                  color: 'hsl(var(--foreground))',
                  borderBottom: '1px solid rgba(255,255,255,0.08)'
                }}
              >
                <span className="text-lg">🍸</span>
                <span className="text-sm font-medium">Barul meu</span>
              </Link>
              <Link
                href="/me/shopping-lists"
                className="h-12 px-4 rounded-lg flex items-center gap-3 transition-colors"
                style={{
                  color: 'hsl(var(--foreground))',
                  borderBottom: '1px solid rgba(255,255,255,0.08)'
                }}
              >
                <span className="text-lg">🛒</span>
                <span className="text-sm font-medium">Liste de cumpărături</span>
              </Link>
              <Link
                href="/plan"
                className="h-12 px-4 rounded-lg flex items-center gap-3 transition-colors"
                style={{
                  color: 'hsl(var(--foreground))',
                  borderBottom: '1px solid rgba(255,255,255,0.08)'
                }}
              >
                <span className="text-lg">📅</span>
                <span className="text-sm font-medium">Planul de masă</span>
              </Link>
              <Link
                href="/submit/recipe"
                className="h-12 px-4 rounded-lg flex items-center gap-3 transition-colors"
                style={{
                  color: 'hsl(var(--foreground))',
                  borderBottom: '1px solid rgba(255,255,255,0.08)'
                }}
              >
                <span className="text-lg">🍽️</span>
                <span className="text-sm font-medium">Adaugă rețetă</span>
              </Link>
              <Link
                href="/submit/cocktail"
                className="h-12 px-4 rounded-lg flex items-center gap-3 transition-colors"
                style={{
                  color: 'hsl(var(--foreground))'
                }}
              >
                <span className="text-lg">🍹</span>
                <span className="text-sm font-medium">Adaugă băutură</span>
              </Link>
            </nav>
          </section>
        )}

        {/* ===== SETTINGS & MODES (ACCORDION) ===== */}
        <section className="flex flex-col gap-0 rounded-lg overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          {/* Accordion header */}
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="h-12 px-4 flex items-center justify-between font-semibold text-sm transition-colors hover:opacity-80"
            style={{ background: 'rgba(255, 77, 109, 0.08)', color: 'hsl(var(--foreground))' }}
          >
            <span>Setări și moduri</span>
            <span style={{ transform: settingsOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms' }}>
              ▼
            </span>
          </button>

          {/* Accordion content */}
          {settingsOpen && (
            <div className="flex flex-col gap-0 p-0">
              {/* Health Mode Toggle */}
              <div className="flex items-center justify-between gap-4 px-4 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <div className="flex-1">
                  <div className="text-sm font-semibold">Modul Sănătate</div>
                  <div className="text-xs opacity-60">Obiective, calorii, macronutrienți</div>
                </div>
                <button
                  onClick={() => toggle("healthMode", healthMode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0`}
                  style={{
                    background: healthMode ? 'hsl(var(--primary))' : 'rgba(255,255,255,0.1)'
                  }}
                  aria-pressed={healthMode}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform`}
                    style={{
                      transform: healthMode ? 'translateX(24px)' : 'translateX(4px)'
                    }}
                  />
                </button>
              </div>

              {/* Power Mode Toggle */}
              <div className="flex items-center justify-between gap-4 px-4 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <div className="flex-1">
                  <div className="text-sm font-semibold">Modul Avansat</div>
                  <div className="text-xs opacity-60">Cămară, nutriții, avansate</div>
                </div>
                <button
                  onClick={() => toggle("powerMode", powerMode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0`}
                  style={{
                    background: powerMode ? 'hsl(var(--primary))' : 'rgba(255,255,255,0.1)'
                  }}
                  aria-pressed={powerMode}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform`}
                    style={{
                      transform: powerMode ? 'translateX(24px)' : 'translateX(4px)'
                    }}
                  />
                </button>
              </div>

              {/* Theme Toggle (Compact) */}
              <div className="px-4 py-3 border-t flex items-center gap-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <div className="flex-1">
                  <div className="text-sm font-semibold">Aspect</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTheme('dark')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      theme === 'dark' ? 'opacity-100' : 'opacity-50'
                    }`}
                    style={{
                      background: theme === 'dark' ? 'rgba(255, 77, 109, 0.2)' : 'transparent',
                      color: 'hsl(var(--foreground))'
                    }}
                  >
                    🌙 Întunecat
                  </button>
                  <button
                    onClick={() => setTheme('light')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      theme === 'light' ? 'opacity-100' : 'opacity-50'
                    }`}
                    style={{
                      background: theme === 'light' ? 'rgba(255, 77, 109, 0.2)' : 'transparent',
                      color: 'hsl(var(--foreground))'
                    }}
                  >
                    ☀️ Luminos
                  </button>
                </div>
              </div>

              {/* Settings Links */}
              <div className="border-t px-2 py-2 flex flex-col gap-1" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <Link
                  href="/me/settings/budget"
                  className="px-2 py-2 rounded text-sm opacity-75 hover:opacity-100 transition-opacity"
                >
                  💰 Buget
                </Link>
                <Link
                  href="/allergies"
                  className="px-2 py-2 rounded text-sm opacity-75 hover:opacity-100 transition-opacity"
                >
                  ⚠️ Alergii
                </Link>
                <Link
                  href="/habits"
                  className="px-2 py-2 rounded text-sm opacity-75 hover:opacity-100 transition-opacity"
                >
                  📅 Obiceiuri
                </Link>
                <Link
                  href="/privacy"
                  className="px-2 py-2 rounded text-sm opacity-75 hover:opacity-100 transition-opacity"
                >
                  🔒 Confidențialitate
                </Link>
              </div>

              {/* Advanced Feature Links (Conditional) */}
              {(healthMode || powerMode) && (
                <div className="border-t px-2 py-2 flex flex-col gap-1" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                  <div className="px-2 py-1 text-xs font-semibold uppercase opacity-50">Funcții avansate</div>
                  {healthMode && (
                    <Link
                      href="/health"
                      className="px-2 py-2 rounded text-sm opacity-75 hover:opacity-100 transition-opacity"
                    >
                      🏥 Sănătate
                    </Link>
                  )}
                  {powerMode && (
                    <>
                      <Link
                        href="/advanced"
                        className="px-2 py-2 rounded text-sm opacity-75 hover:opacity-100 transition-opacity"
                      >
                        ⚡ Funcții avansate
                      </Link>
                      <Link
                        href="/pantry"
                        className="px-2 py-2 rounded text-sm opacity-75 hover:opacity-100 transition-opacity"
                      >
                        🥫 Cămară
                      </Link>
                      <Link
                        href="/nutrition-engine"
                        className="px-2 py-2 rounded text-sm opacity-75 hover:opacity-100 transition-opacity"
                      >
                        🔬 Motor nutrițional
                      </Link>
                      <Link
                        href="/food-logging"
                        className="px-2 py-2 rounded text-sm opacity-75 hover:opacity-100 transition-opacity"
                      >
                        📓 Jurnal alimentar
                      </Link>
                      <Link
                        href="/hydration"
                        className="px-2 py-2 rounded text-sm opacity-75 hover:opacity-100 transition-opacity"
                      >
                        💧 Hidratare
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
