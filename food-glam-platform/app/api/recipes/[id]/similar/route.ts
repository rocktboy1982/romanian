import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { scoreAndRank, RecipeDoc } from '@/lib/search'
import { cacheGet, cacheSet } from '@/lib/cache'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient();

    // Fetch the target recipe from the posts table
    const { data: target, error: e1 } = await supabase
      .from('posts')
      .select('id,title,summary,recipe_json,slug')
      .eq('id', id)
      .eq('type', 'recipe')
      .maybeSingle();
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
    if (!target) return NextResponse.json({ results: [] })

    // Build a query string using title + first ingredient
    // Support both recipeIngredient (original) and ingredients (seeded format)
    const rj = target.recipe_json as Record<string, unknown> | null
    const name = (rj?.name || target.title || '').toString();
    const ingredients = (rj?.recipeIngredient || rj?.ingredients || []) as string[];
    const firstIng = Array.isArray(ingredients) ? (ingredients[0] || '') : '';
    const q = `${name} ${firstIng}`.trim();

    const cacheKey = `similar:${id}`;
    const cached = cacheGet(cacheKey);
    if (cached) return NextResponse.json({ results: cached });

    // Fetch candidate recipes — use the same slug prefix to prefer same-cuisine results,
    // but fall back to broader pool
    const slugPrefix = target.slug ? target.slug.split('-').slice(0, 1).join('-') : null;

    // Get up to 50 recipes from same cuisine + 50 random others (max 100 candidates)
    let candidates: RecipeDoc[] = [];

    if (slugPrefix) {
      const { data: sameCuisine } = await supabase
        .from('posts')
        .select('id,title,summary,recipe_json,slug,hero_image_url')
        .eq('type', 'recipe')
        .eq('status', 'active')
        .ilike('slug', `${slugPrefix}-%`)
        .neq('id', id)
        .limit(50);
      if (sameCuisine) candidates.push(...(sameCuisine as unknown as RecipeDoc[]));
    }

    // If we don't have enough, fetch more broadly
    if (candidates.length < 20) {
      const { data: broader } = await supabase
        .from('posts')
        .select('id,title,summary,recipe_json,slug,hero_image_url')
        .eq('type', 'recipe')
        .eq('status', 'active')
        .neq('id', id)
        .limit(50);
      if (broader) {
        const existingIds = new Set(candidates.map(c => c.id));
        for (const r of broader) {
          if (!existingIds.has(r.id)) candidates.push(r as unknown as RecipeDoc);
        }
      }
    }

    const results = scoreAndRank(candidates, q, 10);
    cacheSet(cacheKey, results, 60);
    return NextResponse.json({ results }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
