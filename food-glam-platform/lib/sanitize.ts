import DOMPurify from 'dompurify'

/**
 * Sanitizes text by stripping all HTML tags using DOMPurify.
 * Returns plain text safe for rendering.
 */
export function sanitizeText(input: string): string {
  if (!input) return ''
  // Strip all HTML tags, leaving only text content
  const cleaned = DOMPurify.sanitize(input, { ALLOWED_TAGS: [] })
  return cleaned
}

/**
 * Validates if a URL uses http:// or https:// protocol.
 * Returns true only for safe protocols, false otherwise.
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Sanitizes a URL by validating its protocol.
 * Returns the URL if valid (http/https), '#' otherwise.
 * Safe to use in href and src attributes.
 */
export function sanitizeUrl(url: string): string {
  if (isValidUrl(url)) return url
  return '#'
}
