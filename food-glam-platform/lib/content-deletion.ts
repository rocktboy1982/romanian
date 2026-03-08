import type { SupabaseClient } from '@supabase/supabase-js'
import type { RequestUser } from './get-user'
import { rateLimit } from './rate-limit'

export interface DeleteContentOptions {
  entityType: 'post' | 'recipe' | 'cocktail' | 'thread' | 'reply'
  entityId: string
  user: RequestUser
  supabase: SupabaseClient
  reason?: string
  ipAddress?: string
  userAgent?: string
}

export interface DeleteResult {
  success: boolean
  error?: string
  statusCode: number
}

/**
 * Securely delete user-owned content with full audit trail.
 * Uses soft-delete (status='deleted') so content can be recovered within 30 days.
 *
 * Security checks performed:
 * 1. User must be authenticated (caller's responsibility — verified before calling)
 * 2. Entity must exist
 * 3. User must own the entity (created_by === user.id)
 * 4. Entity must not already be deleted
 * 5. Rate limiting (max 10 deletions per hour per user)
 * 6. Audit log entry created
 * 7. Related data cleaned up (collection_items referencing this post)
 */
export async function deleteContent(options: DeleteContentOptions): Promise<DeleteResult> {
  const { entityType, entityId, user, supabase, reason, ipAddress, userAgent } = options

  // 1. Validate entityId is a valid UUID format (prevent SQL injection via malformed IDs)
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(entityId)) {
    return { success: false, error: 'Invalid entity ID format', statusCode: 400 }
  }

  // 2. Rate limit: max 10 deletions per hour per user
  const rateLimitResult = rateLimit(`delete:${user.id}`, 10, 60 * 60 * 1000)
  if (!rateLimitResult.success) {
    return { success: false, error: 'Too many deletions. Please try again later.', statusCode: 429 }
  }

  // 3. Fetch the entity to verify it exists and check ownership
  const { data: entity, error: fetchError } = await supabase
    .from('posts')
    .select('id, created_by, title, slug, status')
    .eq('id', entityId)
    .single()

  if (fetchError || !entity) {
    return { success: false, error: 'Post not found', statusCode: 404 }
  }

  // Verify ownership
  if (entity.created_by !== user.id) {
    return { success: false, error: 'You do not have permission to delete this post', statusCode: 403 }
  }

  // Verify not already deleted
  if (entity.status === 'deleted') {
    return { success: false, error: 'This post has already been deleted', statusCode: 400 }
  }

  // 4. Create a snapshot of the content before deletion (for audit/recovery)
  const snapshot = {
    title: entity.title,
    slug: entity.slug,
    status: entity.status,
  }

  // 5. Soft-delete: UPDATE posts SET status = 'deleted', updated_at = NOW() WHERE id = entityId
  const { error: deleteError } = await supabase
    .from('posts')
    .update({ status: 'deleted', updated_at: new Date().toISOString() })
    .eq('id', entityId)

  if (deleteError) {
    return { success: false, error: 'Failed to delete post', statusCode: 500 }
  }

  // 6. Clean up related data:
  //    - DELETE FROM collection_items WHERE post_id = entityId
  const { error: cleanupError } = await supabase
    .from('collection_items')
    .delete()
    .eq('post_id', entityId)

  if (cleanupError) {
    console.error('Failed to clean up collection_items:', cleanupError)
    // Don't fail the deletion if cleanup fails, just log it
  }

  // 7. Insert audit log entry into content_deletions table
  const { error: auditError } = await supabase
    .from('content_deletions')
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      entity_title: entity.title,
      entity_slug: entity.slug,
      deleted_by: user.id,
      deletion_type: 'soft',
      reason: reason || null,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      snapshot,
      created_at: new Date().toISOString(),
    })

  if (auditError) {
    console.error('Failed to create audit log:', auditError)
    // Don't fail the deletion if audit log fails, just log it
  }

  // 8. Return success
  return { success: true, statusCode: 200 }
}

/**
 * Check if a user can delete a specific piece of content.
 * Useful for UI to show/hide delete buttons without making the full delete call.
 */
export async function canDeleteContent(
  entityId: string,
  userId: string,
  supabase: SupabaseClient
): Promise<{ canDelete: boolean; reason?: string }> {
  // Validate entityId is a valid UUID format
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(entityId)) {
    return { canDelete: false, reason: 'Invalid entity ID format' }
  }

  // Check: entity exists, user owns it, entity not already deleted
  const { data: entity, error } = await supabase
    .from('posts')
    .select('id, created_by, status')
    .eq('id', entityId)
    .single()

  if (error || !entity) {
    return { canDelete: false, reason: 'Post not found' }
  }

  if (entity.created_by !== userId) {
    return { canDelete: false, reason: 'You do not own this post' }
  }

  if (entity.status === 'deleted') {
    return { canDelete: false, reason: 'This post has already been deleted' }
  }

  return { canDelete: true }
}

/**
 * Admin force-delete (hard or soft) with moderation audit.
 * Only accessible to admin/moderator roles.
 */
export async function adminDeleteContent(
  options: DeleteContentOptions & { hard?: boolean }
): Promise<DeleteResult> {
  const { entityType, entityId, user, supabase, reason, ipAddress, userAgent, hard } = options

  // Validate entityId is a valid UUID format
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(entityId)) {
    return { success: false, error: 'Invalid entity ID format', statusCode: 400 }
  }

  // Check admin/moderator role
  const { data: roles } = await supabase
    .from('app_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['admin', 'moderator'])
    .limit(1)

  if (!roles || roles.length === 0) {
    return { success: false, error: 'Admin or moderator access required', statusCode: 403 }
  }

  // Fetch the entity to verify it exists
  const { data: entity, error: fetchError } = await supabase
    .from('posts')
    .select('id, created_by, title, slug, status')
    .eq('id', entityId)
    .single()

  if (fetchError || !entity) {
    return { success: false, error: 'Post not found', statusCode: 404 }
  }

  // Create a snapshot of the content before deletion
  const snapshot = {
    title: entity.title,
    slug: entity.slug,
    status: entity.status,
  }

  // Perform deletion (soft or hard)
  let deleteError
  if (hard) {
    // Hard delete: DELETE FROM posts WHERE id = entityId
    const result = await supabase
      .from('posts')
      .delete()
      .eq('id', entityId)
    deleteError = result.error
  } else {
    // Soft delete: UPDATE posts SET status = 'deleted'
    const result = await supabase
      .from('posts')
      .update({ status: 'deleted', updated_at: new Date().toISOString() })
      .eq('id', entityId)
    deleteError = result.error
  }

  if (deleteError) {
    return { success: false, error: 'Failed to delete post', statusCode: 500 }
  }

  // Clean up related data if soft delete
  if (!hard) {
    const { error: cleanupError } = await supabase
      .from('collection_items')
      .delete()
      .eq('post_id', entityId)

    if (cleanupError) {
      console.error('Failed to clean up collection_items:', cleanupError)
    }
  }

  // Insert audit log entry
  const { error: auditError } = await supabase
    .from('content_deletions')
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      entity_title: entity.title,
      entity_slug: entity.slug,
      deleted_by: user.id,
      deletion_type: hard ? 'hard' : 'soft',
      reason: reason || null,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      snapshot,
      created_at: new Date().toISOString(),
    })

  if (auditError) {
    console.error('Failed to create audit log:', auditError)
  }

  return { success: true, statusCode: 200 }
}
