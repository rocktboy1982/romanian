import { createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser, RequestUser } from '@/lib/get-user'

/**
 * Hard-coded admin email list. Users with these emails always get admin access.
 */
export const ADMIN_EMAILS = ['iancu1982@gmail.com']

/**
 * Resolves admin access. Checks:
 * 1. Email is in ADMIN_EMAILS list (always allowed)
 * 2. app_roles entry ('admin' or 'moderator')
 * 3. profiles.is_moderator = true
 * The check is identical in all environments — no dev bypass.
 */
export async function requireAdmin(req: Request): Promise<RequestUser | null> {
  const supabase = createServiceSupabaseClient()
  const user = await getRequestUser(req, supabase)
  if (!user) return null

  // Always allow if email is in admin list
  if (ADMIN_EMAILS.includes(user.email)) return user

  // Check app_roles table first
  const { data: roles } = await supabase
    .from('app_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['admin', 'moderator'])
    .limit(1)
  if (roles && roles.length > 0) return user

  // Production fallback: check profiles.is_moderator
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_moderator')
    .eq('id', user.id)
    .single()
  if (profile?.is_moderator) return user

  return null
}
