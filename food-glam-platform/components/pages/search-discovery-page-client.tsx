'use client'

import React, { Suspense, useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Search,
  SlidersHorizontal,
  X,
  ChevronDown,
  ArrowUpDown,
  Flame,
  Clock,
  Sparkles,
  Loader2,
  SearchX,
} from 'lucide-react'
import RecipeCard from '@/components/RecipeCard'
import { AdInFeed } from '@/components/ads/ad-placements'
import { REGION_META } from '@/lib/recipe-taxonomy'
import type { MockCocktail } from '@/lib/mock-data'


/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Recipe {
  id: string
  slug: string
  title: string
  summary: string | null
  hero_image_url: string
  region: string
  approach_slug: string
  votes: number
  trending_votes: number
  comments: number
  tag: string
  badges: string[] | undefined
  dietTags: string[]
  foodTags: string[]
  is_tested: boolean
  quality_score: number | null
  created_at: string
  created_by: {
    id: string
    display_name: string
    handle: string
    avatar_url: string | null
  }
  is_saved: boolean
}

interface SearchResponse {
  recipes: Recipe[]
  total: number
  page: number
  per_page: number
  has_more: boolean
  filters: {
    q: string
    approach: string
    diet_tags: string[]
    type: string
    sort: string
    cuisine_id: string
    food_style_id: string
    cookbook_id: string
    chapter_id: string
  }
}

interface CocktailResponse {
  cocktails: MockCocktail[]
  total: number
  page: number
  per_page: number
  has_more: boolean
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const REGION_GROUPS = [
  {
    continent: 'Europa',
    regions: ['western-europe', 'northern-europe', 'eastern-europe'],
  },
  {
    continent: 'Orientul Mijlociu și Asia Centrală',
    regions: ['middle-east', 'central-asia'],
  },
  {
    continent: 'Asia',
    regions: ['east-asia', 'southeast-asia', 'south-asia'],
  },
  {
    continent: 'Africa',
    regions: ['north-africa', 'west-africa', 'east-africa', 'southern-africa'],
  },
  {
    continent: 'Americi',
    regions: ['north-america', 'south-america'],
  },
  {
    continent: 'Oceania și Internațional',
    regions: ['oceania', 'international'],
  },
]

// Flat list kept for lookups (active filter label, etc.)
const REGIONS = [
  { slug: '', label: 'Toate regiunile', emoji: '\u{1F30D}' },
  ...REGION_GROUPS.flatMap(g => g.regions.map(id => ({ slug: id, label: REGION_META[id].label, emoji: REGION_META[id].emoji }))),
]
const APPROACHES = REGIONS // Alias for backwards compatibility

const FOOD_TAG_GROUPS = [
  {
    label: 'Fel',
    tags: ['pizza', 'noodles', 'sushi', 'pastry', 'tacos', 'curry', 'paella', 'rice', 'bowl', 'stew', 'casserole'],
  },
  {
    label: 'Proteină',
    tags: ['seafood', 'chicken', 'lamb', 'pork', 'beef', 'tofu'],
  },
  {
    label: 'Caracter',
    tags: ['spicy', 'sweet', 'smoky', 'crispy', 'healthy', 'street-food', 'breakfast', 'dessert', 'comfort'],
  },
]

// Flat list derived from groups — used for active-filter lookups
const FOOD_TAGS = FOOD_TAG_GROUPS.flatMap(g => g.tags)

const STATUS_TAGS = ['Popular', 'În tendințe', 'Nou', 'Testat']

const QUALITY_OPTIONS = [
  { value: 0, label: 'Orice' },
  { value: 4.0, label: '4.0+' },
  { value: 4.3, label: '4.3+' },
  { value: 4.5, label: '4.5+' },
  { value: 4.7, label: '4.7+' },
]

const CALORIE_OPTIONS = [
  { value: 0,    label: 'Orice' },
  { value: 300,  label: '< 300 kcal' },
  { value: 500,  label: '< 500 kcal' },
  { value: 700,  label: '< 700 kcal' },
  { value: 1000, label: '< 1000 kcal' },
]

const DIET_TAGS = [
  'vegan',
  'vegetarian',
  'gluten-free',
  'keto',
  'paleo',
  'dairy-free',
  'nut-free',
  'low-carb',
  'high-protein',
  'whole30',
]


const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevanță', icon: Sparkles },
  { value: 'trending', label: 'În tendințe (7z)', icon: Flame },
  { value: 'newest', label: 'Cele mai noi', icon: Clock },
]

const PER_PAGE = 12

const SPIRITS = [
  { value: '', label: 'Toate spirtoasele' },
  { value: 'whisky',   label: '🥃 Whisky' },
  { value: 'gin',      label: '🌿 Gin' },
  { value: 'rum',      label: '🍹 Rum' },
  { value: 'tequila',  label: '🌵 Tequila' },
  { value: 'vodka',    label: '🧊 Vodka' },
  { value: 'brandy',   label: '🍇 Brandy' },
  { value: 'liqueur',  label: '🍊 Lichior' },
  { value: 'wine',     label: '🍾 Vin' },
]

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function SearchDiscoveryPageClientContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // ---- Mode toggle: recipes | cocktails ----
  const [mode, setMode] = useState<'recipes' | 'cocktails'>(
    searchParams.get('mode') === 'cocktails' ? 'cocktails' : 'recipes'
  )

  // ---- State from URL params ----
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [approach, setApproach] = useState(searchParams.get('approach') || '')
  const [dietTags, setDietTags] = useState<string[]>(() => {
    const raw = searchParams.get('diet_tags')
    return raw ? raw.split(',').filter(Boolean) : []
  })

  const [sort, setSort] = useState(searchParams.get('sort') || 'relevance')
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10) || 1)
  const [foodTags, setFoodTags] = useState<string[]>(() => {
    const raw = searchParams.get('food_tags')
    return raw ? raw.split(',').filter(Boolean) : []
  })
  const [isTested, setIsTested] = useState(searchParams.get('is_tested') === 'true')
  const [tagFilter, setTagFilter] = useState(searchParams.get('tag') || '')
  const [qualityMin, setQualityMin] = useState(parseFloat(searchParams.get('quality_min') || '0') || 0)
  const [cuisineId, setCuisineId] = useState(searchParams.get('cuisine_id') || '')
  const [cookbookId, setCookbookId] = useState(searchParams.get('cookbook_id') || '')
  const [chapterId, setChapterId] = useState(searchParams.get('chapter_id') || '')
  const [calMax, setCalMax] = useState(parseInt(searchParams.get('cal_max') || '0') || 0)

  // ---- Cocktail-specific state ----
  const [cocktails, setCocktails] = useState<MockCocktail[]>([])
  const [cocktailTotal, setCocktailTotal] = useState(0)
  const [cocktailHasMore, setCocktailHasMore] = useState(false)
  const [cocktailCategory, setCocktailCategory] = useState<'' | 'alcoholic' | 'non-alcoholic'>(
    (searchParams.get('category') as '' | 'alcoholic' | 'non-alcoholic') || ''
  )
  const [cocktailSpirit, setCocktailSpirit] = useState(searchParams.get('spirit') || '')

  // ---- UI state ----
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [initialLoad, setInitialLoad] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // ---- Sync URL params ----
  const updateURL = useCallback((params: Record<string, string>) => {
    const sp = new URLSearchParams()
    Object.entries(params).forEach(([key, val]) => {
      if (val) sp.set(key, val)
    })
    const qs = sp.toString()
    router.replace(`/search${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [router])

  // ---- Fetch search results ----
  const fetchResults = useCallback(async (
    searchQuery: string,
    searchApproach: string,
    searchDietTags: string[],
    searchType: string,
    searchSort: string,
    searchPage: number,
    searchFoodTags: string[],
    searchIsTested: boolean,
    searchTagFilter: string,
    searchQualityMin: number,
    searchCalMax: number,
  ) => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setLoading(true)

    const params = new URLSearchParams()
    if (searchQuery) params.set('q', searchQuery)
    if (searchApproach) params.set('approach', searchApproach)
    if (searchDietTags.length > 0) params.set('diet_tags', searchDietTags.join(','))
    if (searchType) params.set('type', searchType)
    if (searchSort) params.set('sort', searchSort)
    if (searchFoodTags.length > 0) params.set('food_tags', searchFoodTags.join(','))
    if (searchIsTested) params.set('is_tested', 'true')
    if (searchTagFilter) params.set('tag', searchTagFilter)
    if (searchQualityMin > 0) params.set('quality_min', String(searchQualityMin))
    if (searchCalMax > 0) params.set('cal_max', String(searchCalMax))
    params.set('page', String(searchPage))
    params.set('per_page', String(PER_PAGE))

    try {
      const res = await fetch(`/api/search/recipes?${params.toString()}`, {
        signal: abortRef.current.signal,
      })
      if (!res.ok) throw new Error('Search failed')
      const data: SearchResponse = await res.json()

      setRecipes(data.recipes)
      setTotal(data.total)
      setHasMore(data.has_more)
      setInitialLoad(false)
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return
      console.error('Search error:', e)
      setRecipes([])
      setTotal(0)
      setHasMore(false)
      setInitialLoad(false)
    } finally {
      setLoading(false)
    }
  }, [])

  // ---- Fetch cocktail results ----
  const fetchCocktails = useCallback(async (
    searchQuery: string,
    category: '' | 'alcoholic' | 'non-alcoholic',
    spirit: string,
    searchSort: string,
    searchPage: number,
  ) => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setLoading(true)
    const params = new URLSearchParams()
    if (searchQuery) params.set('q', searchQuery)
    if (category) params.set('category', category)
    if (spirit) params.set('spirit', spirit)
    params.set('sort', searchSort)
    params.set('page', String(searchPage))
    params.set('per_page', String(PER_PAGE))
    try {
      const res = await fetch(`/api/search/cocktails?${params.toString()}`, {
        signal: abortRef.current.signal,
      })
      if (!res.ok) throw new Error('Cocktail search failed')
      const data: CocktailResponse = await res.json()
      setCocktails(data.cocktails)
      setCocktailTotal(data.total)
      setCocktailHasMore(data.has_more)
      setInitialLoad(false)
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return
      setCocktails([])
      setCocktailTotal(0)
      setCocktailHasMore(false)
      setInitialLoad(false)
    } finally {
      setLoading(false)
    }
  }, [])

  // ---- Trigger search on filter changes ----
  const triggerSearch = useCallback((
    newQuery?: string,
    newApproach?: string,
    newDietTags?: string[],

    newSort?: string,
    newPage?: number,
    newFoodTags?: string[],
    newIsTested?: boolean,
    newTagFilter?: string,
    newQualityMin?: number,
    newCalMax?: number,
  ) => {
    const q = newQuery ?? query
    const a = newApproach ?? approach
    const d = newDietTags ?? dietTags
    const t = 'recipe'
    const s = newSort ?? sort
    const p = newPage ?? 1
    const ft = newFoodTags ?? foodTags
    const it = newIsTested ?? isTested
    const tf = newTagFilter ?? tagFilter
    const qm = newQualityMin ?? qualityMin
    const cm = newCalMax ?? calMax

    // Update URL
    updateURL({
      q,
      approach: a,
      diet_tags: d.join(','),
      type: '',
      sort: s !== 'relevance' ? s : '',
      food_tags: ft.join(','),
      is_tested: it ? 'true' : '',
      tag: tf,
      quality_min: qm > 0 ? String(qm) : '',
      cal_max: cm > 0 ? String(cm) : '',
      page: p > 1 ? String(p) : '',
    })

    fetchResults(q, a, d, t, s, p, ft, it, tf, qm, cm)
  }, [query, approach, dietTags, sort, foodTags, isTested, tagFilter, qualityMin, calMax, fetchResults, updateURL])

  // ---- Debounced search for text input ----
  const handleQueryChange = (value: string) => {
    setQuery(value)
    setPage(1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      triggerSearch(value, undefined, undefined, undefined, 1)
    }, 350)
  }

  // ---- Filter changes (immediate) ----
  const handleApproachChange = (val: string) => {
    setApproach(val)
    setPage(1)
    triggerSearch(undefined, val, undefined, undefined, 1)
  }

  const handleDietTagToggle = (tag: string) => {
    const next = dietTags.includes(tag)
      ? dietTags.filter(t => t !== tag)
      : [...dietTags, tag]
    setDietTags(next)
    setPage(1)
    triggerSearch(undefined, undefined, next, undefined, 1)
  }

  const handleFoodTagToggle = (tag: string) => {
    const next = foodTags.includes(tag) ? foodTags.filter(t => t !== tag) : [...foodTags, tag]
    setFoodTags(next)
    setPage(1)
    triggerSearch(undefined, undefined, undefined, undefined, 1, next)
  }

  const handleTestedToggle = () => {
    const next = !isTested
    setIsTested(next)
    setPage(1)
    triggerSearch(undefined, undefined, undefined, undefined, 1, undefined, next)
  }

  const handleTagFilterChange = (val: string) => {
    const next = tagFilter === val ? '' : val
    setTagFilter(next)
    setPage(1)
    triggerSearch(undefined, undefined, undefined, undefined, 1, undefined, undefined, next)
  }

  const handleQualityMinChange = (val: number) => {
    setQualityMin(val)
    setPage(1)
    triggerSearch(undefined, undefined, undefined, undefined, 1, undefined, undefined, undefined, val)
  }

  const handleCalMaxChange = (val: number) => {
    setCalMax(val)
    setPage(1)
    triggerSearch(undefined, undefined, undefined, undefined, 1, undefined, undefined, undefined, undefined, val)
  }


  const handleSortChange = (val: string) => {
    setSort(val)
    setPage(1)
    triggerSearch(undefined, undefined, undefined, val, 1)
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    triggerSearch(undefined, undefined, undefined, undefined, newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const clearAllFilters = () => {
    setQuery('')
    setApproach('')
    setDietTags([])

    setSort('relevance')
    setFoodTags([])
    setIsTested(false)
    setTagFilter('')
    setQualityMin(0)
    setCalMax(0)
    setPage(1)
    triggerSearch('', '', [], 'relevance', 1, [], false, '', 0, 0)
  }

  // ---- Mode switch ----
  const switchMode = (newMode: 'recipes' | 'cocktails') => {
    setMode(newMode)
    setInitialLoad(true)
    setPage(1)
    if (newMode === 'cocktails') {
      router.replace('/search?mode=cocktails', { scroll: false })
      fetchCocktails(query, cocktailCategory, cocktailSpirit, 'trending', 1)
    } else {
      router.replace('/search', { scroll: false })
      fetchResults(query, approach, dietTags, 'recipe', sort, 1, foodTags, isTested, tagFilter, qualityMin, calMax)
    }
  }

  // ---- Cocktail-specific handlers ----
  const handleCocktailCategoryChange = (cat: '' | 'alcoholic' | 'non-alcoholic') => {
    setCocktailCategory(cat)
    setPage(1)
    fetchCocktails(query, cat, cocktailSpirit, sort, 1)
  }

  const handleCocktailSpiritChange = (sp: string) => {
    setCocktailSpirit(sp)
    setPage(1)
    fetchCocktails(query, cocktailCategory, sp, sort, 1)
  }

  const handleCocktailPageChange = (newPage: number) => {
    setPage(newPage)
    fetchCocktails(query, cocktailCategory, cocktailSpirit, sort, newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const hasActiveFilters = query || approach || dietTags.length > 0 || sort !== 'relevance' || foodTags.length > 0 || isTested || tagFilter || qualityMin > 0 || calMax > 0 || cookbookId || chapterId

  // ---- Initial load ----
  useEffect(() => {
    if (mode === 'cocktails') {
      fetchCocktails(query, cocktailCategory, cocktailSpirit, 'trending', page)
    } else {
      fetchResults(query, approach, dietTags, 'recipe', sort, page, foodTags, isTested, tagFilter, qualityMin, calMax)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Active filter count ----
  const activeFilterCount = [
    approach ? 1 : 0,
    dietTags.length > 0 ? 1 : 0,

    foodTags.length > 0 ? 1 : 0,
    isTested ? 1 : 0,
    tagFilter ? 1 : 0,
    qualityMin > 0 ? 1 : 0,
    calMax > 0 ? 1 : 0,
  ].reduce((a, b) => a + b, 0)

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))
  const cocktailTotalPages = Math.max(1, Math.ceil(cocktailTotal / PER_PAGE))

  return (
    <main className="min-h-screen" style={{ background: '#dde3ee' }}>

      {/* ---- Mode toggle: Recipes / Cocktails ---- */}
      <div className="flex justify-center pt-4 pb-0">
        <div className="inline-flex rounded-full p-1 bg-white/60">
           <button
             onClick={() => switchMode('recipes')}
             className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
               mode === 'recipes'
                 ? 'bg-amber-500 text-white shadow'
                 : 'text-stone-500 hover:text-stone-800'
             }`}
           >
             🍽️ Rețete
           </button>
           <button
             onClick={() => switchMode('cocktails')}
             className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
               mode === 'cocktails'
                 ? 'bg-violet-600 text-white shadow'
                 : 'text-stone-500 hover:text-stone-800'
             }`}
           >
             🍹 Cocktailuri
           </button>
        </div>
      </div>
      {/* ---- Hero search bar ---- */}
      <section className={`relative overflow-hidden text-white ${
        mode === 'cocktails'
          ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-violet-900'
          : 'bg-gradient-to-br from-stone-900 via-stone-800 to-amber-900'
      }`}>
        {/* Decorative grain overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }} />
        {/* Decorative circles */}
        <div className={`absolute -top-24 -right-24 w-96 h-96 rounded-full blur-3xl ${mode === 'cocktails' ? 'bg-violet-600/10' : 'bg-amber-600/10'}`} />
        <div className={`absolute -bottom-32 -left-32 w-80 h-80 rounded-full blur-3xl ${mode === 'cocktails' ? 'bg-purple-500/10' : 'bg-orange-500/10'}`} />

        <div className="relative container mx-auto px-4 py-12 md:py-16">
          <div className="max-w-2xl mx-auto text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3"
                style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
              {mode === 'cocktails' ? 'Descoperă Cocktailuri' : 'Descoperă Rețete'}
            </h1>
            <p className="text-stone-300 text-base md:text-lg">
              {mode === 'cocktails'
                ? 'Caută rețete de cocktailuri — filtrează după alcoolice sau non-alcoolice.'
                : 'Caută după titlu, filtrează după regiune și dietă, găsește-ți următoarea masă.'
              }
            </p>
          </div>

          {/* Search input */}
          <div className="max-w-2xl mx-auto relative">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
               <input
                 type="text"
                 value={query}
                 onChange={(e) => handleQueryChange(e.target.value)}
                 placeholder={mode === 'cocktails' ? 'Caută cocktailuri, spirtoase, etichete...' : 'Caută rețete după titlu sau cuvânt cheie...'}
                 className={`w-full pl-12 pr-12 py-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder:text-stone-400 text-lg focus:outline-none focus:ring-2 transition-all ${mode === 'cocktails' ? 'focus:ring-violet-500/50 focus:border-violet-500/50' : 'focus:ring-amber-500/50 focus:border-amber-500/50'}`}
               />
              {query && (
                <button
                  onClick={() => handleQueryChange('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Sort pills - desktop */}
          <div className="max-w-2xl mx-auto mt-5 flex items-center justify-center gap-2">
            {SORT_OPTIONS.map(opt => {
              const Icon = opt.icon
              const isActive = sort === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => handleSortChange(opt.value)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    isActive
                      ? `${mode === 'cocktails' ? 'bg-violet-600 shadow-violet-500/25' : 'bg-amber-500 shadow-amber-500/25'} text-white shadow-lg`
                      : 'bg-white/10 text-stone-300 hover:bg-white/20'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* ---- Content area ---- */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* ---- Filters toggle (mobile) ---- */}
          <div className="lg:hidden">
             <button
               onClick={() => setFiltersOpen(!filtersOpen)}
               className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white border border-stone-200 shadow-sm"
             >
               <span className="flex items-center gap-2 text-sm font-medium text-stone-700">
                 <SlidersHorizontal className="w-4 h-4" />
                 Filtre
                 {activeFilterCount > 0 && (
                   <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold">
                     {activeFilterCount}
                   </span>
                 )}
               </span>
               <ChevronDown className={`w-4 h-4 text-stone-500 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
             </button>
          </div>

          {/* ---- Sidebar filters ---- */}
          <aside className={`lg:w-64 lg:flex-shrink-0 ${filtersOpen ? 'block' : 'hidden lg:block'}`}>

            {/* ====== COCKTAIL SIDEBAR ====== */}
            {mode === 'cocktails' && (
              <div className="rounded-2xl border p-5 space-y-6 sticky top-4" style={{ background: 'rgba(255,255,255,0.65)', borderColor: 'rgba(0,0,0,0.1)' }}>
                 <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#7c3aed' }}>Filtre</h2>

                {/* Category */}
                <div>
                   <label className="block text-xs font-medium uppercase tracking-wider mb-2" style={{ color: '#555' }}>Categorie</label>
                   <div className="flex flex-col gap-1.5">
                     {([['', 'Toate băuturile', '🍹'], ['alcoholic', 'Alcoolice', '🥃'], ['non-alcoholic', 'Non-alcoolice', '🍃']] as const).map(([val, label, emoji]) => (
                      <button
                        key={val}
                        onClick={() => handleCocktailCategoryChange(val)}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left"
                        style={cocktailCategory === val
                          ? { background: '#7c3aed', color: '#fff' }
                          : { background: 'rgba(0,0,0,0.06)', color: '#444' }
                        }
                      >
                        <span>{emoji}</span> {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Spirit */}
                {(cocktailCategory === '' || cocktailCategory === 'alcoholic') && (
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wider mb-2" style={{ color: '#555' }}>Spirtoasă</label>
                    <div className="flex flex-wrap gap-1.5">
                      {SPIRITS.map(sp => (
                        <button
                          key={sp.value}
                          onClick={() => handleCocktailSpiritChange(sp.value)}
                          className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                          style={cocktailSpirit === sp.value
                            ? { background: '#7c3aed', color: '#fff' }
                            : { background: 'rgba(0,0,0,0.06)', color: '#444' }
                          }
                        >
                          {sp.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                 {/* Difficulty */}
                 <div>
                   <label className="block text-xs font-medium uppercase tracking-wider mb-2" style={{ color: '#555' }}>Dificultate</label>
                   <div className="flex flex-wrap gap-1.5">
                     {([['', 'Orice'], ['easy', 'Ușor'], ['medium', 'Mediu'], ['hard', 'Greu']] as const).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => {
                          fetchCocktails(query, cocktailCategory, cocktailSpirit, sort, 1)
                        }}
                        className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                        style={{ background: 'rgba(0,0,0,0.06)', color: '#444' }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ====== RECIPE SIDEBAR ====== */}
            {mode === 'recipes' && (
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-6 sticky top-4">
                {/* Header */}
                 <div className="flex items-center justify-between">
                   <h2 className="text-sm font-semibold text-stone-800 uppercase tracking-wider">Filtre</h2>
                   {hasActiveFilters && (
                     <button onClick={clearAllFilters} className="text-xs text-amber-600 hover:text-amber-700 font-medium">
                       Șterge tot
                     </button>
                   )}
                 </div>

                 {/* Region */}
                 <div>
                   <div className="flex items-center justify-between mb-2">
                     <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider">Regiune</label>
                     {approach && (<button onClick={() => handleApproachChange('')} className="text-[10px] text-amber-600 hover:text-amber-700 font-medium">Șterge</button>)}
                   </div>
                   <select value={approach} onChange={e => handleApproachChange(e.target.value)} className="w-full text-xs rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 cursor-pointer">
                     <option value="">🌍 Toate regiunile</option>
                    {REGION_GROUPS.map(group => (
                      <optgroup key={group.continent} label={group.continent}>
                        {group.regions.map(id => {
                          const r = REGION_META[id]
                          return (<option key={id} value={id}>{r.emoji} {r.label}</option>)
                        })}
                      </optgroup>
                    ))}
                  </select>
                </div>

                 {/* Food Tags */}
                 <div>
                   <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">Etichete Mâncare</label>
                  <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                    {FOOD_TAG_GROUPS.map(group => (
                      <div key={group.label}>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1.5">{group.label}</p>
                        <div className="flex flex-wrap gap-1">
                          {group.tags.map(tag => {
                            const isActive = foodTags.includes(tag)
                            return (
                              <button key={tag} onClick={() => handleFoodTagToggle(tag)} className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize transition-all ${isActive ? 'bg-orange-500 text-white shadow-sm' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
                                {tag}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                 {/* Diet tags */}
                 <div>
                   <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">Dietă &amp; Preferințe</label>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {DIET_TAGS.map(tag => {
                      const isChecked = dietTags.includes(tag)
                      return (
                        <label key={tag} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${isChecked ? 'bg-amber-50 text-amber-800' : 'hover:bg-stone-50 text-stone-600'}`}>
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${isChecked ? 'bg-amber-500 border-amber-500' : 'border-stone-300'}`}>
                            {isChecked && (<svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>)}
                          </div>
                          <span className="text-sm capitalize">{tag.replace('-', ' ')}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                 {/* Status */}
                 <div>
                   <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">Stare</label>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_TAGS.map(tag => (
                      <button key={tag} onClick={() => handleTagFilterChange(tag)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${tagFilter === tag ? 'bg-violet-500 text-white shadow-sm' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>{tag}</button>
                    ))}
                  </div>
                </div>

                 {/* Quality */}
                 <div>
                   <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">Calitate Minimă</label>
                   <div className="flex flex-wrap gap-1.5">
                     {QUALITY_OPTIONS.map(opt => (
                       <button key={opt.value} onClick={() => handleQualityMinChange(opt.value)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${qualityMin === opt.value ? 'bg-emerald-500 text-white shadow-sm' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>{opt.label}</button>
                     ))}
                   </div>
                 </div>

                 {/* Calories */}
                 <div>
                   <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">Calorii Maxime</label>
                  <div className="flex flex-wrap gap-1.5">
                    {CALORIE_OPTIONS.map(opt => (
                      <button key={opt.value} onClick={() => handleCalMaxChange(opt.value)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${calMax === opt.value ? 'bg-rose-500 text-white shadow-sm' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>{opt.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </aside>

          {/* ---- Results area ---- */}
          <div className="flex-1 min-w-0">
            {/* Results header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <p className={`text-sm ${mode === 'cocktails' ? 'text-slate-400' : 'text-stone-500'}`}>
                   {loading ? (
                     <span className="flex items-center gap-1.5">
                       <Loader2 className="w-3.5 h-3.5 animate-spin" />
                       Se caută...
                     </span>
                   ) : (
                     <>
                       <span className={`font-semibold ${mode === 'cocktails' ? 'text-white' : 'text-stone-800'}`}>
                         {mode === 'cocktails' ? cocktailTotal : total}
                       </span>{' '}
                       {mode === 'cocktails'
                         ? (cocktailTotal === 1 ? 'cocktail' : 'cocktailuri') + ' găsit'
                         : (total === 1 ? 'rețetă' : 'rețete') + ' găsite'
                       }
                     </>
                   )}
                </p>

                {/* Active filter pills */}
                {(approach || dietTags.length > 0 || foodTags.length > 0 || tagFilter || isTested || qualityMin > 0 || calMax > 0) && (
                  <div className="hidden md:flex items-center gap-1.5 flex-wrap">
                    {approach && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">
                        {REGIONS.find(a => a.slug === approach)?.label}
                        <button onClick={() => handleApproachChange('')} className="hover:text-amber-900">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {dietTags.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-medium capitalize">
                        {tag.replace('-', ' ')}
                        <button onClick={() => handleDietTagToggle(tag)} className="hover:text-emerald-900">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    {foodTags.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 text-xs font-medium capitalize">
                        {tag}
                        <button onClick={() => handleFoodTagToggle(tag)} className="hover:text-orange-900">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    {tagFilter && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-100 text-violet-800 text-xs font-medium">
                        {tagFilter}
                        <button onClick={() => handleTagFilterChange(tagFilter)} className="hover:text-violet-900">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                     {isTested && (
                       <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">
                         Doar testate
                         <button onClick={handleTestedToggle} className="hover:text-amber-900">
                           <X className="w-3 h-3" />
                         </button>
                       </span>
                     )}
                     {qualityMin > 0 && (
                       <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-medium">
                         ≥{qualityMin} calitate
                         <button onClick={() => handleQualityMinChange(0)} className="hover:text-emerald-900">
                           <X className="w-3 h-3" />
                         </button>
                       </span>
                     )}
                    {calMax > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-medium">
                        &lt;{calMax} kcal
                        <button onClick={() => handleCalMaxChange(0)} className="hover:text-rose-900">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Sort dropdown - desktop secondary */}
              <div className="hidden md:flex items-center gap-2 text-sm text-stone-500">
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>{SORT_OPTIONS.find(s => s.value === sort)?.label}</span>
              </div>
            </div>

            {/* Loading skeleton */}
            {loading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {Array.from({ length: PER_PAGE }).map((_, i) => (
                  <div key={i} className="rounded-xl overflow-hidden bg-white border border-stone-200 shadow-sm animate-pulse">
                    <div className="w-full h-40 bg-stone-200" />
                    <div className="p-4 space-y-3">
                      <div className="h-4 bg-stone-200 rounded w-3/4" />
                      <div className="h-3 bg-stone-100 rounded w-full" />
                      <div className="h-3 bg-stone-100 rounded w-1/2" />
                      <div className="flex gap-2 pt-2">
                        <div className="h-6 bg-stone-100 rounded w-16" />
                        <div className="h-6 bg-stone-100 rounded w-16" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!loading && !initialLoad && (mode === 'cocktails' ? cocktails.length === 0 : recipes.length === 0) && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-5 ${mode === 'cocktails' ? 'bg-slate-700' : 'bg-stone-100'}`}>
                  <SearchX className={`w-9 h-9 ${mode === 'cocktails' ? 'text-slate-400' : 'text-stone-400'}`} />
                </div>
                 <h3 className={`text-lg font-semibold mb-2 ${mode === 'cocktails' ? 'text-white' : 'text-stone-800'}`}>
                   Niciun {mode === 'cocktails' ? 'cocktail' : 'rețetă'} găsit
                 </h3>
                 <p className={`text-sm max-w-sm mb-6 ${mode === 'cocktails' ? 'text-slate-400' : 'text-stone-500'}`}>
                   {query ? `Niciun rezultat pentru "${query}". Încearcă cuvinte cheie diferite sau ajustează filtrele.` : 'Nimic nu se potrivește cu filtrele curente. Încearcă să lărgești căutarea.'}
                 </p>
                 {mode === 'recipes' && hasActiveFilters && (
                   <button onClick={clearAllFilters} className="px-5 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-colors">
                     Șterge toate filtrele
                   </button>
                 )}
              </div>
            )}

            {/* ====== COCKTAIL RESULTS GRID ====== */}
            {mode === 'cocktails' && !loading && cocktails.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {cocktails.map((c, idx) => (
                  <div
                    key={c.id}
                    className="animate-in fade-in slide-in-from-bottom-2 h-full"
                    style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'both', animationDuration: '300ms' }}
                  >
                    <div className="rounded-xl overflow-hidden flex flex-col h-full border transition-all hover:shadow-lg" style={{ background: 'rgba(255,255,255,0.75)', borderColor: 'rgba(0,0,0,0.1)' }}>
                      {/* Image */}
                      <div className="relative">
                        <Image src={c.hero_image_url} alt={c.title} width={400} height={176} className="w-full h-44 object-cover" />
                        {/* Category badge */}
                        <span
                          className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-bold shadow"
                          style={c.category === 'alcoholic'
                            ? { background: '#7c3aed', color: '#fff' }
                            : { background: '#059669', color: '#fff' }
                          }
                        >
                           {c.category === 'alcoholic' ? '🥃 Alcoolice' : '🍃 Non-alc'}
                        </span>
                        {/* ABV badge */}
                        {c.abv !== null && c.abv > 0 && (
                          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>
                            {c.abv}% ABV
                          </span>
                        )}
                      </div>
                      {/* Content */}
                      <div className="p-4 flex flex-col flex-1">
                        <h3 className="font-semibold text-base mb-1 line-clamp-2" style={{ color: '#111' }}>{c.title}</h3>
                        <p className="text-sm mb-3 line-clamp-2 flex-1" style={{ color: '#555' }}>{c.summary}</p>
                        {/* Tags */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: 'rgba(124,58,237,0.12)', color: '#7c3aed' }}>
                            {c.spiritLabel}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: 'rgba(0,0,0,0.07)', color: '#555' }}>
                            {c.difficulty}
                          </span>
                          {c.tags.slice(0, 2).map(t => (
                            <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-medium capitalize" style={{ background: 'rgba(0,0,0,0.05)', color: '#666' }}>{t}</span>
                          ))}
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
                          <span className="text-xs" style={{ color: '#7c3aed' }}>♥ {c.votes}</span>
                          <span className="text-xs" style={{ color: '#888' }}>★ {c.quality_score.toFixed(1)}</span>
                           <span className="text-xs ml-auto" style={{ color: '#888' }}>Servește {c.serves}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ====== AD PLACEMENT ====== */}
            {mode === 'recipes' && !loading && recipes.length > 0 && (
              <div className="mb-8">
                <AdInFeed placement="search-infeed" />
              </div>
            )}

            {/* ====== RECIPE RESULTS GRID ====== */}
            {mode === 'recipes' && !loading && recipes.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {recipes.map((recipe, idx) => (
                  <div
                    key={recipe.id}
                    className="animate-in fade-in slide-in-from-bottom-2 h-full"
                    style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'both', animationDuration: '300ms' }}
                  >
                    <RecipeCard
                      id={recipe.id}
                      slug={recipe.slug}
                      title={recipe.title}
                      summary={recipe.summary}
                      hero_image_url={recipe.hero_image_url}
                      region={recipe.region}
                      votes={recipe.votes}
                      comments={recipe.comments}
                      tag={recipe.tag}
                      badges={recipe.badges}
                      dietTags={recipe.dietTags}
                      foodTags={recipe.foodTags}
                      is_tested={recipe.is_tested}
                      quality_score={recipe.quality_score}
                      created_by={recipe.created_by}
                      is_saved={recipe.is_saved}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {!loading && (mode === 'cocktails' ? cocktailTotal : total) > PER_PAGE && (
              <div className="flex items-center justify-center gap-2 mt-10">
                 <button
                   onClick={() => mode === 'cocktails' ? handleCocktailPageChange(page - 1) : handlePageChange(page - 1)}
                   disabled={page <= 1}
                   className={`px-4 py-2.5 rounded-xl border text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${mode === 'cocktails' ? 'border-slate-600 bg-slate-700 text-slate-200 hover:bg-slate-600' : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'}`}
                 >
                   Anterior
                 </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: mode === 'cocktails' ? cocktailTotalPages : totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === (mode === 'cocktails' ? cocktailTotalPages : totalPages) || Math.abs(p - page) <= 1)
                    .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
                      if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('ellipsis')
                      acc.push(p)
                      return acc
                    }, [])
                    .map((item, i) => {
                      if (item === 'ellipsis') return <span key={`e-${i}`} className="px-2 py-2 text-stone-400 text-sm">...</span>
                      const p = item as number
                      return (
                        <button
                          key={p}
                          onClick={() => mode === 'cocktails' ? handleCocktailPageChange(p) : handlePageChange(p)}
                          className={`w-10 h-10 rounded-xl text-sm font-medium transition-colors ${p === page ? (mode === 'cocktails' ? 'bg-violet-600 text-white' : 'bg-stone-900 text-white') : (mode === 'cocktails' ? 'bg-slate-700 border border-slate-600 text-slate-300 hover:bg-slate-600' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50')}`}
                        >
                          {p}
                        </button>
                      )
                    })}
                </div>
                 <button
                   onClick={() => mode === 'cocktails' ? handleCocktailPageChange(page + 1) : handlePageChange(page + 1)}
                   disabled={mode === 'cocktails' ? !cocktailHasMore : !hasMore}
                   className={`px-4 py-2.5 rounded-xl border text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${mode === 'cocktails' ? 'border-slate-600 bg-slate-700 text-slate-200 hover:bg-slate-600' : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'}`}
                 >
                   Următor
                 </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

export default function SearchDiscoveryPageClient() {
  return (
     <Suspense fallback={
       <div className="min-h-screen flex items-center justify-center" style={{ background: '#dde3ee' }}>
         <div className="text-muted-foreground">Se încarcă căutarea...</div>
       </div>
     }>
      <SearchDiscoveryPageClientContent />
    </Suspense>
  )
}
