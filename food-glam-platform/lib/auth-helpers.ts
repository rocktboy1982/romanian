import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceSupabaseClient } from './supabase-server'
import { getRequestUser, type RequestUser } from './get-user'

export interface AuthResult {
  user: RequestUser | null
  error: NextResponse | null
  supabase?: SupabaseClient
}

/**
 * Verify that the request has a valid authenticated user
 * @param req - The incoming request
 * @returns { user, error, supabase } - User object if authenticated, error response if not
 */
export async function requireAuth(req: Request): Promise<AuthResult> {
  const supabase = createServiceSupabaseClient()
  const user = await getRequestUser(req, supabase)

  if (!user) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ),
    }
  }

  return { user, error: null, supabase }
}

/**
 * Verify that the request has a valid admin user
 * @param req - The incoming request
 * @returns { user, error, supabase } - User object if admin, error response if not
 */
export async function requireAdmin(req: Request): Promise<AuthResult> {
  const result = await requireAuth(req)
  if (result.error) return result

  const { data: roles } = await result.supabase!
    .from('app_roles')
    .select('role')
    .eq('user_id', result.user!.id)
    .eq('role', 'admin')
    .limit(1)

  if (!roles || roles.length === 0) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      ),
    }
  }

  return result
}

/**
 * Verify that the request has a valid moderator or admin user
 * @param req - The incoming request
 * @returns { user, error, supabase } - User object if moderator/admin, error response if not
 */
export async function requireModerator(req: Request): Promise<AuthResult> {
  const result = await requireAuth(req)
  if (result.error) return result

  const { data: roles } = await result.supabase!
    .from('app_roles')
    .select('role')
    .eq('user_id', result.user!.id)
    .in('role', ['moderator', 'admin'])
    .limit(1)

  if (!roles || roles.length === 0) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Moderator access required' },
        { status: 403 }
      ),
    }
  }

  return result
}
