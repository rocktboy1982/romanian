'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase-client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface HealthProfile {
  user_id: string
  age: number | null
  gender: string | null
  height_cm: number | null
  weight_kg: number | null
  goal_weight_kg: number | null
  activity_level: string | null
  daily_calorie_target: number | null
  fasting_protocol: string | null
  fasting_eating_start: string | null
  fasting_eating_end: string | null
  daily_water_goal_ml: number | null
  caloric_regime: string | null
  diet_type: string | null
  personal_preferences: string | null
}

// ─── Meal Plan Types ──────────────────────────────────────────────────────────

interface MealPlanMeal {
  type: string
  label: string
  time?: string
  recipe_id: string | null
  recipe_title: string
  recipe_slug: string | null
  calories: number
  notes: string
}

interface HydrationReminder {
  time: string
  amount_ml: number
  note: string
}

interface MealPlanDay {
  day: string
  date: string
  meals: MealPlanMeal[]
  total_calories: number
  hydration?: HydrationReminder[]
}

interface MealPlan {
  week_start: string
  week_end: string
  daily_calorie_target: number
  diet_type: string
  caloric_regime: string
  days: MealPlanDay[]
  weekly_summary: {
    avg_calories: number
    protein_focus: string
    notes: string
  }
  disclaimer: string
}

interface HydrationLog {
  id: string
  log_date: string
  amount_ml: number
  drink_type: string
  logged_at: string
}

interface MealLog {
  id: string
  meal_date: string
  meal_type: string
  recipe_title: string
  calories_estimated: number | null
  notes: string | null
  logged_at: string
}

interface FastingLog {
  id: string
  log_date: string
  fast_start: string | null
  fast_end: string | null
  achieved_hours: number
  target_hours: number
  completed: boolean
  logged_at: string
}

interface WeightLog {
  id: string
  log_date: string
  weight_kg: number
  logged_at: string
}

interface LogsData {
  hydration: HydrationLog[]
  meals: MealLog[]
  fasting: FastingLog[]
  weight: WeightLog[]
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
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

// ─── Formatting helpers ───────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function last7Days(): string[] {
  const days: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().split('T')[0])
  }
  return days
}

function last30Days(): string[] {
  const days: string[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().split('T')[0])
  }
  return days
}

function last28Days(): string[] {
  const days: string[] = []
  for (let i = 27; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().split('T')[0])
  }
  return days
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatWater(ml: number): string {
  if (ml >= 1000) return `${(ml / 1000).toFixed(1).replace('.', ',')}L`
  return `${ml}ml`
}

function fastingProtocolLabel(protocol: string): string {
  const map: Record<string, string> = {
    none: 'Niciunul',
    '16:8': '16:8',
    '18:6': '18:6',
    '20:4': '20:4',
    omad: 'OMAD',
    '5:2': '5:2',
  }
  return map[protocol] ?? protocol
}

function mealTypeLabel(type: string): string {
  const map: Record<string, string> = {
    breakfast: 'Mic dejun',
    lunch: 'Prânz',
    dinner: 'Cină',
    snack: 'Gustare',
  }
  return map[type] ?? type
}

// ─── SVG Progress Ring ────────────────────────────────────────────────────────

function ProgressRing({
  value,
  max,
  size = 80,
  strokeWidth = 7,
  color = '#ff4d6d',
  children,
}: {
  value: number
  max: number
  size?: number
  strokeWidth?: number
  color?: string
  children?: React.ReactNode
}) {
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.min(1, max > 0 ? value / max : 0)
  const dash = pct * circ

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="rgba(255,255,255,0.1)" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  )
}

// ─── SVG Weight Line Chart ────────────────────────────────────────────────────

function WeightLineChart({ data }: { data: { date: string; kg: number }[] }) {
  if (data.length < 2) {
    return (
      <div className="text-center py-6 text-sm opacity-50">
        Niciun date suficiente pentru grafic (minimum 2 înregistrări)
      </div>
    )
  }

  const W = 300, H = 100
  const pad = { top: 8, right: 8, bottom: 24, left: 36 }
  const minKg = Math.min(...data.map(d => d.kg))
  const maxKg = Math.max(...data.map(d => d.kg))
  const range = maxKg - minKg || 1

  const toX = (i: number) =>
    pad.left + (i / (data.length - 1)) * (W - pad.left - pad.right)
  const toY = (kg: number) =>
    pad.top + (1 - (kg - minKg) / range) * (H - pad.top - pad.bottom)

  const points = data.map((d, i) => `${toX(i)},${toY(d.kg)}`).join(' ')

  // Tick marks: show first, middle, last dates
  const ticks = [0, Math.floor(data.length / 2), data.length - 1].filter(
    (v, i, a) => a.indexOf(v) === i,
  )

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 100 }}>
      {/* grid lines */}
      {[0, 0.5, 1].map((t, i) => (
        <line key={i}
          x1={pad.left} x2={W - pad.right}
          y1={pad.top + t * (H - pad.top - pad.bottom)}
          y2={pad.top + t * (H - pad.top - pad.bottom)}
          stroke="rgba(255,255,255,0.06)" strokeWidth={1}
        />
      ))}
      {/* weight labels */}
      {[minKg, (minKg + maxKg) / 2, maxKg].map((v, i) => (
        <text key={i} x={pad.left - 4}
          y={pad.top + (1 - (v - minKg) / range) * (H - pad.top - pad.bottom) + 4}
          textAnchor="end" fill="rgba(255,255,255,0.4)" fontSize={9}>
          {v.toFixed(1)}
        </text>
      ))}
      {/* line */}
      <polyline points={points} fill="none" stroke="#ff4d6d" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {/* dots */}
      {data.map((d, i) => (
        <circle key={i} cx={toX(i)} cy={toY(d.kg)} r={2.5} fill="#ff4d6d" />
      ))}
      {/* date ticks */}
      {ticks.map(i => (
        <text key={i} x={toX(i)}
          y={H - 2}
          textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize={8}>
          {data[i].date.slice(5)}
        </text>
      ))}
    </svg>
  )
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────

function Card({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-4"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <h2 className="font-semibold text-base" style={{ color: 'hsl(var(--foreground))' }}>{title}</h2>
      </div>
      {children}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HealthDashboardClient() {
  const [profile, setProfile] = useState<HealthProfile | null>(null)
  const [logs, setLogs] = useState<LogsData>({ hydration: [], meals: [], fasting: [], weight: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Meal Plan AI state
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null)
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)
  const [planWeek, setPlanWeek] = useState<'current' | 'next'>('current')
  const [includeHydration, setIncludeHydration] = useState(false)
  const [applyingPlan, setApplyingPlan] = useState(false)
  const [planApplied, setPlanApplied] = useState(false)

  // Quick-add states
  const [addingWater, setAddingWater] = useState(false)
  const [mealForm, setMealForm] = useState({ meal_type: 'lunch', recipe_title: '', calories_estimated: '' })
  const [addingMeal, setAddingMeal] = useState(false)
  const [weightInput, setWeightInput] = useState('')
  const [addingWeight, setAddingWeight] = useState(false)
  const [fastingActive, setFastingActive] = useState(false)
  const [fastingStart, setFastingStart] = useState<string | null>(null)
  const [now, setNow] = useState(new Date())

  // Update clock every minute
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(iv)
  }, [])

  // Load fasting state from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('marechef-fasting')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.start) {
          setFastingStart(parsed.start)
          setFastingActive(true)
        }
      }
    } catch { /* ignore */ }
  }, [])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const headers = await getAuthHeaders()

      const [profileRes, logsRes] = await Promise.all([
        fetch('/api/health/profile', { headers }),
        fetch('/api/health/logs?days=30', { headers }),
      ])

      if (!profileRes.ok) {
        const d = await profileRes.json()
        setError(d.error || 'Eroare la încărcarea profilului')
        return
      }

      const profileData = await profileRes.json()
      setProfile(profileData.profile)

      if (logsRes.ok) {
        const logsData = await logsRes.json()
        setLogs({
          hydration: logsData.hydration ?? [],
          meals: logsData.meals ?? [],
          fasting: logsData.fasting ?? [],
          weight: logsData.weight ?? [],
        })
      }
    } catch (e) {
      setError('Eroare de rețea')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function addWater(ml: number) {
    if (addingWater) return
    setAddingWater(true)
    try {
      const headers = await getAuthHeaders()
      await fetch('/api/health/logs', {
        method: 'POST',
        headers,
        body: JSON.stringify({ type: 'hydration', amount_ml: ml, drink_type: 'apa' }),
      })
      await fetchData()
    } finally {
      setAddingWater(false)
    }
  }

  async function addMeal(e: React.FormEvent) {
    e.preventDefault()
    if (!mealForm.recipe_title.trim() || addingMeal) return
    setAddingMeal(true)
    try {
      const headers = await getAuthHeaders()
      await fetch('/api/health/logs', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type: 'meal',
          meal_type: mealForm.meal_type,
          recipe_title: mealForm.recipe_title.trim(),
          calories_estimated: mealForm.calories_estimated ? Number(mealForm.calories_estimated) : undefined,
        }),
      })
      setMealForm({ meal_type: 'lunch', recipe_title: '', calories_estimated: '' })
      await fetchData()
    } finally {
      setAddingMeal(false)
    }
  }

  async function addWeight(e: React.FormEvent) {
    e.preventDefault()
    const kg = parseFloat(weightInput.replace(',', '.'))
    if (isNaN(kg) || kg <= 0 || addingWeight) return
    setAddingWeight(true)
    try {
      const headers = await getAuthHeaders()
      await fetch('/api/health/logs', {
        method: 'POST',
        headers,
        body: JSON.stringify({ type: 'weight', weight_kg: kg }),
      })
      setWeightInput('')
      await fetchData()
    } finally {
      setAddingWeight(false)
    }
  }

  function toggleFasting() {
    if (!fastingActive) {
      const start = new Date().toISOString()
      setFastingStart(start)
      setFastingActive(true)
      try { localStorage.setItem('marechef-fasting', JSON.stringify({ start })) } catch { /* ignore */ }
    } else {
      // End fasting — log it
      if (fastingStart) {
        const startDate = new Date(fastingStart)
        const endDate = new Date()
        const hours = (endDate.getTime() - startDate.getTime()) / 3_600_000
        const targetH = profile?.fasting_protocol
          ? parseFloat(profile.fasting_protocol.split(':')[0]) || 16
          : 16

        getAuthHeaders().then(headers =>
          fetch('/api/health/logs', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              type: 'fasting',
              fast_start: fastingStart,
              fast_end: endDate.toISOString(),
              achieved_hours: Math.round(hours * 10) / 10,
              target_hours: targetH,
              completed: hours >= targetH,
            }),
          }),
        ).then(() => fetchData())
      }
      setFastingStart(null)
      setFastingActive(false)
      try { localStorage.removeItem('marechef-fasting') } catch { /* ignore */ }
    }
  }

  async function generateMealPlan(week: 'current' | 'next') {
    if (generatingPlan) return
    setGeneratingPlan(true)
    setPlanError(null)
    setPlanWeek(week)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/health/meal-plan', {
        method: 'POST',
        headers,
        body: JSON.stringify({ week, include_hydration: includeHydration }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPlanError(data.error || 'Eroare la generarea planului')
      } else {
        setMealPlan(data.plan)
      }
    } catch {
      setPlanError('Eroare de rețea')
    } finally {
      setGeneratingPlan(false)
    }
  }

  // ─── ICS Calendar Export ────────────────────────────────────────────────────

  function downloadICS(plan: MealPlan) {
    const mealTimes: Record<string, { h: number; m: number }> = {
      breakfast: { h: 8, m: 0 },
      lunch: { h: 13, m: 0 },
      dinner: { h: 19, m: 0 },
      snack: { h: 16, m: 0 },
    }
    const mealEmoji: Record<string, string> = {
      breakfast: '🥐', lunch: '🍽️', dinner: '🍛', snack: '🍎',
    }

    function pad(n: number) { return n.toString().padStart(2, '0') }
    function icsDate(dateStr: string, h: number, m: number) {
      return dateStr.replace(/-/g, '') + 'T' + pad(h) + pad(m) + '00'
    }
    function icsEndDate(dateStr: string, h: number, m: number) {
      const endM = m + 30
      const endH = endM >= 60 ? h + 1 : h
      return dateStr.replace(/-/g, '') + 'T' + pad(endH) + pad(endM % 60) + '00'
    }
    function escICS(s: string) { return s.replace(/[\\;,]/g, c => '\\' + c).replace(/\n/g, '\\n') }
    function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}@marechef.ro` }

    let events = ''

    for (const day of plan.days) {
      // Meal events
      for (const meal of day.meals) {
        const fromTime = meal.time ? { h: parseInt(meal.time.split(':')[0]), m: parseInt(meal.time.split(':')[1]) } : null
        const t = fromTime || mealTimes[meal.type] || { h: 12, m: 0 }
        const emoji = mealEmoji[meal.type] || '🍴'
        events += `BEGIN:VEVENT\r\nUID:${uid()}\r\nDTSTART;TZID=Europe/Bucharest:${icsDate(day.date, t.h, t.m)}\r\nDTEND;TZID=Europe/Bucharest:${icsEndDate(day.date, t.h, t.m)}\r\nSUMMARY:${escICS(`${emoji} ${meal.label}: ${meal.recipe_title}`)}\r\nDESCRIPTION:${escICS(`${meal.calories} kcal${meal.notes ? '\\n' + meal.notes : ''}`)}\r\nBEGIN:VALARM\r\nTRIGGER:-PT10M\r\nACTION:DISPLAY\r\nDESCRIPTION:${escICS(`${meal.label}: ${meal.recipe_title}`)}\r\nEND:VALARM\r\nEND:VEVENT\r\n`
      }

      // Hydration events
      if (day.hydration && Array.isArray(day.hydration)) {
        for (const h of day.hydration) {
          const [hh, mm] = h.time.split(':').map(Number)
          events += `BEGIN:VEVENT\r\nUID:${uid()}\r\nDTSTART;TZID=Europe/Bucharest:${icsDate(day.date, hh, mm)}\r\nDTEND;TZID=Europe/Bucharest:${icsDate(day.date, hh, mm + 5 < 60 ? mm + 5 : mm)}\r\nSUMMARY:${escICS(`💧 Apă: ${h.amount_ml}ml`)}\r\nDESCRIPTION:${escICS(h.note || '')}\r\nBEGIN:VALARM\r\nTRIGGER:PT0M\r\nACTION:DISPLAY\r\nDESCRIPTION:${escICS(`Bea ${h.amount_ml}ml apă`)}\r\nEND:VALARM\r\nEND:VEVENT\r\n`
        }
      }
    }

    const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//MareChef.ro//Plan Alimentar//RO\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nX-WR-CALNAME:Plan Alimentar MareChef\r\nX-WR-TIMEZONE:Europe/Bucharest\r\n${events}END:VCALENDAR`

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `marechef-plan-${plan.week_start}.ics`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─── Apply AI plan to Meal Planner ──────────────────────────────────────────

  async function applyToMealPlan(plan: MealPlan) {
    if (applyingPlan) return
    setApplyingPlan(true)
    setPlanApplied(false)
    try {
      const headers = await getAuthHeaders()

      // 1. Create a new meal plan
      const createRes = await fetch('/api/meal-plans', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: `Plan AI ${plan.week_start} — ${plan.week_end}`,
          start_date: plan.week_start,
          end_date: plan.week_end,
        }),
      })
      const planData = await createRes.json()
      if (!createRes.ok || !planData?.id) throw new Error('Nu s-a putut crea planul')

      // 2. Add entries for each meal
      const entries = plan.days.flatMap(day =>
        day.meals.map(meal => ({
          meal_plan_id: planData.id,
          date: day.date,
          meal_slot: meal.type as 'breakfast' | 'lunch' | 'dinner' | 'snack',
          post_id: meal.recipe_id || undefined,
          recipe_title: meal.recipe_title,
          servings: 1,
        }))
      )

      // Add entries in batch
      for (const entry of entries) {
        await fetch('/api/meal-plan-entries', {
          method: 'POST',
          headers,
          body: JSON.stringify(entry),
        })
      }

      setPlanApplied(true)
    } catch {
      setPlanApplied(false)
    } finally {
      setApplyingPlan(false)
    }
  }

  // ─── Derived values ─────────────────────────────────────────────────────────

  const today = todayStr()
  const days7 = last7Days()
  const days30 = last30Days()
  const days28 = last28Days()

  // Today's totals
  const todayHydration = logs.hydration
    .filter(l => l.log_date === today)
    .reduce((sum, l) => sum + l.amount_ml, 0)

  const todayMeals = logs.meals.filter(l => l.meal_date === today)
  const todayCalories = todayMeals.reduce((sum, m) => sum + (m.calories_estimated ?? 0), 0)

  // Water goal
  const waterGoal = profile?.daily_water_goal_ml ?? 2000
  const calorieGoal = profile?.daily_calorie_target ?? 2000

  // Fasting timer
  let fastingHours = 0
  if (fastingActive && fastingStart) {
    fastingHours = (now.getTime() - new Date(fastingStart).getTime()) / 3_600_000
  }

  // Weight data for chart
  const weightChartData = days30
    .map(d => {
      const entries = logs.weight.filter(w => w.log_date === d)
      if (!entries.length) return null
      const avg = entries.reduce((s, w) => s + w.weight_kg, 0) / entries.length
      return { date: d, kg: avg }
    })
    .filter(Boolean) as { date: string; kg: number }[]

  const latestWeight = weightChartData[weightChartData.length - 1]?.kg ?? profile?.weight_kg ?? null
  const goalWeight = profile?.goal_weight_kg ?? null

  // Weight progress toward goal
  let weightProgress = 0
  if (latestWeight != null && goalWeight != null && profile?.weight_kg != null) {
    const totalDelta = Math.abs(profile.weight_kg - goalWeight)
    const doneDelta = Math.abs(profile.weight_kg - latestWeight)
    weightProgress = totalDelta > 0 ? Math.min(1, doneDelta / totalDelta) : 1
  }

  // Hydration bar chart: last 7 days
  const hydrByDay = days7.map(d => ({
    date: d,
    ml: logs.hydration.filter(l => l.log_date === d).reduce((s, l) => s + l.amount_ml, 0),
  }))
  const maxHydration = Math.max(...hydrByDay.map(d => d.ml), waterGoal)

  // Meal calendar: last 7 days
  const mealByDay = days7.map(d => ({
    date: d,
    count: logs.meals.filter(m => m.meal_date === d).length,
  }))

  // Fasting 7 days
  const fastByDay = days7.map(d => ({
    date: d,
    completed: logs.fasting.some(f => f.log_date === d && f.completed),
    logged: logs.fasting.some(f => f.log_date === d),
  }))

  // 28-day habit grid
  const habitGrid = days28.map(d => {
    const hasWater = logs.hydration.some(l => l.log_date === d)
    const hasMeal = logs.meals.some(m => m.meal_date === d)
    const hasWeight = logs.weight.some(w => w.log_date === d)
    const waterOk = logs.hydration.filter(l => l.log_date === d).reduce((s, l) => s + l.amount_ml, 0) >= waterGoal * 0.8
    const fastOk = !profile?.fasting_protocol || profile.fasting_protocol === 'none' ||
      logs.fasting.some(f => f.log_date === d && f.completed)

    const score = [hasWater, hasMeal, hasWeight, waterOk, fastOk].filter(Boolean).length
    if (score === 0) return { date: d, color: 'transparent' }
    if (score >= 4) return { date: d, color: '#22c55e' }
    return { date: d, color: '#f59e0b' }
  })

  // Stats for habits section
  const thisWeekMeals = logs.meals.filter(m => days7.includes(m.meal_date)).length
  const avgWater = days7.reduce((sum, d) => {
    const ml = logs.hydration.filter(l => l.log_date === d).reduce((s, l) => s + l.amount_ml, 0)
    return sum + ml
  }, 0) / 7
  const fastingCompleted = logs.fasting.filter(f => days7.includes(f.log_date) && f.completed).length
  const fastingTarget = profile?.fasting_protocol && profile.fasting_protocol !== 'none' ? 7 : 0

  // ─── Loading / Error states ──────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="min-h-screen" style={{ background: 'hsl(var(--background))' }}>
        <div className="container mx-auto px-4 py-8 max-w-4xl flex items-center justify-center min-h-[60vh]">
          <div className="text-center opacity-60">
            <div className="text-4xl mb-3">🏥</div>
            <p>Se încarcă datele de sănătate...</p>
          </div>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen" style={{ background: 'hsl(var(--background))' }}>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.3)' }}>
            <div className="text-4xl mb-3">⚠️</div>
            <p className="font-semibold mb-2">Eroare la încărcare</p>
            <p className="text-sm opacity-70 mb-4">{error}</p>
            <Link href="/auth/signin"
              className="inline-block px-4 py-2 rounded-full text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)' }}
            >
              Autentifică-te
            </Link>
          </div>
        </div>
      </main>
    )
  }

  if (!profile) {
    return (
      <main className="min-h-screen" style={{ background: 'hsl(var(--background))' }}>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-5xl mb-4">🏥</div>
            <h2 className="font-bold text-xl mb-2">Configurează profilul de sănătate</h2>
            <p className="text-sm opacity-60 mb-6">
              Pentru a folosi modulul de sănătate, configurează mai întâi profilul tău.
            </p>
            <Link href="/me"
              className="inline-block px-6 py-3 rounded-full text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)' }}
            >
              Mergi la Setări
            </Link>
          </div>
        </div>
      </main>
    )
  }

  // ─── Full dashboard ──────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen pb-24" style={{ background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
      {/* Print styles */}
      <style>{`@media print { nav, header, footer, button, .no-print { display: none !important; } main { background: #fff !important; color: #000 !important; } }`}</style>
      <div className="container mx-auto px-4 py-6 max-w-4xl flex flex-col gap-6">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-2xl" style={{ color: 'hsl(var(--foreground))' }}>Sănătate</h1>
            <p className="text-sm opacity-50">{formatDate(today)}</p>
          </div>
          <Link href="/me"
            className="text-xs px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.07)', color: 'hsl(var(--muted-foreground))' }}
          >
            Setări
          </Link>
        </div>

        {/* ── Section A: Sumar Zilnic ───────────────────────────────────── */}
        <div className="rounded-2xl p-5 flex flex-col gap-5"
          style={{
            background: 'linear-gradient(135deg, rgba(255,77,109,0.15), rgba(255,149,0,0.1))',
            border: '1px solid rgba(255,77,109,0.2)',
          }}
        >
          <h2 className="font-semibold text-base">Sumar Zilnic</h2>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {/* Calories */}
            <div className="flex flex-col items-center gap-2">
              <ProgressRing value={todayCalories} max={calorieGoal} size={72} color="#ff4d6d">
                <span className="text-xs font-bold" style={{ color: '#ff4d6d' }}>{todayCalories}</span>
                <span className="text-[9px] opacity-50">kcal</span>
              </ProgressRing>
              <div className="text-center">
                <div className="text-xs font-semibold">Calorii</div>
                <div className="text-[11px] opacity-50">{todayCalories} / {calorieGoal} kcal</div>
              </div>
            </div>

            {/* Water */}
            <div className="flex flex-col items-center gap-2">
              <ProgressRing value={todayHydration} max={waterGoal} size={72} color="#3b82f6">
                <span className="text-xs font-bold" style={{ color: '#3b82f6' }}>
                  {(todayHydration / 1000).toFixed(1).replace('.', ',')}
                </span>
                <span className="text-[9px] opacity-50">L</span>
              </ProgressRing>
              <div className="text-center">
                <div className="text-xs font-semibold">Hidratare</div>
                <div className="text-[11px] opacity-50">{formatWater(todayHydration)} / {formatWater(waterGoal)}</div>
              </div>
            </div>

            {/* Fasting */}
            {profile.fasting_protocol && profile.fasting_protocol !== 'none' && (
              <div className="flex flex-col items-center gap-2">
                {fastingActive ? (
                  <>
                    <ProgressRing
                      value={fastingHours}
                      max={parseFloat(profile.fasting_protocol.split(':')[0]) || 16}
                      size={72}
                      color="#a855f7"
                    >
                      <span className="text-xs font-bold" style={{ color: '#a855f7' }}>
                        {fastingHours.toFixed(0)}h
                      </span>
                    </ProgressRing>
                    <div className="text-center">
                      <div className="text-xs font-semibold">Post activ</div>
                      <div className="text-[11px] opacity-50">{fastingProtocolLabel(profile.fasting_protocol)}</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-[72px] h-[72px] rounded-full flex items-center justify-center text-2xl"
                      style={{ background: 'rgba(168,85,247,0.1)', border: '2px dashed rgba(168,85,247,0.3)' }}>
                      🌙
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-semibold">Fasting</div>
                      <div className="text-[11px] opacity-50">{fastingProtocolLabel(profile.fasting_protocol)}</div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Weight */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-[72px] h-[72px] rounded-full flex flex-col items-center justify-center"
                style={{ background: 'rgba(34,197,94,0.1)', border: '2px solid rgba(34,197,94,0.25)' }}>
                <span className="text-sm font-bold" style={{ color: '#22c55e' }}>
                  {latestWeight != null ? `${latestWeight.toFixed(1)}` : '—'}
                </span>
                <span className="text-[9px] opacity-50">kg</span>
              </div>
              <div className="text-center">
                <div className="text-xs font-semibold">Greutate</div>
                {goalWeight != null && (
                  <div className="text-[11px] opacity-50">țintă: {goalWeight} kg</div>
                )}
              </div>
            </div>
          </div>

          {/* Fasting window info */}
          {profile.fasting_protocol && profile.fasting_protocol !== 'none' && profile.fasting_eating_start && profile.fasting_eating_end && (
            <div className="text-xs opacity-60 text-center">
              Fereastră de alimentare: {profile.fasting_eating_start?.slice(0,5)} – {profile.fasting_eating_end?.slice(0,5)}
            </div>
          )}

          {/* Calorie progress bar */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs opacity-60">
              <span>Calorii consumate</span>
              <span>{todayCalories} / {calorieGoal} kcal</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, calorieGoal > 0 ? (todayCalories / calorieGoal) * 100 : 0)}%`,
                  background: 'linear-gradient(90deg, #ff4d6d, #ff9500)',
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Sections grid: B + C ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* ── Section B: Hidratare ─────────────────────────────────────── */}
          <Card title="Hidratare" icon="💧">
            {/* Progress ring */}
            <div className="flex items-center gap-4">
              <ProgressRing value={todayHydration} max={waterGoal} size={80} color="#3b82f6">
                <span className="text-xs font-bold" style={{ color: '#3b82f6' }}>
                  {Math.round(todayHydration / 100) * 100 >= 1000
                    ? `${(todayHydration / 1000).toFixed(1)}L`
                    : `${todayHydration}ml`}
                </span>
              </ProgressRing>
              <div className="flex-1">
                <div className="font-semibold">
                  {formatWater(todayHydration)} <span className="opacity-40">/ {formatWater(waterGoal)}</span>
                </div>
                <div className="text-xs opacity-50 mt-0.5">
                  Obiectiv: {formatWater(waterGoal)} / zi
                </div>
                {/* Quick add */}
                <div className="flex gap-2 mt-3 flex-wrap">
                  {[250, 500, 1000].map(ml => (
                    <button key={ml}
                      onClick={() => addWater(ml)}
                      disabled={addingWater}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all disabled:opacity-40"
                      style={{
                        background: 'rgba(59,130,246,0.15)',
                        color: '#3b82f6',
                        border: '1px solid rgba(59,130,246,0.3)',
                      }}
                    >
                      +{ml < 1000 ? `${ml}ml` : '1L'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 7-day bar chart */}
            <div>
              <p className="text-xs opacity-40 mb-2">Ultimele 7 zile</p>
              <div className="flex items-end gap-1 h-16">
                {hydrByDay.map(({ date, ml }) => (
                  <div key={date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t-sm transition-all"
                      style={{
                        height: `${maxHydration > 0 ? Math.max(4, (ml / maxHydration) * 52) : 4}px`,
                        background: ml >= waterGoal
                          ? '#3b82f6'
                          : ml > 0
                            ? 'rgba(59,130,246,0.4)'
                            : 'rgba(255,255,255,0.05)',
                      }}
                    />
                    <span className="text-[8px] opacity-30">{date.slice(5)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* ── Section C: Jurnal Alimentar ─────────────────────────────── */}
          <Card title="Jurnal Alimentar — Azi" icon="🍽️">
            {/* Today's meals: planned vs logged */}
            <div className="flex flex-col gap-2">
              {['breakfast', 'lunch', 'dinner', 'snack'].map(type => {
                const logged = todayMeals.filter(m => m.meal_type === type)
                // Find planned meal from AI plan (if generated for today)
                const plannedMeal = mealPlan?.days.find(d => d.date === today)?.meals.find(m => m.type === type)
                const hasLogged = logged.length > 0
                return (
                  <div key={type} className="rounded-lg px-3 py-2" style={{ background: hasLogged ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid ${hasLogged ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)'}` }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold w-20 flex-shrink-0" style={{ color: hasLogged ? '#22c55e' : 'hsl(var(--muted-foreground))' }}>
                        {hasLogged ? '✓' : '○'} {mealTypeLabel(type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        {hasLogged ? (
                          <span className="text-xs truncate block">
                            {logged.map(m => m.recipe_title).join(', ')}
                            {logged.some(m => m.calories_estimated) && (
                              <span className="opacity-40 ml-1">({logged.reduce((s, m) => s + (m.calories_estimated ?? 0), 0)} kcal)</span>
                            )}
                          </span>
                        ) : plannedMeal ? (
                          <button
                            type="button"
                            onClick={async () => {
                              const headers = await getAuthHeaders()
                              await fetch('/api/health/logs', {
                                method: 'POST', headers,
                                body: JSON.stringify({ type: 'meal', meal_type: type, recipe_title: plannedMeal.recipe_title, calories_estimated: plannedMeal.calories }),
                              })
                              fetchData()
                            }}
                            className="text-xs opacity-50 hover:opacity-100 transition-opacity truncate block text-left"
                          >
                            📋 {plannedMeal.recipe_title} — <span className="underline">loghează</span>
                          </button>
                        ) : (
                          <span className="text-xs opacity-20">—</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Quick log form */}
            <form onSubmit={addMeal} className="flex flex-col gap-2">
              <div className="flex gap-2">
                <select
                  value={mealForm.meal_type}
                  onChange={e => setMealForm(f => ({ ...f, meal_type: e.target.value }))}
                  className="text-xs px-2 py-1.5 rounded-lg flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'hsl(var(--foreground))' }}
                >
                  <option value="breakfast">Mic dejun</option>
                  <option value="lunch">Prânz</option>
                  <option value="dinner">Cină</option>
                  <option value="snack">Gustare</option>
                </select>
                <input
                  type="text"
                  placeholder="Numele preparatului"
                  value={mealForm.recipe_title}
                  onChange={e => setMealForm(f => ({ ...f, recipe_title: e.target.value }))}
                  className="flex-1 text-xs px-2 py-1.5 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'hsl(var(--foreground))' }}
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Calorii (opțional)"
                  value={mealForm.calories_estimated}
                  onChange={e => setMealForm(f => ({ ...f, calories_estimated: e.target.value }))}
                  className="flex-1 text-xs px-2 py-1.5 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'hsl(var(--foreground))' }}
                />
                <button
                  type="submit"
                  disabled={addingMeal || !mealForm.recipe_title.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)' }}
                >
                  {addingMeal ? '...' : 'Adaugă'}
                </button>
              </div>
            </form>

            {/* 7-day calendar squares */}
            <div>
              <p className="text-xs opacity-40 mb-2">Ultima săptămână</p>
              <div className="flex gap-1">
                {mealByDay.map(({ date, count }) => (
                  <div key={date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full aspect-square rounded-md flex items-center justify-center text-[9px] font-bold"
                      style={{
                        background: count > 0 ? 'rgba(255,77,109,0.4)' : 'rgba(255,255,255,0.04)',
                        border: count > 0 ? '1px solid rgba(255,77,109,0.5)' : '1px solid rgba(255,255,255,0.06)',
                        color: count > 0 ? '#ff4d6d' : 'transparent',
                      }}
                    >
                      {count > 0 ? count : ''}
                    </div>
                    <span className="text-[8px] opacity-30">{date.slice(8)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* ── Sections grid: D + E ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* ── Section D: Fasting ──────────────────────────────────────── */}
          {profile.fasting_protocol && profile.fasting_protocol !== 'none' && (
            <Card title="Fasting" icon="🌙">
              {/* Current status */}
              <div className="flex flex-col items-center gap-3 py-2">
                {fastingActive ? (
                  <>
                    <ProgressRing
                      value={fastingHours}
                      max={parseFloat(profile.fasting_protocol.split(':')[0]) || 16}
                      size={100}
                      strokeWidth={8}
                      color="#a855f7"
                    >
                      <span className="text-lg font-bold" style={{ color: '#a855f7' }}>
                        {fastingHours.toFixed(1)}h
                      </span>
                      <span className="text-[10px] opacity-50">în post</span>
                    </ProgressRing>
                    <div className="text-center">
                      <div className="font-semibold text-sm">Post activ</div>
                      <div className="text-xs opacity-50 mt-0.5">
                        Obiectiv: {fastingProtocolLabel(profile.fasting_protocol)}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-24 h-24 rounded-full flex items-center justify-center text-4xl"
                      style={{ background: 'rgba(168,85,247,0.1)', border: '2px dashed rgba(168,85,247,0.3)' }}>
                      🌙
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-sm">Post inactiv</div>
                      <div className="text-xs opacity-50 mt-0.5">
                        Protocol: {fastingProtocolLabel(profile.fasting_protocol)}
                      </div>
                      {profile.fasting_eating_start && profile.fasting_eating_end && (
                        <div className="text-xs opacity-50">
                          Fereastră: {profile.fasting_eating_start?.slice(0,5)}–{profile.fasting_eating_end?.slice(0,5)}
                        </div>
                      )}
                    </div>
                  </>
                )}

                <button
                  onClick={toggleFasting}
                  className="px-6 py-2.5 rounded-full text-sm font-semibold text-white transition-all"
                  style={{
                    background: fastingActive
                      ? 'rgba(168,85,247,0.3)'
                      : 'linear-gradient(135deg, #a855f7, #7c3aed)',
                    border: fastingActive ? '1px solid #a855f7' : 'none',
                  }}
                >
                  {fastingActive ? 'Termină postul' : 'Începe postul'}
                </button>
              </div>

              {/* 7-day circles */}
              <div>
                <p className="text-xs opacity-40 mb-2">Ultima săptămână</p>
                <div className="flex gap-1.5">
                  {fastByDay.map(({ date, completed, logged }) => (
                    <div key={date} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full aspect-square rounded-full flex items-center justify-center"
                        style={{
                          background: completed
                            ? 'rgba(168,85,247,0.5)'
                            : logged
                              ? 'rgba(168,85,247,0.15)'
                              : 'rgba(255,255,255,0.04)',
                          border: completed
                            ? '1px solid #a855f7'
                            : '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        {completed && <span className="text-[10px]">✓</span>}
                      </div>
                      <span className="text-[8px] opacity-30">{date.slice(8)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* ── Section E: Greutate ──────────────────────────────────────── */}
          <Card title="Greutate" icon="⚖️">
            {/* Current weight display */}
            <div className="flex items-center gap-4">
              <div className="text-3xl font-bold" style={{ color: '#22c55e' }}>
                {latestWeight != null ? `${latestWeight.toFixed(1)} kg` : '— kg'}
              </div>
              {goalWeight != null && latestWeight != null && (
                <div className="flex-1">
                  <div className="text-xs opacity-50 mb-1">
                    {latestWeight.toFixed(1)} kg → {goalWeight} kg țintă ({Math.round(weightProgress * 100)}% parcurs)
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${weightProgress * 100}%`, background: '#22c55e' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Add weight form */}
            <form onSubmit={addWeight} className="flex gap-2">
              <input
                type="text"
                inputMode="decimal"
                placeholder="Ex: 73.5"
                value={weightInput}
                onChange={e => setWeightInput(e.target.value)}
                className="flex-1 text-sm px-3 py-2 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'hsl(var(--foreground))' }}
              />
              <button
                type="submit"
                disabled={addingWeight || !weightInput.trim()}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}
              >
                {addingWeight ? '...' : 'Adaugă'}
              </button>
            </form>

            {/* Line chart */}
            <div>
              <p className="text-xs opacity-40 mb-2">Ultimele 30 de zile</p>
              <WeightLineChart data={weightChartData} />
            </div>
          </Card>
        </div>

        {/* ── Section F: Plan Alimentar AI ──────────────────────────────── */}
        <div className="rounded-2xl p-5 flex flex-col gap-4"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <h2 className="font-semibold text-base" style={{ color: 'hsl(var(--foreground))' }}>Plan Alimentar Personalizat</h2>
          </div>
          <p className="text-sm opacity-60">
            Generează un plan de masă pentru săptămâna curentă sau viitoare bazat pe profilul tău de sănătate, preferințe și rețetele tale favorite.
          </p>

          {/* Hydration checkbox */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => setIncludeHydration(v => !v)}
              className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all"
              style={{
                background: includeHydration ? 'linear-gradient(135deg,#3b82f6,#06b6d4)' : 'rgba(255,255,255,0.06)',
                border: includeHydration ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.15)',
                cursor: 'pointer',
              }}
            >
              {includeHydration && (
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <span className="text-sm" style={{ color: 'hsl(var(--foreground))', opacity: 0.7 }}>💧 Include program de hidratare</span>
          </label>

          {/* Generate buttons */}
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => generateMealPlan('current')}
              disabled={generatingPlan}
              className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)' }}
            >
              {generatingPlan && planWeek === 'current' ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Se generează...
                </span>
              ) : 'Săptămâna curentă'}
            </button>
            <button
              onClick={() => generateMealPlan('next')}
              disabled={generatingPlan}
              className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
              style={{
                background: 'rgba(255,77,109,0.1)',
                border: '1px solid rgba(255,77,109,0.3)',
                color: '#ff4d6d',
              }}
            >
              {generatingPlan && planWeek === 'next' ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Se generează...
                </span>
              ) : 'Săptămâna viitoare'}
            </button>
          </div>

          {/* Error state */}
          {planError && (
            <div className="rounded-xl px-4 py-3 text-sm"
              style={{ background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.3)', color: '#ff4d6d' }}>
              {planError}
            </div>
          )}

          {/* Meal plan result */}
          {mealPlan && (
            <div className="flex flex-col gap-4">
              {/* Summary header */}
              <div className="rounded-xl px-4 py-3 flex flex-col gap-1"
                style={{ background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.2)' }}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-semibold" style={{ color: '#ff9500' }}>
                    {mealPlan.week_start} — {mealPlan.week_end}
                  </span>
                  <span className="text-xs opacity-60">
                    Medie: {mealPlan.weekly_summary.avg_calories} kcal/zi
                  </span>
                </div>
                <p className="text-xs opacity-70">{mealPlan.weekly_summary.notes}</p>
                {mealPlan.weekly_summary.protein_focus && (
                  <p className="text-xs opacity-50">Proteine: {mealPlan.weekly_summary.protein_focus}</p>
                )}
              </div>

              {/* Day cards */}
              {mealPlan.days.map(day => {
                const pct = mealPlan.daily_calorie_target > 0
                  ? Math.min(100, (day.total_calories / mealPlan.daily_calorie_target) * 100)
                  : 0
                const mealIcons: Record<string, string> = {
                  breakfast: '🥐',
                  lunch: '🍽️',
                  dinner: '🍛',
                  snack: '🍎',
                }
                return (
                  <div key={day.date} className="rounded-xl overflow-hidden"
                    style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                    {/* Day header */}
                    <div className="px-4 py-2.5 flex items-center justify-between"
                      style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{day.day}</span>
                        <span className="text-xs opacity-40">{day.date.slice(5)}</span>
                      </div>
                      <span className="text-xs font-semibold" style={{ color: pct > 105 ? '#f59e0b' : pct > 95 ? '#22c55e' : 'hsl(var(--muted-foreground))' }}>
                        {day.total_calories} kcal
                      </span>
                    </div>

                    {/* Calorie progress bar */}
                    <div className="h-1" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: pct > 105 ? '#f59e0b' : 'linear-gradient(90deg,#ff4d6d,#ff9500)',
                        }}
                      />
                    </div>

                    {/* Meals list */}
                    <div className="px-4 py-2 flex flex-col gap-2">
                      {day.meals.map((meal, idx) => (
                        <div key={idx} className="flex items-start gap-3 py-1.5"
                          style={{ borderBottom: idx < day.meals.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                          <span className="text-base flex-shrink-0 mt-0.5">{mealIcons[meal.type] ?? '🍴'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs opacity-40 flex-shrink-0">{meal.time && <span className="font-mono mr-1">{meal.time}</span>}{meal.label}</span>
                              {meal.recipe_id && meal.recipe_slug ? (
                                <Link
                                  href={`/recipes/${meal.recipe_slug}`}
                                  className="text-sm font-medium hover:underline truncate"
                                  style={{ color: '#ff9500' }}
                                >
                                  {meal.recipe_title}
                                </Link>
                              ) : (
                                <span className="text-sm font-medium truncate">{meal.recipe_title}</span>
                              )}
                            </div>
                            {meal.notes && (
                              <p className="text-xs opacity-40 mt-0.5 leading-relaxed">{meal.notes}</p>
                            )}
                          </div>
                          <span className="text-xs opacity-50 flex-shrink-0 mt-0.5 font-mono">{meal.calories} kcal</span>
                        </div>
                      ))}
                    </div>

                    {/* Hydration schedule (if included) */}
                    {day.hydration && Array.isArray(day.hydration) && (
                      <div className="px-4 py-2 flex flex-col gap-1.5" style={{ borderTop: '1px solid rgba(59,130,246,0.15)', background: 'rgba(59,130,246,0.03)' }}>
                        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#3b82f6', opacity: 0.6 }}>💧 Hidratare</span>
                        <div className="flex flex-wrap gap-2">
                          {day.hydration!.map((h, hi) => (
                            <span key={hi} className="text-[10px] px-2 py-1 rounded-full" style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}>
                              {h.time} — {h.amount_ml}ml
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Export button */}
              <button
                onClick={() => downloadICS(mealPlan)}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
                style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', color: '#3b82f6' }}
              >
                📅 Exportă în Calendar (.ics)
              </button>

              {/* Set as meal plan + Print */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => applyToMealPlan(mealPlan)}
                  disabled={applyingPlan}
                  className="py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e' }}
                >
                  {applyingPlan ? (
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Se setează...
                    </span>
                  ) : '🍽️ Setează ca Plan de masă'}
                </button>
                <button
                  onClick={() => window.print()}
                  className="py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
                  style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)', color: '#a855f7' }}
                >
                  🖨️ Printează planul
                </button>
              </div>
              {planApplied && (
                <div className="rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-2"
                  style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e' }}>
                  ✓ Planul a fost setat! Mergi la <Link href="/plan" className="underline">Planul de masă</Link> pentru a-l vedea.
                </div>
              )}

              {/* Disclaimer */}
              <div className="flex items-start gap-2 rounded-xl px-4 py-3"
                style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
                <span className="text-sm flex-shrink-0">⚠️</span>
                <p className="text-xs opacity-60 leading-relaxed">{mealPlan.disclaimer}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Section G: Obiceiuri ─────────────────────────────────────── */}
        <Card title="Obiceiuri — 28 de zile" icon="📅">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,77,109,0.08)' }}>
              <div className="font-bold text-lg" style={{ color: '#ff4d6d' }}>{thisWeekMeals}</div>
              <div className="text-[10px] opacity-50">mese logate<br />săptămâna asta</div>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'rgba(59,130,246,0.08)' }}>
              <div className="font-bold text-lg" style={{ color: '#3b82f6' }}>
                {avgWater >= 1000 ? `${(avgWater / 1000).toFixed(1)}L` : `${Math.round(avgWater)}ml`}
              </div>
              <div className="text-[10px] opacity-50">hidratare<br />medie / zi</div>
            </div>
            {fastingTarget > 0 && (
              <div className="rounded-xl p-3" style={{ background: 'rgba(168,85,247,0.08)' }}>
                <div className="font-bold text-lg" style={{ color: '#a855f7' }}>{fastingCompleted}/{fastingTarget}</div>
                <div className="text-[10px] opacity-50">fasting<br />completat</div>
              </div>
            )}
          </div>

          {/* 28-day grid */}
          <div>
            <p className="text-xs opacity-40 mb-2">Legendă: <span style={{ color: '#22c55e' }}>■</span> toate obiectivele &nbsp; <span style={{ color: '#f59e0b' }}>■</span> parțial &nbsp; <span className="opacity-20">■</span> nimic</p>
            <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {habitGrid.map(({ date, color }) => (
                <div
                  key={date}
                  title={date}
                  className="aspect-square rounded-md"
                  style={{
                    background: color !== 'transparent'
                      ? color === '#22c55e'
                        ? 'rgba(34,197,94,0.4)'
                        : 'rgba(245,158,11,0.4)'
                      : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${color !== 'transparent'
                      ? color === '#22c55e'
                        ? 'rgba(34,197,94,0.5)'
                        : 'rgba(245,158,11,0.4)'
                      : 'rgba(255,255,255,0.06)'
                    }`,
                  }}
                />
              ))}
            </div>
            <div className="flex justify-between text-[9px] opacity-30 mt-1 px-0.5">
              <span>{days28[0].slice(5)}</span>
              <span>{days28[27].slice(5)}</span>
            </div>
          </div>
        </Card>

      </div>
    </main>
  )
}
