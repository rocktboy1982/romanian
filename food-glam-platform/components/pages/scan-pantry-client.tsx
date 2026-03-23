'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { RecognitionResult, RecognisedIngredient } from '@/lib/ai-provider'
import { isAlcoholicIngredient } from '@/lib/normalize-for-search'

const BG = '#dde3ee'

type Destination = 'pantry' | 'bar'

interface IngredientRow {
  ing: RecognisedIngredient
  destination: Destination
}

export default function ScanPantryClient({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [rows, setRows] = useState<IngredientRow[]>([])
  const [syncing, setSyncing] = useState(false)
  const [synced, setSynced] = useState(false)
  const [result, setResult] = useState<{ pantryCount: number; barCount: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`scan_result_${sessionId}`)
      if (raw) {
        const r = JSON.parse(raw) as RecognitionResult
        const items = (r.ingredients || []).map(ing => ({
          ing,
          // Auto-recommend: alcoholic → bar, rest → pantry
          destination: isAlcoholicIngredient(ing.name || ing.canonical_name || '') ? 'bar' as Destination : 'pantry' as Destination,
        }))
        setRows(items)
      }
    } catch { /* ignore */ }
  }, [sessionId])

  const toggleDestination = (idx: number) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, destination: r.destination === 'pantry' ? 'bar' : 'pantry' } : r))
  }

  const handleSync = async () => {
    setSyncing(true)
    setError(null)

    let pantryCount = 0
    let barCount = 0

    try {
      for (const row of rows) {
        const name = row.ing.name || row.ing.canonical_name
        if (!name) continue

        let quantity: string | null = null
        let unit: string | null = null
        if (row.ing.quantity_estimate) {
          const match = row.ing.quantity_estimate.match(/~?(\d+[\d.,]*)\s*(.*)/)
          if (match) {
            quantity = match[1]
            unit = match[2]?.trim() || null
          }
        }

        const res = await fetch('/api/pantry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            quantity,
            unit,
            category: row.destination,
            source: 'scan',
          }),
        })

        if (res.ok) {
          if (row.destination === 'bar') barCount++
          else pantryCount++
        } else if (res.status === 401) {
          setError('Trebuie să fii autentificat. Conectează-te cu Google.')
          setSyncing(false)
          return
        }
      }

      setResult({ pantryCount, barCount })
      setSynced(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ceva a mers greșit')
    } finally {
      setSyncing(false)
    }
  }

  const pantryItems = rows.filter(r => r.destination === 'pantry')
  const barItems = rows.filter(r => r.destination === 'bar')

  return (
    <main style={{ background: BG, minHeight: '100vh', color: '#111', paddingBottom: 80 }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '16px 16px' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button
            onClick={() => router.back()}
            style={{ background: '#fff', border: 'none', cursor: 'pointer', color: '#444', fontSize: 20, width: 44, height: 44, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
            aria-label="Înapoi"
          >←</button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>🥫 Salvează în Cămară & Bar</h1>
            <p style={{ color: '#555', fontSize: 13, margin: '2px 0 0' }}>
              Verifică și alege unde se salvează fiecare ingredient.
            </p>
          </div>
        </div>

        {error && (
          <div style={{ background: '#ffe0e0', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#c00', fontSize: 14 }}>
            {error}
          </div>
        )}

        {rows.length === 0 ? (
          <section style={{ background: '#fff', borderRadius: 16, padding: 24, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <p style={{ color: '#888', fontSize: 14 }}>Niciun ingredient găsit. Te rog scanează din nou.</p>
          </section>
        ) : !synced ? (
          <>
            {/* Ingredient list with toggles */}
            <section style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
                {rows.length} ingredient{rows.length !== 1 ? 'e' : ''} · Apasă pentru a schimba
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {rows.map((row, idx) => (
                  <div
                    key={idx}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: row.destination === 'bar' ? 'rgba(139,92,246,0.06)' : 'rgba(34,197,94,0.06)', border: `1px solid ${row.destination === 'bar' ? 'rgba(139,92,246,0.15)' : 'rgba(34,197,94,0.15)'}` }}
                  >
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{row.ing.name || row.ing.canonical_name}</span>
                      {row.ing.quantity_estimate && (
                        <span style={{ fontSize: 12, color: '#888', marginLeft: 6 }}>({row.ing.quantity_estimate})</span>
                      )}
                    </div>
                    <button
                      onClick={() => toggleDestination(idx)}
                      style={{
                        padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                        background: row.destination === 'bar' ? '#8b5cf6' : '#22c55e',
                        color: '#fff',
                      }}
                    >
                      {row.destination === 'bar' ? '🍸 Bar' : '🥫 Cămara'}
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Summary */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1, background: '#e8f5e9', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1b5e20' }}>{pantryItems.length}</div>
                <div style={{ fontSize: 11, color: '#2e7d32', fontWeight: 600 }}>🥫 Cămara</div>
              </div>
              <div style={{ flex: 1, background: '#ede9fe', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#5b21b6' }}>{barItems.length}</div>
                <div style={{ fontSize: 11, color: '#6d28d9', fontWeight: 600 }}>🍸 Bar</div>
              </div>
            </div>

            {/* Save button */}
            <button
              onClick={handleSync}
              disabled={syncing || rows.length === 0}
              style={{
                width: '100%', padding: '14px', borderRadius: 12,
                background: syncing ? '#ccc' : '#111',
                color: '#fff', border: 'none', fontSize: 15, fontWeight: 700,
                cursor: syncing ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                marginBottom: 12,
              }}
            >
              {syncing ? '⏳ Se salvează…' : '✅ Salvează totul'}
            </button>
          </>
        ) : (
          /* Success */
          <div style={{ background: '#e8f5e9', borderRadius: 12, padding: '16px 18px', marginBottom: 20, border: '1px solid #a5d6a7' }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: '#1b5e20', marginBottom: 8 }}>
              ✅ Salvat cu succes!
            </div>
            <div style={{ fontSize: 13, color: '#2e7d32', marginBottom: 12 }}>
              {result && result.pantryCount > 0 && <span>🥫 {result.pantryCount} în Cămara · </span>}
              {result && result.barCount > 0 && <span>🍸 {result.barCount} în Bar</span>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => router.push('/me/pantry')}
                style={{ flex: 1, background: '#22c55e', color: '#fff', border: 'none', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                🥫 Vezi Cămara
              </button>
              <button
                onClick={() => router.push('/me/bar')}
                style={{ flex: 1, background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                🍸 Vezi Bar
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
