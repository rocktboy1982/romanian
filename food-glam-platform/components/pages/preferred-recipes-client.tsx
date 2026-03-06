"use client"

import React, { useState, useMemo, useRef } from "react"
import Link from "next/link"
import { usePreferredRecipes, type PreferredRecipe, type RecipeInput } from "@/lib/preferred-recipes"
import { MOCK_RECIPES } from "@/lib/mock-data"

// ── Group chefs found in preferred list ───────────────────────────────────────

type ChefGroup = {
  chefId: string
  chefName: string
  chefHandle?: string
  count: number
  recipes: PreferredRecipe[]
}

function groupByChef(preferred: PreferredRecipe[]): ChefGroup[] {
  const map: Record<string, ChefGroup> = {}
  preferred.forEach((p) => {
    if (!p.chefId) return
    if (!map[p.chefId]) {
      map[p.chefId] = { chefId: p.chefId, chefName: p.chefName ?? p.chefId, chefHandle: p.chefHandle, count: 0, recipes: [] }
    }
    map[p.chefId].count++
    map[p.chefId].recipes.push(p)
  })
  return Object.values(map).sort((a, b) => b.count - a.count)
}

// ── Add from search panel ─────────────────────────────────────────────────────

function AddFromSearch({
  existing,
  onAdd,
}: {
  existing: Set<string>
  onAdd: (recipe: RecipeInput) => void
}) {
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return MOCK_RECIPES.slice(0, 12)
    return MOCK_RECIPES.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.region?.toLowerCase().includes(q) ||
        r.dietTags?.some((t) => t.toLowerCase().includes(q)) ||
        r.foodTags?.some((t) => t.toLowerCase().includes(q)) ||
        r.created_by?.display_name?.toLowerCase().includes(q)
    )
  }, [query])

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-semibold text-sm mb-3">Adaugă din biblioteca de rețete</h3>
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Caută după titlu, regiune, dietă, chef…"
        className="w-full border border-input rounded-xl px-4 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-300 mb-4"
        autoFocus
      />

       {results.length === 0 ? (
         <p className="text-sm text-muted-foreground text-center py-6">Nicio rețetă găsită</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[420px] overflow-y-auto pr-1">
          {results.map((recipe) => {
            const isIn = existing.has(recipe.id)
            return (
              <div
                key={recipe.id}
                className={`relative rounded-xl overflow-hidden border transition-all ${
                  isIn ? "border-amber-400 opacity-60" : "border-border hover:border-amber-400 hover:shadow-md"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={recipe.hero_image_url}
                  alt={recipe.title}
                  className="w-full h-24 object-cover"
                />
                <div className="p-2">
                  <p className="text-xs font-medium line-clamp-2 leading-snug">{recipe.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{recipe.region}</p>
                  <p className="text-[10px] text-muted-foreground">by {recipe.created_by?.display_name}</p>
                </div>
                <button
                  onClick={() => { if (!isIn) onAdd(recipe as RecipeInput) }}
                  disabled={isIn}
                  className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow transition-colors ${
                    isIn
                      ? "bg-amber-400 text-white cursor-default"
                      : "bg-white/90 text-amber-600 hover:bg-amber-500 hover:text-white"
                  }`}
                   title={isIn ? "Deja în Preferate" : "Adaugă în Preferate"}
                >
                  {isIn ? "✓" : "+"}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Bulk-add by chef */}
      {query.trim() && results.length > 0 && (() => {
        const chef = results[0].created_by
        if (!chef) return null
        const sameChef = results.filter((r) => r.created_by?.id === chef.id)
        if (sameChef.length < 2) return null
        const allIn = sameChef.every((r) => existing.has(r.id))
        return (
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
             <span className="text-xs text-muted-foreground">
               {sameChef.length} rețete de <strong>{chef.display_name}</strong>
             </span>
             <button
               onClick={() => sameChef.filter((r) => !existing.has(r.id)).forEach((r) => onAdd(r as RecipeInput))}
               disabled={allIn}
               className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                 allIn
                   ? "border-amber-300 text-amber-400 cursor-default"
                   : "border-amber-400 text-amber-600 hover:bg-amber-50"
               }`}
             >
               {allIn ? "Toate adăugate ✓" : `+ Adaugă toate ${sameChef.length}`}
             </button>
          </div>
        )
      })()}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PreferredRecipesClient() {
  const {
    preferred,
    hydrated,
    preferredIds,
    addRecipe,
    addByChef,
    removeRecipe,
    removeByChef,
    clearAll,
  } = usePreferredRecipes()

  const [search, setSearch] = useState("")
  const [filterChef, setFilterChef] = useState("")
  const [filterRegion, setFilterRegion] = useState("")
  const [filterDiet, setFilterDiet] = useState("")
  const [filterSource, setFilterSource] = useState<"" | "manual" | "chef" | "cookbook">("")
  const [showAdd, setShowAdd] = useState(false)
  const [viewMode, setViewMode] = useState<"list" | "chef">("list")
  const [confirmClear, setConfirmClear] = useState(false)

  // Derived filter options
  const allChefs = useMemo(() => groupByChef(preferred), [preferred])
  const allRegions = useMemo(() => Array.from(new Set(preferred.map((p) => p.region).filter(Boolean))).sort() as string[], [preferred])
  const allDiets = useMemo(() => {
    const s = new Set<string>()
    preferred.forEach((p) => p.dietTags?.forEach((t) => s.add(t)))
    return Array.from(s).sort()
  }, [preferred])

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return preferred.filter((p) => {
      if (q && !p.title.toLowerCase().includes(q) && !p.region?.toLowerCase().includes(q) && !p.chefName?.toLowerCase().includes(q)) return false
      if (filterChef && p.chefId !== filterChef) return false
      if (filterRegion && p.region !== filterRegion) return false
      if (filterDiet && !p.dietTags?.includes(filterDiet)) return false
      if (filterSource && p.source !== filterSource) return false
      return true
    })
  }, [preferred, search, filterChef, filterRegion, filterDiet, filterSource])

  const hasFilters = search || filterChef || filterRegion || filterDiet || filterSource

  if (!hydrated) {
    return (
      <main className="min-h-screen" style={{ background: '#dde3ee', color: '#111' }}><div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-muted" />)}
        </div>
      </div></main>
    )
  }

  return (
    <main className="min-h-screen" style={{ background: '#dde3ee', color: '#111' }}><div className="container mx-auto px-4 py-8 max-w-5xl">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
           <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
             ⭐ Rețete preferate
           </h1>
           <p className="text-muted-foreground text-sm mt-1">
             {preferred.length} rețet{preferred.length !== 1 ? "e" : "ă"} · lista ta de scurtătură pentru planificarea meselor
           </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden text-sm">
             <button
               onClick={() => setViewMode("list")}
               className={`px-3 py-1.5 font-medium transition-colors ${viewMode === "list" ? "bg-foreground text-background" : "hover:bg-muted"}`}
             >
               Listă
             </button>
             <button
               onClick={() => setViewMode("chef")}
               className={`px-3 py-1.5 font-medium border-l border-border transition-colors ${viewMode === "chef" ? "bg-foreground text-background" : "hover:bg-muted"}`}
             >
               După Chef
             </button>
          </div>

           <button
             onClick={() => setShowAdd((v) => !v)}
             className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors border ${
               showAdd ? "bg-amber-500 text-white border-amber-500" : "border-amber-400 text-amber-600 hover:bg-amber-50"
             }`}
           >
             {showAdd ? "× Închide" : "+ Adaugă rețete"}
           </button>
        </div>
      </div>

      {/* ── Add panel ── */}
      {showAdd && (
        <div className="mb-6">
          <AddFromSearch
            existing={preferredIds}
            onAdd={(recipe) => addRecipe(recipe, "manual")}
          />
          {/* Bulk-add by chef from mock data */}
           <div className="mt-4 rounded-2xl border border-border bg-card p-5">
             <h3 className="font-semibold text-sm mb-3">Adaugă toate rețetele unui chef</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from(new Map(MOCK_RECIPES.map((r) => [r.created_by.id, r.created_by])).values()).map((chef) => {
                const chefRecipes = MOCK_RECIPES.filter((r) => r.created_by.id === chef.id)
                const allIn = chefRecipes.every((r) => preferredIds.has(r.id))
                const someIn = chefRecipes.some((r) => preferredIds.has(r.id))
                return (
                  <div key={chef.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={chef.avatar_url} alt={chef.display_name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                     <div className="flex-1 min-w-0">
                       <p className="text-xs font-semibold line-clamp-1">{chef.display_name}</p>
                       <p className="text-[10px] text-muted-foreground">{chef.handle} · {chefRecipes.length} rețet{chefRecipes.length !== 1 ? "e" : "ă"}</p>
                       {someIn && !allIn && (
                         <p className="text-[10px] text-amber-600">{chefRecipes.filter((r) => preferredIds.has(r.id)).length} deja adăugate</p>
                       )}
                     </div>
                     <button
                       onClick={() => allIn
                         ? removeByChef(chef.id)
                         : addByChef(chefRecipes as RecipeInput[], chef)
                       }
                       className={`shrink-0 text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                         allIn
                           ? "border-red-200 text-red-400 hover:bg-red-50"
                           : "border-amber-400 text-amber-600 hover:bg-amber-50"
                       }`}
                     >
                       {allIn ? "Elimină toate" : someIn ? "Adaugă restul" : "Adaugă toate"}
                     </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Search & filters ── */}
      {preferred.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
             placeholder="Caută preferate…"
            className="border border-input rounded-xl px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-300 min-w-[200px]"
          />

          {allChefs.length > 1 && (
            <select
              value={filterChef}
              onChange={(e) => setFilterChef(e.target.value)}
              className="text-sm border border-input rounded-xl px-3 py-1.5 bg-background focus:outline-none"
            >
               <option value="">Toți chefii</option>
              {allChefs.map((c) => (
                <option key={c.chefId} value={c.chefId}>{c.chefName} ({c.count})</option>
              ))}
            </select>
          )}

          {allRegions.length > 1 && (
            <select
              value={filterRegion}
              onChange={(e) => setFilterRegion(e.target.value)}
              className="text-sm border border-input rounded-xl px-3 py-1.5 bg-background focus:outline-none"
            >
               <option value="">Toate regiunile</option>
              {allRegions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          )}

          {allDiets.length > 0 && (
            <select
              value={filterDiet}
              onChange={(e) => setFilterDiet(e.target.value)}
              className="text-sm border border-input rounded-xl px-3 py-1.5 bg-background focus:outline-none"
            >
               <option value="">Toate dietele</option>
              {allDiets.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}

          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value as typeof filterSource)}
            className="text-sm border border-input rounded-xl px-3 py-1.5 bg-background focus:outline-none"
          >
             <option value="">Toate sursele</option>
             <option value="manual">Adăugate manual</option>
             <option value="chef">De la chef</option>
             <option value="cookbook">Din carte de rețete</option>
          </select>

          {hasFilters && (
            <button
              onClick={() => { setSearch(""); setFilterChef(""); setFilterRegion(""); setFilterDiet(""); setFilterSource("") }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
               Șterge filtrele
            </button>
          )}
        </div>
      )}

      {/* ══════════════════ LIST VIEW ══════════════════ */}
      {viewMode === "list" && (
        <>
           {preferred.length === 0 ? (
             <div className="text-center py-20">
               <p className="text-5xl mb-4">⭐</p>
               <h2 className="text-xl font-semibold mb-2">Nicio rețetă preferată deocamdată</h2>
               <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
                 Adaugă rețete aici pentru a le folosi în Planificatorul de mese. Poți adăuga individual, în masă după chef, sau importa din Cartea ta de rețete.
               </p>
               <button
                 onClick={() => setShowAdd(true)}
                 className="px-5 py-2.5 bg-amber-500 text-white rounded-xl font-semibold text-sm hover:bg-amber-600 transition-colors"
               >
                 + Adaugă rețete
               </button>
             </div>
           ) : filtered.length === 0 ? (
             <div className="text-center py-12 text-muted-foreground">
               <p>Nicio rețetă nu se potrivește cu filtrele tale.</p>
               <button onClick={() => { setSearch(""); setFilterChef(""); setFilterRegion(""); setFilterDiet(""); setFilterSource("") }} className="text-sm underline mt-2">Șterge filtrele</button>
             </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((recipe) => (
                <div
                  key={recipe.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-amber-200 hover:bg-amber-50/20 transition-colors group"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {recipe.hero_image_url && (
                    <img
                      src={recipe.hero_image_url}
                      alt={recipe.title}
                      className="w-14 h-14 rounded-lg object-cover shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold line-clamp-1">{recipe.title}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      {recipe.region && (
                        <span className="text-[11px] text-muted-foreground">{recipe.region}</span>
                      )}
                      {recipe.chefName && (
                        <span className="text-[11px] text-muted-foreground">· by {recipe.chefName}</span>
                      )}
                      {recipe.dietTags && recipe.dietTags.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-700 rounded-full border border-green-200">
                          {recipe.dietTags[0]}
                        </span>
                      )}
                       <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                         recipe.source === "chef" ? "bg-blue-50 text-blue-600 border-blue-200" :
                         recipe.source === "cookbook" ? "bg-amber-50 text-amber-600 border-amber-200" :
                         "bg-stone-50 text-stone-500 border-stone-200"
                       }`}>
                         {recipe.source === "chef" ? "🍴 chef" : recipe.source === "cookbook" ? "📖 carte" : "✓ manual"}
                       </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link
                      href={`/recipes/${recipe.slug}`}
                      className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1"
                    >
                       Vezi
                    </Link>
                    <button
                      onClick={() => removeRecipe(recipe.id)}
                      className="text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 rounded-lg px-2.5 py-1 transition-colors"
                      title="Remove from Preferred"
                    >
                       Elimină
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ══════════════════ BY CHEF VIEW ══════════════════ */}
      {viewMode === "chef" && (
        <>
           {allChefs.length === 0 ? (
             <div className="text-center py-12 text-muted-foreground">
               <p>Nicio rețetă cu informații de chef deocamdată.</p>
             </div>
          ) : (
            <div className="space-y-4">
              {allChefs.map((chef) => (
                <div key={chef.chefId} className="rounded-2xl border border-border bg-card overflow-hidden">
                  {/* Chef header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-sm">
                        {chef.chefName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{chef.chefName}</p>
                        {chef.chefHandle && <p className="text-[11px] text-muted-foreground">{chef.chefHandle}</p>}
                      </div>
                       <span className="ml-2 text-xs text-muted-foreground">{chef.count} rețet{chef.count !== 1 ? "e" : "ă"}</span>
                    </div>
                    <button
                      onClick={() => removeByChef(chef.chefId)}
                      className="text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-300 rounded-lg px-3 py-1 transition-colors"
                    >
                       Elimină toate
                    </button>
                  </div>
                  {/* Recipes */}
                  <div className="p-3 space-y-1.5">
                    {chef.recipes.map((recipe) => (
                      <div key={recipe.id} className="flex items-center gap-3 rounded-lg hover:bg-muted/30 px-2 py-1.5 group transition-colors">
                        {recipe.hero_image_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={recipe.hero_image_url} alt={recipe.title} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium line-clamp-1">{recipe.title}</p>
                          {recipe.region && <p className="text-[10px] text-muted-foreground">{recipe.region}</p>}
                        </div>
                        <button
                          onClick={() => removeRecipe(recipe.id)}
                          className="text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity border border-red-200 rounded px-2 py-0.5"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Footer actions ── */}
      {preferred.length > 0 && (
        <div className="mt-8 pt-6 border-t border-border flex items-center justify-between">
           <p className="text-sm text-muted-foreground">{preferred.length} rețet{preferred.length !== 1 ? "e" : "ă"} în lista ta de scurtătură</p>
           {confirmClear ? (
             <div className="flex items-center gap-2">
               <span className="text-sm text-muted-foreground">Ești sigur?</span>
               <button onClick={() => { clearAll(); setConfirmClear(false) }} className="text-sm text-red-500 font-semibold hover:text-red-700">Da, șterge toate</button>
               <button onClick={() => setConfirmClear(false)} className="text-sm text-muted-foreground hover:text-foreground">Anulează</button>
             </div>
           ) : (
             <button
               onClick={() => setConfirmClear(true)}
               className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
             >
               Șterge toate preferatele
             </button>
           )}
        </div>
      )}
    </div></main>
  )
}
