"use client";

import { useEffect, useState, useCallback } from "react";
import FallbackImage from '@/components/FallbackImage'
import { useFeatureFlags } from "@/components/feature-flags-provider";
import { useTheme } from "@/components/theme-provider";
import { supabase } from "@/lib/supabase-client";
import SignInButton from "@/components/auth/signin-button";
import Link from "next/link";

interface Profile {
  id: string
  email: string
  display_name: string
  handle: string
  bio: string | null
  avatar_url: string | null
  banner_url: string | null
}

interface HealthProfile {
  age: number | null
  gender: string | null
  height_cm: number | null
  weight_kg: number | null
  goal_weight_kg: number | null
  activity_level: string | null
  daily_calorie_target: number | null
  fasting_protocol: string | null
  fasting_eating_start: string | null
  fasting_eating_end: string | null
  daily_water_goal_ml: number | null
  medical_conditions: string[] | null
  allergens: string[] | null
  blood_type: string | null
  is_smoker: boolean | null
  pregnancy_status: string | null
}

const MEDICAL_CONDITIONS = [
  { value: 'diabet_tip2', label: 'Diabet tip 2' },
  { value: 'hipertensiune', label: 'Hipertensiune' },
  { value: 'boli_cardiovasculare', label: 'Boli cardiovasculare' },
  { value: 'celiachie', label: 'Celiachie' },
  { value: 'boala_renala', label: 'Boală renală' },
  { value: 'guta', label: 'Gută' },
  { value: 'anemie', label: 'Anemie' },
  { value: 'hipotiroidism', label: 'Hipotiroidism' },
  { value: 'gerd_reflux', label: 'GERD / Reflux' },
  { value: 'ibs', label: 'IBS' },
  { value: 'intoleranta_lactoza', label: 'Intoleranță lactoză' },
]

const ALLERGENS = [
  { value: 'gluten', label: 'Gluten' },
  { value: 'lactoza', label: 'Lactoză' },
  { value: 'nuci', label: 'Nuci' },
  { value: 'arahide', label: 'Arahide' },
  { value: 'fructe_de_mare', label: 'Fructe de mare' },
  { value: 'oua', label: 'Ouă' },
  { value: 'soia', label: 'Soia' },
  { value: 'susan', label: 'Susan' },
]

const BLOOD_TYPES = ['0+', '0-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']

const inputStyle = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'hsl(var(--foreground))',
}

export default function MeClientPage() {
  const { flags, loading, setOverride } = useFeatureFlags();
  const { theme, setTheme } = useTheme();
  const healthMode = !!flags.healthMode;

  const [user, setUser] = useState<{ email?: string; user_metadata?: { full_name?: string }; id: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);

  // Health profile state
  const [healthProfile, setHealthProfile] = useState<HealthProfile | null>(null);
  const [healthForm, setHealthForm] = useState({
    age: '',
    gender: 'M',
    height_cm: '',
    weight_kg: '',
    goal_weight_kg: '',
    activity_level: 'moderate',
    fasting_protocol: 'none',
    fasting_eating_start: '',
    fasting_eating_end: '',
    medical_conditions: [] as string[],
    allergens: [] as string[],
    blood_type: 'unknown',
    is_smoker: false,
    pregnancy_status: 'none',
  });
  const [healthSaving, setHealthSaving] = useState(false);
  const [healthSaved, setHealthSaved] = useState(false);

  // Auth headers helper
  const buildAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    try {
      const backup = localStorage.getItem('marechef-session')
      if (backup) {
        const parsed = JSON.parse(backup)
        if (parsed?.access_token) { h['Authorization'] = `Bearer ${parsed.access_token}`; return h }
      }
    } catch { /* ignore */ }
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) h['Authorization'] = `Bearer ${session.access_token}`
    return h
  }, []);

  // Load health profile when healthMode is active and user is available
  useEffect(() => {
    if (!healthMode || !user) return;
    buildAuthHeaders().then(async (headers) => {
      try {
        const res = await fetch('/api/health/profile', { headers })
        if (res.ok) {
          const data = await res.json()
          if (data.profile) {
            setHealthProfile(data.profile)
            setHealthForm({
              age: data.profile.age != null ? String(data.profile.age) : '',
              gender: data.profile.gender ?? 'M',
              height_cm: data.profile.height_cm != null ? String(data.profile.height_cm) : '',
              weight_kg: data.profile.weight_kg != null ? String(data.profile.weight_kg) : '',
              goal_weight_kg: data.profile.goal_weight_kg != null ? String(data.profile.goal_weight_kg) : '',
              activity_level: data.profile.activity_level ?? 'moderate',
              fasting_protocol: data.profile.fasting_protocol ?? 'none',
              fasting_eating_start: data.profile.fasting_eating_start ?? '',
              fasting_eating_end: data.profile.fasting_eating_end ?? '',
              medical_conditions: data.profile.medical_conditions ?? [],
              allergens: data.profile.allergens ?? [],
              blood_type: data.profile.blood_type ?? 'unknown',
              is_smoker: data.profile.is_smoker ?? false,
              pregnancy_status: data.profile.pregnancy_status ?? 'none',
            })
          }
          setHealthOpen(true)
        }
      } catch { /* ignore */ }
    })
  }, [healthMode, user, buildAuthHeaders]);

  async function saveHealthProfile(e: React.FormEvent) {
    e.preventDefault()
    if (healthSaving) return
    setHealthSaving(true)
    setHealthSaved(false)
    try {
      const headers = await buildAuthHeaders()
      const body: Record<string, unknown> = {
        age: healthForm.age ? Number(healthForm.age) : undefined,
        gender: healthForm.gender || undefined,
        height_cm: healthForm.height_cm ? Number(healthForm.height_cm) : undefined,
        weight_kg: healthForm.weight_kg ? Number(healthForm.weight_kg) : undefined,
        goal_weight_kg: healthForm.goal_weight_kg ? Number(healthForm.goal_weight_kg) : null,
        activity_level: healthForm.activity_level || undefined,
        fasting_protocol: healthForm.fasting_protocol || undefined,
        fasting_eating_start: healthForm.fasting_protocol !== 'none' ? (healthForm.fasting_eating_start || null) : null,
        fasting_eating_end: healthForm.fasting_protocol !== 'none' ? (healthForm.fasting_eating_end || null) : null,
        medical_conditions: healthForm.medical_conditions,
        allergens: healthForm.allergens,
        blood_type: healthForm.blood_type,
        is_smoker: healthForm.is_smoker,
        pregnancy_status: healthForm.pregnancy_status,
      }
      const res = await fetch('/api/health/profile', { method: 'POST', headers, body: JSON.stringify(body) })
      if (res.ok) {
        const data = await res.json()
        if (data.profile) setHealthProfile(data.profile)
        setHealthSaved(true)
        setTimeout(() => setHealthSaved(false), 3000)
      }
    } finally {
      setHealthSaving(false)
    }
  }

  function toggleMultiSelect(field: 'medical_conditions' | 'allergens', value: string) {
    setHealthForm(f => {
      const current = f[field]
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value]
      return { ...f, [field]: next }
    })
  }

  useEffect(() => {
    let mounted = true;

    const buildProfileHeaders = async (): Promise<Record<string, string>> => {
      const h: Record<string, string> = {}
      try {
        const backup = localStorage.getItem('marechef-session')
        if (backup) {
          const parsed = JSON.parse(backup)
          if (parsed?.access_token) {
            h['Authorization'] = `Bearer ${parsed.access_token}`
            return h
          }
        }
      } catch {}
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) h['Authorization'] = `Bearer ${session.access_token}`
      return h
    }

    const getUser = async () => {
      // 1. Try marechef-session (primary)
      try {
        const backup = localStorage.getItem('marechef-session')
        if (backup) {
          const parsed = JSON.parse(backup)
          if (parsed?.user?.id) return parsed.user
        }
      } catch {}
      // 2. Try Supabase session
      try {
        const { data: { session: _sess } } = await supabase.auth.getSession()
        if (_sess?.user) return _sess.user
      } catch {}
      // 3. Try sb-*-auth-token (Supabase cookie format in localStorage)
      try {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
            const raw = localStorage.getItem(key)
            if (raw) {
              const parsed = JSON.parse(raw)
              if (parsed?.user?.id) return parsed.user
            }
          }
        }
      } catch {}
      return null
    }

    (async () => {
      try {
        const u = await getUser()
        if (!mounted) return;
        setUser(u ?? null);

        if (!u) {
          if (mounted) setProfileLoading(false)
          return
        }

        if (u) {
          try {
            const profileHeaders = await buildProfileHeaders()
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
        if (mounted) setProfileLoading(true)
        buildProfileHeaders()
          .then(profileHeaders => fetch('/api/profiles/me', { headers: profileHeaders }))
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

        {/* ===== PROFILE CARD ===== */}
        <section className="flex flex-col gap-3">
          {profileLoading ? (
            <div className="flex items-center gap-3 opacity-60">
              <div className="w-12 h-12 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.1)' }} />
              <div className="flex flex-col gap-1.5">
                <div className="w-28 h-3 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.1)' }} />
                <div className="w-20 h-3 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.07)' }} />
              </div>
            </div>
          ) : profile ? (
            <>
              {(() => {
                const displayedProfile = profile
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
                        Vezi profilul bucătarului &rarr;
                      </Link>
                      {user && (
                        <Link
                          href="/me/profile/edit"
                          className="inline-block text-xs font-semibold opacity-75 hover:opacity-100 transition-opacity"
                        >
                          Editează &rarr;
                        </Link>
                      )}
                    </div>
                  </>
                )
              })()}
            </>
          ) : user ? (
            <div className="text-sm opacity-60">Se încarcă profilul...</div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
                style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)' }}>
                👨‍🍳
              </div>
              <p className="text-sm opacity-70 text-center">Conectează-te pentru a accesa profilul tău, rețetele salvate și setările de sănătate.</p>
              <SignInButton />
            </div>
          )}
        </section>

        {/* ===== SECTION 1: QUICK ACTIONS ===== */}
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
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <span className="text-lg">📝</span>
                <span className="text-sm font-medium">Postările mele</span>
              </Link>
              <Link
                href="/me/messages"
                className="h-12 px-4 rounded-lg flex items-center gap-3 transition-colors"
                style={{
                  color: 'hsl(var(--foreground))',
                }}
              >
                <span className="text-lg">✉️</span>
                <span className="text-sm font-medium">Mesaje</span>
              </Link>
            </nav>
          </section>
        )}

        {/* ===== SECTION 2: SANATATE (collapsible) ===== */}
        {user && (
          <section className="flex flex-col gap-0 rounded-lg overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <button
              onClick={() => setHealthOpen(v => !v)}
              className="h-12 px-4 flex items-center justify-between font-semibold text-sm transition-colors hover:opacity-80"
              style={{ background: 'rgba(255, 77, 109, 0.08)', color: 'hsl(var(--foreground))' }}
            >
              <span>Sănătate</span>
              <span style={{ transform: healthOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms' }}>▼</span>
            </button>

            {healthOpen && (
              <div className="flex flex-col gap-0 p-0">
                {/* Health Mode Toggle */}
                <div className="flex items-center justify-between gap-4 px-4 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">Modul Sănătate</div>
                    <div className="text-xs opacity-60">Obiective, calorii, macronutrienți</div>
                  </div>
                  <button
                    onClick={() => toggle("healthMode", healthMode)}
                    className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0"
                    style={{ background: healthMode ? 'hsl(var(--primary))' : 'rgba(255,255,255,0.1)' }}
                    aria-pressed={healthMode}
                  >
                    <span
                      className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                      style={{ transform: healthMode ? 'translateX(24px)' : 'translateX(4px)' }}
                    />
                  </button>
                </div>

                {/* Health Profile Form — shown when healthMode is ON */}
                {healthMode && (
                  <div className="border-t px-4 py-4 flex flex-col gap-4" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,77,109,0.04)' }}>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold" style={{ color: '#ff4d6d' }}>🏥 Profil de sănătate</div>
                      {healthProfile?.daily_calorie_target != null && (
                        <div className="text-xs opacity-70 text-right">
                          <span className="font-semibold">{healthProfile.daily_calorie_target.toLocaleString('ro-RO')} kcal</span> / zi
                          &nbsp;|&nbsp; Apă: {healthProfile.daily_water_goal_ml != null ? `${(healthProfile.daily_water_goal_ml / 1000).toFixed(1).replace('.', ',')}L` : '—'}
                        </div>
                      )}
                    </div>

                    <form onSubmit={saveHealthProfile} className="flex flex-col gap-4">

                      {/* ---- Subsecțiunea 1: Date personale ---- */}
                      <div className="text-xs font-semibold uppercase tracking-wider opacity-40 pt-2">Date personale</div>

                      {/* Row 1: Age, Gender */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs opacity-60">Vârstă</label>
                          <input
                            type="number" min={10} max={100}
                            placeholder="Ex: 30"
                            value={healthForm.age}
                            onChange={e => setHealthForm(f => ({ ...f, age: e.target.value }))}
                            className="px-3 py-2 rounded-lg text-sm"
                            style={inputStyle}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs opacity-60">Sex</label>
                          <div className="flex gap-2">
                            {['M', 'F'].map(g => (
                              <button key={g} type="button"
                                onClick={() => setHealthForm(f => ({ ...f, gender: g }))}
                                className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                                style={{
                                  background: healthForm.gender === g ? 'rgba(255,77,109,0.3)' : 'rgba(255,255,255,0.06)',
                                  border: healthForm.gender === g ? '1px solid #ff4d6d' : '1px solid rgba(255,255,255,0.1)',
                                  color: 'hsl(var(--foreground))',
                                }}
                              >
                                {g === 'M' ? 'Masculin' : 'Feminin'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Row 2: Height, Weight, Goal weight */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs opacity-60">Înălțime (cm)</label>
                          <input
                            type="number" min={100} max={250}
                            placeholder="175"
                            value={healthForm.height_cm}
                            onChange={e => setHealthForm(f => ({ ...f, height_cm: e.target.value }))}
                            className="px-3 py-2 rounded-lg text-sm"
                            style={inputStyle}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs opacity-60">Greutate (kg)</label>
                          <input
                            type="number" min={20} max={300} step={0.1}
                            placeholder="70"
                            value={healthForm.weight_kg}
                            onChange={e => setHealthForm(f => ({ ...f, weight_kg: e.target.value }))}
                            className="px-3 py-2 rounded-lg text-sm"
                            style={inputStyle}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs opacity-60">Greutate țintă</label>
                          <input
                            type="number" min={20} max={300} step={0.1}
                            placeholder="Opțional"
                            value={healthForm.goal_weight_kg}
                            onChange={e => setHealthForm(f => ({ ...f, goal_weight_kg: e.target.value }))}
                            className="px-3 py-2 rounded-lg text-sm"
                            style={inputStyle}
                          />
                        </div>
                      </div>

                      {/* Activity Level */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs opacity-60">Nivel activitate</label>
                        <select
                          value={healthForm.activity_level}
                          onChange={e => setHealthForm(f => ({ ...f, activity_level: e.target.value }))}
                          className="px-3 py-2 rounded-lg text-sm"
                          style={inputStyle}
                        >
                          <option value="sedentary">Sedentar (birou, fără exerciții)</option>
                          <option value="light">Ușor activ (1-3 zile/săpt.)</option>
                          <option value="moderate">Moderat activ (3-5 zile/săpt.)</option>
                          <option value="heavy">Foarte activ (6-7 zile/săpt.)</option>
                          <option value="athlete">Atlet (antrenamente intense zilnice)</option>
                        </select>
                      </div>

                      {/* ---- Subsecțiunea 2: Condiții medicale și alergeni ---- */}
                      <div className="text-xs font-semibold uppercase tracking-wider opacity-40 pt-2">Condiții medicale și alergeni</div>

                      {/* Medical Conditions */}
                      <div className="flex flex-col gap-2">
                        <label className="text-xs opacity-60">Condiții medicale</label>
                        <div className="flex flex-wrap gap-2">
                          {MEDICAL_CONDITIONS.map(c => {
                            const selected = healthForm.medical_conditions.includes(c.value)
                            return (
                              <button
                                key={c.value}
                                type="button"
                                onClick={() => toggleMultiSelect('medical_conditions', c.value)}
                                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                                style={{
                                  background: selected ? 'rgba(255,77,109,0.25)' : 'rgba(255,255,255,0.06)',
                                  border: selected ? '1px solid #ff4d6d' : '1px solid rgba(255,255,255,0.1)',
                                  color: 'hsl(var(--foreground))',
                                }}
                              >
                                {c.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Allergens */}
                      <div className="flex flex-col gap-2">
                        <label className="text-xs opacity-60">Alergeni</label>
                        <div className="flex flex-wrap gap-2">
                          {ALLERGENS.map(a => {
                            const selected = healthForm.allergens.includes(a.value)
                            return (
                              <button
                                key={a.value}
                                type="button"
                                onClick={() => toggleMultiSelect('allergens', a.value)}
                                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                                style={{
                                  background: selected ? 'rgba(255,149,0,0.25)' : 'rgba(255,255,255,0.06)',
                                  border: selected ? '1px solid #ff9500' : '1px solid rgba(255,255,255,0.1)',
                                  color: 'hsl(var(--foreground))',
                                }}
                              >
                                {a.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* ---- Subsecțiunea 3: Informații suplimentare ---- */}
                      <div className="text-xs font-semibold uppercase tracking-wider opacity-40 pt-2">Informații suplimentare</div>

                      {/* Blood type + Smoker row */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs opacity-60">Grupa sanguină</label>
                          <select
                            value={healthForm.blood_type}
                            onChange={e => setHealthForm(f => ({ ...f, blood_type: e.target.value }))}
                            className="px-3 py-2 rounded-lg text-sm"
                            style={inputStyle}
                          >
                            <option value="unknown">Nu știu</option>
                            {BLOOD_TYPES.map(bt => (
                              <option key={bt} value={bt}>{bt}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs opacity-60">Fumător</label>
                          <div className="flex gap-2">
                            {[false, true].map(val => (
                              <button
                                key={String(val)}
                                type="button"
                                onClick={() => setHealthForm(f => ({ ...f, is_smoker: val }))}
                                className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                                style={{
                                  background: healthForm.is_smoker === val ? 'rgba(255,77,109,0.3)' : 'rgba(255,255,255,0.06)',
                                  border: healthForm.is_smoker === val ? '1px solid #ff4d6d' : '1px solid rgba(255,255,255,0.1)',
                                  color: 'hsl(var(--foreground))',
                                }}
                              >
                                {val ? 'Da' : 'Nu'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Pregnancy — only for F */}
                      {healthForm.gender === 'F' && (
                        <div className="flex flex-col gap-1">
                          <label className="text-xs opacity-60">Gravidă / Alăptare</label>
                          <select
                            value={healthForm.pregnancy_status}
                            onChange={e => setHealthForm(f => ({ ...f, pregnancy_status: e.target.value }))}
                            className="px-3 py-2 rounded-lg text-sm"
                            style={inputStyle}
                          >
                            <option value="none">Nu</option>
                            <option value="pregnant">Gravidă</option>
                            <option value="breastfeeding">Alăptare</option>
                          </select>
                        </div>
                      )}

                      {/* ---- Subsecțiunea 4: Fasting ---- */}
                      <div className="text-xs font-semibold uppercase tracking-wider opacity-40 pt-2">Fasting</div>

                      {/* Fasting Protocol */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs opacity-60">Protocol fasting</label>
                        <select
                          value={healthForm.fasting_protocol}
                          onChange={e => setHealthForm(f => ({ ...f, fasting_protocol: e.target.value }))}
                          className="px-3 py-2 rounded-lg text-sm"
                          style={inputStyle}
                        >
                          <option value="none">Niciunul</option>
                          <option value="16:8">16:8 (16h post, 8h masă)</option>
                          <option value="18:6">18:6 (18h post, 6h masă)</option>
                          <option value="20:4">20:4 (20h post, 4h masă)</option>
                          <option value="omad">OMAD (o masă pe zi)</option>
                          <option value="5:2">5:2 (restricție 2 zile/săpt.)</option>
                        </select>
                      </div>

                      {/* Fasting window */}
                      {healthForm.fasting_protocol !== 'none' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs opacity-60">Ora început masă</label>
                            <input
                              type="time"
                              value={healthForm.fasting_eating_start}
                              onChange={e => setHealthForm(f => ({ ...f, fasting_eating_start: e.target.value }))}
                              className="px-3 py-2 rounded-lg text-sm"
                              style={inputStyle}
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs opacity-60">Ora sfârșit masă</label>
                            <input
                              type="time"
                              value={healthForm.fasting_eating_end}
                              onChange={e => setHealthForm(f => ({ ...f, fasting_eating_end: e.target.value }))}
                              className="px-3 py-2 rounded-lg text-sm"
                              style={inputStyle}
                            />
                          </div>
                        </div>
                      )}

                      {/* Calculated target preview */}
                      {healthProfile?.daily_calorie_target != null && (
                        <div className="rounded-lg px-3 py-2 text-xs font-medium"
                          style={{ background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.2)', color: '#ff9500' }}>
                          Ținta ta: {healthProfile.daily_calorie_target.toLocaleString('ro-RO')} kcal&nbsp;|&nbsp;
                          Apă: {healthProfile.daily_water_goal_ml != null
                            ? `${(healthProfile.daily_water_goal_ml / 1000).toFixed(1).replace('.', ',')}L`
                            : '—'}
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <button
                          type="submit"
                          disabled={healthSaving}
                          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                          style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)' }}
                        >
                          {healthSaving ? 'Se salvează...' : 'Salvează profilul'}
                        </button>
                        {healthSaved && (
                          <span className="text-xs font-semibold" style={{ color: '#22c55e' }}>Salvat!</span>
                        )}
                      </div>
                    </form>

                    {/* Link to Health Dashboard */}
                    <Link
                      href="/health"
                      className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
                      style={{
                        background: 'rgba(255,77,109,0.12)',
                        border: '1px solid rgba(255,77,109,0.25)',
                        color: '#ff4d6d',
                      }}
                    >
                      🏥 Mergi la Dashboard Sănătate &rarr;
                    </Link>

                    {/* Medical disclaimer */}
                    <div className="flex items-start gap-2 rounded-lg px-3 py-2.5" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
                      <span className="text-base flex-shrink-0">⚠️</span>
                      <p className="text-xs leading-relaxed" style={{ color: 'rgba(251,191,36,0.9)' }}>
                        Informațiile nutriționale sunt orientative și nu înlocuiesc sfatul medicului. Consultă un specialist înainte de a modifica dieta.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ===== SECTION 3: SETARI (collapsible) ===== */}
        <section className="flex flex-col gap-0 rounded-lg overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="h-12 px-4 flex items-center justify-between font-semibold text-sm transition-colors hover:opacity-80"
            style={{ background: 'rgba(255, 77, 109, 0.08)', color: 'hsl(var(--foreground))' }}
          >
            <span>Setări</span>
            <span style={{ transform: settingsOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms' }}>▼</span>
          </button>

          {settingsOpen && (
            <div className="flex flex-col gap-0 p-0">
              {/* Theme Toggle */}
              <div className="px-4 py-3 border-t flex items-center gap-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <div className="flex-1">
                  <div className="text-sm font-semibold">Aspect</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTheme('dark')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${theme === 'dark' ? 'opacity-100' : 'opacity-50'}`}
                    style={{
                      background: theme === 'dark' ? 'rgba(255, 77, 109, 0.2)' : 'transparent',
                      color: 'hsl(var(--foreground))',
                    }}
                  >
                    🌙 Întunecat
                  </button>
                  <button
                    onClick={() => setTheme('light')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${theme === 'light' ? 'opacity-100' : 'opacity-50'}`}
                    style={{
                      background: theme === 'light' ? 'rgba(255, 77, 109, 0.2)' : 'transparent',
                      color: 'hsl(var(--foreground))',
                    }}
                  >
                    ☀️ Luminos
                  </button>
                </div>
              </div>

              {/* Privacy link */}
              <div className="border-t px-2 py-2 flex flex-col gap-1" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <Link
                  href="/privacy"
                  className="px-2 py-2 rounded text-sm opacity-75 hover:opacity-100 transition-opacity"
                >
                  🔒 Confidențialitate
                </Link>
              </div>
            </div>
          )}
        </section>


      </div>
    </main>
  );
}
