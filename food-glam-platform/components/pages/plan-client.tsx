"use client"
import Image from 'next/image'
import React, { useState, useMemo, useCallback, useId, useEffect } from "react"
import Link from "next/link"
import { usePreferredRecipes, type PreferredRecipe } from "@/lib/preferred-recipes"
import IngredientLink from '@/components/ui/ingredient-link'
import { useFeatureFlags } from "@/components/feature-flags-provider"
import { useUserTier } from '@/lib/use-user-tier'
import ProPaywallModal from '@/components/ui/pro-paywall-modal'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Recipe {
  id: string
  title: string
  slug: string
  hero_image_url: string
  servings: number
  cook_time_minutes: number | null
  prep_time_minutes: number | null
  ingredients: string[]
  nutrition_per_serving: { calories: number; protein: number; carbs: number; fat: number }
  dietTags: string[]
  foodTags: string[]
}

const DAYS = ["Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"] as const
const MEALS = ["Mic dejun", "Prânz", "Cină"] as const
// ─── Calendar: all Mon-starting weeks that touch the current year ─────────────
function buildYearWeeks(year: number) {
  const weeks: { weekIndex: number; monday: Date; sunday: Date; month: number }[] = []
  // Start from Jan 1 and rewind to the Monday of that week
  const jan1 = new Date(year, 0, 1)
  const dow = jan1.getDay() // 0=Sun
  const offset = dow === 0 ? -6 : 1 - dow
  const cursor = new Date(year, 0, 1 + offset)
  let idx = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const sunday = new Date(cursor)
    sunday.setDate(cursor.getDate() + 6)
    // Stop once the whole week is past this year
    if (cursor.getFullYear() > year) break
    // Assign week to the month its Monday falls in.
    // assign it to January (month 0) so it appears under the Jan tab.
    const month = cursor.getFullYear() < year ? 0 : cursor.getMonth()
    weeks.push({ weekIndex: idx++, monday: new Date(cursor), sunday: new Date(sunday), month })
    cursor.setDate(cursor.getDate() + 7)
  }
  return weeks
}

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_WEEKS = buildYearWeeks(CURRENT_YEAR)
const TOTAL_WEEKS = YEAR_WEEKS.length
const MONTH_NAMES = ["Ianuarie","Februarie","Martie","Aprilie","Mai","Iunie","Iulie","August","Septembrie","Octombrie","Noiembrie","Decembrie"]
type DayKey = typeof DAYS[number]
type MealKey = typeof MEALS[number]
type DishEntry = {
  id: string
  recipe: Recipe
  servings: number
}
type MealSlot = { dishes: DishEntry[] }
type WeekPlan = Record<DayKey, Record<MealKey, MealSlot>>
type PlannerState = Record<number, WeekPlan>  // weekIndex keyed by YEAR_WEEKS index

// ─── Ingredient data ──────────────────────────────────────────────────────────
// Ingredients come from the recipe API response as raw strings.
// Format: { name, qty, unit, category, subtypeNote }
type Ingredient = { name: string; qty: number; unit: string; category: string; subtypeNote: string }

// Convert raw ingredient strings from API to structured Ingredient objects
function getIngredients(recipe: Recipe): Ingredient[] {
  if (!recipe.ingredients || recipe.ingredients.length === 0) {
    return [
      { name: "Ingrediente", qty: 1, unit: "porție", category: "Cămară", subtypeNote: "vezi pagina rețetei" }
    ]
  }
  // Map raw ingredient strings to structured format
  return recipe.ingredients.map((ingredientStr) => ({
    name: ingredientStr,
    qty: 1,
    unit: "buc",
    category: "Necategorizat",
    subtypeNote: ""
  }))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptySlot(): MealSlot { return { dishes: [] } }

function emptyWeek(): WeekPlan {
  return Object.fromEntries(
    DAYS.map((d) => [d, Object.fromEntries(MEALS.map((m) => [m, emptySlot()]))])
  ) as WeekPlan
}

function emptyPlanner(): PlannerState {
  return Object.fromEntries(Array.from({ length: TOTAL_WEEKS }, (_, i) => [i, emptyWeek()]))
}

function weekLabel(weekIndex: number): string {
  const w = YEAR_WEEKS[weekIndex]
  if (!w) return `Săpt. ${weekIndex + 1}`
  const fmt = (d: Date) => d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })
  return `${fmt(w.monday)} – ${fmt(w.sunday)}`
}

function dateForDay(weekIndex: number, dayIndex: number): Date {
  const w = YEAR_WEEKS[weekIndex]
  if (!w) return new Date()
  const result = new Date(w.monday)
  result.setDate(w.monday.getDate() + dayIndex)
  return result
}

// ─── Shopping list builder ────────────────────────────────────────────────────

type ShoppingItem = {
  id: string
  name: string
  totalQty: number
  unit: string
  category: string
  subtypeNote: string   // editable by user
  fromRecipes: string[]
  fromDays: string[]
  checked: boolean
}

type ShoppingScope = { type: "week"; weekIndex: number } | { type: "day"; weekIndex: number; day: DayKey } | { type: "range"; from: number; to: number }

function buildShoppingList(planner: PlannerState, scope: ShoppingScope): ShoppingItem[] {
  const accumulator: Record<string, ShoppingItem> = {}

  const processWeek = (weekIndex: number, dayFilter?: DayKey) => {
    const week = planner[weekIndex]
    if (!week) return
    DAYS.forEach((day, di) => {
      if (dayFilter && day !== dayFilter) return
      MEALS.forEach((meal) => {
        week[day][meal].dishes.forEach((dish) => {
          const ings = getIngredients(dish.recipe)
          const dayLabel = `${day} W${weekIndex + 1}`
          ings.forEach((ing) => {
            const key = `${ing.name.toLowerCase()}__${ing.unit}`
            if (accumulator[key]) {
              accumulator[key].totalQty += ing.qty * dish.servings
              if (!accumulator[key].fromRecipes.includes(dish.recipe.title))
                accumulator[key].fromRecipes.push(dish.recipe.title)
              if (!accumulator[key].fromDays.includes(dayLabel))
                accumulator[key].fromDays.push(dayLabel)
            } else {
              accumulator[key] = {
                id: key,
                name: ing.name,
                totalQty: ing.qty * dish.servings,
                unit: ing.unit,
                category: ing.category,
                subtypeNote: ing.subtypeNote,
                fromRecipes: [dish.recipe.title],
                fromDays: [dayLabel],
                checked: false,
              }
            }
          })
        })
      })
    })
  }

  if (scope.type === "week") processWeek(scope.weekIndex)
  else if (scope.type === "day") processWeek(scope.weekIndex, scope.day)
  else {
    for (let w = scope.from; w <= scope.to; w++) processWeek(w)
  }

  return Object.values(accumulator).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ServingBadge({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1 bg-black/50 rounded-full px-1.5 py-0.5">
      <button
        onClick={(e) => { e.stopPropagation(); onChange(Math.max(1, value - 1)) }}
        className="w-4 h-4 flex items-center justify-center text-white text-xs hover:text-amber-300 transition-colors"
      >−</button>
      <span className="text-white text-[10px] font-semibold min-w-[20px] text-center">{value}×</span>
      <button
        onClick={(e) => { e.stopPropagation(); onChange(value + 1) }}
        className="w-4 h-4 flex items-center justify-center text-white text-xs hover:text-amber-300 transition-colors"
      >+</button>
    </div>
  )
}

// ─── WeekNav Component ───────────────────────────────────────────────────────

function WeekNav({
  currentWeek,
  onSelect,
  onClear,
  selectedMonth,
  onMonthSelect,
}: {
  currentWeek: number
  onSelect: (w: number) => void
  onClear: () => void
  selectedMonth: number
  onMonthSelect: (m: number) => void
}) {
  const weeksByMonth: Record<number, typeof YEAR_WEEKS> = {}
  YEAR_WEEKS.forEach((w) => {
    if (!weeksByMonth[w.month]) weeksByMonth[w.month] = []
    weeksByMonth[w.month].push(w)
  })
  // Months that actually have weeks
  const activeMonths = Object.keys(weeksByMonth).map(Number).sort((a, b) => a - b)
  const weeksInMonth = weeksByMonth[selectedMonth] ?? []
  const currentMonthForWeek = YEAR_WEEKS[currentWeek]?.month ?? selectedMonth

  return (
    <div className="mb-6">
      {/* Month row */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {activeMonths.map((m) => (
          <button
            key={m}
            onClick={() => onMonthSelect(m)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
              selectedMonth === m
                ? "bg-amber-500 text-white border-amber-500"
                : currentMonthForWeek === m
                ? "border-amber-400 text-amber-600 bg-amber-50"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {MONTH_NAMES[m].slice(0, 3)}
          </button>
        ))}
      </div>

      {/* Weeks row for selected month + actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex flex-wrap gap-1.5">
          {weeksInMonth.map((w) => (
            <button
              key={w.weekIndex}
              onClick={() => onSelect(w.weekIndex)}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                currentWeek === w.weekIndex
                  ? "bg-amber-500 text-white border-amber-500"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {weekLabel(w.weekIndex)}
            </button>
          ))}
        </div>

        <button
          onClick={onClear}
          className="ml-auto text-xs text-destructive border border-destructive/30 px-3 py-1.5 rounded-lg hover:bg-destructive/5 transition-colors"
        >
          Golește săptămâna
        </button>
      </div>
    </div>
  )
}
// ─── Nutrition helpers ───────────────────────────────────────────────────────

type NutritionTotals = { calories: number; protein: number; carbs: number; fat: number }

function sumSlotNutrition(slot: MealSlot): NutritionTotals {
  return slot.dishes.reduce(
    (acc, dish) => {
      const n = dish.recipe.nutrition_per_serving
      if (!n) return acc
      return {
        calories: acc.calories + n.calories * dish.servings,
        protein: acc.protein + n.protein * dish.servings,
        carbs: acc.carbs + n.carbs * dish.servings,
        fat: acc.fat + n.fat * dish.servings,
      }
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )
}

function sumDayNutrition(dayPlan: Record<MealKey, MealSlot>): NutritionTotals {
  return MEALS.reduce(
    (acc, meal) => {
      const s = sumSlotNutrition(dayPlan[meal])
      return {
        calories: acc.calories + s.calories,
        protein: acc.protein + s.protein,
        carbs: acc.carbs + s.carbs,
        fat: acc.fat + s.fat,
      }
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )
}

function sumWeekNutrition(weekPlan: WeekPlan): NutritionTotals {
  return DAYS.reduce(
    (acc, day) => {
      const d = sumDayNutrition(weekPlan[day])
      return {
        calories: acc.calories + d.calories,
        protein: acc.protein + d.protein,
        carbs: acc.carbs + d.carbs,
        fat: acc.fat + d.fat,
      }
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )
}

function useHealthGoals() {
  const [calorieTarget, setCalorieTarget] = useState<number>(2100)
  const [macroProtein, setMacroProtein] = useState<number>(35)
  const [macroCarbs, setMacroCarbs] = useState<number>(40)
  const [macroFat, setMacroFat] = useState<number>(25)
  useEffect(() => {
    const ct = Number(localStorage.getItem("health-calorie-target") ?? 2100)
    const mp = Number(localStorage.getItem("health-macro-protein") ?? 35)
    const mc = Number(localStorage.getItem("health-macro-carbs") ?? 40)
    const mf = Number(localStorage.getItem("health-macro-fat") ?? 25)
    setCalorieTarget(isNaN(ct) ? 2100 : ct)
    setMacroProtein(isNaN(mp) ? 35 : mp)
    setMacroCarbs(isNaN(mc) ? 40 : mc)
    setMacroFat(isNaN(mf) ? 25 : mf)
  }, [])
  return { calorieTarget, macroProtein, macroCarbs, macroFat }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PlanClient() {
  const uid = useId()
  const { isPro } = useUserTier()
  const [showProModal, setShowProModal] = useState(false)
  const [planner, setPlanner] = useState<PlannerState>(emptyPlanner)
  const [currentWeek, setCurrentWeek] = useState<number>(0)
  const [selectedMonth, setSelectedMonth] = useState<number>(YEAR_WEEKS[0]?.month ?? 0)
  const [hydrated, setHydrated] = useState(false)

  // Hydrate all localStorage-dependent state after mount (avoids SSR mismatch)
  useEffect(() => {
    // Restore planner data
    try {
      const raw = localStorage.getItem('meal-planner-state')
      if (raw) {
        const parsed = JSON.parse(raw) as Record<number, WeekPlan>
        const base = emptyPlanner()
        for (const [k, v] of Object.entries(parsed)) {
          base[Number(k)] = v as WeekPlan
        }
        setPlanner(base)
      }
    } catch { /* ignore parse errors */ }
    // Restore week & month
    const savedWeek = Number(localStorage.getItem('planner-week') ?? 0)
    setCurrentWeek(savedWeek)
    const savedMonth = localStorage.getItem('planner-month')
    if (savedMonth !== null) {
      setSelectedMonth(Number(savedMonth))
    } else {
      setSelectedMonth(YEAR_WEEKS[savedWeek]?.month ?? new Date().getMonth())
    }
    setHydrated(true)
  }, [])
  const [expandedSlot, setExpandedSlot] = useState<{ day: DayKey; meal: MealKey } | null>(null)
  const [pickingFor, setPickingFor] = useState<{ day: DayKey; meal: MealKey } | null>(null)
  const [view, setView] = useState<"planner" | "shopping">("planner")
  const [pickerSearch, setPickerSearch] = useState("")
  const [searchResults, setSearchResults] = useState<Recipe[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchDebounceTimer, setSearchDebounceTimer] = useState<NodeJS.Timeout | null>(null)
  const { preferred, hydrated: prefHydrated } = usePreferredRecipes()
  const { flags } = useFeatureFlags()
  const healthMode = !!flags.healthMode
  const healthGoals = useHealthGoals()

  // Shopping list state
  const [shopScope, setShopScope] = useState<ShoppingScope>({ type: "week", weekIndex: 0 })
  const [shopGrouping, setShopGrouping] = useState<"category" | "recipe" | "day">("category")
  const [shopItems, setShopItems] = useState<ShoppingItem[]>([])
  const [shopRangeFrom, setShopRangeFrom] = useState(0)
  const [shopRangeTo, setShopRangeTo] = useState(0)
  const [shopSaveState, setShopSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  // Persist planner to localStorage whenever it changes (only non-empty weeks)
  useEffect(() => {
    try {
      const toSave: Partial<PlannerState> = {}
      for (const [weekIdxStr, weekPlan] of Object.entries(planner)) {
        const hasContent = DAYS.some(d =>
          MEALS.some(m => (weekPlan as WeekPlan)[d as DayKey][m as MealKey].dishes.length > 0)
        )
        if (hasContent) toSave[Number(weekIdxStr)] = weekPlan as WeekPlan
      }
      localStorage.setItem("meal-planner-state", JSON.stringify(toSave))
    } catch { /* ignore quota errors */ }
  }, [planner])
  const week = planner[currentWeek]

  // ── Nutrition totals (only computed when healthMode on) ──
  const weekNutrition = useMemo(() => sumWeekNutrition(week), [week])
  const dayNutrition = useMemo(() =>
    Object.fromEntries(DAYS.map((d) => [d, sumDayNutrition(week[d])])) as Record<DayKey, NutritionTotals>,
    [week]
  )

  // ── Planner mutations ──
  const addDish = useCallback((day: DayKey, meal: MealKey, recipe: Recipe) => {
    setPlanner((prev) => {
      const slot = prev[currentWeek][day][meal]
      const newDish: DishEntry = { id: `${uid}-${Date.now()}-${Math.random()}`, recipe, servings: 1 }
      return {
        ...prev,
        [currentWeek]: {
          ...prev[currentWeek],
          [day]: {
            ...prev[currentWeek][day],
            [meal]: { dishes: [...slot.dishes, newDish] },
          },
        },
      }
    })
    setPickingFor(null)
  }, [currentWeek, uid])

  const removeDish = useCallback((day: DayKey, meal: MealKey, dishId: string) => {
    setPlanner((prev) => {
      const slot = prev[currentWeek][day][meal]
      return {
        ...prev,
        [currentWeek]: {
          ...prev[currentWeek],
          [day]: {
            ...prev[currentWeek][day],
            [meal]: { dishes: slot.dishes.filter((d) => d.id !== dishId) },
          },
        },
      }
    })
  }, [currentWeek])

  const updateServings = useCallback((day: DayKey, meal: MealKey, dishId: string, servings: number) => {
    setPlanner((prev) => {
      const slot = prev[currentWeek][day][meal]
      return {
        ...prev,
        [currentWeek]: {
          ...prev[currentWeek],
          [day]: {
            ...prev[currentWeek][day],
            [meal]: {
              dishes: slot.dishes.map((d) => d.id === dishId ? { ...d, servings } : d),
            },
          },
        },
      }
    })
  }, [currentWeek])

  const clearWeek = useCallback(() => {
    setPlanner((prev) => ({ ...prev, [currentWeek]: emptyWeek() }))
    setExpandedSlot(null)
    setPickingFor(null)
  }, [currentWeek])

  // ── Recipe search with debouncing ──
  const searchRecipes = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    setSearchLoading(true)
    try {
      const res = await fetch(`/api/recipes/search-for-planner?q=${encodeURIComponent(query)}&limit=20`)
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json() as { recipes: Recipe[] }
      setSearchResults(data.recipes)
    } catch (err) {
      console.error('[searchRecipes] error:', err)
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }, [])

  // Handle search input with debouncing
  const handlePickerSearchChange = useCallback((value: string) => {
    setPickerSearch(value)
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
    const timer = setTimeout(() => {
      searchRecipes(value)
    }, 300)
    setSearchDebounceTimer(timer)
  }, [searchRecipes, searchDebounceTimer])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
    }
  }, [searchDebounceTimer])

  // ── Stats ──
  const totalDishes = useMemo(() =>
    DAYS.reduce((a, d) => a + MEALS.reduce((b, m) => b + week[d][m].dishes.length, 0), 0),
    [week]
  )

  // ── Shopping list generation ──
  const generateShoppingList = useCallback(() => {
    // Always use currentWeek for week/day scopes so it stays in sync with the planner
    const resolvedScope: ShoppingScope = shopScope.type === 'range'
      ? { type: 'range', from: shopRangeFrom, to: shopRangeTo }
      : shopScope.type === 'day'
        ? { type: 'day', weekIndex: currentWeek, day: shopScope.day }
        : { type: 'week', weekIndex: currentWeek }
    const items = buildShoppingList(planner, resolvedScope)
    setShopItems(items)
    setShopSaveState('idle')
    setShopSaveError('')
  }, [planner, shopScope, shopRangeFrom, shopRangeTo, currentWeek])

  const toggleCheck = useCallback((id: string) => {
    setShopItems((prev) => prev.map((item) => item.id === id ? { ...item, checked: !item.checked } : item))
  }, [])

  const updateSubtype = useCallback((id: string, note: string) => {
    setShopItems((prev) => prev.map((item) => item.id === id ? { ...item, subtypeNote: note } : item))
  }, [])

  const [shopSaveError, setShopSaveError] = useState('')
  const saveToShoppingList = useCallback(async () => {
    if (shopItems.length === 0) return
    setShopSaveState('saving')
    setShopSaveError('')
    try {
      let mockUserId = 'anonymous'
      try {
        const stored = localStorage.getItem('mock_user')
        if (stored) {
          const parsed = JSON.parse(stored) as { id?: string }
          if (parsed.id) mockUserId = parsed.id
        }
      } catch { /* ignore */ }

       const now = new Date()
       const listName = `Plan de Masă \u2013 ${now.toLocaleDateString('ro-RO', { month: 'short', day: 'numeric', year: 'numeric' })}`

      const createRes = await fetch('/api/shopping-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-mock-user-id': mockUserId },
        body: JSON.stringify({ name: listName, source_type: 'meal_plan' }),
      })
      if (!createRes.ok) {
        const errText = await createRes.text()
        console.error('[saveToShoppingList] create list failed:', createRes.status, errText)
        throw new Error(errText)
      }
      const created = await createRes.json() as { id: string }

      const results = await Promise.all(
        shopItems.map((item) =>
          fetch(`/api/shopping-lists/${created.id}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-mock-user-id': mockUserId },
            body: JSON.stringify({
              name: item.name,
              amount: item.totalQty,
              unit: item.unit,
              notes: JSON.stringify({
                subtype: item.subtypeNote || '',
                category: item.category || 'Other',
                recipes: item.fromRecipes || [],
              }),
            }),
          })
        )
      )

      const failed = results.filter((r) => !r.ok)
      if (failed.length > 0) {
        console.error('[saveToShoppingList] some items failed:', failed.length, 'of', results.length)
      }

       setShopSaveState('saved')
       setTimeout(() => setShopSaveState('idle'), 4000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[saveToShoppingList] error:', msg)
      setShopSaveError(msg)
      setShopSaveState('error')
      setTimeout(() => setShopSaveState('idle'), 5000)
    }
  }, [shopItems])

  // ── Grouped shopping list ──
  const groupedItems = useMemo(() => {
    if (shopGrouping === "category") {
      const map: Record<string, ShoppingItem[]> = {}
      shopItems.forEach((item) => {
        if (!map[item.category]) map[item.category] = []
        map[item.category].push(item)
      })
      return map
    }
    if (shopGrouping === "recipe") {
      const map: Record<string, ShoppingItem[]> = {}
      shopItems.forEach((item) => {
        item.fromRecipes.forEach((r) => {
          if (!map[r]) map[r] = []
          if (!map[r].find((i) => i.id === item.id)) map[r].push(item)
        })
      })
      return map
    }
    // by day
    const map: Record<string, ShoppingItem[]> = {}
    shopItems.forEach((item) => {
      item.fromDays.forEach((d) => {
        if (!map[d]) map[d] = []
        if (!map[d].find((i) => i.id === item.id)) map[d].push(item)
      })
    })
    return map
  }, [shopItems, shopGrouping])

  // Auto-generate shopping list when switching to shopping view
  useEffect(() => {
    if (view === 'shopping') {
      generateShoppingList()
    }
  }, [view, generateShoppingList])

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
    <main className="min-h-screen" style={{ background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}><div className="container mx-auto px-4 py-8 max-w-7xl">

      {/* ── Top bar ── */}
       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
         <div>
           <h1 className="text-3xl font-bold tracking-tight">Planificator de mese</h1>
           <p className="text-muted-foreground mt-1 text-sm">
             {totalDishes} fel{totalDishes !== 1 ? "uri" : ""} planificat{totalDishes !== 1 ? "e" : ""} săptămâna aceasta ·{" "}
             Planificare {CURRENT_YEAR}
           </p>
         </div>
        <div className="flex items-center gap-2">
           <button
             onClick={() => setView("planner")}
             className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
               view === "planner" ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted"
             }`}
           >
             📅 Planificator
           </button>
            <button
              onClick={() => setView("shopping")}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                view === "shopping" ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted"
              }`}
            >
              🛒 Lista de cumpărături
            </button>
           <Link
             href="/me/shopping-lists"
             className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors"
           >
             📋 Liste salvate
           </Link>
        </div>
      </div>

      {/* ══════════════════════════════ PLANNER VIEW ══════════════════════════ */}
      {view === "planner" && (
        <>
          {/* Week navigation — month accordion */}
          <WeekNav
            currentWeek={currentWeek}
            onSelect={(w) => { setCurrentWeek(w); localStorage.setItem("planner-week", String(w)); const m = YEAR_WEEKS[w]?.month; if (m !== undefined) { setSelectedMonth(m); localStorage.setItem("planner-month", String(m)) } }}
            onClear={clearWeek}
            selectedMonth={selectedMonth}
            onMonthSelect={(m) => { setSelectedMonth(m); localStorage.setItem("planner-month", String(m)) }}
          />


          {/* Weekly nutrition summary — only shown in Health Mode */}
          {healthMode && weekNutrition.calories > 0 && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <div className="flex items-center justify-between mb-2">
               <h3 className="text-sm font-semibold">🔥 Nutriție săptămânală</h3>
                 <a href="/health" className="text-xs text-amber-600 hover:underline">Ajustează țintele →</a>
              </div>
              {/* Calorie progress bar */}
              <div className="mb-3">
                 <div className="flex justify-between text-xs mb-1">
                   <span className="text-muted-foreground">Calorii</span>
                   <span className="font-medium">
                     {Math.round(weekNutrition.calories)} / {healthGoals.calorieTarget * 7} kcal
                   </span>
                 </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      weekNutrition.calories > healthGoals.calorieTarget * 7
                        ? "bg-red-500"
                        : "bg-amber-500"
                    }`}
                    style={{ width: `${Math.min(100, (weekNutrition.calories / (healthGoals.calorieTarget * 7)) * 100)}%` }}
                  />
                </div>
              </div>
              {/* Macro chips */}
              <div className="flex gap-4 text-xs flex-wrap">
                <span className="text-red-600 font-medium">🥩 {Math.round(weekNutrition.protein)}g protein</span>
                <span className="text-amber-600 font-medium">🌾 {Math.round(weekNutrition.carbs)}g carbs</span>
                <span className="text-yellow-700 font-medium">🫒 {Math.round(weekNutrition.fat)}g fat</span>
              </div>
               <p className="text-[10px] text-muted-foreground mt-1">
                 Ținte: {healthGoals.macroProtein}% proteine · {healthGoals.macroCarbs}% carbohidrați · {healthGoals.macroFat}% grăsimi
               </p>
            </div>
          )}
          {/* 7-day grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 mb-8">
            {DAYS.map((day, di) => {
              const date = dateForDay(currentWeek, di)
              const dateStr = date.toLocaleDateString("ro-RO", { day: "numeric", month: "short" })
              const now = new Date()
              const isToday = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
              return (
                <div key={day} className={`bg-card rounded-xl border overflow-hidden ${isToday ? "border-amber-400 ring-2 ring-amber-200" : "border-border"}`}>
                  {/* Day header */}
                   <div className={`border-b px-3 py-2 text-center ${isToday ? "bg-amber-100 border-amber-200" : "bg-amber-50 border-amber-100"}`}>
                     <div className="text-xs font-bold text-amber-700 uppercase tracking-wide">{day.slice(0, 3)}{isToday && <span className="ml-1 text-[9px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full normal-case tracking-normal font-semibold">Azi</span>}</div>
                    <div className="text-[10px] text-amber-500 mt-0.5">{dateStr}</div>
                    {healthMode && dayNutrition[day].calories > 0 && (
                      <div className="text-[9px] text-amber-600 font-semibold mt-0.5">
                        🔥 {Math.round(dayNutrition[day].calories)} kcal
                      </div>
                    )}
                  </div>

                  {/* Meal slots */}
                  <div className="p-2 flex flex-col gap-2">
                    {MEALS.map((meal) => {
                      const slot = week[day][meal]
                      const isExpanded = expandedSlot?.day === day && expandedSlot?.meal === meal
                      const isPicking = pickingFor?.day === day && pickingFor?.meal === meal
                      const hasDishes = slot.dishes.length > 0

                      return (
                        <div key={meal}>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-0.5">
                            {meal}
                          </p>

                          {/* Collapsed summary / expand trigger */}
                          <button
                            onClick={() => { if (!hasDishes) { setPickingFor({ day, meal }); setExpandedSlot(null) } else { setExpandedSlot(isExpanded ? null : { day, meal }) } }}
                            className={`w-full rounded-lg border transition-colors text-left ${
                              isExpanded
                                ? "border-amber-400 bg-amber-50"
                                : hasDishes
                                ? "border-stone-200 bg-stone-50 hover:border-amber-300"
                                : "border-dashed border-stone-200 hover:border-amber-300 hover:bg-amber-50/40"
                            }`}
                          >
                            {hasDishes ? (
                              <div className="p-2 space-y-1">
                                {slot.dishes.map((dish) => (
                                  <div key={dish.id} className="flex items-center gap-1.5">
                                     <Image
                                       src={dish.recipe.hero_image_url}
                                       alt={dish.recipe.title}
                                       width={32}
                                       height={32}
                                       className="w-8 h-8 rounded object-cover shrink-0"
                                     />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[10px] font-medium line-clamp-1 leading-tight">{dish.recipe.title}</p>
                                      <p className="text-[9px] text-muted-foreground">{dish.servings}× porție</p>
                                    </div>
                                  </div>
                                ))}
                                 <p className="text-[9px] text-amber-600 pt-0.5">
                                   {isExpanded ? "▲ restrânge" : "▼ editează"}
                                 </p>
                              </div>
                            ) : (
                               <div className="h-12 flex items-center justify-center text-[11px] text-stone-400 font-medium">
                                 + Adaugă fel
                               </div>
                            )}
                          </button>

                          {/* Expanded slot panel */}
                          {isExpanded && (
                            <div className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50/50 p-2 space-y-1.5">
                              {slot.dishes.map((dish) => (
                                <div key={dish.id} className="flex items-center gap-2 bg-white rounded-lg p-1.5 border border-stone-100">
                                   <Image
                                     src={dish.recipe.hero_image_url}
                                     alt={dish.recipe.title}
                                     width={40}
                                     height={40}
                                     className="w-10 h-10 rounded object-cover shrink-0"
                                   />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium line-clamp-1">{dish.recipe.title}</p>
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <button
                                        onClick={() => updateServings(day, meal, dish.id, Math.max(1, dish.servings - 1))}
                                        className="w-5 h-5 rounded-full border border-stone-300 flex items-center justify-center text-xs hover:border-amber-400 hover:text-amber-600 transition-colors"
                                      >−</button>
                                      <span className="text-xs font-semibold min-w-[28px] text-center">{dish.servings}×</span>
                                      <button
                                        onClick={() => updateServings(day, meal, dish.id, dish.servings + 1)}
                                        className="w-5 h-5 rounded-full border border-stone-300 flex items-center justify-center text-xs hover:border-amber-400 hover:text-amber-600 transition-colors"
                                      >+</button>
                                      <span className="text-[10px] text-muted-foreground ml-0.5">porții</span>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => removeDish(day, meal, dish.id)}
                                    className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                    aria-label="Remove dish"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}

                              {/* Add extra dish button */}
                               <button
                                 onClick={() => setPickingFor(isPicking ? null : { day, meal })}
                                 className={`w-full py-1.5 rounded-lg border-2 border-dashed text-xs font-medium transition-colors ${
                                   isPicking
                                     ? "border-amber-400 text-amber-600 bg-amber-50"
                                     : "border-stone-300 text-stone-500 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50"
                                 }`}
                               >
                                 {isPicking ? "↓ Alege o rețetă mai jos" : "+ Adaugă fel suplimentar"}
                               </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

           {/* Empty state hint */}
           {totalDishes === 0 && !pickingFor && (
             <div className="text-center py-8 px-4 rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/30 mb-8">
               <p className="text-2xl mb-2">🍳</p>
               <p className="font-semibold text-amber-800">Niciun fel planificat încă</p>
               <p className="text-sm text-amber-600 mt-1">Apasă \"+ Adaugă fel\" pe orice slot de masă de mai sus pentru a începe planificarea săptămânii tale</p>
             </div>
           )}

          {/* Recipe picker panel */}
          {pickingFor && (
            <section className="mb-10 rounded-2xl border border-amber-200 bg-amber-50/30 p-4">
               <div className="flex items-center justify-between mb-3">
                 <div>
                   <h2 className="text-base font-semibold">
                     Adaugă fel la{" "}
                     <span className="text-amber-600">{pickingFor.day} — {pickingFor.meal}</span>
                   </h2>
                   <p className="text-xs text-muted-foreground mt-0.5">
                     Alege din{" "}
                     <a href="/me/preferred" className="underline hover:text-amber-600">Rețetele tale preferate</a>
                     {preferred.length === 0 && " — niciuna adăugată încă"} 
                   </p>
                 </div>
                 <button
                   onClick={() => { setPickingFor(null); setPickerSearch("") }}
                   className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                 >
                   Anulează ✕
                 </button>
               </div>

                {/* Search bar */}
                <input
                  type="search"
                  value={pickerSearch}
                  onChange={(e) => handlePickerSearchChange(e.target.value)}
                  placeholder="Caută rețete..."
                  className="w-full border border-input rounded-xl px-4 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-300 mb-4"
                />

                {searchLoading ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Se caută...</p>
                ) : pickerSearch.trim() === "" ? (
                  <div className="text-center py-10">
                    <p className="text-muted-foreground text-sm mb-3">Începe să scrii pentru a căuta rețete</p>
                  </div>
                ) : searchResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nicio rețetă nu se potrivește cu căutarea ta.</p>
                ) : (
                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                   {searchResults.map((recipe) => (
                     <button
                       key={recipe.id}
                       onClick={() => { addDish(pickingFor!.day, pickingFor!.meal, recipe); setPickerSearch("") }}
                       className="text-left rounded-xl overflow-hidden border border-border bg-card hover:shadow-md hover:border-amber-400 transition-all group"
                     >
                        <Image
                          src={recipe.hero_image_url}
                          alt={recipe.title}
                          width={400}
                          height={80}
                          className="w-full h-20 object-cover group-hover:scale-105 transition-transform duration-200"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                       <div className="p-2">
                         <p className="text-xs font-medium line-clamp-2 leading-snug">{recipe.title}</p>
                         {recipe.foodTags.length > 0 && (
                           <p className="text-[10px] text-muted-foreground mt-0.5">{recipe.foodTags.join(", ")}</p>
                         )}
                       </div>
                     </button>
                   ))}
                 </div>
               )}
            </section>
          )}
        </>
      )}

      {/* ══════════════════════════ SHOPPING LIST VIEW ════════════════════════ */}
      {view === "shopping" && (
        <div style={{ maxWidth: '1000px' }}>
           {(() => {
             return (
              <div className="space-y-6">
                {shopItems.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-card p-12 text-center">
                    <p className="text-4xl mb-4">🛒</p>
                    <p className="text-sm font-medium text-foreground mb-2">Nu sunt mese planificate pentru acest interval</p>
                    <p className="text-xs text-muted-foreground">Adaugă feluri de mâncare în planificator mai întâi</p>
                  </div>
                ) : (
                  <>
                    {/* Grouping toggle */}
                    <div className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex flex-wrap gap-2">
                        {(['category', 'recipe', 'day'] as const).map((g) => {
                          const isSelected = shopGrouping === g
                          const labels = {
                            category: '🗂️ pe categorii',
                            recipe: '🍽️ pe rețete',
                            day: '📅 pe zile',
                          }
                          return (
                            <button
                              key={g}
                              onClick={() => setShopGrouping(g)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                isSelected
                                  ? 'bg-foreground text-background border-foreground'
                                  : 'border-border text-muted-foreground hover:bg-muted'
                              }`}
                            >
                              {labels[g]}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Items list */}
                    <div className="space-y-4">
                      {Object.entries(groupedItems).map(([group, items]) => (
                        <div key={group} className="rounded-2xl border border-border bg-card overflow-hidden">
                          <div className="bg-muted/50 border-b border-border px-4 py-2">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              {group}
                            </h3>
                          </div>
                          <div className="divide-y divide-border">
                            {items.map((item) => {
                              const alcoholKeywords = ['vodka', 'vodcă', 'rom', 'rum', 'gin', 'whisky', 'whiskey', 'bourbon', 'scotch', 'tequila', 'mezcal', 'cognac', 'brandy', 'coniac', 'vermut', 'vermouth', 'campari', 'aperol', 'angostura', 'bitter', 'cointreau', 'triple sec', 'curaçao', 'curacao', 'kahlua', 'baileys', 'amaretto', 'absint', 'chartreuse', 'fernet', 'limoncello', 'prosecco', 'champagne', 'șampanie', 'bere', 'beer', 'vin', 'wine', 'lichior', 'liqueur', 'sambuca', 'grappa', 'țuică', 'pălincă', 'rachiu', 'jägermeister', 'grand marnier']
                              const isAlcohol = alcoholKeywords.some(kw => item.name.toLowerCase().includes(kw))
                              
                              const normalizedName = item.name
                                .replace(/^\d+\s*/, '')
                                .replace(/\b(ml|g|kg|linguri|linguriță|cană|buc|bucată|bucăți)\b/gi, '')
                                .replace(/\b(de|of)\b/gi, '')
                                .trim()

                              const emagUrl = `https://www.emag.ro/search/${encodeURIComponent(normalizedName.replace(/\s+/g, '+'))}`
                              const bauturiUrl = `https://bauturialcoolice.ro/index.php?route=product/search&search=${encodeURIComponent(normalizedName)}`

                              return (
                                <div key={item.id} className="p-4 hover:bg-muted/30 transition-colors">
                                  <div className="flex items-start gap-3">
                                    <input
                                      type="checkbox"
                                      checked={item.checked}
                                      onChange={() => toggleCheck(item.id)}
                                      className="mt-1 w-4 h-4 cursor-pointer flex-shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <span className={`text-sm font-medium ${item.checked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                          <IngredientLink ingredient={item.name} variant="light" />
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          {item.totalQty % 1 === 0 ? item.totalQty : item.totalQty.toFixed(1)} {item.unit}
                                        </span>
                                      </div>
                                      {item.subtypeNote && (
                                        <input
                                          type="text"
                                          value={item.subtypeNote}
                                          onChange={(e) => updateSubtype(item.id, e.target.value)}
                                          placeholder="+ tip / notă"
                                          className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded px-2 py-1 italic mb-1 w-full"
                                        />
                                      )}
                                      <p className="text-[10px] text-muted-foreground leading-tight">
                                        {shopGrouping === 'recipe'
                                          ? item.fromDays.join(' · ')
                                          : shopGrouping === 'day'
                                            ? item.fromRecipes.join(' · ')
                                            : item.fromRecipes.join(' · ')}
                                      </p>
                                    </div>
                                    <div className="flex gap-1 flex-shrink-0">
                                      <a
                                        href={emagUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-2 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
                                        title="Caută pe eMAG"
                                      >
                                        🛒
                                      </a>
                                      {isAlcohol && (
                                        <a
                                          href={bauturiUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="px-2 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-700 dark:text-purple-400 hover:bg-purple-500/20 transition-colors"
                                          title="Caută pe BauturiAlcoolice"
                                        >
                                          🍷
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Action bar */}
                    <div className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (shopItems.length === 0) return
                            const scopeLabel = shopScope.type === 'day' ? `Astăzi (${shopScope.day})`
                              : shopScope.type === 'range' ? `Săptămânile ${shopRangeFrom + 1}–${shopRangeTo + 1}`
                              : `Săptămâna ${currentWeek + 1}`
                            const groupLabel = shopGrouping === 'category' ? 'pe categorii'
                              : shopGrouping === 'recipe' ? 'pe rețete' : 'pe zile'

                            let html = `<!DOCTYPE html><html><head><title>Listă de cumpărături</title><style>
                              * { box-sizing: border-box; margin: 0; padding: 0; }
                              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 780px; margin: 0 auto; padding: 32px 40px; color: #111; font-size: 16px; line-height: 1.5; }
                              h1 { font-size: 26px; font-weight: 800; margin-bottom: 6px; }
                              .scope { font-size: 15px; color: #555; margin-bottom: 28px; border-bottom: 2px solid #111; padding-bottom: 14px; }
                              h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #888; border-bottom: 1px solid #e0e0e0; padding-bottom: 6px; margin: 24px 0 10px 0; }
                              ul { list-style: none; padding: 0; margin: 0; }
                              li.item { display: flex; align-items: flex-start; gap: 12px; padding: 7px 0; border-bottom: 1px solid #f2f2f2; }
                              .check { width: 18px; height: 18px; border: 2px solid #bbb; border-radius: 4px; flex-shrink: 0; margin-top: 2px; }
                              .name { font-weight: 600; font-size: 16px; }
                              .qty { color: #555; font-size: 15px; }
                              .note { color: #aa7700; font-style: italic; font-size: 13px; }
                              .meta { font-size: 12px; color: #aaa; padding: 2px 0 6px 30px; }
                              @media print {
                                body { padding: 0; font-size: 13pt; }
                                @page { size: A4; margin: 1.8cm 2cm; }
                                h1 { font-size: 22pt; }
                                .scope { font-size: 12pt; }
                                h2 { font-size: 9pt; }
                                .name { font-size: 13pt; }
                                .qty { font-size: 12pt; }
                                .note { font-size: 11pt; }
                                .meta { font-size: 10pt; }
                                li.item { break-inside: avoid; }
                              }
                            </style></head><body>`
                            html += `<h1>🛒 Listă de cumpărături</h1>`
                            html += `<p class="scope">${scopeLabel} · ${shopItems.length} produse · ${groupLabel}</p>`

                            Object.entries(groupedItems).sort(([a], [b]) => a.localeCompare(b)).forEach(([group, items]) => {
                              html += `<h2>${group}</h2><ul>`
                              items.forEach((item) => {
                                const qty = item.totalQty % 1 === 0 ? String(item.totalQty) : item.totalQty.toFixed(1)
                                html += `<li class="item"><div class="check"></div><div><span class="name">${item.name}</span> <span class="qty">${qty} ${item.unit}</span>${item.subtypeNote ? ` <span class="note">(${item.subtypeNote})</span>` : ''}</div></li>`
                                if (shopGrouping === 'category' && item.fromRecipes.length > 0) {
                                  html += `<div class="meta">${item.fromRecipes.join(' &middot; ')}</div>`
                                } else if (shopGrouping === 'recipe' && item.fromDays.length > 0) {
                                  html += `<div class="meta">${item.fromDays.join(' &middot; ')}</div>`
                                } else if (shopGrouping === 'day' && item.fromRecipes.length > 0) {
                                  html += `<div class="meta">${item.fromRecipes.join(' &middot; ')}</div>`
                                }
                              })
                              html += `</ul>`
                            })
                            html += `</body></html>`
                            const printWin = window.open('', '_blank', 'width=700,height=900')
                            if (printWin) {
                              printWin.document.write(html)
                              printWin.document.close()
                              printWin.focus()
                              printWin.print()
                            }
                          }}
                          className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors border border-border"
                        >
                          🖨️ Printează
                        </button>
                        <button
                          onClick={() => {
                            const text = shopItems.map(
                              (i) => `${i.checked ? '✓' : '☐'} ${i.name} — ${i.totalQty}${i.unit}${i.subtypeNote ? ` (${i.subtypeNote})` : ''}`
                            ).join('\n')
                            navigator.clipboard.writeText(text).catch(() => {})
                          }}
                          className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors border border-border"
                        >
                          📋 Copiază
                        </button>
                        <button
                          onClick={saveToShoppingList}
                          disabled={shopSaveState === 'saving'}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                            shopSaveState === 'saved'
                              ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80 border-border'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {shopSaveState === 'saving' ? '⏳ Se salvează…' : shopSaveState === 'saved' ? '✅ Salvat!' : shopSaveState === 'error' ? '❌ Eroare' : '💾 Salvează'}
                        </button>
                      </div>
                      {shopSaveState === 'error' && shopSaveError && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-2 bg-red-500/10 border border-red-200 dark:border-red-800 rounded px-2 py-1">
                          {shopSaveError}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })()}
        </div>
      )}
    </div></main>
    {/* Pro paywall removed — all features available to all users */}
    </>
  )
}
