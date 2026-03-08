/**
 * Convert a string to a URL-safe slug.
 * Removes non-alphanumeric characters, collapses hyphens, trims leading/trailing hyphens.
 */
export function slugify(input: string, maxLength = 80): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, maxLength)
}
