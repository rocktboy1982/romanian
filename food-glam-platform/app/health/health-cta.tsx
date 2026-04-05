'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function HealthCTA() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)

  useEffect(() => {
    try {
      const session = localStorage.getItem('marechef-session')
      if (session) {
        const parsed = JSON.parse(session)
        setIsLoggedIn(!!parsed?.access_token)
      } else {
        setIsLoggedIn(false)
      }
    } catch {
      setIsLoggedIn(false)
    }
  }, [])

  // Still checking — show nothing
  if (isLoggedIn === null) return null

  // Logged in — show profile completion prompt
  if (isLoggedIn) {
    return (
      <div className="text-center mb-8">
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xl mx-auto mb-4">
          Completează-ți profilul de sănătate pentru a primi recomandări personalizate și planuri de mese adaptate nevoilor tale.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            href="/me"
            className="px-6 py-3 rounded-xl font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-colors"
          >
            Completează profilul de sănătate
          </Link>
          <Link
            href="/blog/fasting-intermitent"
            className="px-6 py-3 rounded-xl font-semibold text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
          >
            Citește despre fasting
          </Link>
        </div>
      </div>
    )
  }

  // Not logged in — show auth CTA + steps
  return (
    <div className="text-center mb-8">
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xl mx-auto mb-4">
        Pentru a accesa tabloul de bord complet, urmează acești pași:
      </p>
      <div className="flex flex-col items-center gap-3 mb-6 max-w-md mx-auto text-left">
        <div className="flex items-start gap-3 w-full">
          <span className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
          <span className="text-sm text-gray-600 dark:text-gray-400">Creează un cont gratuit cu Google</span>
        </div>
        <div className="flex items-start gap-3 w-full">
          <span className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
          <span className="text-sm text-gray-600 dark:text-gray-400">Completează profilul de sănătate (vârstă, greutate, alergii, preferințe)</span>
        </div>
        <div className="flex items-start gap-3 w-full">
          <span className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
          <span className="text-sm text-gray-600 dark:text-gray-400">Primești planuri de mese personalizate generate cu AI</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 justify-center">
        <Link
          href="/auth/signin"
          className="px-6 py-3 rounded-xl font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-colors"
        >
          Creează cont gratuit
        </Link>
        <Link
          href="/blog/dieta-mediteraneana"
          className="px-6 py-3 rounded-xl font-semibold text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
        >
          Citește despre diete
        </Link>
      </div>
    </div>
  )
}
