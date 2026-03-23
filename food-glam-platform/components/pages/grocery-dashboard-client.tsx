'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { BudgetTier } from '@/lib/ai-provider'
import type { GroceryVendor } from '@/lib/grocery/vendors'
import { supabase } from '@/lib/supabase-client'

interface ShoppingList {
  id: string
  name: string
  created_at: string
  source_type?: string | null
}

interface UserVendorConfig {
  vendor_id: string
  is_default: boolean
  preferred_store?: string | null
  preferred_city?: string | null
}

interface BudgetPrefs {
  default_budget_tier: BudgetTier
  pack_size_optimisation: boolean
  substitutions_enabled: boolean
}

const BUDGET_META: Record<BudgetTier, { label: string; color: string; bg: string; desc: string }> = {
   budget:  { label: '💚 Budget',  color: '#1b5e20', bg: '#e8f5e9', desc: 'Preț minim · Kaufland → Bringo → Glovo' },
    normal:  { label: '💛 Normal',  color: '#5d4037', bg: '#fff8e1', desc: 'Preț + comoditate · Bringo → Carrefour → Freshful' },
    premium: { label: '💎 Premium', color: '#8B1A2B', bg: '#fce8eb', desc: 'Cea mai bună calitate · Freshful → Carrefour → Bringo' },
  }

const BG = '#dde3ee'

export default function GroceryDashboardClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Support coming from scan "Order missing" with a pre-selected list
  const fromScan = searchParams.get('from_scan')

  const [lists, setLists] = useState<ShoppingList[]>([])
  const [vendors, setVendors] = useState<GroceryVendor[]>([])
  const [myVendors, setMyVendors] = useState<UserVendorConfig[]>([])
  const [budgetPrefs, setBudgetPrefs] = useState<BudgetPrefs>({ default_budget_tier: 'normal', pack_size_optimisation: true, substitutions_enabled: true })
  const [loading, setLoading] = useState(true)
  const [savingBudget, setSavingBudget] = useState(false)
  const [togglingVendor, setTogglingVendor] = useState<string | null>(null)
  const [showSetup, setShowSetup] = useState(false) // accordion for budget/vendor config

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
    return headers
  }, [])

  const fetchAll = useCallback(async () => {
    try {
      const headers = await getAuthHeaders()
      const [listsRes, vendorsRes, myVRes, budgetRes] = await Promise.all([
        fetch('/api/shopping-lists', { headers }),
        fetch('/api/grocery/vendors'),
        fetch('/api/grocery/vendors/my', { headers }),
        fetch('/api/grocery/budget-prefs', { headers }),
      ])
      if (listsRes.ok) setLists(await listsRes.json())
      if (vendorsRes.ok) setVendors(await vendorsRes.json())
      if (myVRes.ok) {
        const configs: UserVendorConfig[] = await myVRes.json()
        setMyVendors(configs)
        // Auto-open setup if no stores selected yet
        if (configs.length === 0) setShowSetup(true)
      }
      if (budgetRes.ok) setBudgetPrefs(await budgetRes.json())
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [getAuthHeaders])

  useEffect(() => { fetchAll() }, [fetchAll])

  const toggleVendor = async (vendorId: string) => {
    setTogglingVendor(vendorId)
    const isActive = myVendors.some(v => v.vendor_id === vendorId)
    try {
      if (isActive) {
        await fetch('/api/grocery/vendors/my', {
          method: 'DELETE',
          headers: await getAuthHeaders(),
          body: JSON.stringify({ vendor_id: vendorId }),
        })
        setMyVendors(prev => prev.filter(v => v.vendor_id !== vendorId))
      } else {
        const res = await fetch('/api/grocery/vendors/my', {
          method: 'POST',
          headers: await getAuthHeaders(),
          body: JSON.stringify({ vendor_id: vendorId, is_default: myVendors.length === 0 }),
        })
        if (res.ok) {
          const data: UserVendorConfig = await res.json()
          setMyVendors(prev => [...prev, data])
        }
      }
    } finally {
      setTogglingVendor(null)
    }
  }

  const saveBudget = async (tier: BudgetTier) => {
    if (tier === budgetPrefs.default_budget_tier) return
    setSavingBudget(true)
    try {
      const res = await fetch('/api/grocery/budget-prefs', {
        method: 'PATCH',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ default_budget_tier: tier }),
      })
      if (res.ok) setBudgetPrefs(await res.json())
    } finally { setSavingBudget(false) }
  }

  if (loading) {
    return (
      <main style={{ background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#555' }}>
          <div style={{ width: 32, height: 32, border: '3px solid #ccc', borderTopColor: '#555', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
           Se încarcă…
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </main>
    )
  }

  const activeVendorIds = new Set(myVendors.map(v => v.vendor_id))
  const noStoresSelected = activeVendorIds.size === 0
  const budgetMeta = BUDGET_META[budgetPrefs.default_budget_tier] ?? BUDGET_META.normal
  const activeVendorNames = (vendors ?? []).filter(v => activeVendorIds.has(v.id)).map(v => v.name)

  return (
    <main style={{ background: BG, minHeight: '100vh', color: '#111', paddingBottom: 100 }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px' }}>

        {/* Back */}
        <button
          onClick={() => router.back()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 14, padding: '8px 0', marginBottom: 12, minHeight: 44 }}
         >
           ← Înapoi
         </button>

        <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 2px' }}>🛒 Magazin de alimente</h1>
        <p style={{ color: '#666', fontSize: 14, margin: '0 0 20px' }}>
          Trimite lista de cumpărături la un magazin, optimizată pentru bugetul tău.
        </p>

        {fromScan && (
          <div style={{ background: '#e8f0fe', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#1a56db', display: 'flex', alignItems: 'center', gap: 8 }}>
             📷 <span>Vii de la o scanare — alege o listă de mai jos pentru a comanda ingredientele lipsă.</span>
          </div>
        )}

        {/* ── Config accordion ─────────────────────────────────── */}
        <button
          onClick={() => setShowSetup(s => !s)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: '#fff', borderRadius: showSetup ? '14px 14px 0 0' : 14,
            padding: '14px 18px', border: 'none', cursor: 'pointer',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: showSetup ? 0 : 16,
            transition: 'border-radius 0.15s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>⚙️</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Setări magazine</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 1 }}>
                {noStoresSelected
                  ? '⚠️ Niciun magazin selectat — atinge pentru a alege'
                  : `${budgetMeta.label} · ${activeVendorNames.join(', ')}`}
              </div>
            </div>
          </div>
          <span style={{ color: '#888', fontSize: 18, transform: showSetup ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>›</span>
        </button>

        {showSetup && (
          <div style={{ background: '#fff', borderRadius: '0 0 14px 14px', padding: '0 18px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 16 }}>
            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>

              {/* Budget selector */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Mod buget</div>
                <div style={{ display: 'flex', gap: 7 }}>
                  {(Object.entries(BUDGET_META) as [BudgetTier, typeof BUDGET_META[BudgetTier]][]).map(([tier, meta]) => (
                    <button
                      key={tier}
                      onClick={() => saveBudget(tier)}
                      disabled={savingBudget}
                      style={{
                        flex: 1, padding: '9px 4px', borderRadius: 10, fontWeight: 600, fontSize: 13,
                        border: budgetPrefs.default_budget_tier === tier ? `2px solid ${meta.color}` : '2px solid #e8e8e8',
                        background: budgetPrefs.default_budget_tier === tier ? meta.bg : '#f8f8f8',
                        color: budgetPrefs.default_budget_tier === tier ? meta.color : '#555',
                        cursor: savingBudget ? 'default' : 'pointer',
                        transition: 'all 0.15s',
                        minHeight: 44,
                      }}
                    >
                      {meta.label}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: '#888', margin: '8px 0 0' }}>{budgetMeta.desc}</p>
              </div>

              {/* Store selector */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Magazinele mele</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(vendors ?? []).map(v => {
                    const active = activeVendorIds.has(v.id)
                    const toggling = togglingVendor === v.id
                    return (
                      <div
                        key={v.id}
                        onClick={() => !toggling && toggleVendor(v.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '11px 13px', borderRadius: 10,
                          border: active ? '2px solid #111' : '2px solid #e8e8e8',
                          background: active ? '#f0f0f0' : '#fafafa',
                          cursor: toggling ? 'default' : 'pointer',
                          opacity: toggling ? 0.6 : 1,
                          transition: 'all 0.15s',
                          minHeight: 52,
                        }}
                      >
                        <span style={{ fontSize: 22 }}>{v.logoEmoji}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{v.name}</div>
                          <div style={{ fontSize: 12, color: '#777', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.description}</div>
                        </div>
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                          border: active ? '2px solid #111' : '2px solid #bbb',
                          background: active ? '#111' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {active && <span style={{ color: '#fff', fontSize: 13, lineHeight: 1 }}>✓</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Order history link ─────────────────────────────── */}
        <button
          onClick={() => router.push('/me/grocery/orders')}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            background: '#fff', borderRadius: 12, padding: '12px 16px',
            border: 'none', cursor: 'pointer', marginBottom: 16,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)', minHeight: 44,
          }}
        >
          <span style={{ fontSize: 18 }}>📋</span>
          <span style={{ flex: 1, textAlign: 'left', fontSize: 14, fontWeight: 500, color: '#333' }}>Istoric comenzi</span>
          <span style={{ color: '#888', fontSize: 14 }}>→</span>
        </button>

        {/* ── Shopping lists ───────────────────────────────────── */}
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Listele tale</h2>
          <button
            onClick={() => router.push('/me/shopping-lists')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 13, padding: '4px 0' }}
          >
            Administrează →
          </button>
        </div>

        {noStoresSelected && (
          <div style={{ background: '#fff3cd', borderRadius: 12, padding: '12px 16px', marginBottom: 12, fontSize: 13, color: '#856404', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⚠️</span>
            <span>Selectează cel puțin un magazin mai sus înainte de a trimite o listă.</span>
            <button
              onClick={() => setShowSetup(true)}
              style={{ marginLeft: 'auto', background: '#856404', color: '#fff', border: 'none', borderRadius: 7, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Configurează
            </button>
          </div>
        )}

        {lists.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 14, padding: '28px 20px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
            <p style={{ color: '#888', fontSize: 14, marginBottom: 12 }}>Nicio listă de cumpărături încă.</p>
            <button
              onClick={() => router.push('/me/shopping-lists')}
              style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 44 }}
            >
              Creează o listă
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lists.map(list => (
              <div
                key={list.id}
                style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{list.name}</div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
                    {new Date(list.created_at).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/me/grocery/match/${list.id}`)}
                  disabled={noStoresSelected}
                  style={{
                    background: noStoresSelected ? '#e0e0e0' : '#111',
                    color: noStoresSelected ? '#aaa' : '#fff',
                    border: 'none', borderRadius: 9,
                    padding: '9px 16px', fontSize: 13, fontWeight: 700,
                    cursor: noStoresSelected ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap', minHeight: 40,
                    transition: 'background 0.15s',
                  }}
                  title={noStoresSelected ? 'Selectează un magazin mai întâi' : undefined}
                >
                  Trimite →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
