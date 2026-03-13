'use client'

import { useIsLoggedIn } from '@/lib/use-auth'
import { ADS_ENABLED } from '@/lib/adsense-config'

interface AdWrapperProps {
  children: React.ReactNode
  /** Optional fallback content shown while auth state is loading */
  fallback?: React.ReactNode
}

/**
 * Conditional ad display wrapper.
 *
 * - Logged-in users: ads are hidden (children not rendered)
 * - Anonymous users: ads are shown (children rendered)
 * - While loading: hidden (avoids ad flash for returning users)
 *
 * Usage:
 * ```tsx
 * <AdWrapper>
 *   <AdBanner placement="recipe-between-ingredients-directions" />
 * </AdWrapper>
 * ```
 */
export default function AdWrapper({ children, fallback = null }: AdWrapperProps) {
  const { isLoggedIn, loading } = useIsLoggedIn()

  // Kill switch — globally disable all ads
  if (!ADS_ENABLED) return null

  // While resolving auth state, suppress ads to avoid flash
  if (loading) return <>{fallback}</>

  // TODO: Re-enable once ad revenue is stable
  // Logged-in users don't see ads
  // if (isLoggedIn) return null

  return <>{children}</>
}
