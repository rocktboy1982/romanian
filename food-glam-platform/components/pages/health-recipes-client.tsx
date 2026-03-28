'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase-client'
import { useTheme } from '@/components/theme-provider'

// ─── Types ────────────────────────────────────────────────────────────────────

interface HealthRecipe {
  id: string
  user_id: string
  category: 'food' | 'drink'
  title: string
  description: string | null
  ingredients: string[]
  preparation: string | null
  calories_estimated: number | null
  tags: string[]
  is_public: boolean
  created_at: string
}

// ─── Tags per category ────────────────────────────────────────────────────────

const FOOD_TAGS = ['disociat', 'proteină', 'amidon', 'vitamine', 'detox', 'raw', 'fiert', 'copt', 'salată']
const DRINK_TAGS = ['ceai', 'smoothie', 'suc', 'infuzie', 'matcha', 'detox', 'energizant', 'calmant', 'dimineață', 'seară']

// ─── Seed suggestions ─────────────────────────────────────────────────────────

const FOOD_SUGGESTIONS: Omit<HealthRecipe, 'id' | 'user_id' | 'created_at'> = {} as never

const FOOD_SEED: Omit<HealthRecipe, 'id' | 'user_id' | 'created_at'>[] = [
  {
    category: 'food',
    title: 'Ouă fierte moi (6 minute)',
    description: 'Ouă fierte moi, perfecte pentru o masă ușoară bogată în proteine.',
    ingredients: ['2 ouă', 'apă', 'sare'],
    preparation: 'Fierbe apa, adaugă ouăle și lasă 6 minute. Răcește sub jet de apă rece.',
    calories_estimated: 140,
    tags: ['proteină', 'disociat'],
    is_public: false,
  },
  {
    category: 'food',
    title: 'Cartof copt simplu',
    description: 'Cartof copt în cuptor, fără grăsimi adăugate.',
    ingredients: ['1 cartof mare', 'sare'],
    preparation: 'Învelește cartoful în folie de aluminiu și coace la 200°C timp de 45-60 minute.',
    calories_estimated: 160,
    tags: ['amidon', 'disociat'],
    is_public: false,
  },
  {
    category: 'food',
    title: 'Salată verde cu lămâie',
    description: 'Salată proaspătă cu lămâie și ulei de măsline extravirgin.',
    ingredients: ['salată verde', 'lămâie', 'ulei de măsline'],
    preparation: 'Spală și rupe salata. Amestecă zeama de lămâie cu ulei și asezonează.',
    calories_estimated: 80,
    tags: ['vitamine', 'raw'],
    is_public: false,
  },
  {
    category: 'food',
    title: 'Piept de pui la grătar',
    description: 'Piept de pui simplu la grătar, sursa ideală de proteine.',
    ingredients: ['piept de pui', 'condimente (sare, piper, boia)'],
    preparation: 'Condimentează pieptul și grilează 6-7 minute pe fiecare parte.',
    calories_estimated: 165,
    tags: ['proteină', 'disociat'],
    is_public: false,
  },
  {
    category: 'food',
    title: 'Orez integral fiert',
    description: 'Orez integral fiert, bogat în fibre și carbohidrați complecși.',
    ingredients: ['orez integral', 'apă'],
    preparation: 'Fierbe orezul în apă dublă față de cantitatea de orez, timp de 35-40 minute.',
    calories_estimated: 215,
    tags: ['amidon', 'disociat'],
    is_public: false,
  },
]

const DRINK_SEED: Omit<HealthRecipe, 'id' | 'user_id' | 'created_at'>[] = [
  {
    category: 'drink',
    title: 'Ceai verde cu lămâie',
    description: 'Ceai verde antioxidant cu lămâie proaspătă și miere.',
    ingredients: ['ceai verde', 'lămâie', 'miere'],
    preparation: 'Infuzează ceaiul verde 3 minute la 80°C. Adaugă zeama de lămâie și mierea.',
    calories_estimated: 25,
    tags: ['ceai', 'detox', 'dimineață'],
    is_public: false,
  },
  {
    category: 'drink',
    title: 'Smoothie de spanac și banană',
    description: 'Smoothie energizant verde, bogat în vitamine și potasiu.',
    ingredients: ['spanac proaspăt', 'banană coaptă', 'lapte de migdale'],
    preparation: 'Mixează toate ingredientele în blender până obții o textură omogenă.',
    calories_estimated: 180,
    tags: ['smoothie', 'energizant', 'dimineață'],
    is_public: false,
  },
  {
    category: 'drink',
    title: 'Matcha Latte',
    description: 'Băutură cu pudră de matcha și lapte de ovăz.',
    ingredients: ['pudră matcha (1 linguriță)', 'lapte de ovăz (250ml)', 'miere'],
    preparation: 'Dizolvă matcha în puțin lapte fierbinte, apoi adaugă restul de lapte și miere.',
    calories_estimated: 120,
    tags: ['matcha', 'energizant'],
    is_public: false,
  },
  {
    category: 'drink',
    title: 'Infuzie de ghimbir și turmeric',
    description: 'Infuzie antiinflamatoare naturală cu ghimbir, turmeric și lămâie.',
    ingredients: ['ghimbir proaspăt (2cm)', 'turmeric (1/2 linguriță)', 'miere', 'lămâie'],
    preparation: 'Fierbe ghimbirul 10 minute, adaugă turmericul, filtrează și adaugă miere și lămâie.',
    calories_estimated: 30,
    tags: ['infuzie', 'detox', 'calmant'],
    is_public: false,
  },
  {
    category: 'drink',
    title: 'Apă cu castraveți și mentă',
    description: 'Apă detox hidratantă cu castraveți proaspeți și mentă.',
    ingredients: ['apă (1L)', 'castraveți (1/2)', 'mentă proaspătă'],
    preparation: 'Taie castraveții felii, adaugă menta și lasă la frigider 2 ore înainte de servire.',
    calories_estimated: 5,
    tags: ['detox'],
    is_public: false,
  },
]

// Silence unused variable
void (FOOD_SUGGESTIONS as unknown)

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
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
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  title: string
  description: string
  ingredientsRaw: string
  preparation: string
  calories_estimated: string
  tags: string[]
  is_public: boolean
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  ingredientsRaw: '',
  preparation: '',
  calories_estimated: '',
  tags: [],
  is_public: false,
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function HealthRecipesClient() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [activeTab, setActiveTab] = useState<'food' | 'drink'>('food')
  const [recipes, setRecipes] = useState<HealthRecipe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // Form
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Deletion
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ── Resolve current user ──────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem('marechef-session')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.user?.id) { setUserId(parsed.user.id); return }
      }
    } catch { /* ignore */ }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) setUserId(session.user.id)
    })
  }, [])

  // ── Fetch recipes ─────────────────────────────────────────────────────────
  const fetchRecipes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/health/recipes?category=${activeTab}`, { headers })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Eroare la încărcarea rețetelor')
      }
      const data = await res.json()
      setRecipes(data.recipes ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Eroare necunoscută')
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => {
    fetchRecipes()
  }, [fetchRecipes])

  // ── Open form (add) ───────────────────────────────────────────────────────
  function openAdd() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setSaveError(null)
    setFormOpen(true)
    setTimeout(() => {
      document.getElementById('hr-title-input')?.focus()
    }, 50)
  }

  // ── Open form (edit) ──────────────────────────────────────────────────────
  function openEdit(recipe: HealthRecipe) {
    setEditingId(recipe.id)
    setForm({
      title: recipe.title,
      description: recipe.description ?? '',
      ingredientsRaw: (recipe.ingredients ?? []).join('\n'),
      preparation: recipe.preparation ?? '',
      calories_estimated: recipe.calories_estimated != null ? String(recipe.calories_estimated) : '',
      tags: recipe.tags ?? [],
      is_public: recipe.is_public,
    })
    setSaveError(null)
    setFormOpen(true)
  }

  // ── Close form ────────────────────────────────────────────────────────────
  function closeForm() {
    setFormOpen(false)
    setEditingId(null)
    setSaveError(null)
  }

  // ── Toggle tag ────────────────────────────────────────────────────────────
  function toggleTag(tag: string) {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag],
    }))
  }

  // ── Submit form ───────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setSaveError(null)

    if (!form.title.trim()) {
      setSaveError('Titlul este obligatoriu.')
      return
    }

    setSaving(true)
    try {
      const headers = await getAuthHeaders()
      const ingredients = form.ingredientsRaw
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)

      const body = {
        category: activeTab,
        title: form.title.trim(),
        description: form.description.trim() || null,
        ingredients,
        preparation: form.preparation.trim() || null,
        calories_estimated: form.calories_estimated ? Number(form.calories_estimated) : null,
        tags: form.tags,
        is_public: form.is_public,
      }

      if (editingId) {
        // DELETE old + POST new (no PATCH endpoint, keep it simple)
        await fetch(`/api/health/recipes?id=${editingId}`, { method: 'DELETE', headers })
      }

      const res = await fetch('/api/health/recipes', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Eroare la salvare')
      }

      closeForm()
      await fetchRecipes()
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Eroare necunoscută')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm('Ștergi această rețetă de sănătate?')) return
    setDeletingId(id)
    try {
      const headers = await getAuthHeaders()
      await fetch(`/api/health/recipes?id=${id}`, { method: 'DELETE', headers })
      setRecipes(rs => rs.filter(r => r.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  // ── Copy suggestion ───────────────────────────────────────────────────────
  async function copySuggestion(seed: Omit<HealthRecipe, 'id' | 'user_id' | 'created_at'>) {
    const headers = await getAuthHeaders()
    const res = await fetch('/api/health/recipes', {
      method: 'POST',
      headers,
      body: JSON.stringify(seed),
    })
    if (res.ok) await fetchRecipes()
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const seeds = activeTab === 'food' ? FOOD_SEED : DRINK_SEED
  const availableTags = activeTab === 'food' ? FOOD_TAGS : DRINK_TAGS
  const ownRecipes = recipes.filter(r => r.user_id === userId)
  const publicFromOthers = recipes.filter(r => r.user_id !== userId && r.is_public)

  // ─── Styles ──────────────────────────────────────────────────────────────
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : '#fff'
  const cardBorder = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)'
  const inputSt: React.CSSProperties = {
    background: isDark ? 'rgba(255,255,255,0.06)' : '#f8f8f8',
    border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.12)',
    color: 'hsl(var(--foreground))',
    borderRadius: 8,
    padding: '8px 12px',
    width: '100%',
    fontSize: 14,
    outline: 'none',
  }
  const labelSt: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 4,
    display: 'block',
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-28" style={{ color: 'hsl(var(--foreground))' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Rețete de Sănătate</h1>
          <p className="text-sm opacity-60 mt-0.5">Alimente și băuturi pentru stilul tău de viață sănătos</p>
        </div>
        {!formOpen && (
          <button
            onClick={openAdd}
            className="px-4 py-2 rounded-full text-sm font-semibold transition-all"
            style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff' }}
          >
            + Adaugă
          </button>
        )}
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div
        className="flex rounded-xl overflow-hidden mb-6"
        style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f0f0f0' }}
      >
        {(['food', 'drink'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setFormOpen(false) }}
            className="flex-1 py-2.5 text-sm font-semibold transition-all"
            style={activeTab === tab
              ? { background: 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff', borderRadius: 10 }
              : { color: isDark ? '#999' : '#666', background: 'transparent' }
            }
          >
            {tab === 'food' ? '🥗 Alimente' : '🍵 Băuturi'}
          </button>
        ))}
      </div>

      {/* ── Inline form ─────────────────────────────────────────────────── */}
      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-5 mb-6 flex flex-col gap-4"
          style={{ background: cardBg, border: cardBorder }}
        >
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-base">
              {editingId ? 'Editează rețeta' : `Rețetă nouă — ${activeTab === 'food' ? 'Aliment' : 'Băutură'}`}
            </h2>
            <button type="button" onClick={closeForm} style={{ opacity: 0.5, fontSize: 18 }}>✕</button>
          </div>

          {/* Title */}
          <div>
            <label style={labelSt}>Titlu *</label>
            <input
              id="hr-title-input"
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="ex. Ouă fierte moi"
              style={inputSt}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label style={labelSt}>Descriere</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="O scurtă descriere a rețetei..."
              rows={2}
              style={{ ...inputSt, resize: 'vertical' }}
            />
          </div>

          {/* Ingredients */}
          <div>
            <label style={labelSt}>Ingrediente (câte unul pe linie)</label>
            <textarea
              value={form.ingredientsRaw}
              onChange={e => setForm(f => ({ ...f, ingredientsRaw: e.target.value }))}
              placeholder={'2 ouă\napă\nsare'}
              rows={4}
              style={{ ...inputSt, resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }}
            />
          </div>

          {/* Preparation */}
          <div>
            <label style={labelSt}>Preparare</label>
            <textarea
              value={form.preparation}
              onChange={e => setForm(f => ({ ...f, preparation: e.target.value }))}
              placeholder="Pași de preparare..."
              rows={3}
              style={{ ...inputSt, resize: 'vertical' }}
            />
          </div>

          {/* Calories */}
          <div>
            <label style={labelSt}>Calorii estimate (kcal)</label>
            <input
              type="number"
              min={0}
              max={9999}
              value={form.calories_estimated}
              onChange={e => setForm(f => ({ ...f, calories_estimated: e.target.value }))}
              placeholder="ex. 140"
              style={{ ...inputSt, width: 160 }}
            />
          </div>

          {/* Tags */}
          <div>
            <label style={labelSt}>Etichete</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {availableTags.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                  style={form.tags.includes(tag)
                    ? { background: 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff' }
                    : { background: isDark ? 'rgba(255,255,255,0.08)' : '#eee', color: isDark ? '#ccc' : '#444' }
                  }
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Public */}
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={form.is_public}
              onChange={e => setForm(f => ({ ...f, is_public: e.target.checked }))}
              className="w-4 h-4 rounded"
            />
            <span>Disponibil pentru toți utilizatorii</span>
          </label>

          {saveError && (
            <p className="text-sm" style={{ color: '#ff4d6d' }}>{saveError}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-full text-sm font-semibold transition-all"
              style={{ background: saving ? '#555' : 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff' }}
            >
              {saving ? 'Se salvează...' : editingId ? 'Actualizează' : 'Adaugă rețeta'}
            </button>
            <button type="button" onClick={closeForm} className="px-4 py-2 rounded-full text-sm" style={{ opacity: 0.6 }}>
              Anulează
            </button>
          </div>
        </form>
      )}

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <div className="text-sm text-center py-4" style={{ color: '#ff4d6d' }}>
          {error}
        </div>
      )}

      {/* ── Loading ──────────────────────────────────────────────────────── */}
      {loading && (
        <div className="text-sm text-center py-8 opacity-50">Se încarcă rețetele...</div>
      )}

      {/* ── Own recipes ──────────────────────────────────────────────────── */}
      {!loading && (
        <>
          {ownRecipes.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xs font-bold uppercase tracking-widest opacity-40 mb-3">
                Rețetele mele
              </h2>
              <div className="flex flex-col gap-3">
                {ownRecipes.map(r => (
                  <RecipeCard
                    key={r.id}
                    recipe={r}
                    isOwn={true}
                    isDark={isDark}
                    cardBg={cardBg}
                    cardBorder={cardBorder}
                    deleting={deletingId === r.id}
                    onEdit={() => openEdit(r)}
                    onDelete={() => handleDelete(r.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Public from others ───────────────────────────────────────── */}
          {publicFromOthers.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xs font-bold uppercase tracking-widest opacity-40 mb-3">
                De la comunitate
              </h2>
              <div className="flex flex-col gap-3">
                {publicFromOthers.map(r => (
                  <RecipeCard
                    key={r.id}
                    recipe={r}
                    isOwn={false}
                    isDark={isDark}
                    cardBg={cardBg}
                    cardBorder={cardBorder}
                    deleting={false}
                    onEdit={() => {}}
                    onDelete={() => {}}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Suggestions (shown when user has no own recipes) ─────────── */}
          {ownRecipes.length === 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest opacity-40 mb-3">
                Sugestii recomandate
              </h2>
              <p className="text-sm opacity-60 mb-4">
                Nu ai rețete de sănătate încă. Adaugă una dintre sugestiile de mai jos sau creează una proprie.
              </p>
              <div className="flex flex-col gap-3">
                {seeds.map((seed, idx) => (
                  <SuggestionCard
                    key={idx}
                    seed={seed}
                    isDark={isDark}
                    cardBg={cardBg}
                    cardBorder={cardBorder}
                    onAdd={() => copySuggestion(seed)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

// ─── RecipeCard ───────────────────────────────────────────────────────────────

interface RecipeCardProps {
  recipe: HealthRecipe
  isOwn: boolean
  isDark: boolean
  cardBg: string
  cardBorder: string
  deleting: boolean
  onEdit: () => void
  onDelete: () => void
}

function RecipeCard({ recipe, isOwn, isDark, cardBg, cardBorder, deleting, onEdit, onDelete }: RecipeCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: cardBorder }}>
      <button
        type="button"
        className="w-full text-left px-4 pt-4 pb-3"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm">{recipe.title}</h3>
              {recipe.is_public && !isOwn && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
                  público
                </span>
              )}
              {recipe.is_public && isOwn && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
                  public
                </span>
              )}
            </div>
            {recipe.description && (
              <p className="text-xs opacity-60 mt-0.5 line-clamp-1">{recipe.description}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5">
              {recipe.calories_estimated != null && (
                <span className="text-xs font-medium" style={{ color: '#ff9500' }}>
                  {recipe.calories_estimated} kcal
                </span>
              )}
              {recipe.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {recipe.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#eee', color: isDark ? '#aaa' : '#555' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <span className="text-xs opacity-40 flex-shrink-0 mt-1">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3" style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
          {recipe.ingredients.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] font-bold uppercase tracking-wide opacity-40 mb-1.5">Ingrediente</p>
              <ul className="flex flex-col gap-0.5">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i} className="text-sm flex items-center gap-2">
                    <span style={{ color: '#ff9500', fontSize: 10 }}>●</span>
                    {ing}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {recipe.preparation && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide opacity-40 mb-1.5">Preparare</p>
              <p className="text-sm leading-relaxed opacity-80">{recipe.preparation}</p>
            </div>
          )}

          {isOwn && (
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onEdit}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#eee', color: isDark ? '#ccc' : '#444' }}
              >
                ✏️ Editează
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={deleting}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{ background: 'rgba(255,77,109,0.12)', color: '#ff4d6d' }}
              >
                {deleting ? 'Se șterge...' : '🗑️ Șterge'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── SuggestionCard ───────────────────────────────────────────────────────────

interface SuggestionCardProps {
  seed: Omit<HealthRecipe, 'id' | 'user_id' | 'created_at'>
  isDark: boolean
  cardBg: string
  cardBorder: string
  onAdd: () => void
}

function SuggestionCard({ seed, isDark, cardBg, cardBorder, onAdd }: SuggestionCardProps) {
  const [adding, setAdding] = useState(false)
  const [done, setDone] = useState(false)

  async function handleAdd() {
    if (adding || done) return
    setAdding(true)
    try {
      await onAdd()
      setDone(true)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="rounded-2xl px-4 py-3 flex items-start gap-3"
      style={{ background: isDark ? 'rgba(255,149,0,0.05)' : 'rgba(255,149,0,0.04)', border: isDark ? '1px solid rgba(255,149,0,0.15)' : '1px solid rgba(255,149,0,0.2)' }}>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{seed.title}</p>
        {seed.description && <p className="text-xs opacity-60 mt-0.5">{seed.description}</p>}
        <div className="flex items-center gap-3 mt-1.5">
          {seed.calories_estimated != null && (
            <span className="text-xs font-medium" style={{ color: '#ff9500' }}>{seed.calories_estimated} kcal</span>
          )}
          <div className="flex flex-wrap gap-1">
            {seed.tags.map(tag => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#eee', color: isDark ? '#aaa' : '#555' }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={handleAdd}
        disabled={adding || done}
        className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap"
        style={done
          ? { background: 'rgba(34,197,94,0.15)', color: '#22c55e' }
          : { background: 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff' }
        }
      >
        {done ? '✓ Adăugat' : adding ? '...' : 'Adaugă la rețetele mele'}
      </button>
    </div>
  )
}
