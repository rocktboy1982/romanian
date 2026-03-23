import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'
import { resolveIngredientName } from '@/lib/ingredient-aliases'

/**
 * GET /api/search/by-inventory?category=pantry|bar&sort=closest|perfect|fewest&limit=20
 *
 * Searches recipes (category=pantry) or cocktails (category=bar)
 * that can be made with the user's inventory items.
 */

const STAPLES = new Set([
  'olive oil', 'oil', 'salt', 'pepper', 'black pepper', 'water', 'sugar',
  'flour', 'garlic', 'onion', 'butter', 'vegetable oil', 'eggs', 'egg',
  'ice', 'ice cubes', 'lemon', 'lime',
])

function normalise(s: string): string {
  return s.toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/,.*$/, '')
    .replace(/\b(fresh|frozen|dried|chopped|diced|minced|sliced|grated|proaspăt|congelat|tocat|tăiat|ras)\b/gi, '')
    .replace(/\d+\s*(g|kg|ml|l|tbsp|tsp|cup|cups|buc|linguri|lingură|cană|căni)\b/gi, '')
    .trim()
}

export async function GET(req: NextRequest) {
  try {
    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const category = req.nextUrl.searchParams.get('category') || 'pantry'
    const sort = req.nextUrl.searchParams.get('sort') || 'closest'
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 20, 50)
    const postType = category === 'bar' ? 'cocktail' : 'recipe'

    // 1. Get user's inventory
    const { data: inventory } = await supabase
      .from('pantry')
      .select('item_name, canonical_name')
      .eq('user_id', user.id)
      .eq('category', category)

    if (!inventory || inventory.length === 0) {
      return NextResponse.json({ results: [], message: 'Inventory is empty' })
    }

    // Build normalised ingredient set from user's inventory
    const userIngredients = new Set<string>()
    for (const item of inventory) {
      if (item.canonical_name) userIngredients.add(normalise(item.canonical_name))
      userIngredients.add(normalise(item.item_name))
      // Also resolve the Romanian name to English canonical
      const resolved = resolveIngredientName(item.item_name.toLowerCase())
      if (resolved) userIngredients.add(normalise(resolved))
    }

    // 2. Fetch recipes/cocktails with recipe_json
    const { data: posts } = await supabase
      .from('posts')
      .select('id, title, slug, hero_image_url, recipe_json, summary')
      .eq('type', postType)
      .eq('status', 'published')
      .not('recipe_json', 'is', null)
      .limit(500)

    if (!posts || posts.length === 0) {
      return NextResponse.json({ results: [] })
    }

    // 3. Score each recipe
    interface ScoredResult {
      id: string
      title: string
      slug: string
      image_url: string | null
      summary: string | null
      match_ratio: number
      matched_count: number
      total_count: number
      missing_count: number
      effective_missing: number
      matched_ingredients: string[]
      missing_ingredients: string[]
    }

    const results: ScoredResult[] = []

    for (const post of posts) {
      const json = post.recipe_json as Record<string, unknown> | null
      if (!json) continue

      const rawIngredients = (json.ingredients as string[]) || []
      if (rawIngredients.length === 0) continue

      const matched: string[] = []
      const missing: string[] = []
      let effectiveMissing = 0

      for (const raw of rawIngredients) {
        const norm = normalise(raw)
        const canonical = normalise(resolveIngredientName(norm) || norm)

        const found = [...userIngredients].some(ui =>
          canonical.includes(ui) || ui.includes(canonical) ||
          norm.includes(ui) || ui.includes(norm)
        )

        if (found) {
          matched.push(raw)
        } else {
          missing.push(raw)
          if (!STAPLES.has(canonical) && !STAPLES.has(norm)) {
            effectiveMissing++
          }
        }
      }

      const total = rawIngredients.length
      const ratio = total > 0 ? matched.length / total : 0

      // Only include if at least 30% match
      if (ratio >= 0.3) {
        results.push({
          id: post.id,
          title: post.title,
          slug: post.slug,
          image_url: post.hero_image_url,
          summary: post.summary,
          match_ratio: Math.round(ratio * 100),
          matched_count: matched.length,
          total_count: total,
          missing_count: missing.length,
          effective_missing: effectiveMissing,
          matched_ingredients: matched,
          missing_ingredients: missing,
        })
      }
    }

    // 4. Sort
    if (sort === 'perfect') {
      results.sort((a, b) => a.effective_missing - b.effective_missing || b.match_ratio - a.match_ratio)
    } else if (sort === 'fewest') {
      results.sort((a, b) => a.missing_count - b.missing_count)
    } else {
      // closest — highest match ratio
      results.sort((a, b) => b.match_ratio - a.match_ratio || a.effective_missing - b.effective_missing)
    }

    return NextResponse.json({ results: results.slice(0, limit) })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
