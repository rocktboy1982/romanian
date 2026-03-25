'use client'

import { Suspense, useState, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'

/* ── Constants ──────────────────────────────────────────────────────────── */

const SPIRITS = [
  { value: 'whisky',   label: 'Whisky / Bourbon', emoji: '🥃' },
  { value: 'gin',      label: 'Gin',               emoji: '🌿' },
  { value: 'rum',      label: 'Rum',               emoji: '🍹' },
  { value: 'tequila',  label: 'Tequila / Mezcal',  emoji: '🌵' },
  { value: 'vodka',    label: 'Vodka',             emoji: '🧊' },
  { value: 'brandy',   label: 'Brandy / Cognac',   emoji: '🍇' },
  { value: 'liqueur',  label: 'Lichior / Aperitiv', emoji: '🍊' },
  { value: 'wine',     label: 'Vin / Șampanie',    emoji: '🍾' },
  { value: 'none',     label: 'Fără spirit (mocktail)', emoji: '🫧' },
] as const

const DIFFICULTY_OPTIONS = [
  { value: 'easy',   label: 'Ușor',   desc: 'Nu necesită echipament special' },
  { value: 'medium', label: 'Mediu',  desc: 'Shaker sau muddler' },
  { value: 'hard',   label: 'Dificil', desc: 'Tehnică avansată' },
] as const

const COCKTAIL_TAGS = [
  'classic', 'modern', 'tropical', 'sour', 'bubbly', 'stirred', 'shaken',
  'built', 'blended', 'frozen', 'citrus', 'herbal', 'spicy', 'smoky',
  'sweet', 'bitter', 'low-abv', 'zero-proof', 'after-dinner', 'aperitif',
  'party', 'summer', 'winter', 'brunch', 'coffee', 'floral', 'wellness',
]

const UNITS = [
  '', 'ml', 'cl', 'oz', 'fl oz',
  'linguriță', 'lingură', 'cană', 'strop', 'splash',
  'parte', 'părți', 'picătură', 'felie', 'sfert',
  'rămurică', 'frunză', 'frunze', 'bucată', 'vârf de cuțit',
] as const

interface IngredientRow { qty: string; unit: string; name: string }
const emptyIngredient = (): IngredientRow => ({ qty: '', unit: '', name: '' })

interface CocktailFormState {
  title: string
  summary: string
  heroImageUrl: string
  category: 'alcoholic' | 'non-alcoholic'
  spirit: string
  abv: string
  difficulty: 'easy' | 'medium' | 'hard'
  serves: string
  tags: string[]
  ingredients: IngredientRow[]
  steps: string[]
  glassware: string
  garnish: string
}

const emptyForm: CocktailFormState = {
  title: '',
  summary: '',
  heroImageUrl: '',
  category: 'alcoholic',
  spirit: '',
  abv: '',
  difficulty: 'easy',
  serves: '1',
  tags: [],
  ingredients: [emptyIngredient()],
  steps: [''],
  glassware: '',
  garnish: '',
}

type Errors = Partial<Record<keyof CocktailFormState | 'ingredients' | 'steps', string>>

function validate(f: CocktailFormState): Errors {
  const e: Errors = {}
  if (!f.title.trim())        e.title        = 'Titlul este obligatoriu'
  if (!f.summary.trim())      e.summary      = 'Scrie o descriere scurtă'
  if (!f.heroImageUrl.trim()) e.heroImageUrl = 'URL-ul fotografiei principale este obligatoriu'
  if (!f.spirit)              e.spirit       = 'Selectează spirtoasa de bază (sau mocktail)'
  if (f.category === 'alcoholic' && (!f.abv || Number(f.abv) <= 0))
                              e.abv          = 'Introdu ABV % aproximativ'
  if (!f.serves || Number(f.serves) < 1) e.serves = 'Introdu numărul de porții'
  if (f.ingredients.filter(i => i.name.trim()).length === 0) e.ingredients = 'Adaugă cel puțin un ingredient'
  if (f.steps.filter(s => s.trim()).length === 0) e.steps = 'Adaugă cel puțin un pas'
  return e
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80)
}

/* ── Component ─────────────────────────────────────────────────────────── */

function SubmitCocktailPageContent() {
  const router = useRouter()
  const toast = useToast()

  const [form, setForm] = useState<CocktailFormState>(emptyForm)
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  /* field helpers */
  const set = useCallback(<K extends keyof CocktailFormState>(key: K, val: CocktailFormState[K]) => {
    setForm(prev => ({ ...prev, [key]: val }))
    setErrors(prev => { const n = { ...prev }; delete n[key]; return n })
  }, [])

  const updateIngredient = (idx: number, field: keyof IngredientRow, val: string) => {
    set('ingredients', form.ingredients.map((r, i) => i === idx ? { ...r, [field]: val } : r))
  }
  const addIngredient = () => set('ingredients', [...form.ingredients, emptyIngredient()])
  const removeIngredient = (idx: number) => {
    if (form.ingredients.length <= 1) return
    set('ingredients', form.ingredients.filter((_, i) => i !== idx))
  }

  const updateStep = (idx: number, val: string) =>
    set('steps', form.steps.map((v, i) => (i === idx ? val : v)))
  const addStep = () => set('steps', [...form.steps, ''])
  const removeStep = (idx: number) => {
    if (form.steps.length <= 1) return
    set('steps', form.steps.filter((_, i) => i !== idx))
  }

  const toggleTag = (tag: string) =>
    set('tags', form.tags.includes(tag) ? form.tags.filter(t => t !== tag) : [...form.tags, tag])

  /* Get mock user from localStorage */
  const getMockUser = () => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('mock_user') : null
      if (!raw) return null
      const u = JSON.parse(raw) as { id?: string; display_name?: string; handle?: string; avatar_url?: string | null }
      return { id: u.id || 'user-1', display_name: u.display_name || 'Demo Chef', handle: u.handle || '@demochef', avatar_url: u.avatar_url ?? null }
    } catch { return null }
  }

  /* submit */
  const handleSubmit = async () => {
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      setTimeout(() => {
        const el = document.querySelector('[data-error="true"]')
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
      return
    }
    setSaving(true)
    try {
      const selectedSpirit = SPIRITS.find(s => s.value === form.spirit)

      // Build auth headers from marechef-session
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      try {
        const backup = localStorage.getItem('marechef-session')
        if (backup) {
          const parsed = JSON.parse(backup)
          if (parsed?.access_token) headers['Authorization'] = `Bearer ${parsed.access_token}`
        }
      } catch {}

      const res = await fetch('/api/submit/cocktail', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: form.title.trim(),
          summary: form.summary.trim(),
          hero_image_url: form.heroImageUrl.trim(),
          category: form.category,
          spirit: form.spirit,
          spiritLabel: selectedSpirit?.label ?? form.spirit,
          abv: form.category === 'non-alcoholic' ? 0 : Number(form.abv),
          difficulty: form.difficulty,
          serves: Number(form.serves),
          tags: form.tags,
          ingredients: form.ingredients.filter(i => i.name.trim()).map(i =>
            [i.qty, i.unit, i.name].filter(Boolean).join(' ')
          ),
          steps: form.steps.filter(s => s.trim()),
          glassware: form.glassware,
          garnish: form.garnish,
          // created_by is set server-side from auth token
        }),
      })

      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Trimiterea a eșuat')

      toast.push({ message: '🍹 Cocktail publicat!', type: 'success' })
      router.push(`/cocktails/${d.slug}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ceva a mers greșit'
      toast.push({ message: msg, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  /* style constants */
  const inputCls = 'w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring placeholder:text-muted-foreground/60'
  const inputErrCls = 'w-full rounded-lg border border-destructive bg-background px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-destructive/30 focus:border-destructive placeholder:text-muted-foreground/60'
  const errorCls = 'text-xs text-destructive mt-1'
  const labelCls = 'block text-sm font-medium mb-1.5'
  const sectionCls = 'space-y-1.5'

  /* ── Preview ── */
  if (showPreview) {
    const spirit = SPIRITS.find(s => s.value === form.spirit)
    return (
<div className="min-h-screen" style={{ background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
        <div className="max-w-3xl mx-auto px-4 py-10">
           <div className="flex items-center justify-between mb-8">
             <h1 className="text-2xl font-bold">Previzualizare</h1>
             <Button variant="outline" onClick={() => setShowPreview(false)}>Înapoi la editor</Button>
           </div>
          <article className="space-y-6">
            {form.heroImageUrl && (
              <Image src={form.heroImageUrl} alt={form.title} className="w-full h-64 object-cover rounded-xl" />
            )}
             <h2 className="text-3xl font-bold tracking-tight">{form.title || 'Cocktail fără titlu'}</h2>
             {form.summary && <p className="text-muted-foreground leading-relaxed">{form.summary}</p>}
             <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(139,26,43,0.15)', color: '#8B1A2B', border: '1px solid rgba(139,26,43,0.3)' }}>
                  {form.category === 'alcoholic' ? '🥃 Alcoholic' : '🍃 Non-Alcoholic'}
                </span>
               {spirit && (
                 <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(0,0,0,0.05)', color: '#444', border: '1px solid rgba(0,0,0,0.1)' }}>
                   {spirit.emoji} {spirit.label}
                 </span>
               )}
               {form.category === 'alcoholic' && form.abv && (
                 <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(0,0,0,0.08)', color: '#555', border: '1px solid rgba(0,0,0,0.12)' }}>
                   {form.abv}% ABV
                 </span>
               )}
               <span className="px-3 py-1 rounded-full text-xs font-medium capitalize" style={{ background: 'rgba(0,0,0,0.05)', color: '#666', border: '1px solid rgba(0,0,0,0.1)' }}>
                 {form.difficulty}
               </span>
             </div>
            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
               {form.serves && <div><span className="font-medium">Porții:</span> {form.serves}</div>}
               {form.glassware && <div><span className="font-medium">Pahar:</span> {form.glassware}</div>}
               {form.garnish && <div><span className="font-medium">Garnitură:</span> {form.garnish}</div>}
             </div>
             <div>
               <h3 className="text-lg font-semibold mb-3">Ingrediente</h3>
               <ul className="space-y-1.5">
                 {form.ingredients.filter(i => i.name.trim()).map((ing, i) => (
                   <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-violet-500 flex-shrink-0" />
                    {[ing.qty, ing.unit, ing.name].filter(Boolean).join(' ')}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-3">Metodă</h3>
              <ol className="space-y-4">
                {form.steps.filter(s => s.trim()).map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm text-foreground">
                      <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: '#8B1A2B', color: 'white' }}>{i + 1}</span>
                    <p className="pt-0.5 leading-relaxed">{step}</p>
                  </li>
                ))}
              </ol>
            </div>
          </article>
        </div>
      </div>
    )
  }

  /* ── Main form ── */
  return (
    <div className="min-h-screen" style={{ background: '#dde3ee', color: '#111' }}>
      <div className="max-w-3xl mx-auto px-4 py-10">

         {/* Header */}
         <div className="flex items-center gap-3 mb-8">
           <Link href="/cocktailbooks" className="text-muted-foreground hover:text-foreground transition-colors">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
               <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
             </svg>
           </Link>
           <div>
             <h1 className="text-2xl font-bold tracking-tight">🍹 Cocktail nou</h1>
             <p className="text-sm text-muted-foreground">
               Câmpurile marcate cu <span className="text-destructive font-medium">*</span> sunt obligatorii.
             </p>
           </div>
         </div>

        <div className="space-y-8">

          {/* ── Title ── */}
          <div className={sectionCls}>
            <label className={labelCls}>Titlu <span className="text-destructive">*</span></label>
            <input
              type="text"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              className={errors.title ? inputErrCls : inputCls}
              placeholder="ex. Negroni cu Mezcal afumat"
              data-error={!!errors.title}
            />
            {errors.title && <p className={errorCls}>{errors.title}</p>}
          </div>

          {/* ── Summary ── */}
          <div className={sectionCls}>
            <label className={labelCls}>
              Rezumat <span className="text-destructive">*</span>
              <span className="text-muted-foreground text-xs font-normal ml-1">— afișat pe cardurile de căutare</span>
            </label>
            <textarea
              value={form.summary}
              onChange={e => set('summary', e.target.value)}
              rows={3}
              className={errors.summary ? inputErrCls : inputCls}
              placeholder="O variantă a clasicului Negroni — mezcal înlocuiește ginul pentru o aromă afumată profundă..."
              data-error={!!errors.summary}
            />
            {errors.summary && <p className={errorCls}>{errors.summary}</p>}
          </div>

          {/* ── Hero image ── */}
          <div className={sectionCls}>
            <label className={labelCls}>
              URL fotografie principală <span className="text-destructive">*</span>
            </label>
            <input
              type="url"
              value={form.heroImageUrl}
              onChange={e => set('heroImageUrl', e.target.value)}
              className={errors.heroImageUrl ? inputErrCls : inputCls}
              placeholder="https://..."
              data-error={!!errors.heroImageUrl}
            />
            {errors.heroImageUrl && <p className={errorCls}>{errors.heroImageUrl}</p>}
             {form.heroImageUrl && !errors.heroImageUrl && (
               <Image src={form.heroImageUrl} alt="Preview" className="mt-2 h-32 w-auto object-cover rounded-lg border border-border" />
             )}
          </div>

          {/* ── Category + Spirit ── */}
          <div className="rounded-xl border p-5 space-y-5" style={{ borderColor: 'rgba(0,0,0,0.08)', background: 'rgba(0,0,0,0.02)' }}>
            <p className="text-sm font-semibold text-foreground">Tip băutură <span className="text-destructive">*</span></p>

            {/* Category */}
            <div>
              <label className={labelCls}>Categorie</label>
              <div className="flex gap-2">
                {(['alcoholic', 'non-alcoholic'] as const).map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      set('category', cat)
                      if (cat === 'non-alcoholic') { set('spirit', 'none'); set('abv', '0') }
                      else { set('spirit', ''); set('abv', '') }
                    }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border"
                    style={form.category === cat
                      ? { background: cat === 'alcoholic' ? 'rgba(139,26,43,0.3)' : 'rgba(5,150,105,0.3)', borderColor: cat === 'alcoholic' ? '#8B1A2B' : '#059669', color: cat === 'alcoholic' ? '#b8394e' : '#6ee7b7' }
                      : { background: 'transparent', borderColor: 'rgba(0,0,0,0.1)', color: '#888' }
                    }
                  >
                    {cat === 'alcoholic' ? '🥃 Alcoolic' : '🍃 Nealcoolic'}
                  </button>
                ))}
              </div>
            </div>

            {/* Spirit */}
            <div>
              <label className={labelCls}>Spirtoasă de bază <span className="text-destructive">*</span></label>
              <div className="flex flex-wrap gap-2" data-error={!!errors.spirit}>
                {SPIRITS.filter(s => form.category === 'non-alcoholic' ? s.value === 'none' : s.value !== 'none').map(sp => (
                  <button
                    key={sp.value}
                    type="button"
                    onClick={() => set('spirit', sp.value)}
                     className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all"
                     style={form.spirit === sp.value
                       ? { background: 'rgba(139,26,43,0.3)', borderColor: '#8B1A2B', color: '#b8394e' }
                       : { background: 'transparent', borderColor: 'rgba(0,0,0,0.1)', color: '#888' }
                     }
                  >
                    <span>{sp.emoji}</span> {sp.label}
                  </button>
                ))}
              </div>
              {errors.spirit && <p className={errorCls} data-error="true">{errors.spirit}</p>}
            </div>

            {/* ABV */}
            {form.category === 'alcoholic' && (
              <div className="grid grid-cols-2 gap-4">
                <div className={sectionCls}>
                  <label className={labelCls}>ABV % <span className="text-destructive">*</span></label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={form.abv}
                    onChange={e => set('abv', e.target.value)}
                    className={errors.abv ? inputErrCls : inputCls}
                    placeholder="ex. 20"
                    data-error={!!errors.abv}
                  />
                  {errors.abv && <p className={errorCls}>{errors.abv}</p>}
                </div>
                <div className={sectionCls}>
                   <label className={labelCls}>Porții <span className="text-destructive">*</span></label>
                   <input
                     type="number"
                     min={1}
                     value={form.serves}
                     onChange={e => set('serves', e.target.value)}
                     className={errors.serves ? inputErrCls : inputCls}
                     placeholder="1"
                     data-error={!!errors.serves}
                   />
                   {errors.serves && <p className={errorCls}>{errors.serves}</p>}
                 </div>
               </div>
             )}
             {form.category === 'non-alcoholic' && (
               <div className={sectionCls}>
                 <label className={labelCls}>Porții <span className="text-destructive">*</span></label>
                <input
                  type="number"
                  min={1}
                  value={form.serves}
                  onChange={e => set('serves', e.target.value)}
                  className={errors.serves ? inputErrCls : inputCls}
                  placeholder="1"
                  data-error={!!errors.serves}
                />
                {errors.serves && <p className={errorCls}>{errors.serves}</p>}
              </div>
            )}
          </div>

          {/* ── Difficulty ── */}
          <div className={sectionCls}>
             <label className={labelCls}>Dificultate</label>
            <div className="flex gap-2">
              {DIFFICULTY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set('difficulty', opt.value)}
                   className="flex-1 py-2.5 px-3 rounded-xl text-sm border transition-all text-left"
                   style={form.difficulty === opt.value
                      ? { background: 'rgba(139,26,43,0.25)', borderColor: '#8B1A2B', color: '#b8394e' }
                     : { background: 'transparent', borderColor: 'rgba(0,0,0,0.1)', color: '#888' }
                   }
                >
                  <p className="font-semibold">{opt.label}</p>
                  <p className="text-[10px] mt-0.5 opacity-70">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* ── Glassware + Garnish ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={sectionCls}>
               <label className={labelCls}>Pahar <span className="text-muted-foreground text-xs font-normal">(opțional)</span></label>
              <input
                type="text"
                value={form.glassware}
                onChange={e => set('glassware', e.target.value)}
                className={inputCls}
                placeholder="ex. Coupe, pahar rocks"
              />
            </div>
            <div className={sectionCls}>
              <label className={labelCls}>Garnitură <span className="text-muted-foreground text-xs font-normal">(opțional)</span></label>
              <input
                type="text"
                value={form.garnish}
                onChange={e => set('garnish', e.target.value)}
                className={inputCls}
                placeholder="ex. Coajă de portocală, crenguță de mentă"
              />
            </div>
          </div>

          {/* ── Tags ── */}
          <div className={sectionCls}>
             <label className={labelCls}>Etichete <span className="text-muted-foreground text-xs font-normal">(opțional — alege până la 5)</span></label>
            <div className="flex flex-wrap gap-1.5">
              {COCKTAIL_TAGS.map(tag => {
                const active = form.tags.includes(tag)
                const atLimit = !active && form.tags.length >= 5
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => !atLimit && toggleTag(tag)}
                    disabled={atLimit}
                     className="px-2.5 py-1 rounded-full text-xs font-medium border capitalize transition-all disabled:opacity-30"
                     style={active
                       ? { background: 'rgba(139,26,43,0.3)', borderColor: '#8B1A2B', color: '#b8394e' }
                       : { background: 'transparent', borderColor: 'rgba(0,0,0,0.1)', color: '#888' }
                     }
                  >
                    {active && '✓ '}{tag}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Ingredients ── */}
          <div className={sectionCls}>
             <label className={labelCls}>Ingrediente <span className="text-destructive">*</span></label>
              <div className="flex items-center gap-2 mb-1">
               <span className="w-5 flex-shrink-0" />
               <span className="w-16 flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-center">Cant.</span>
               <span className="w-32 flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-center">Unitate</span>
               <span className="flex-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Ingredient</span>
              </div>
            <div className="space-y-2">
              {form.ingredients.map((ing, idx) => (
                 <div key={idx} className="flex items-center gap-2">
                   <span className="text-xs text-muted-foreground w-5 text-right flex-shrink-0">{idx + 1}.</span>
                  <input
                    type="text"
                    value={ing.qty}
                    onChange={e => updateIngredient(idx, 'qty', e.target.value)}
                    className="w-16 flex-shrink-0 rounded-lg border border-border bg-background px-2 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring"
                    placeholder="60"
                  />
                   <select
                     value={ing.unit}
                     onChange={e => updateIngredient(idx, 'unit', e.target.value)}
                     className="w-32 flex-shrink-0 rounded-lg border border-border bg-background px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring"
                   >
                    {UNITS.map(u => (
                       <option key={u} value={u}>{u === '' ? '— unitate —' : u}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={ing.name}
                    onChange={e => updateIngredient(idx, 'name', e.target.value)}
                    className={`flex-1 ${inputCls}`}
                     placeholder={idx === 0 ? 'Gin' : idx === 1 ? 'Vermut dulce' : ''}
                  />
                  {form.ingredients.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeIngredient(idx)}
                      className="p-1.5 text-muted-foreground hover:text-destructive rounded transition-colors flex-shrink-0"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addIngredient}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mt-1"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                 Adaugă ingredient
              </button>
            </div>
            {errors.ingredients && <p className={errorCls} data-error="true">{errors.ingredients}</p>}
          </div>

          {/* ── Steps / Method ── */}
          <div className={sectionCls}>
             <label className={labelCls}>Metodă <span className="text-destructive">*</span></label>
            <div className="space-y-3">
              {form.steps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-2" style={{ background: '#8B1A2B' }}>
                     {idx + 1}
                   </span>
                  <textarea
                    value={step}
                    onChange={e => updateStep(idx, e.target.value)}
                    rows={2}
                    className={`flex-1 ${inputCls}`}
                     placeholder={idx === 0 ? 'Adaugă toate ingredientele în paharul de amestec cu gheață...' : ''}
                  />
                  {form.steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStep(idx)}
                      className="p-1.5 text-muted-foreground hover:text-destructive rounded transition-colors mt-2"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addStep}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mt-1"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                 Adaugă pas
              </button>
            </div>
            {errors.steps && <p className={errorCls} data-error="true">{errors.steps}</p>}
          </div>

          {/* ── Actions ── */}
          <div className="flex flex-wrap items-center gap-3 pt-4 border-t">
             <Button onClick={handleSubmit} disabled={saving}>
               {saving ? 'Se publică...' : '🍹 Publică cocktailul'}
             </Button>
             <Button variant="outline" onClick={() => setShowPreview(true)}>
               Previzualizare
             </Button>
             <div className="flex-1" />
             <Link href="/cocktailbooks" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
               Anulează
             </Link>
          </div>

        </div>
      </div>
    </div>
  )
}

export default function SubmitCocktailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#dde3ee' }}>
        <div className="text-muted-foreground">Se încarcă...</div>
      </div>
    }>
      <SubmitCocktailPageContent />
    </Suspense>
  )
}


