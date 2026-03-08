"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useParams, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/toast"
import type { ShoppingListItem } from "@/types/meal-plans"

export default function MealPlanShoppingListPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const planId = params.id as string
  const { push } = useToast()

  const [items, setItems] = useState<ShoppingListItem[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [entryCount, setEntryCount] = useState(0)
  const [saving, setSaving] = useState(false)

  // Date range from query params or defaults to this week
  const [fromDate, setFromDate] = useState(searchParams.get("from") || getThisMonday())
  const [toDate, setToDate] = useState(searchParams.get("to") || getThisSunday())

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/meal-plans/${planId}/shopping-list?from=${fromDate}&to=${toDate}`
      )
      if (!res.ok) throw new Error("Fetch failed")
      const data = await res.json()
      setItems(data.items || [])
      setEntryCount(data.entry_count || 0)
      setChecked(new Set())
    } catch {
      push({ message: "Failed to generate shopping list", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [planId, fromDate, toDate, push])

  useEffect(() => { fetchList() }, [fetchList])

  const toggleItem = (name: string) => {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const handlePrint = () => window.print()

  const handleSaveToShoppingLists = async () => {
    setSaving(true)
    try {
      const text = items
        .map(i => {
          const amount = i.amount ? `${formatAmount(i.amount)} ${i.unit}`.trim() : ""
          return amount ? `${i.name} — ${amount}` : i.name
        })
        .join("\n")

      const res = await fetch("/api/shopping-lists/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error("Save failed")
      push({ message: "Saved to shopping lists!", type: "success" })
    } catch {
      push({ message: "Failed to save shopping list", type: "error" })
    } finally {
      setSaving(false)
    }
  }

  const checkedCount = checked.size
  const totalCount = items.length
  const progress = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/me/meal-plans/${planId}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-1 inline-block"
        >
          &larr; Înapoi la Calendar
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          <span role="img" aria-label="cumpărături">&#x1F6D2;</span> Lista de cumpărături
        </h1>
      </div>

      {/* Date Range Selector */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">De la</label>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Până la</label>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <Button size="sm" onClick={fetchList}>
            Generează Lista
          </Button>
        </CardContent>
      </Card>

      {/* Progress */}
      {!loading && items.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-1.5">
            <span>
              {checkedCount} din {totalCount} bifate
            </span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12 text-muted-foreground">
          Se generează lista de cumpărături...
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <div className="text-4xl mb-3">
              <span role="img" aria-label="empty">&#x1F6D2;</span>
            </div>
            <p className="text-muted-foreground">
              {entryCount === 0
                ? "Nicio rețetă în acest interval de dată. Adăugați mai întâi rețete în planul de masă."
                : "Niciun ingredient găsit în rețetele din această perioadă."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Shopping list items — grouped by category */}
      {!loading && items.length > 0 && (() => {
        // Group items by category while preserving sort order
        const groups: { category: string; items: ShoppingListItem[] }[] = []
        let currentCategory = ''
        for (const item of items) {
          const cat = item.category || 'Altele'
          if (cat !== currentCategory) {
            currentCategory = cat
            groups.push({ category: cat, items: [] })
          }
          groups[groups.length - 1].items.push(item)
        }

        return (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {totalCount} ingredient{totalCount !== 1 ? "e" : ""} din{" "}
              {entryCount} rețet{entryCount !== 1 ? "e" : "ă"}
            </div>
            {groups.map(group => (
              <Card key={group.category}>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wide text-primary">
                    {group.category}
                    <span className="text-xs font-normal text-muted-foreground ml-2">
                      ({group.items.length})
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <ul className="divide-y divide-border">
                    {group.items.map(item => {
                      const itemKey = `${item.name}|${item.unit}`
                      const isChecked = checked.has(itemKey)
                      return (
                        <li key={itemKey} className="py-2.5">
                          <label className="flex items-start gap-3 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleItem(itemKey)}
                              className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-ring shrink-0"
                            />
                            <div className={`flex-1 min-w-0 transition-opacity ${isChecked ? "opacity-40" : ""}`}>
                              <div className="flex items-baseline gap-2">
                                <span
                                  className={`text-sm font-medium ${
                                    isChecked
                                      ? "line-through text-muted-foreground"
                                      : "text-foreground"
                                  }`}
                                >
                                  {item.name}
                                </span>
                                {item.amount > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    {formatAmount(item.amount)}{" "}
                                    {item.unit}
                                  </span>
                                )}
                              </div>
                              {item.recipe_titles.length > 0 && (
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  {item.recipe_titles.join(", ")}
                                </div>
                              )}
                            </div>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      })()}

      {/* Actions */}
      {!loading && items.length > 0 && (
        <div className="flex gap-2 mt-6 print:hidden">
          <Button variant="outline" onClick={handlePrint}>
            <span role="img" aria-label="tipărire" className="mr-1.5">&#x1F5A8;</span>
            Tipărește
          </Button>
          <Button onClick={handleSaveToShoppingLists} disabled={saving}>
            {saving ? "Se salvează..." : "Salvează în Listele de cumpărături"}
          </Button>
        </div>
      )}
    </main>
  )
}

// ── Helpers ──
function formatAmount(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(2).replace(/\.?0+$/, "")
}

function getThisMonday(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().slice(0, 10)
}

function getThisSunday(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? 0 : 7)
  d.setDate(diff)
  return d.toISOString().slice(0, 10)
}
