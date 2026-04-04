'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function SignInPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Reset loading state when page mounts (e.g. user navigated back)
  useEffect(() => {
    setLoading(false)
  }, [])

  // Check if already logged in — redirect to home
  useEffect(() => {
    const checkSession = async () => {
      try {
        const backup = localStorage.getItem('marechef-session')
        if (backup) {
          const parsed = JSON.parse(backup)
          if (parsed?.access_token) {
            router.replace('/')
            return
          }
        }
      } catch {}
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          // Persist to marechef-session for other pages
          try {
            localStorage.setItem('marechef-session', JSON.stringify({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
              user: { id: session.user.id, email: session.user.email, user_metadata: session.user.user_metadata }
            }))
          } catch {}
          router.replace('/')
        }
      } catch {}
    }
    checkSession()
  }, [router, supabase])

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true)
      setError(null)

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) throw error
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Autentificare eșuată'
      setError(message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'hsl(var(--background))' }}>
      <div className="max-w-md w-full mx-4">
        <div className="rounded-2xl shadow-xl p-8" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
          <div className="text-center mb-8">
             <div className="text-4xl mb-3">👨‍🍳</div>
             <h1 className="text-3xl font-bold mb-2" style={{ color: 'hsl(var(--foreground))' }}>Bine ai venit!</h1>
             <p style={{ color: 'hsl(var(--muted-foreground))' }}>Autentifică-te pentru a salva rețete, planifica mese și multe altele</p>
           </div>

          {error && (
            <div className="mb-6 p-4 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-lg hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'hsl(var(--card))', border: '2px solid hsl(var(--border))' }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span className="font-medium" style={{ color: 'hsl(var(--foreground))' }}>
               {loading ? 'Se redirecționează...' : 'Continuă cu Google'}
             </span>
          </button>

           <p className="mt-6 text-center text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
             Prin autentificare, ești de acord cu <a href="/terms" className="underline">Termenii și Condițiile</a> și <a href="/privacy" className="underline">Politica de Confidențialitate</a>
           </p>
        </div>
      </div>
    </div>
  )
}
