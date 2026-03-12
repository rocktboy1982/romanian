"use client"

import React, { useState, useEffect, useCallback } from "react"
import Image from 'next/image'
import FallbackImage from '@/components/FallbackImage'
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useToast } from "@/components/ui/toast"
import type {
  MealPlan,
  MealsData,
  MealEntry,
  MealSlot,
  RecipePickerResult,
} from "@/types/meal-plans"
import { MEAL_SLOTS, MEAL_SLOT_LABELS, MEAL_SLOT_ICONS } from "@/types/meal-plans"

// ── Helpers ──
function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function formatDayHeader(d: Date): { weekday: string; date: string } {
  return {
    weekday: d.toLocaleDateString("ro-RO", { weekday: "short" }),
    date: d.toLocaleDateString("ro-RO", { month: "short", day: "numeric" }),
  }
}

function isToday(d: Date): boolean {
  const now = new Date()
  return toISO(d) === toISO(now)
}

// ── Main Component ──
export default function MealPlanCalendarPage() {
  const params = useParams()
  const planId = params.id as string
  const { push } = useToast()

  const [plan, setPlan] = useState<MealPlan | null>(null)
  const [entries, setEntries] = useState<MealEntry[]>([])
  const [weekStart, setWeekStart] = useState<Date>(getMonday(new Date()))
  const [loading, setLoading] = useState(true)

  // Recipe picker state
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerDate, setPickerDate] = useState("")
  const [pickerSlot, setPickerSlot] = useState<MealSlot>("breakfast")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<RecipePickerResult[]>([])
  const [searching, setSearching] = useState(false)

  // Servings edit state
  const [editingEntry, setEditingEntry] = useState<string | null>(null)
  const [editServings, setEditServings] = useState<string>("")

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const fetchPlan = useCallback(async () => {
    try {
      const from = toISO(weekStart)
      const to = toISO(addDays(weekStart, 6))
      const res = await fetch(
        `/api/meal-plan-entries?meal_plan_id=${planId}&from=${from}&to=${to}`
      )
      if (!res.ok) throw new Error("Fetch failed")
      const data = await res.json()
      setEntries(data.entries || [])

      // Also fetch plan metadata
      const planRes = await fetch("/api/meal-plans")
      if (planRes.ok) {
        const plans: MealPlan[] = await planRes.json()
        const found = plans.find(p => p.id === planId)
        if (found) setPlan(found)
      }
     } catch {
       push({ message: "Încărcarea planului de masă a eșuat", type: "error" })
     } finally {
      setLoading(false)
    }
  }, [planId, weekStart, push])

  useEffect(() => { fetchPlan() }, [fetchPlan])

  const getEntriesFor = (date: string, slot: MealSlot): MealEntry[] =>
    entries.filter(e => e.date === date && e.meal_slot === slot)

  // ── Search recipes ──
  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (query.length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=10`)
      if (!res.ok) throw new Error("Search failed")
      const data = await res.json()
      // Map search results to our format
      const results: RecipePickerResult[] = (data.results || data || []).map(
        (r: Record<string, unknown>) => ({
          post_id: r.id as string,
          title: r.title as string,
          hero_image_url: (r.hero_image_url as string) || null,
        })
      )
      setSearchResults(results)
    } catch {
      // Fallback: try posts endpoint
      try {
        const res = await fetch(`/api/recipes?q=${encodeURIComponent(query)}&limit=10`)
        if (res.ok) {
          const data = await res.json()
          setSearchResults(
            (Array.isArray(data) ? data : data.results || []).map(
              (r: Record<string, unknown>) => ({
                post_id: r.id as string,
                title: r.title as string,
                hero_image_url: (r.hero_image_url as string) || null,
              })
            )
          )
        }
      } catch {
        setSearchResults([])
      }
    } finally {
      setSearching(false)
    }
  }

  // ── Add entry ──
  const handleAddRecipe = async (recipe: RecipePickerResult) => {
    try {
      const res = await fetch("/api/meal-plan-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meal_plan_id: planId,
          date: pickerDate,
          meal_slot: pickerSlot,
          post_id: recipe.post_id,
          servings: 1,
          recipe_title: recipe.title,
          recipe_image: recipe.hero_image_url,
        }),
      })
       if (!res.ok) throw new Error("Add failed")
       push({ message: `Adăugat "${recipe.title}"`, type: "success" })
      setPickerOpen(false)
      setSearchQuery("")
      setSearchResults([])
      fetchPlan()
     } catch {
       push({ message: "Adăugarea rețetei a eșuat", type: "error" })
     }
   }

  // ── Update servings ──
  const handleUpdateServings = async (entryId: string) => {
    const val = parseFloat(editServings)
    if (isNaN(val) || val <= 0) return
    try {
      const res = await fetch("/api/meal-plan-entries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meal_plan_id: planId,
          entry_id: entryId,
          servings: val,
        }),
      })
       if (!res.ok) throw new Error("Update failed")
       setEditingEntry(null)
       fetchPlan()
     } catch {
       push({ message: "Actualizarea porțiilor a eșuat", type: "error" })
    }
  }

  // ── Delete entry ──
  const handleDeleteEntry = async (entryId: string) => {
    try {
      const res = await fetch("/api/meal-plan-entries", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meal_plan_id: planId,
          entry_id: entryId,
        }),
      })
       if (!res.ok) throw new Error("Delete failed")
       fetchPlan()
     } catch {
       push({ message: "Eliminarea rețetei a eșuat", type: "error" })
    }
  }

  // ── Open picker ──
  const openPicker = (date: string, slot: MealSlot) => {
    setPickerDate(date)
    setPickerSlot(slot)
    setSearchQuery("")
    setSearchResults([])
    setPickerOpen(true)
  }

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="animate-pulse text-muted-foreground text-center py-20">
          Se încarcă calendarul...
        </div>
      </main>
    )
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <Link
            href="/me/meal-plans"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-1 inline-block"
           >
            &larr; Toate Planurile de Masă
          </Link>
           <h1 className="text-2xl font-bold tracking-tight text-foreground">
             {plan?.title || "Plan de Masă"}
           </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/me/meal-plans/${planId}/shopping-list?from=${toISO(weekStart)}&to=${toISO(addDays(weekStart, 6))}`}>
            <Button variant="outline" size="sm">
              <span role="img" aria-label="cumpărături" className="mr-1.5">&#x1F6D2;</span>
              Lista de cumpărături
            </Button>
          </Link>
        </div>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-6 bg-card border rounded-lg px-4 py-3">
         <Button
          variant="ghost"
          size="sm"
          onClick={() => setWeekStart(addDays(weekStart, -7))}
        >
          &larr; Săptămâna Anterioară
        </Button>
        <div className="text-sm font-medium text-foreground">
          {weekDates[0].toLocaleDateString("ro-RO", {
            month: "long",
            day: "numeric",
          })}{" "}
          &mdash;{" "}
          {weekDates[6].toLocaleDateString("ro-RO", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </div>
         <Button
          variant="ghost"
          size="sm"
          onClick={() => setWeekStart(addDays(weekStart, 7))}
        >
          Următoarea Săptămână &rarr;
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="grid grid-cols-7 gap-2 min-w-[900px]">
          {/* Day headers */}
          {weekDates.map(date => {
            const hdr = formatDayHeader(date)
            const today = isToday(date)
            return (
              <div
                key={toISO(date)}
                className={`text-center pb-2 border-b-2 transition-colors ${
                  today
                    ? "border-primary text-primary font-semibold"
                    : "border-border text-muted-foreground"
                }`}
              >
                <div className="text-xs uppercase tracking-wider">{hdr.weekday}</div>
                <div className={`text-sm ${today ? "font-bold" : ""}`}>{hdr.date}</div>
              </div>
            )
          })}

          {/* Meal slots for each day */}
          {MEAL_SLOTS.map(slot => (
            <React.Fragment key={slot}>
              {weekDates.map(date => {
                const dateStr = toISO(date)
                const slotEntries = getEntriesFor(dateStr, slot)
                return (
                  <div
                    key={`${dateStr}-${slot}`}
                    className="min-h-[120px] border border-border/50 rounded-lg p-2 bg-card/50 hover:bg-card transition-colors"
                  >
                    {/* Slot label */}
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                      <span>{MEAL_SLOT_ICONS[slot]}</span>
                      {MEAL_SLOT_LABELS[slot]}
                    </div>

                    {/* Entries */}
                    <div className="space-y-1.5">
                      {slotEntries.map(entry => (
                        <div
                          key={entry.id}
                          className="group relative bg-background rounded-md border border-border/60 p-1.5 text-xs hover:border-primary/40 transition-all"
                        >
                          <div className="flex items-start gap-1.5">
                             {entry.recipe_image && (
                               <FallbackImage
                                 src={entry.recipe_image}
                                 alt=""
                                 width={28}
                                 height={28}
                                 className="rounded object-cover shrink-0"
                                 fallbackEmoji="🍽️"
                               />
                             )}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium leading-tight line-clamp-2 text-foreground">
                                {entry.recipe_title || "Rețetă"}
                              </div>
                              {/* Servings */}
                              {editingEntry === entry.id ? (
                                <div className="flex items-center gap-1 mt-1">
                                  <input
                                    type="number"
                                    min="0.25"
                                    step="0.25"
                                    value={editServings}
                                    onChange={e => setEditServings(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === "Enter") handleUpdateServings(entry.id)
                                      if (e.key === "Escape") setEditingEntry(null)
                                    }}
                                    onBlur={() => handleUpdateServings(entry.id)}
                                    className="w-12 px-1 py-0.5 text-[10px] border rounded bg-background"
                                    autoFocus
                                  />
                                   <span className="text-[10px] text-muted-foreground">por</span>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingEntry(entry.id)
                                    setEditServings(String(entry.servings))
                                  }}
                                  className="text-[10px] text-muted-foreground hover:text-foreground mt-0.5"
                                >
                                   {entry.servings} porție{entry.servings !== 1 ? "s" : ""}
                                </button>
                              )}
                            </div>
                          </div>
                          {/* Delete button */}
                          <button
                            onClick={() => handleDeleteEntry(entry.id)}
                            className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive text-xs p-0.5"
                            title="Elimina"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add button */}
                    <button
                      onClick={() => openPicker(dateStr, slot)}
                      className="mt-1.5 w-full text-[10px] text-muted-foreground hover:text-primary hover:bg-primary/5 rounded py-1 transition-colors border border-dashed border-transparent hover:border-primary/30"
                    >
                      + Adăugați rețetă
                    </button>
                  </div>
                )
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Recipe Picker Modal */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-background border rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
            {/* Modal header */}
            <div className="p-4 border-b">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold text-foreground">Adăugați Rețetă</h2>
                <button
                  onClick={() => setPickerOpen(false)}
                  className="text-muted-foreground hover:text-foreground text-xl leading-none"
                >
                  &times;
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {MEAL_SLOT_ICONS[pickerSlot]} {MEAL_SLOT_LABELS[pickerSlot]} &middot;{" "}
                {new Date(pickerDate + "T00:00:00").toLocaleDateString("ro-RO", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </p>
              <input
                type="text"
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Căutați rețete..."
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-2">
              {searching && (
               <div className="text-center py-8 text-muted-foreground text-sm">
                   Se caută...
                 </div>
              )}
              {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                 <div className="text-center py-8 text-muted-foreground text-sm">
                   Nu s-au găsit rețete pentru „{searchQuery}"
                 </div>
              )}
              {!searching && searchQuery.length < 2 && (
                 <div className="text-center py-8 text-muted-foreground text-sm">
                   Tastați cel puțin 2 caractere pentru a căuta
                 </div>
              )}
              {searchResults.map(recipe => (
                <button
                  key={recipe.post_id}
                  onClick={() => handleAddRecipe(recipe)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent text-left transition-colors"
                >
                   {recipe.hero_image_url ? (
                     <FallbackImage
                       src={recipe.hero_image_url}
                       alt=""
                       width={48}
                       height={48}
                       className="rounded-md object-cover shrink-0"
                       fallbackEmoji="🍽️"
                     />
                   ) : (
                    <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center text-lg shrink-0">
                       <span role="img" aria-label="rețetă">&#x1F372;</span>
                    </div>
                  )}
                  <span className="text-sm font-medium text-foreground line-clamp-2">
                    {recipe.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
