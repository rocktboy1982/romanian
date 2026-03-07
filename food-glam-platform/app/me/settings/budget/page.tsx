'use client'

import React, { useState } from 'react'
import Link from 'next/link'

export default function BudgetSettingsPage() {
  const [weeklyBudget, setWeeklyBudget] = useState(500)
  const [currency, setCurrency] = useState('USD')
  const [showAlerts, setShowAlerts] = useState(true)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    // In production this would persist to the server
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6">
        <Link
          href="/me"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Înapoi la profil
        </Link>
      </div>

      <h1 className="text-2xl font-bold tracking-tight mb-1">Setări Buget</h1>
      <p className="text-muted-foreground text-sm mb-8">
        Setați-vă bugetul săptămânal de cumpărături și planificare a meselor.
      </p>

      <div className="space-y-6">
        {/* Weekly Budget */}
        <div className="rounded-xl border border-border bg-card p-6">
          <label className="block text-sm font-medium mb-2" htmlFor="budget">
             Obiectiv Buget Săptămânal
           </label>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">{currency}</span>
            <input
              id="budget"
              type="number"
              min={0}
              step={10}
              value={weeklyBudget}
              onChange={(e) => setWeeklyBudget(parseFloat(e.target.value) || 0)}
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
           <p className="mt-2 text-xs text-muted-foreground">
             Vă vom alerta când planul de masă depășește această sumă.
           </p>
        </div>

        {/* Currency */}
        <div className="rounded-xl border border-border bg-card p-6">
          <label className="block text-sm font-medium mb-2" htmlFor="currency">
             Monedă
           </label>
          <select
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="USD">USD — Dolar SUA</option>
             <option value="EUR">EUR — Euro</option>
             <option value="GBP">GBP — Liră Sterlină</option>
             <option value="RON">RON — Leu Român</option>
          </select>
        </div>

        {/* Alerts */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Alerturi Buget</p>
               <p className="text-xs text-muted-foreground mt-0.5">
                 Anunță-mă când sunt aproape sau depășesc bugetul
               </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={showAlerts}
              onClick={() => setShowAlerts(!showAlerts)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
                showAlerts ? 'bg-amber-500' : 'bg-stone-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  showAlerts ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            className="px-6 py-2 rounded-lg bg-amber-500 text-white font-medium text-sm hover:bg-amber-600 transition-colors"
           >
             {saved ? 'Salvat ✓' : 'Salvează Setări'}
           </button>
          <Link
            href="/me"
            className="px-6 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
           >
             Anulează
           </Link>
        </div>
      </div>
    </main>
  )
}
