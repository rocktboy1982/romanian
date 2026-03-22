'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { User } from '@supabase/supabase-js'

export default function Header() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-amber-600 hover:text-amber-700 transition-colors">
            MareChef.ro
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link href="/search" className="text-gray-700 hover:text-amber-600 transition-colors font-medium">
              Discover
            </Link>
            <Link href="/me/meal-plans" className="text-gray-700 hover:text-amber-600 transition-colors font-medium">
              Plan de masă
            </Link>
             <Link href="/me/cookbook" className="text-gray-700 hover:text-amber-600 transition-colors font-medium">
               Carte de rețete
             </Link>
            <Link href="/submit/recipe" className="text-gray-700 hover:text-amber-600 transition-colors font-medium">
              Adaugă rețetă
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            {!loading && (
              <>
                {user ? (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">
                      {user.user_metadata?.full_name || user.email}
                    </span>
                    <button
                      onClick={handleSignOut}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <Link
                    href="/auth/signin"
                    className="px-6 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
                  >
                    Sign In
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
