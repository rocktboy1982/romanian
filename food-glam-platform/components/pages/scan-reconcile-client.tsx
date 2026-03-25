'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'

interface ShoppingList {
  id: string
  name: string
  created_at: string
}

interface ReconcileResult {
  matched: Array<{ item_id: string; item_name: string; ingredient: string }>
  unmatched_ingredients: string[]
  patched_count: number
}

const BG = '#dde3ee'

export default function ScanReconcileClient({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [lists, setLists] = useState<ShoppingList[]>([])
  const [selectedListId, setSelectedListId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reconciling, setReconciling] = useState(false)
  const [result, setResult] = useState<ReconcileResult | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  useEffect(() => {
    getAuthHeaders().then(headers => fetch('/api/shopping-lists', { headers }))
      .then(r => r.ok ? r.json() : [])
      .then((data: ShoppingList[]) => {
        setLists(data)
        if (data.length === 1) setSelectedListId(data[0].id)
      })
      .catch(() => { /* ignore */ })
      .finally(() => setLoading(false))
  }, [getAuthHeaders])

  const handleReconcile = useCallback(async () => {
    if (!selectedListId) return
    setReconciling(true)
    setError(null)
    try {
      const res = await fetch('/api/vision/reconcile-list', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ session_id: sessionId, list_id: selectedListId }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Reconcilierea a eșuat')
      }
      setResult(await res.json())
    } catch (e) {
       setError(e instanceof Error ? e.message : 'Ceva a mers greșit')
    } finally {
      setReconciling(false)
    }
  }, [sessionId, selectedListId, getAuthHeaders])

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
    <main style={{ background: BG, minHeight: '100vh', color: '#111', paddingBottom: 80 }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '16px 16px' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button
            onClick={() => router.back()}
            style={{
              background: '#fff', border: 'none', cursor: 'pointer', color: '#444',
              fontSize: 20, width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
            aria-label="Înapoi"
           >
             ←
           </button>
           <div>
             <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>✅ Actualizează Lista de Cumpărături</h1>
             <p style={{ color: '#555', fontSize: 13, margin: '2px 0 0' }}>Bifează ingredientele pe care le ai deja.</p>
          </div>
        </div>


        {error && (
          <div style={{ background: '#ffe0e0', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#c00', fontSize: 14 }}>
            {error}
          </div>
        )}

        {!result && (
          <>
            {lists.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 16, padding: 24, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
                 <p style={{ color: '#888', fontSize: 14, marginBottom: 12 }}>Nicio listă de cumpărături găsită.</p>
                 <button
                   onClick={() => router.push('/me/shopping-lists')}
                   style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer' }}
                 >
                   Creează o listă
                </button>
              </div>
            ) : (
              <section style={{ background: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 12px' }}>Alege o listă</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {lists.map(list => (
                    <div
                      key={list.id}
                      onClick={() => setSelectedListId(list.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                        border: selectedListId === list.id ? '2px solid #111' : '2px solid #eee',
                        background: selectedListId === list.id ? '#f0f0f0' : '#fafafa',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{list.name}</div>
                        <div style={{ fontSize: 11, color: '#888' }}>
                          {new Date(list.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      {selectedListId === list.id && (
                        <span style={{ fontWeight: 700, color: '#111', fontSize: 16 }}>✓</span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <button
              onClick={handleReconcile}
              disabled={!selectedListId || reconciling}
              style={{
                width: '100%', padding: '14px', borderRadius: 12,
                background: !selectedListId || reconciling ? '#ccc' : '#111',
                color: '#fff', border: 'none', fontSize: 15, fontWeight: 700,
                cursor: !selectedListId || reconciling ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
              }}
            >
              {reconciling ? '⏳ Se actualizează…' : '✅ Bifează articolele potrivite'}
            </button>
          </>
        )}

        {result && (
          <section style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px' }}>
              ✅ Gata! {result.patched_count} element{result.patched_count !== 1 ? 'e' : ''} bifate
            </h2>

            {result.matched.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                   Potrivite
                 </div>
                {result.matched.map((m, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <span style={{ color: '#1a7f37', fontSize: 16 }}>✓</span>
                    <span style={{ fontSize: 14 }}>{m.item_name}</span>
                    {m.ingredient !== m.item_name && (
                      <span style={{ fontSize: 11, color: '#999' }}>← {m.ingredient}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {result.unmatched_ingredients.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                   Nu a fost găsit în listă
                 </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {result.unmatched_ingredients.map((ing, i) => (
                    <span key={i} style={{ padding: '3px 10px', borderRadius: 12, background: '#f5f5f5', fontSize: 12, color: '#666' }}>
                      {ing}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                onClick={() => router.push(`/me/shopping-lists/${selectedListId}`)}
                style={{
                  flex: 1, padding: '11px', borderRadius: 10,
                   background: '#111', color: '#fff', border: 'none',
                   fontSize: 14, fontWeight: 600, cursor: 'pointer',
                 }}
               >
                 Vezi lista →
              </button>
              <button
                onClick={() => router.push(`/me/scan/${sessionId}/review`)}
                style={{
                  padding: '11px 16px', borderRadius: 10,
                   background: '#f0f0f0', color: '#333', border: 'none',
                   fontSize: 14, fontWeight: 600, cursor: 'pointer',
                 }}
               >
                 ← Înapoi la rezultate
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
