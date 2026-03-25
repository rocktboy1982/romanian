'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase-client'

/* ── Auth helpers ─────────────────────────────────────────────────── */

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  try {
    const backup = localStorage.getItem('marechef-session')
    if (backup) {
      const parsed = JSON.parse(backup)
      if (parsed?.access_token) {
        headers['Authorization'] = `Bearer ${parsed.access_token}`
        return headers
      }
    }
  } catch { /* ignore */ }
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
  return headers
}

/* ── JSON-LD field normalisers ────────────────────────────────────── */

function normaliseIngredients(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean)
  if (typeof raw === 'string') return raw.split('\n').map(s => s.trim()).filter(Boolean)
  return []
}

function normaliseSteps(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw.flatMap((item: unknown) => {
      if (typeof item === 'string') return item.trim() ? [item.trim()] : []
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>
        if (obj['@type'] === 'HowToSection' && Array.isArray(obj.itemListElement)) {
          return normaliseSteps(obj.itemListElement)
        }
        const text = obj.text || obj.name
        return typeof text === 'string' && text.trim() ? [text.trim()] : []
      }
      return []
    })
  }
  if (typeof raw === 'string') return raw.split('\n').map(s => s.trim()).filter(Boolean)
  return []
}

function normaliseImage(raw: unknown): string {
  if (!raw) return ''
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw)) return normaliseImage(raw[0])
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    return (obj.url as string) || (obj.contentUrl as string) || ''
  }
  return ''
}

function normaliseDuration(raw: unknown): number {
  if (!raw || typeof raw !== 'string') return 0
  // ISO 8601 duration: PT1H30M or PT45M
  const match = raw.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
  if (!match) return 0
  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  return hours * 60 + minutes
}

/* ── Derived form state from extracted JSON-LD ────────────────────── */

interface ImportedRecipe {
  title: string
  heroImageUrl: string
  ingredients: string[]
  steps: string[]
  servings: number
  cookTimeMinutes: number
  sourceUrl: string
}

function normaliseExtracted(raw: Record<string, unknown>, sourceUrl: string): ImportedRecipe {
  const title = (raw.name as string) || ''
  const heroImageUrl = normaliseImage(raw.image)
  const ingredients = normaliseIngredients(raw.recipeIngredient || raw.ingredients)
  const steps = normaliseSteps(raw.recipeInstructions || raw.instructions)
  const servings = (() => {
    const y = raw.recipeYield || raw.yield
    if (typeof y === 'number') return y
    if (typeof y === 'string') {
      const n = parseInt(y, 10)
      return isNaN(n) ? 4 : n
    }
    if (Array.isArray(y) && y.length > 0) {
      const n = parseInt(String(y[0]), 10)
      return isNaN(n) ? 4 : n
    }
    return 4
  })()
  const cookMin = normaliseDuration(raw.cookTime) || normaliseDuration(raw.totalTime)
  return { title, heroImageUrl, ingredients, steps, servings, cookTimeMinutes: cookMin, sourceUrl }
}

/* ── Main page ────────────────────────────────────────────────────── */

type Phase = 'loading' | 'not-logged-in' | 'not-certified' | 'idle' | 'extracted' | 'saving' | 'saved'

export default function ImportRecipePage() {
  const router = useRouter()

  const [phase, setPhase] = useState<Phase>('loading')
  const [url, setUrl] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Editable imported recipe fields
  const [title, setTitle] = useState('')
  const [heroImageUrl, setHeroImageUrl] = useState('')
  const [ingredientsText, setIngredientsText] = useState('') // newline-joined
  const [stepsText, setStepsText] = useState('')             // newline-joined
  const [servings, setServings] = useState('4')
  const [cookTime, setCookTime] = useState('30')
  const [sourceUrl, setSourceUrl] = useState('')

  /* ── Check auth + certified creator status ─── */
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        // Read session
        let token: string | null = null
        try {
          const backup = localStorage.getItem('marechef-session')
          if (backup) {
            const parsed = JSON.parse(backup)
            if (parsed?.access_token) token = parsed.access_token
          }
        } catch { /* ignore */ }
        if (!token) {
          const { data } = await supabase.auth.getSession()
          token = data.session?.access_token ?? null
        }
        if (!mounted) return
        if (!token) {
          setPhase('not-logged-in')
          return
        }
        // Fetch profile
        const res = await fetch('/api/profiles/me', {
          headers: { 'Authorization': `Bearer ${token}` },
        })
        if (!res.ok) { setPhase('not-logged-in'); return }
        const data = await res.json()
        if (!mounted) return
        const profile = data.profile
        if (!profile) { setPhase('not-logged-in'); return }
        if (!profile.is_certified_creator) {
          setPhase('not-certified')
          return
        }
        setPhase('idle')
      } catch {
        if (mounted) setPhase('not-logged-in')
      }
    })()
    return () => { mounted = false }
  }, [])

  /* ── Extract recipe from URL ─── */
  const handleExtract = useCallback(async () => {
    const trimmedUrl = url.trim()
    if (!trimmedUrl) return
    setExtractError(null)
    setExtracting(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/import/extract', {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: trimmedUrl }),
      })
      const data = await res.json()
      if (!res.ok) {
        setExtractError(data.error || 'Eroare la extragerea rețetei.')
        return
      }
      const recipes: Record<string, unknown>[] = data.recipes || []
      if (recipes.length === 0) {
        setExtractError('Nu am găsit date despre rețetă la această adresă.')
        return
      }
      const normalised = normaliseExtracted(recipes[0], trimmedUrl)
      setTitle(normalised.title)
      setHeroImageUrl(normalised.heroImageUrl)
      setIngredientsText(normalised.ingredients.join('\n'))
      setStepsText(normalised.steps.join('\n'))
      setServings(String(normalised.servings || 4))
      setCookTime(String(normalised.cookTimeMinutes || 30))
      setSourceUrl(normalised.sourceUrl)
      setPhase('extracted')
    } catch (err: unknown) {
      setExtractError(err instanceof Error ? err.message : 'Eroare necunoscută.')
    } finally {
      setExtracting(false)
    }
  }, [url])

  /* ── Save recipe ─── */
  const handleSave = useCallback(async () => {
    setSaveError(null)
    setPhase('saving')
    try {
      const headers = await getAuthHeaders()
      const ingredients = ingredientsText.split('\n').map(s => s.trim()).filter(Boolean)
      const steps = stepsText.split('\n').map(s => s.trim()).filter(Boolean)

      if (!title.trim()) { setSaveError('Titlul este obligatoriu.'); setPhase('extracted'); return }
      if (ingredients.length === 0) { setSaveError('Adaugă cel puțin un ingredient.'); setPhase('extracted'); return }
      if (steps.length === 0) { setSaveError('Adaugă cel puțin un pas.'); setPhase('extracted'); return }

      const summary = steps[0]?.slice(0, 200) || ''

      const body = {
        title: title.trim(),
        type: 'recipe',
        hero_image_url: heroImageUrl.trim() || null,
        source_url: sourceUrl || null,
        status: 'active',
        recipe_json: {
          summary,
          ingredients,
          steps,
          servings: parseInt(servings, 10) || 4,
          cookTime: `${cookTime} min`,
          source_url: sourceUrl || null,
        },
      }

      const res = await fetch('/api/submit', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
      const result = await res.json()
      if (!res.ok) {
        setSaveError(result.error || 'Eroare la salvarea rețetei.')
        setPhase('extracted')
        return
      }
      setPhase('saved')
      // Redirect to the new recipe after short delay
      setTimeout(() => {
        router.push('/me/cookbook')
      }, 2500)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Eroare necunoscută.')
      setPhase('extracted')
    }
  }, [title, heroImageUrl, ingredientsText, stepsText, servings, cookTime, sourceUrl, router])

  /* ── Render loading ─── */
  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'hsl(var(--background))' }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm" style={{ color: '#888' }}>Se verifică contul...</p>
        </div>
      </div>
    )
  }

  /* ── Render not logged in ─── */
  if (phase === 'not-logged-in') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">🔐</div>
          <h1 className="text-2xl font-bold mb-2">Autentificare necesară</h1>
          <p className="mb-6" style={{ color: '#888' }}>Trebuie să fii autentificat pentru a importa rețete.</p>
          <Link href="/auth/sign-in"
            className="inline-block px-6 py-3 rounded-xl font-semibold text-white"
            style={{ background: 'linear-gradient(135deg,#ff9500,#ff6b00)' }}>
            Autentifică-te
          </Link>
        </div>
      </div>
    )
  }

  /* ── Render not certified ─── */
  if (phase === 'not-certified') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
        <div className="text-center max-w-lg">
          <div className="text-5xl mb-4">🏅</div>
          <h1 className="text-2xl font-bold mb-3">Creator Certificat necesar</h1>
          <p className="mb-4 leading-relaxed" style={{ color: '#888' }}>
            Importul de rețete din surse externe este disponibil exclusiv <strong style={{ color: '#f0f0f0' }}>Creatorilor Certificați</strong>.
            Aceasta ne ajută să menținem calitatea și originalitatea conținutului de pe MareChef.
          </p>
          <div className="rounded-2xl p-5 mb-6 text-left" style={{ background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.2)' }}>
            <p className="text-sm font-semibold mb-2" style={{ color: '#ff9500' }}>Cum devii Creator Certificat?</p>
            <ul className="text-sm space-y-1" style={{ color: '#aaa' }}>
              <li>• Publică cel puțin 5 rețete originale pe platformă</li>
              <li>• Trimite o solicitare prin <Link href="/me/messages" className="underline" style={{ color: '#ff9500' }}>mesaje</Link> echipei MareChef</li>
              <li>• Echipa noastră va analiza profilul tău și te va notifica</li>
            </ul>
          </div>
          <div className="flex gap-3 justify-center">
            <Link href="/submit/recipe"
              className="px-5 py-2.5 rounded-xl font-semibold text-sm"
              style={{ background: 'linear-gradient(135deg,#ff9500,#ff6b00)', color: '#fff' }}>
              Publică o rețetă
            </Link>
            <Link href="/me/messages"
              className="px-5 py-2.5 rounded-xl font-semibold text-sm"
              style={{ background: 'rgba(255,255,255,0.08)', color: '#ccc', border: '1px solid rgba(255,255,255,0.12)' }}>
              Trimite o solicitare
            </Link>
          </div>
        </div>
      </div>
    )
  }

  /* ── Render saved ─── */
  if (phase === 'saved') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold mb-2">Rețetă salvată!</h1>
          <p style={{ color: '#888' }}>Rețeta a fost importată cu succes. Vei fi redirecționat către cartea ta de bucate...</p>
        </div>
      </div>
    )
  }

  /* ── Render import form ─── */
  const isExtracted = phase === 'extracted' || phase === 'saving'

  return (
    <div className="min-h-screen py-10 px-4" style={{ background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
              Creator Certificat
            </span>
          </div>
          <h1 className="text-3xl font-bold mb-1">Import rețetă</h1>
          <p style={{ color: '#888' }}>Importă automat o rețetă dintr-un site extern și publicã-o pe MareChef.</p>
        </div>

        {/* Step 1: URL input */}
        <div className="rounded-2xl p-6 mb-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: '#888' }}>Pasul 1 — Adresă URL</h2>
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleExtract() }}
              placeholder="https://www.example.com/reteta-delicioasa"
              className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#f0f0f0',
              }}
            />
            <button
              onClick={handleExtract}
              disabled={extracting || !url.trim()}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#ff9500,#ff6b00)', color: '#fff' }}>
              {extracting ? 'Se extrage...' : 'Extrage rețeta'}
            </button>
          </div>
          {extractError && (
            <p className="mt-3 text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
              {extractError}
            </p>
          )}
        </div>

        {/* Step 2: Preview + edit */}
        {isExtracted && (
          <div className="rounded-2xl p-6 mb-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: '#888' }}>Pasul 2 — Verifică și editează</h2>

            {/* Hero image preview */}
            {heroImageUrl && (
              <div className="mb-4 rounded-xl overflow-hidden" style={{ aspectRatio: '16/7' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={heroImageUrl}
                  alt={title}
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
            )}

            {/* Title */}
            <label className="block mb-1 text-xs font-semibold" style={{ color: '#888' }}>Titlu *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm mb-4 outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#f0f0f0' }}
            />

            {/* Hero image URL */}
            <label className="block mb-1 text-xs font-semibold" style={{ color: '#888' }}>URL imagine principală</label>
            <input
              type="url"
              value={heroImageUrl}
              onChange={e => setHeroImageUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-2.5 rounded-xl text-sm mb-4 outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#f0f0f0' }}
            />

            {/* Servings + cook time */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block mb-1 text-xs font-semibold" style={{ color: '#888' }}>Porții *</label>
                <input
                  type="number"
                  value={servings}
                  onChange={e => setServings(e.target.value)}
                  min={1}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#f0f0f0' }}
                />
              </div>
              <div>
                <label className="block mb-1 text-xs font-semibold" style={{ color: '#888' }}>Timp gătire (minute) *</label>
                <input
                  type="number"
                  value={cookTime}
                  onChange={e => setCookTime(e.target.value)}
                  min={1}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#f0f0f0' }}
                />
              </div>
            </div>

            {/* Ingredients */}
            <label className="block mb-1 text-xs font-semibold" style={{ color: '#888' }}>
              Ingrediente * <span className="font-normal">(unul per linie)</span>
            </label>
            <textarea
              value={ingredientsText}
              onChange={e => setIngredientsText(e.target.value)}
              rows={8}
              className="w-full px-4 py-2.5 rounded-xl text-sm mb-4 outline-none resize-y font-mono"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#f0f0f0', lineHeight: 1.6 }}
            />

            {/* Steps */}
            <label className="block mb-1 text-xs font-semibold" style={{ color: '#888' }}>
              Pași de pregătire * <span className="font-normal">(unul per linie)</span>
            </label>
            <textarea
              value={stepsText}
              onChange={e => setStepsText(e.target.value)}
              rows={10}
              className="w-full px-4 py-2.5 rounded-xl text-sm mb-4 outline-none resize-y"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#f0f0f0', lineHeight: 1.6 }}
            />

            {/* Source attribution */}
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              <span className="text-xs" style={{ color: '#666' }}>
                Sursa:{' '}
                <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#aaa' }}>
                  {sourceUrl ? (() => { try { return new URL(sourceUrl).hostname.replace('www.', '') } catch { return sourceUrl } })() : '—'}
                </a>
              </span>
            </div>

            {saveError && (
              <p className="mb-4 text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                {saveError}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setPhase('idle'); setExtractError(null); setSaveError(null) }}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.07)', color: '#aaa', border: '1px solid rgba(255,255,255,0.1)' }}>
                Importă altă rețetă
              </button>
              <button
                onClick={handleSave}
                disabled={phase === 'saving'}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff' }}>
                {phase === 'saving' ? 'Se salvează...' : 'Salvează rețeta'}
              </button>
            </div>
          </div>
        )}

        {/* Info box — always visible in idle */}
        {phase === 'idle' && (
          <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-sm font-semibold mb-2" style={{ color: '#888' }}>Cum funcționează?</p>
            <ul className="text-sm space-y-1.5" style={{ color: '#666' }}>
              <li>• Inserează URL-ul unei rețete de pe un site extern (AllRecipes, Jamies Oliver, etc.)</li>
              <li>• Aplicația va extrage automat titlul, ingredientele și pașii de pregătire</li>
              <li>• Poți edita orice câmp înainte de salvare</li>
              <li>• Rețeta va fi publicată imediat, cu atribuire sursei originale</li>
              <li>• Imaginile nu sunt descărcate — se folosește URL-ul original</li>
            </ul>
          </div>
        )}

      </div>
    </div>
  )
}
