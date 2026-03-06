'use client'
import React, { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AdBanner } from '@/components/ads/ad-placements'
import { REGION_META, COURSES, COURSE_TAGS } from '@/lib/recipe-taxonomy'

interface Recipe {
  id: string
  slug: string
  title: string
  summary: string | null
  hero_image_url: string
  dietTags: string[]
  foodTags: string[]
  is_tested: boolean
  quality_score: number | null
  source_url: string | null
  votes: number
  comments: number
  created_by: { id: string; display_name: string; handle: string | null; avatar_url: string | null } | null
}

export default function RegionCookbookClient({ region }: { region: string }) {
  const meta = REGION_META[region]
  const router = useRouter()
  const searchParams = useSearchParams()

  // ── Initialise from URL params ────────────────────────────────────────────
  const [activeCountry, setActiveCountry] = useState<string | null>(
    searchParams.get('country') || null
  )
  const [activeStyle, setActiveStyle] = useState<string | null>(
    searchParams.get('style') || null
  )
  const [activeCourse, setActiveCourse] = useState<string>(
    searchParams.get('course') || 'all'
  )

  const selectedCountry = useMemo(
    () => meta.countries.find((c) => c.id === activeCountry) ?? null,
    [activeCountry, meta.countries]
  )

  // ── DB fetch state ────────────────────────────────────────────────────────
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  const fetchRecipes = useCallback(async (countryId: string | null) => {
    setLoading(true)
    try {
      let url: string
      if (countryId) {
        url = `/api/recipes/by-country?country=${encodeURIComponent(countryId)}&limit=100`
      } else {
        url = `/api/recipes/by-region?region=${encodeURIComponent(region)}&limit=100`
      }
      const res = await fetch(url)
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setAllRecipes(data.recipes ?? [])
      setTotal(data.total ?? 0)
    } catch (err) {
      console.error('Failed to fetch recipes:', err)
      setAllRecipes([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [region])

  // Fetch whenever the country filter changes
  useEffect(() => {
    fetchRecipes(activeCountry)
  }, [activeCountry, fetchRecipes])

  // ── Sync filters → URL ────────────────────────────────────────────────────
  const syncURL = useCallback(
    (country: string | null, style: string | null, course: string) => {
      const sp = new URLSearchParams()
      if (country) sp.set('country', country)
      if (style) sp.set('style', style)
      if (course !== 'all') sp.set('course', course)
      const qs = sp.toString()
      router.replace(`/cookbooks/region/${region}${qs ? `?${qs}` : ''}`, { scroll: false })
    },
    [region, router]
  )

  // ── Client-side course filter on top of DB results ────────────────────────
  const filteredRecipes = useMemo(() => {
    let results = allRecipes

    // Style filter — match by style id against foodTags
    if (activeStyle && selectedCountry) {
      const styleMatched = results.filter((r) =>
        r.foodTags.some((t) => t === activeStyle || t.includes(activeStyle!))
      )
      if (styleMatched.length > 0) results = styleMatched
    }

    // Course filter
    if (activeCourse !== 'all') {
      const courseTags = COURSE_TAGS[activeCourse] ?? []
      if (courseTags.length > 0) {
        const matched = results.filter((r) =>
          r.foodTags.some((t) => courseTags.includes(t))
        )
        if (matched.length > 0) results = matched
      }
    }

    return results
  }, [allRecipes, selectedCountry, activeStyle, activeCourse])

  // ── Handler helpers ───────────────────────────────────────────────────────
  const handleCountryChange = (countryId: string | null) => {
    setActiveCountry(countryId)
    setActiveStyle(null)
    syncURL(countryId, null, activeCourse)
  }

  const handleStyleChange = (styleId: string | null) => {
    setActiveStyle(styleId)
    syncURL(activeCountry, styleId, activeCourse)
  }

  const handleCourseChange = (courseId: string) => {
    setActiveCourse(courseId)
    syncURL(activeCountry, activeStyle, courseId)
  }

  const clearAll = () => {
    setActiveCountry(null)
    setActiveStyle(null)
    setActiveCourse('all')
    router.replace(`/cookbooks/region/${region}`, { scroll: false })
  }

  const hasActiveFilters = activeCountry || activeCourse !== 'all'

  return (
    <main className="min-h-screen" style={{ background: '#dde3ee', color: '#111' }}>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Breadcrumb */}
         <nav className="text-sm text-muted-foreground mb-6 flex items-center gap-2">
           <Link href="/cookbooks" className="hover:text-foreground transition-colors">
             Cărți de bucate globale
           </Link>
          <span>›</span>
          <span className="text-foreground font-medium">{meta.label}</span>
          {activeCountry && selectedCountry && (
            <>
              <span>›</span>
              <span className="text-foreground font-medium">{selectedCountry.label}</span>
              {activeStyle && selectedCountry && (
                <>
                  <span>›</span>
                  <span className="text-foreground font-medium">
                    {selectedCountry.styles.find((s) => s.id === activeStyle)?.label}
                  </span>
                </>
              )}
            </>
          )}
        </nav>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">{meta.emoji}</span>
            <h1 className="text-3xl font-bold tracking-tight">{meta.label} Cuisine</h1>
          </div>
          <p className="text-muted-foreground">{meta.description}</p>
        </div>

        {/* ── Country filter ── */}
         <section className="mb-6">
           <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
             Țară / Origine
           </h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleCountryChange(null)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                !activeCountry
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'border-border hover:border-amber-300 hover:bg-amber-50 text-foreground'
              }`}
               >
               🌐 Toate
             </button>
            {meta.countries.map((country) => (
              <button
                key={country.id}
                onClick={() => handleCountryChange(activeCountry === country.id ? null : country.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                  activeCountry === country.id
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'border-border hover:border-amber-300 hover:bg-amber-50 text-foreground'
                }`}
              >
                <span>{country.emoji}</span>
                {country.label}
              </button>
            ))}
          </div>
        </section>

        {/* ── Style filter ── */}
         {selectedCountry && selectedCountry.styles.length > 0 && (
           <section className="mb-6 pl-4 border-l-2 border-amber-200 animate-in fade-in slide-in-from-top-1 duration-150">
             <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
               Stil regional
             </h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleStyleChange(null)}
                 className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                   !activeStyle
                     ? 'bg-stone-800 text-white border-stone-800'
                     : 'border-border hover:border-stone-400 text-foreground'
                 }`}
               >
                 Toate stilurile
               </button>
              {selectedCountry.styles.map((style) => (
                <button
                  key={style.id}
                  onClick={() => handleStyleChange(activeStyle === style.id ? null : style.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    activeStyle === style.id
                      ? 'bg-stone-800 text-white border-stone-800'
                      : 'border-border hover:border-stone-400 text-foreground'
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Course filter ── */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Course
          </h2>
          <div className="flex flex-wrap gap-2">
            {COURSES.map((course) => (
              <button
                key={course.id}
                onClick={() => handleCourseChange(course.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  activeCourse === course.id
                    ? 'bg-foreground text-background border-foreground'
                    : 'border-border hover:border-foreground/40 text-foreground'
                }`}
              >
                <span>{course.emoji}</span>
                {course.label}
              </button>
            ))}
          </div>
        </section>

        {/* ── AD PLACEMENT ── */}
        <div className="mb-8">
          <AdBanner placement="cookbook-banner" />
        </div>

        {/* ── Active filter summary ── */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <span className="text-sm text-muted-foreground">Showing:</span>
            {activeCountry && selectedCountry && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">
                {selectedCountry.emoji} {selectedCountry.label}
                {activeStyle && (
                  <> · {selectedCountry.styles.find((s) => s.id === activeStyle)?.label}</>
                )}
                <button onClick={() => handleCountryChange(null)} className="ml-1 hover:text-amber-900">✕</button>
              </span>
            )}
            {activeCourse !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 text-xs font-medium">
                {COURSES.find((c) => c.id === activeCourse)?.emoji}{' '}
                {COURSES.find((c) => c.id === activeCourse)?.label}
                <button onClick={() => handleCourseChange('all')} className="ml-1 hover:text-stone-900">✕</button>
              </span>
            )}
          </div>
        )}

        {/* ── Recipe grid ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
             <h2 className="text-lg font-semibold">
               {loading ? (
                 <span className="text-muted-foreground">Se încarcă rețete...</span>
               ) : (
                 <>
                   {filteredRecipes.length} Rețetă{filteredRecipes.length !== 1 ? 'e' : ''}
                   {total > filteredRecipes.length && (
                     <span className="text-sm font-normal text-muted-foreground ml-1">
                       (din {total} total)
                     </span>
                   )}
                 </>
               )}
             </h2>
             <Link
               href={`/search?approach=${region}`}
               className="text-sm text-amber-600 hover:text-amber-700 font-medium transition-colors"
             >
               Căutare avansată →
             </Link>
          </div>

          {/* Loading skeletons */}
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-border bg-card animate-pulse">
                  <div className="aspect-[4/3] bg-stone-200" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-stone-200 rounded w-3/4" />
                    <div className="h-3 bg-stone-100 rounded w-full" />
                    <div className="h-3 bg-stone-100 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

           {/* No recipes at all */}
           {!loading && allRecipes.length === 0 && (
             <div className="text-center py-20 text-muted-foreground">
               <p className="text-4xl mb-4">🌍</p>
               <p className="font-medium mb-1">Nicio rețetă încă pentru {meta.label}</p>
               <p className="text-sm mb-4">
                 Fii primul care să partajeze o rețetă {meta.label} cu comunitatea.
               </p>
               <div className="flex items-center justify-center gap-3">
                 <Link
                   href="/submit/recipe"
                   className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
                 >
                   Adaugă o rețetă
                 </Link>
                 <Link href="/search" className="text-sm text-amber-600 hover:underline">
                   Explorează toate rețetele →
                 </Link>
               </div>
             </div>
           )}

          {/* Filters narrowed to zero */}
          {!loading && allRecipes.length > 0 && filteredRecipes.length === 0 && (
            <div className="text-center py-20 text-muted-foreground">
              <p className="text-4xl mb-4">🍽️</p>
               <p className="font-medium mb-2">Nicio rețetă nu se potrivește cu aceste filtre</p>
               <p className="text-sm mb-4">
                 Sunt {allRecipes.length} rețetă{allRecipes.length !== 1 ? 'e' : ''} {meta.label} — încearcă să elimini un filtru.
               </p>
               <button onClick={clearAll} className="text-sm text-amber-600 hover:underline">
                 Șterge toate filtrele
               </button>
            </div>
          )}

          {/* Recipe cards */}
          {!loading && filteredRecipes.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRecipes.map((recipe) => (
                <Link
                  key={recipe.id}
                  href={`/recipes/${recipe.slug}`}
                  className="group rounded-xl overflow-hidden border border-border bg-card hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
                >
                  <div className="aspect-[4/3] bg-stone-100 overflow-hidden relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={recipe.hero_image_url}
                      alt={recipe.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2 right-2 flex items-center gap-2">
                      {recipe.source_url && (
                        <a
                          href={recipe.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            if (recipe.source_url) {
                              window.open(recipe.source_url, '_blank')
                            }
                          }}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                          title="View original source"
                        >
                          🔗
                        </a>
                      )}
                      {recipe.is_tested && (
                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-500 text-white">
                          Tested ✓
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-base line-clamp-1 mb-1">{recipe.title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{recipe.summary}</p>

                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      {recipe.quality_score && (
                        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-amber-600">
                          ★ {recipe.quality_score.toFixed(1)}
                        </span>
                      )}
                      {recipe.dietTags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 text-[10px] rounded bg-blue-100 text-blue-700 font-medium capitalize"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      {recipe.created_by && (
                        <div className="flex items-center gap-2">
                          {recipe.created_by.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={recipe.created_by.avatar_url}
                              alt={recipe.created_by.display_name}
                              className="w-6 h-6 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-700">
                              {recipe.created_by.display_name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                            {recipe.created_by.display_name}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground ml-auto">
                        <span>▲ {recipe.votes}</span>
                        <span>💬 {recipe.comments}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
