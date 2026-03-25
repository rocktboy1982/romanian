'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import type { RecognitionResult, BudgetTier } from '@/lib/ai-provider'
import { supabase } from '@/lib/supabase-client'

interface RecipeMatch {
  recipe_id: string
  title: string
  slug: string
  image_url?: string
  match_ratio: number
  matched_count: number
  missing_count: number
  effective_missing_count: number
  matched_ingredients: string[]
  missing_ingredients: string[]
  estimated_missing_cost_ron: number | null
}

const BG = '#dde3ee'

export default function ScanRecipesClient({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sort = (searchParams.get('sort') ?? 'perfect') as 'perfect' | 'closest' | 'fewest' | 'cheapest'
  const showBudget = searchParams.get('budget') === 'true'

  const [recipes, setRecipes] = useState<RecipeMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [budgetTier, setBudgetTier] = useState<BudgetTier>('normal')
  const [orderingFor, setOrderingFor] = useState<string | null>(null)

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

  const fetchRecipes = useCallback(async (tier: BudgetTier) => {
    setLoading(true)
    setError(null)
    try {
      // Get ingredients from sessionStorage
      let ingredients: string[] = []
      try {
        const raw = sessionStorage.getItem(`scan_result_${sessionId}`)
        if (raw) {
          const result = JSON.parse(raw) as RecognitionResult
          ingredients = result.ingredients.map(i => i.canonical_name || i.name)
        }
      } catch { /* ignore */ }

      if (ingredients.length === 0) {
        setError('Niciun ingredient găsit. Te rog scanează din nou.')
        return
      }

      const res = await fetch('/api/vision/match-recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients, sort, limit: 12, budget_tier: tier }),
      })

       if (!res.ok) throw new Error('Potrivirea rețetei a eșuat')
      const data = await res.json()
      setRecipes(data.recipes)
    } catch (e) {
       setError(e instanceof Error ? e.message : 'Ceva a mers greșit')
    } finally {
      setLoading(false)
    }
  }, [sessionId, sort]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Fetch budget tier once, then immediately fetch recipes with that tier
    let cancelled = false
    getAuthHeaders().then(headers => fetch('/api/grocery/budget-prefs', { headers }))
      .then(r => r.ok ? r.json() : { tier: 'normal' })
      .then(d => {
        const tier = (d.tier as BudgetTier) ?? 'normal'
        if (!cancelled) {
          setBudgetTier(tier)
          fetchRecipes(tier)
        }
      })
      .catch(() => { if (!cancelled) fetchRecipes('normal') })
    return () => { cancelled = true }
  }, [fetchRecipes, getAuthHeaders])

  const handleOrderMissing = async (recipe: RecipeMatch) => {
    if (!recipe.missing_ingredients.length) return
    setOrderingFor(recipe.recipe_id)

    try {
      // Create or navigate to grocery match for the missing ingredients
      // We create a temporary session-scoped search
      router.push(`/me/grocery?ingredients=${encodeURIComponent(recipe.missing_ingredients.join(','))}&from_scan=${sessionId}`)
    } finally {
      setOrderingFor(null)
    }
  }

  if (loading) {
    return (
      <main style={{ background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#555', textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '3px solid #ccc', borderTopColor: '#555', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
           <p style={{ fontSize: 14 }}>Se caută rețete…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </main>
    )
  }

  return (
    <main style={{ background: BG, minHeight: '100vh', color: '#111', paddingBottom: 80 }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px' }}>

         <button
           onClick={() => router.back()}
           style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 13, padding: 0, marginBottom: 8 }}
         >
           ← Înapoi
         </button>

         <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>🍽️ Potriviri Rețete</h1>
        <p style={{ color: '#555', fontSize: 14, margin: '0 0 6px' }}>
           Sortat după: <strong>{sort === 'perfect' ? 'cele mai puține lipsă' : sort === 'closest' ? 'cea mai bună potrivire' : sort === 'fewest' ? 'cele mai puține de cumpărat' : 'cea mai ieftină pentru a completa'}</strong>
        </p>

        {/* Sort tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
             { key: 'perfect', label: '🎯 Perfect' },
             { key: 'closest', label: '📊 Cel mai apropiat' },
             { key: 'fewest', label: '🧾 Cel mai puțin' },
             ...(showBudget ? [{ key: 'cheapest', label: '💸 Cel mai ieftin' }] : []),
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => router.push(`/me/scan/${sessionId}/recipes?sort=${key}${showBudget ? '&budget=true' : ''}`)}
              style={{
                padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                border: sort === key ? '2px solid #111' : '2px solid #ddd',
                background: sort === key ? '#111' : '#fff',
                color: sort === key ? '#fff' : '#333',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {error ? (
          <div style={{ background: '#ffe0e0', borderRadius: 12, padding: '16px', color: '#c00', fontSize: 14 }}>
            {error}
          </div>
         ) : recipes.length === 0 ? (
           <div style={{ textAlign: 'center', padding: '48px 0', color: '#777' }}>
             <div style={{ fontSize: 48, marginBottom: 12 }}>🤷</div>
             <p style={{ fontSize: 15 }}>Nicio rețetă potrivită găsită.</p>
             <p style={{ fontSize: 13 }}>Încearcă să adaugi mai multe ingrediente sau ajustează sortarea.</p>
           </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recipes.map(recipe => (
              <div key={recipe.recipe_id} style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                {recipe.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <Image
                    src={recipe.image_url}
                    alt={recipe.title}
                    style={{ width: '100%', height: 160, objectFit: 'cover' }}
                  />
                )}
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{recipe.title}</h3>
                       <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                         {recipe.matched_count} din {recipe.matched_count + recipe.missing_count} ingrediente potrivite
                         {recipe.effective_missing_count === 0 && (
                           <span style={{ color: '#1a7f37', fontWeight: 600, marginLeft: 6 }}>· Poți gătit acum!</span>
                         )}
                       </div>
                    </div>
                    <div style={{
                      background: recipe.match_ratio >= 0.8 ? '#e8f5e9' : recipe.match_ratio >= 0.5 ? '#fff8e1' : '#fce4ec',
                      color: recipe.match_ratio >= 0.8 ? '#1a7f37' : recipe.match_ratio >= 0.5 ? '#9a6700' : '#c62828',
                      borderRadius: 8, padding: '4px 8px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
                    }}>
                      {Math.round(recipe.match_ratio * 100)}%
                    </div>
                  </div>

                  {/* Missing ingredients */}
                  {recipe.missing_ingredients.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                       <div style={{ fontSize: 11, color: '#999', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                         Trebuie să cumperi:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {recipe.missing_ingredients.map((ing, i) => (
                          <span key={i} style={{ padding: '2px 8px', borderRadius: 12, background: '#f5f5f5', fontSize: 11, color: '#555' }}>
                            {ing}
                          </span>
                        ))}
                      </div>
                       {recipe.estimated_missing_cost_ron !== null && (
                         <div style={{ fontSize: 12, color: '#9a6700', marginTop: 6, fontWeight: 600 }}>
                           Cost estimat: ~{recipe.estimated_missing_cost_ron.toFixed(2)} RON
                         </div>
                       )}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                       onClick={() => router.push(`/recipes/${recipe.slug}`)}
                       style={{
                         flex: 1, padding: '9px 0', borderRadius: 8,
                         background: '#111', color: '#fff', border: 'none',
                         fontSize: 13, fontWeight: 600, cursor: 'pointer',
                       }}
                     >
                       Vezi Rețeta
                    </button>
                    {showBudget && recipe.missing_ingredients.length > 0 && (
                      <button
                        onClick={() => handleOrderMissing(recipe)}
                        disabled={orderingFor === recipe.recipe_id}
                        style={{
                          padding: '9px 14px', borderRadius: 8,
                          background: '#f0f7ff', color: '#0066cc', border: '1px solid #b3d4ff',
                          fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                      >
                         {orderingFor === recipe.recipe_id ? '…' : 'Comandă lipsă →'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
