import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceSupabaseClient } from '@/lib/supabase-server'

export interface RequestUser {
  id: string
  email: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DEFAULT_MOCK_USER_ID = 'a0000000-0000-0000-0000-000000000001'

/**
 * Resolves the current user from either a real Supabase session or the
 * mock-user fallback header (`x-mock-user-id`).
 *
 * API routes pass the full `Request` object here so that the mock header
 * can be read server-side without touching localStorage (which is client-only).
 */
export async function getRequestUser(
  req: Request,
  supabase: SupabaseClient,
): Promise<RequestUser | null> {
  // 1. Try real Supabase session first (cookie-based SSR auth)
  const { data: { user } } = await supabase.auth.getUser()
  if (user) return { id: user.id, email: user.email ?? '' }

  // 1.5. Try Bearer token from Authorization header (for clients using
  //      localStorage sessions, e.g. Google OAuth implicit flow via createBrowserClient)
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    // Use the service client to verify the JWT — it has permission to call
    // auth.getUser(token) regardless of the session context.
    const serviceClient = createServiceSupabaseClient()
    const { data: { user: tokenUser } } = await serviceClient.auth.getUser(token)
    if (tokenUser) return { id: tokenUser.id, email: tokenUser.email ?? '' }
  }

  // 2. Fallback: mock user id sent as a header by the client (DEV ONLY)
  if (process.env.NODE_ENV === 'development') {
    const mockId = req.headers.get('x-mock-user-id')
    if (mockId && mockId !== 'anonymous') {
      // Normalize non-UUID mock ids to the default Chef Anna profile
      const id = UUID_RE.test(mockId) ? mockId : DEFAULT_MOCK_USER_ID
      return { id, email: 'mock@local' }
    }
  }

  return null
}
