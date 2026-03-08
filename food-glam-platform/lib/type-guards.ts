/* ── Content moderation type guards ─────────────────────────── */

export const ALLOWED_ENTITY_TYPES = ['post', 'thread', 'reply', 'profile'] as const
export const ALLOWED_CATEGORIES = ['spam', 'hate', 'harassment', 'copyright', 'misinfo', 'other'] as const

export type EntityType = typeof ALLOWED_ENTITY_TYPES[number]
export type ReportCategory = typeof ALLOWED_CATEGORIES[number]

export function isEntityType(v: unknown): v is EntityType {
  return typeof v === 'string' && (ALLOWED_ENTITY_TYPES as readonly string[]).includes(v)
}

export function isReportCategory(v: unknown): v is ReportCategory {
  return typeof v === 'string' && (ALLOWED_CATEGORIES as readonly string[]).includes(v)
}
