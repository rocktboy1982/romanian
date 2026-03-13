'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase-client'

export type UserTier = 'free' | 'pro'

/**
 * Determines the current user's subscription tier.
 *
 * Pro access is granted when:
 *   1. User has an admin role in app_roles table, OR
 *   2. localStorage mock_user.isPro === true (dev override)
 *
 * Free tier:  manual meal planning, recipe browsing, shopping lists
 * Pro tier:   smart shopping list generation, AI meal suggestions,
 *             ingredient scan, grocery matching
 *
 * When real payments are wired, check subscription status from the DB
 * instead of the admin role fallback.
 */
export function useUserTier(): { tier: UserTier; isPro: boolean; loading: boolean } {
  const [isPro, setIsPro] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function checkTier() {
      try {
        // Check localStorage dev override first
        const raw = localStorage.getItem('mock_user')
        if (raw) {
          const user = JSON.parse(raw) as { isPro?: boolean }
          if (user.isPro === true) {
            if (mounted) { setIsPro(true); setLoading(false) }
            return
          }
        }

        // Check if authenticated user is admin → grant Pro
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: role } = await supabase
            .from('app_roles')
            .select('role')
            .eq('user_id', user.id)
            .eq('role', 'admin')
            .maybeSingle()

          if (mounted && role) {
            setIsPro(true)
          }
        }
      } catch {
        // ignore errors — default to free
      } finally {
        if (mounted) setLoading(false)
      }
    }

    checkTier()
    return () => { mounted = false }
  }, [])

  return { tier: isPro ? 'pro' : 'free', isPro, loading }
}
