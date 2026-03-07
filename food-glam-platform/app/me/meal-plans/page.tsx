"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import type { MealPlan, MealsData } from "@/types/meal-plans"

export default function MealPlansListPage() {
  const { push } = useToast()
  const [plans, setPlans] = useState<MealPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newStartDate, setNewStartDate] = useState("")
  const [newEndDate, setNewEndDate] = useState("")
  const [creating, setCreating] = useState(false)

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch("/api/meal-plans")
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setPlans(data)
    } catch {
      push({ message: "Failed to load meal plans", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [push])

  useEffect(() => { fetchPlans() }, [fetchPlans])

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const res = await fetch("/api/meal-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          start_date: newStartDate || undefined,
          end_date: newEndDate || undefined,
        }),
      })
      if (!res.ok) throw new Error("Create failed")
      push({ message: "Meal plan created!", type: "success" })
      setNewTitle("")
      setNewStartDate("")
      setNewEndDate("")
      setShowCreate(false)
      fetchPlans()
    } catch {
      push({ message: "Failed to create meal plan", type: "error" })
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch("/api/meal-plans", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error("Delete failed")
      push({ message: "Meal plan deleted", type: "success" })
      fetchPlans()
    } catch {
      push({ message: "Failed to delete", type: "error" })
    }
  }

  const getEntryCount = (plan: MealPlan): number => {
    const meals = plan.meals as MealsData | null
    return meals?.entries?.length || 0
  }

  const getDateRange = (plan: MealPlan): string => {
    const meals = plan.meals as MealsData | null
    const meta = meals?._meta
    if (meta?.start_date && meta?.end_date) {
      return `${formatDate(meta.start_date)} — ${formatDate(meta.end_date)}`
    }
    if (meta?.start_date) return `De la ${formatDate(meta.start_date)}`
    return "Nicio dată setată"
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Meal Plans
          </h1>
          <p className="text-muted-foreground mt-1">
            Plan your week, generate shopping lists
          </p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "Anulează" : "+ Nou Plan"}
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card className="mb-8 border-dashed border-2 border-primary/30 bg-primary/[0.02]">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-foreground">
                  Numele Planului
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g., Week 1 — Mediterranean"
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  onKeyDown={e => e.key === "Enter" && handleCreate()}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-sm font-medium mb-1.5 text-foreground">
                     Data de început
                   </label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={e => setNewStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                 <div>
                   <label className="block text-sm font-medium mb-1.5 text-foreground">
                     Data de încheiere
                   </label>
                  <input
                    type="date"
                    value={newEndDate}
                    onChange={e => setNewEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
               <Button onClick={handleCreate} disabled={creating || !newTitle.trim()}>
                 {creating ? "Se creează..." : "Creați Plan de Masă"}
               </Button>
            </div>
          </CardContent>
        </Card>
      )}

       {/* Loading */}
       {loading && (
         <div className="flex items-center justify-center py-20">
           <div className="animate-pulse text-muted-foreground">Se încarcă planurile de masă...</div>
         </div>
       )}

      {/* Empty state */}
      {!loading && plans.length === 0 && (
        <Card className="text-center py-16">
          <CardContent>
            <div className="text-5xl mb-4">
              <span role="img" aria-label="calendar">&#x1F4C5;</span>
            </div>
            <h2 className="text-xl font-semibold mb-2">Creați-vă primul plan de masă</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Organizați mesele zilei de luni până duminică, adăugați rețete în fiecare zi și generați
              liste de cumpărături în mod automat.
            </p>
            <Button onClick={() => setShowCreate(true)}>+ Nou Plan</Button>
          </CardContent>
        </Card>
      )}

      {/* Plans grid */}
      {!loading && plans.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map(plan => (
            <Link key={plan.id} href={`/me/meal-plans/${plan.id}`} className="group">
              <Card className="h-full transition-all duration-200 hover:shadow-md hover:border-primary/40 group-hover:-translate-y-0.5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg leading-tight line-clamp-2">
                    {plan.title}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {getDateRange(plan)}
                  </p>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                       <span role="img" aria-label="rețete">&#x1F372;</span>
                       {getEntryCount(plan)} rețet{getEntryCount(plan) !== 1 ? "e" : "ă"}
                     </span>
                     {plan.created_at && (
                       <span>
                         Creat {formatDate(plan.created_at.slice(0, 10))}
                       </span>
                     )}
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={e => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleDelete(plan.id)
                    }}
                   >
                     Șterge
                   </Button>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso + "T00:00:00")
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  } catch {
    return iso
  }
}
