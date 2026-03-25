'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { BudgetTier, CartResult, IngredientMatch } from '@/lib/ai-provider'
import { supabase } from '@/lib/supabase-client'

interface ListItem {
  id: string
  name: string
  amount?: number | null
  unit?: string | null
  checked: boolean
}

interface VendorConfig {
  vendor_id: string
  vendorName?: string
  is_default: boolean
}

const BG = '#dde3ee'

const VENDOR_LABELS: Record<string, string> = {
  bringo: 'Bringo',
  glovo: 'Glovo',
  cora: 'Cora',
  carrefour: 'Carrefour',
  kaufland: 'Kaufland',
  mega_image: 'Mega Image',
}

const BUDGET_LABELS: Record<BudgetTier, string> = {
  budget: '💰 Budget',
  normal: '⚖️ Normal',
  premium: '✨ Premium',
}

export default function GroceryMatchClient({ listId }: { listId: string }) {
  const router = useRouter()
  const [items, setItems] = useState<ListItem[]>([])
  const [budgetTier, setBudgetTier] = useState<BudgetTier>('normal')
  const [vendorId, setVendorId] = useState<string>('bringo')
  const [availableVendors, setAvailableVendors] = useState<VendorConfig[]>([])
  const [matches, setMatches] = useState<IngredientMatch[]>([])
  const [estimatedTotal, setEstimatedTotal] = useState<number | null>(null)
  const [cartResult, setCartResult] = useState<CartResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [matching, setMatching] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showVendorPicker, setShowVendorPicker] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    // Primary: read from our persisted session
    try {
      const backup = localStorage.getItem('marechef-session')
      if (backup) {
        const parsed = JSON.parse(backup)
        if (parsed?.access_token) {
          headers['Authorization'] = `Bearer ${parsed.access_token}`
          return headers
        }
      }
    } catch {}
    // Fallback: try Supabase client
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
    return headers
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const headers = await getAuthHeaders()
      const [itemsRes, budgetRes, vendorRes] = await Promise.all([
        fetch(`/api/shopping-lists/${listId}/items`, { headers }),
        fetch('/api/grocery/budget-prefs', { headers }),
        fetch('/api/grocery/vendors/my', { headers }),
      ])
      if (itemsRes.ok) setItems(await itemsRes.json())
      if (budgetRes.ok) { const d = await budgetRes.json(); setBudgetTier(d.default_budget_tier) }
      if (vendorRes.ok) {
        const configs: VendorConfig[] = await vendorRes.json()
        setAvailableVendors(configs)
        const defaultV = configs.find(c => c.is_default)
        if (defaultV) setVendorId(defaultV.vendor_id)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [listId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData() }, [fetchData])

  const handleMatch = async () => {
    setMatching(true)
    setError(null)
    try {
      const unchecked = items.filter(i => !i.checked)
      const ingredients = unchecked.map(i =>
        [i.amount != null && i.amount, i.unit, i.name].filter(Boolean).join(' ')
      )
      const res = await fetch('/api/grocery/match', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ ingredients, vendor_id: vendorId, budget_tier: budgetTier }),
      })
       if (!res.ok) throw new Error('Potrivirea a eșuat')
      const data = await res.json()
      setMatches(data.matches as IngredientMatch[])
      setEstimatedTotal(data.estimatedTotal)
     } catch (e) {
       setError(e instanceof Error ? e.message : 'Ceva a mers greșit')
     } finally {
       setMatching(false)
     }
   }

  const handleCheckout = async () => {
    setCheckingOut(true)
    setError(null)
    try {
      const cartItems = matches
        .filter(m => m.recommended !== null)
        .map(m => ({
          product: m.recommended!,
          quantity: 1,
          ingredientRef: m.ingredientRef,
        }))

      if (cartItems.length === 0) throw new Error('Niciun produs de comandat')

      const res = await fetch('/api/grocery/checkout', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ vendor_id: vendorId, items: cartItems, budget_tier: budgetTier }),
      })
      if (!res.ok) throw new Error('Comanda a eșuat')
      const data: CartResult = await res.json()
      setCartResult(data)

      // Save order to Supabase
      await fetch('/api/grocery/orders', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          shopping_list_id: listId,
          vendor_id: vendorId,
          items: cartItems,
          total_estimated_price: data.estimatedTotal ?? null,
          currency: data.currency ?? 'RON',
          handoff_url: data.checkoutUrl ?? null,
          status: 'sent',
        }),
      }).catch(() => { /* order save is best-effort */ })

      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, '_blank', 'noopener,noreferrer')
      }
     } catch (e) {
       setError(e instanceof Error ? e.message : 'Ceva a mers greșit')
     } finally {
       setCheckingOut(false)
     }
   }

  const vendorLabel = VENDOR_LABELS[vendorId] ?? vendorId
  const unchecked = items.filter(i => !i.checked)
  const matchedCount = matches.filter(m => m.product !== null).length

  if (loading) {
    return (
      <main style={{ background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#555', textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '3px solid #ccc', borderTopColor: '#555', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
           Se încarcă…
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </main>
    )
  }

  return (
    <main style={{ background: BG, minHeight: '100vh', color: '#111', paddingBottom: 100 }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '16px 16px 0' }}>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => router.back()}
            style={{
              background: '#fff', border: 'none', cursor: 'pointer', color: '#444',
              fontSize: 20, width: 44, height: 44, borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)', flexShrink: 0,
            }}
            aria-label="Înapoi"
          >
            ←
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>🛒 Potrivire Produse</h1>
            <p style={{ color: '#666', fontSize: 13, margin: '2px 0 0' }}>
              {unchecked.length} item{unchecked.length !== 1 ? 's' : ''} · {vendorLabel} · {BUDGET_LABELS[budgetTier]}
            </p>
          </div>
          <button
            onClick={() => setShowSettings(s => !s)}
            style={{
              background: showSettings ? '#111' : '#fff', border: 'none', cursor: 'pointer',
              color: showSettings ? '#fff' : '#444', fontSize: 18, width: 44, height: 44,
              borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)', flexShrink: 0,
            }}
            aria-label="Settings"
          >
            ⚙️
          </button>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#888', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Setări Potrivire</h3>

            {/* Vendor picker */}
            <div style={{ marginBottom: 14 }}>
               <div style={{ fontSize: 13, color: '#555', marginBottom: 6, fontWeight: 500 }}>Magazin</div>
              {availableVendors.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {availableVendors.map(v => (
                    <button
                      key={v.vendor_id}
                      onClick={() => { setVendorId(v.vendor_id); setMatches([]); setCartResult(null); setEstimatedTotal(null) }}
                      style={{
                        background: vendorId === v.vendor_id ? '#111' : '#f3f3f3',
                        color: vendorId === v.vendor_id ? '#fff' : '#333',
                        border: 'none', borderRadius: 10, padding: '8px 14px',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        minHeight: 36,
                      }}
                    >
                      {VENDOR_LABELS[v.vendor_id] ?? v.vendor_id}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {Object.entries(VENDOR_LABELS).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => { setVendorId(id); setMatches([]); setCartResult(null); setEstimatedTotal(null) }}
                      style={{
                        background: vendorId === id ? '#111' : '#f3f3f3',
                        color: vendorId === id ? '#fff' : '#333',
                        border: 'none', borderRadius: 10, padding: '8px 14px',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        minHeight: 36,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Budget picker */}
            <div>
              <div style={{ fontSize: 13, color: '#555', marginBottom: 6, fontWeight: 500 }}>Buget</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(Object.entries(BUDGET_LABELS) as [BudgetTier, string][]).map(([tier, label]) => (
                  <button
                    key={tier}
                    onClick={() => { setBudgetTier(tier); setMatches([]); setCartResult(null); setEstimatedTotal(null) }}
                    style={{
                      flex: 1, background: budgetTier === tier ? '#111' : '#f3f3f3',
                      color: budgetTier === tier ? '#fff' : '#333',
                      border: 'none', borderRadius: 10, padding: '8px 10px',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      minHeight: 36,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: '#ffe0e0', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#c00', fontSize: 14 }}>
            {error}
          </div>
        )}

        {/* Items preview (before match) */}
        {matches.length === 0 && (
          <section style={{ background: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 12px' }}>Articole de trimis ({unchecked.length})</h2>
            {unchecked.length === 0 ? (
              <p style={{ color: '#888', fontSize: 14 }}>Toate articolele sunt bifate — nimic de trimis.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {unchecked.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #f3f3f3' }}>
                    <span style={{ fontSize: 14, flex: 1 }}>{item.name}</span>
                    {(item.amount != null || item.unit) && (
                      <span style={{ fontSize: 12, color: '#888' }}>
                        {item.amount != null && item.amount}{item.unit && ` ${item.unit}`}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Match results */}
        {matches.length > 0 && (
          <section style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
                {vendorLabel} · {matchedCount}/{matches.length} matched
              </h2>
              {estimatedTotal !== null && (
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1a7f37', background: '#e6f4ea', borderRadius: 8, padding: '4px 10px' }}>
                  ~{estimatedTotal.toFixed(2)} RON
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {matches.map((match, idx) => (
                <div key={idx} style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderLeft: `3px solid ${match.product ? '#1a7f37' : '#e55'}` }}>
                  <div style={{ fontSize: 11, color: '#999', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{match.ingredientRef}</div>
                  {match.product ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{match.product.name}</div>
                        <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
                          {match.product.packageSize} · <strong>{match.product.pricePerUnit.toFixed(2)} RON</strong>
                          {match.product.baseUnitLabel && (
                            <span style={{ color: '#888', marginLeft: 6 }}>({match.product.pricePerBaseUnit?.toFixed(2)} {match.product.baseUnitLabel})</span>
                          )}
                        </div>
                      </div>
                      <span style={{ fontSize: 18 }}>✅</span>
                    </div>
                  ) : (
                   <div style={{ color: '#c55', fontSize: 13, fontStyle: 'italic' }}>
                       Niciun produs găsit
                      {match.substitution && (
                        <span style={{ color: '#777', marginLeft: 6, fontStyle: 'normal' }}>· Try: {match.substitution.substitute}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Cart result */}
        {cartResult && (
          <section style={{ background: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderTop: '3px solid #1a7f37' }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 8px' }}>✅ Order Ready</h2>
            {cartResult.estimatedTotal != null && (
              <div style={{ fontSize: 14, color: '#555', marginBottom: 12 }}>
                Estimated total: <strong>{cartResult.estimatedTotal.toFixed(2)} RON</strong>
              </div>
            )}
            {cartResult.checkoutUrl && (
              <a
                href={cartResult.checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#111', color: '#fff', borderRadius: 10, padding: '12px 20px', fontSize: 14, fontWeight: 600, textDecoration: 'none', minHeight: 44 }}
              >
                Open in {vendorLabel} →
              </a>
            )}
            {cartResult.requiresAppHandoff && cartResult.handoffMessage && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, color: '#777', marginBottom: 6 }}>Copy your {vendorLabel} order:</div>
                <pre style={{ background: '#f5f5f5', borderRadius: 8, padding: 12, fontSize: 12, overflow: 'auto', maxHeight: 200, whiteSpace: 'pre-wrap' }}>
                  {cartResult.handoffMessage}
                </pre>
                 <button
                   onClick={() => navigator.clipboard.writeText(cartResult.handoffMessage!)}
                   style={{ marginTop: 8, background: '#555', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 12, cursor: 'pointer', minHeight: 36 }}
                 >
                   Copiază în clipboard
                 </button>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Sticky action bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(221,227,238,0.95)', backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(0,0,0,0.07)', padding: '12px 16px',
        zIndex: 50,
      }}>
        <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', gap: 10 }}>
          {matches.length === 0 ? (
            <button
              onClick={handleMatch}
              disabled={matching || unchecked.length === 0}
              style={{
                flex: 1,
                background: matching || unchecked.length === 0 ? '#ccc' : '#111',
                color: '#fff', border: 'none', borderRadius: 14,
                padding: '0 20px', height: 52, fontSize: 15, fontWeight: 700,
                cursor: matching || unchecked.length === 0 ? 'not-allowed' : 'pointer',
                boxShadow: matching || unchecked.length === 0 ? 'none' : '0 4px 12px rgba(0,0,0,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {matching ? '⏳ Se potrivește…' : `🔍 Potrivire pe ${vendorLabel}`}
            </button>
          ) : (
            <>
              <button
                onClick={() => { setMatches([]); setCartResult(null); setEstimatedTotal(null) }}
                style={{
                  background: '#fff', color: '#333', border: 'none', borderRadius: 14,
                  padding: '0 16px', height: 52, fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                 ← Refă
              </button>
              {!cartResult && (
                <button
                  onClick={handleCheckout}
                  disabled={checkingOut || matchedCount === 0}
                  style={{
                    flex: 1,
                    background: checkingOut || matchedCount === 0 ? '#ccc' : '#111',
                    color: '#fff', border: 'none', borderRadius: 14,
                    padding: '0 20px', height: 52, fontSize: 15, fontWeight: 700,
                    cursor: checkingOut || matchedCount === 0 ? 'not-allowed' : 'pointer',
                    boxShadow: checkingOut || matchedCount === 0 ? 'none' : '0 4px 12px rgba(0,0,0,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {checkingOut ? '⏳ Se pregătește…' : `🚀 Trimite la ${vendorLabel}`}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </main>
  )
}
