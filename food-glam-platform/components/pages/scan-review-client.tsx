'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { RecognitionResult } from '@/lib/ai-provider'
import IngredientLink from '@/components/ui/ingredient-link'

const BG = '#dde3ee'

export default function ScanReviewClient({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [result, setResult] = useState<RecognitionResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Primary: read from sessionStorage (set immediately after scan)
    try {
      const raw = sessionStorage.getItem(`scan_result_${sessionId}`)
      if (raw) {
        const parsed = JSON.parse(raw) as RecognitionResult
        if (parsed.ingredients && parsed.ingredients.length >= 0) {
          setResult(parsed)
          setLoading(false)
          return
        }
      }
    } catch { /* ignore */ }

    // Fallback: the session data is in the server SESSION_STORE but not in sessionStorage
    // (e.g. user refreshed the page). We can't recover without an API endpoint that
    // reads a session by ID — so show a graceful error instead of crashing the merge API.
    setError('Sesiunea a expirat. Te rog scanează din nou pentru a continua.')
    setLoading(false)
  }, [sessionId])

  if (loading) {
    return (
      <main style={{ background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#555', textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #ccc', borderTopColor: '#555', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px' }} />
           <p style={{ fontSize: 15, fontWeight: 500 }}>Se analizează ingredientele tale…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </main>
    )
  }

  if (error || !result) {
    return (
      <main style={{ background: BG, minHeight: '100vh', padding: '32px 16px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center', paddingTop: 60 }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>⏱️</div>
           <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 8 }}>Sesiunea a expirat</h2>
           <p style={{ color: '#666', fontSize: 14, marginBottom: 24 }}>
             {error ?? 'Nu am putut găsi rezultatele scanării tale. Te rog încearcă din nou.'}
          </p>
          <button
             onClick={() => router.push('/me/scan')}
             style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 12, padding: '13px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer', minHeight: 48 }}
           >
             Scanează din nou
          </button>
        </div>
      </main>
    )
  }

  const { ingredients } = result
  const highConf = ingredients.filter(i => i.confidence > 0.7)
  const lowConf = ingredients.filter(i => i.confidence <= 0.7)

  return (
    <main style={{ background: BG, minHeight: '100vh', color: '#111', paddingBottom: 100 }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px' }}>

        {/* Back */}
         <button
           onClick={() => router.push('/me/scan')}
           style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 14, padding: '8px 0', marginBottom: 12, minHeight: 44 }}
         >
           ← Scanare nouă
         </button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <div>
             <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>✨ Am găsit {ingredients.length} ingredient{ingredients.length !== 1 ? 'e' : ''}</h1>
            {result.confidence_overall > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: result.confidence_overall > 0.7 ? '#e8f5e9' : '#fff8e1',
                color: result.confidence_overall > 0.7 ? '#1a7f37' : '#9a6700',
                borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 600,
              }}>
                {result.confidence_overall > 0.7 ? '✓' : '~'} {Math.round(result.confidence_overall * 100)}% încredere
              </span>
            )}
          </div>
          {/* Multi-scan */}
          <button
            onClick={() => router.push(`/me/scan?session_id=${sessionId}`)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: '#fff', border: '1.5px solid #ccc', borderRadius: 10,
              padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              color: '#333', whiteSpace: 'nowrap', minHeight: 40, flexShrink: 0,
            }}
             >
               📷 Adaugă fotografie
             </button>
        </div>

        {/* Ingredients */}
        {ingredients.length === 0 ? (
          <section style={{ background: '#fff', borderRadius: 16, padding: '24px 20px', marginBottom: 16, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
             <div style={{ fontSize: 40, marginBottom: 8 }}>🤔</div>
             <p style={{ color: '#666', fontSize: 14, marginBottom: 12 }}>Niciun ingredient detectat.</p>
             <p style={{ color: '#999', fontSize: 13 }}>Încearcă o fotografie cu iluminare mai bună, sau adaugă un indiciu mai jos.</p>
            <button
               onClick={() => router.push('/me/scan')}
               style={{ marginTop: 14, background: '#111', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 44 }}
             >
               Încearcă din nou
            </button>
          </section>
        ) : (
          <section style={{ background: '#fff', borderRadius: 16, padding: '16px 18px', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            {/* High confidence */}
            {highConf.length > 0 && (
              <div style={{ marginBottom: lowConf.length > 0 ? 14 : 0 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {highConf.map((ing, idx) => (
                    <span
                      key={idx}
                      style={{ padding: '6px 13px', borderRadius: 20, background: '#e8f5e9', border: '1px solid #a5d6a7', fontSize: 13, fontWeight: 600, color: '#1b5e20' }}
                    >
                      <IngredientLink ingredient={ing.name || ing.canonical_name} variant="pill-green" />
                      {ing.quantity_estimate && <span style={{ fontWeight: 400, marginLeft: 4, color: '#388e3c' }}>({ing.quantity_estimate})</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {/* Low confidence */}
            {lowConf.length > 0 && (
              <div>
                {highConf.length > 0 && (
                   <div style={{ fontSize: 11, color: '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7 }}>
                     Mai puțin sigur
                   </div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {lowConf.map((ing, idx) => (
                    <span
                      key={idx}
                      style={{ padding: '6px 13px', borderRadius: 20, background: '#fff8e1', border: '1px solid #ffe082', fontSize: 13, fontWeight: 500, color: '#5d4037' }}
                    >
                      <IngredientLink ingredient={ing.name || ing.canonical_name} variant="pill-yellow" />
                      {ing.quantity_estimate && <span style={{ fontWeight: 400, marginLeft: 4, color: '#8d6e63' }}>({ing.quantity_estimate})</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* 4 action cards — only show when we have ingredients */}
        {ingredients.length > 0 && (
          <>
             <h2 style={{ fontSize: 14, fontWeight: 600, color: '#555', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
               Ce vrei să faci?
             </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

               <ActionCard
                 emoji="🍽️"
                 title="Găsește Rețete"
                 desc="Ce poți gătit chiar acum"
                 onClick={() => router.push(`/me/scan/${sessionId}/recipes?sort=perfect`)}
                 accent="#e8f5e9"
                 accentBorder="#a5d6a7"
               />

               <ActionCard
                 emoji="🛒"
                 title="Gătit + Cumpărături"
                 desc="Cele mai puține adăugiri necesare"
                 onClick={() => router.push(`/me/scan/${sessionId}/recipes?sort=fewest&budget=true`)}
                 accent="#e8f0fe"
                 accentBorder="#b3cff5"
               />

               <ActionCard
                 emoji="✅"
                 title="Actualizează Lista"
                 desc="Bifează ce ai"
                 onClick={() => router.push(`/me/scan/${sessionId}/reconcile`)}
                 accent="#fff8e1"
                 accentBorder="#ffe082"
               />

               <ActionCard
                 emoji="🥫"
                 title="Înregistrează Cămara"
                 desc="Salvează în stocul tău de ingrediente"
                 onClick={() => router.push(`/me/scan/${sessionId}/pantry`)}
                 accent="#fce4ec"
                 accentBorder="#f48fb1"
               />
            </div>
          </>
        )}
      </div>
    </main>
  )
}

function ActionCard({
  emoji, title, desc, onClick, accent, accentBorder,
}: {
  emoji: string
  title: string
  desc: string
  onClick: () => void
  accent: string
  accentBorder: string
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? accent : '#fff',
        borderRadius: 14, padding: '16px 14px',
        border: `2px solid ${hovered ? accentBorder : '#e8e8e8'}`,
        cursor: 'pointer', textAlign: 'left',
        boxShadow: hovered ? `0 2px 10px ${accentBorder}55` : '0 1px 3px rgba(0,0,0,0.06)',
        transition: 'all 0.15s',
        minHeight: 90,
      }}
    >
      <div style={{ fontSize: 26, marginBottom: 7, lineHeight: 1 }}>{emoji}</div>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{title}</div>
      <div style={{ fontSize: 12, color: '#777', lineHeight: 1.35 }}>{desc}</div>
    </button>
  )
}
