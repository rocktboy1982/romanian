/**
 * Relative time display in Romanian.
 * e.g. "acum 5m", "acum 3h", "acum 2z"
 */
export function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `acum ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `acum ${hours}h`
  const days = Math.floor(hours / 24)
  return `acum ${days}z`
}
