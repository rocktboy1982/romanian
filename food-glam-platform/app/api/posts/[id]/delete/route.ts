import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { deleteContent, canDeleteContent } from '@/lib/content-deletion'
import { apiSuccess, apiError } from '@/lib/api-response'

// POST /api/posts/[id]/delete
// Using POST instead of DELETE because:
// - Can send JSON body (reason field)
// - Works better with CSRF protection
// - Next.js dynamic route params work more reliably
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // 1. Authenticate
  const auth = await requireAuth(req)
  if (auth.error) return auth.error

  // 2. Parse optional body (reason for deletion)
  let reason: string | undefined
  try {
    const body = await req.json()
    reason = body.reason?.trim()?.slice(0, 500) // Sanitize & limit length
  } catch {
    // No body is fine
  }

  // 3. Extract security context
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const userAgent = req.headers.get('user-agent')?.slice(0, 500) || 'unknown'

  // 4. Call the secure deletion service
  const result = await deleteContent({
    entityType: 'post', // The route determines it's a post
    entityId: id,
    user: auth.user!,
    supabase: auth.supabase!,
    reason,
    ipAddress,
    userAgent,
  })

  if (!result.success) {
    return apiError(result.error!, result.statusCode)
  }

  return apiSuccess({ ok: true, message: 'Conținutul a fost șters cu succes' })
}

// GET /api/posts/[id]/delete
// Check if the current user can delete this post (for UI)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const auth = await requireAuth(req)
  if (auth.error) return apiSuccess({ canDelete: false })

  const result = await canDeleteContent(id, auth.user!.id, auth.supabase!)
  return apiSuccess(result)
}
