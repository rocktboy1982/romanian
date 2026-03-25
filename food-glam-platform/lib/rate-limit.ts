/**
 * Simple in-memory sliding window rate limiter
 * For production, replace with Redis-backed (@upstash/ratelimit)
 */

import { ADMIN_EMAILS } from '@/lib/require-admin'

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

/**
 * Check if a request should be allowed based on rate limit.
 * Admin emails are always allowed (no rate limit).
 * @param key - Unique identifier (e.g., "submit:192.168.1.1")
 * @param limit - Maximum requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @param email - Optional user email — admins bypass rate limit
 * @returns { success: boolean; remaining: number }
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  email?: string | null
): { success: boolean; remaining: number } {
  // Admins bypass rate limits
  if (email && ADMIN_EMAILS.includes(email)) {
    return { success: true, remaining: 9999 }
  }

  const now = Date.now()
  const entry = store.get(key)

  // New entry or window expired
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: limit - 1 }
  }

  // Limit exceeded
  if (entry.count >= limit) {
    return { success: false, remaining: 0 }
  }

  // Increment and allow
  entry.count++
  return { success: true, remaining: limit - entry.count }
}

/**
 * Periodic cleanup of expired entries (prevent memory leak)
 * Runs every 60 seconds
 */
setInterval(() => {
  const now = Date.now()
  const keysToDelete: string[] = []
  store.forEach((entry, key) => {
    if (now > entry.resetAt) {
      keysToDelete.push(key)
    }
  })
  keysToDelete.forEach(key => store.delete(key))
}, 60_000)
