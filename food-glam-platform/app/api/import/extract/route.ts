import { NextResponse } from 'next/server'
import { fetchAndExtractJsonLd } from '@/lib/jsonld'
import { rateLimit } from '@/lib/rate-limit'

/**
 * POST /api/import/extract
 * 
 * Extract recipe data from a URL using JSON-LD or site-specific extractors.
 * 
 * Body:
 *   { url: string }
 * 
 * Response:
 *   { recipes: Recipe[] } or { error: string }
 */
export async function POST(req: Request) {
  try {
    // Rate limit: 10 extractions per hour per IP
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    const { success } = rateLimit(`import:extract:${ip}`, 10, 60 * 60 * 1000)
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await req.json()
    const { url } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Validate URL format
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    // Require HTTPS
    if (parsedUrl.protocol !== 'https:') {
      return NextResponse.json({ error: 'Only HTTPS URLs are allowed' }, { status: 400 })
    }

    // Block local/private URLs for security (SSRF prevention)
    const hostname = parsedUrl.hostname.toLowerCase()
    const isPrivateIP = (h: string) => {
      if (h === 'localhost' || h.endsWith('.local') || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0') return true
      if (h.includes(':')) return true // IPv6
      const parts = h.split('.').map(Number)
      if (parts.length !== 4 || parts.some(isNaN)) return false
      // 10.0.0.0/8
      if (parts[0] === 10) return true
      // 172.16.0.0/12
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
      // 192.168.0.0/16
      if (parts[0] === 192 && parts[1] === 168) return true
      // 169.254.0.0/16 (link-local)
      if (parts[0] === 169 && parts[1] === 254) return true
      return false
    }
    if (isPrivateIP(hostname)) {
      return NextResponse.json({ error: 'Cannot import from local or private URLs' }, { status: 400 })
    }

    // Extract recipe data
    const recipes = await fetchAndExtractJsonLd(url)

    if (!recipes || recipes.length === 0) {
      return NextResponse.json({ 
        error: 'No recipe data found at this URL. Please check the URL or try a different recipe site.' 
      }, { status: 404 })
    }

    return NextResponse.json({ recipes })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Recipe extraction error:', message)
    
    // Return user-friendly error
    if (message.includes('Fetch failed') || message.includes('timeout')) {
      return NextResponse.json({ 
        error: 'Failed to fetch the URL. The site may be down or blocking requests.' 
      }, { status: 500 })
    }
    
    return NextResponse.json({ error: 'Failed to extract recipe data' }, { status: 500 })
  }
}
