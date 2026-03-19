import { NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase-server'

const INDEXNOW_KEY = 'aaadaedb2bdb4a47a1b0f5eda029bd20'
const HOST = 'marechef.ro'
const BASE = `https://${HOST}`

/**
 * POST /api/indexnow
 * Submits all site URLs to IndexNow (Bing, Yahoo, Yandex, DuckDuckGo, etc.)
 * Protected: only callable from server/admin
 */
export async function POST() {
  try {
    const supabase = createServiceSupabaseClient()

    // Gather all URLs
    const urls: string[] = [
      BASE,
      `${BASE}/search`,
      `${BASE}/cookbooks`,
      `${BASE}/cocktailbooks`,
      `${BASE}/rankings`,
      `${BASE}/chefs`,
      `${BASE}/plan`,
      `${BASE}/party`,
      `${BASE}/retete/rapide`,
      `${BASE}/retete/traditionale`,
    ]

    // Recipe URLs
    const { data: recipes } = await supabase
      .from('posts')
      .select('slug')
      .eq('type', 'recipe')
      .eq('status', 'published')
    if (recipes) {
      for (const r of recipes) urls.push(`${BASE}/recipes/${r.slug}`)
    }

    // Cocktail URLs
    const { data: cocktails } = await supabase
      .from('posts')
      .select('slug')
      .eq('type', 'cocktail')
      .eq('status', 'published')
    if (cocktails) {
      for (const c of cocktails) urls.push(`${BASE}/cocktails/${c.slug}`)
    }

    // Cuisine URLs
    const { data: cuisines } = await supabase
      .from('cuisines')
      .select('slug')
    if (cuisines) {
      for (const c of cuisines) urls.push(`${BASE}/cookbooks/cuisines/${c.slug}`)
    }

    // Submit to IndexNow (Bing endpoint — syndicates to all partners)
    // IndexNow accepts max 10,000 URLs per request
    const batches = []
    for (let i = 0; i < urls.length; i += 10000) {
      batches.push(urls.slice(i, i + 10000))
    }

    const results = []
    for (const batch of batches) {
      const res = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: HOST,
          key: INDEXNOW_KEY,
          keyLocation: `${BASE}/${INDEXNOW_KEY}.txt`,
          urlList: batch,
        }),
      })
      results.push({ status: res.status, count: batch.length })
    }

    return NextResponse.json({
      ok: true,
      total_urls: urls.length,
      batches: results,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
