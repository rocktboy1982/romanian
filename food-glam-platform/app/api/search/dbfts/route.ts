import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { cacheGet, cacheSet } from '@/lib/cache'
import { expandSearchTerms } from '@/lib/ingredient-aliases'
import { scoreAndRank } from '@/lib/search'
import { MOCK_RECIPES } from '@/lib/mock-data'
import { REGION_META, ALL_COUNTRIES, COURSE_TAGS } from '@/lib/recipe-taxonomy'
import { getVotesByPostIds } from '@/lib/data-access/votes'

/** Apply region/country/course filters to a list of mock-recipe-shaped docs */
function applyFilters<T extends { recipe_json?: any; title?: string | null; summary?: string | null }>(
  docs: T[],
  region: string | undefined,
  country: string | undefined,
  course: string | undefined,
): T[] {
  let results = docs

  if (region && REGION_META[region]) {
    const regionMeta = REGION_META[region]
    if (country) {
      // filter by specific country's foodTags
      const countryMeta = ALL_COUNTRIES.find(c => c.id === country && c.regionId === region)
      if (countryMeta) {
        const tags = countryMeta.foodTags
        results = results.filter(r => {
          const ingredients: string[] = Array.isArray(r.recipe_json?.recipeIngredient)
            ? r.recipe_json.recipeIngredient
            : []
          const allText = ((r.title || '') + ' ' + (r.summary || '') + ' ' + ingredients.join(' ')).toLowerCase()
          return tags.some(t => allText.includes(t))
        })
      }
    } else {
      // filter by any country in the region
      const allRegionTags = regionMeta.countries.flatMap(c => c.foodTags)
      const regionLabel = regionMeta.label.toLowerCase()
      results = results.filter(r => {
        const ingredients: string[] = Array.isArray(r.recipe_json?.recipeIngredient)
          ? r.recipe_json.recipeIngredient
          : []
        const allText = ((r.title || '') + ' ' + (r.summary || '') + ' ' + ingredients.join(' ')).toLowerCase()
        return allRegionTags.some(t => allText.includes(t)) || allText.includes(regionLabel)
      })
    }
  }

  if (course && COURSE_TAGS[course]) {
    const courseTags = COURSE_TAGS[course]
    const filtered = results.filter(r => {
      const ingredients: string[] = Array.isArray(r.recipe_json?.recipeIngredient)
        ? r.recipe_json.recipeIngredient
        : []
      const allText = ((r.title || '') + ' ' + (r.summary || '') + ' ' + ingredients.join(' ')).toLowerCase()
      return courseTags.some(t => allText.includes(t))
    })
    if (filtered.length > 0) results = filtered
  }

  return results
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const q = body?.q;
    const page = Number(body?.page || 1) || 1;
    const pageSize = Number(body?.pageSize || 10) || 10;
    const region: string | undefined = body?.region || undefined;
    const country: string | undefined = body?.country || undefined;
    const course: string | undefined = body?.course || undefined;

    if (!q || typeof q !== 'string') return NextResponse.json({ error: 'Missing query' }, { status: 400 })

    // Expand the query through the multilingual alias dictionary.
    const expandedTerms = expandSearchTerms(q === '*' ? '' : q);
    const rawQ = q === '*' ? '' : q;
    const allTerms = rawQ
      ? Array.from(new Set([rawQ.toLowerCase(), ...expandedTerms]))
      : []

    const supabase = createServerSupabaseClient();
    const totalWanted = page * pageSize;
    const cacheKey = `search:dbfts:${q}:${region ?? ''}:${country ?? ''}:${course ?? ''}:${page}:${pageSize}`;
    const cached = cacheGet(cacheKey);
    if (cached) return NextResponse.json(cached);

    // --- Supabase search ---
    let supabaseRows: any[] | null = null;
    let usedFallback: string | null = null;

    if (allTerms.length > 0) {
      for (const term of allTerms) {
        const { data, error } = await supabase.rpc('search_recipes', { query_text: term, limit_count: totalWanted });
        if (!error && Array.isArray(data) && data.length > 0) {
          const ids = data.map((r: any) => r.id).filter(Boolean);
          const { data: rows } = await supabase
            .from('recipes')
            .select('id,title,summary,recipe_json,hero_image_url')
            .in('id', ids)
            .limit(totalWanted);
          const byId = new Map((rows || []).map((r: any) => [String(r.id), r]));
          supabaseRows = data.map((r: any) => ({ ...byId.get(String(r.id)), rank: r.rank }));
          break;
        }
      }

      // trigram fallback
      if (!supabaseRows || supabaseRows.length === 0) {
        for (const term of allTerms) {
          try {
            const { data: trigramData, error: trigramErr } = await supabase.rpc('search_recipes_trgm', { query_text: term, limit_count: totalWanted });
            if (!trigramErr && Array.isArray(trigramData) && trigramData.length) {
              const trigIds = trigramData.map((r: any) => r.id).filter(Boolean);
              const { data: triRows } = await supabase.from('recipes').select('id,title,summary,recipe_json,hero_image_url').in('id', trigIds).limit(totalWanted);
              const byIdTri = new Map((triRows || []).map((r: any) => [String(r.id), r]));
              supabaseRows = trigramData.map((r: any) => ({ ...byIdTri.get(String(r.id)), rank: r.rank ?? r.similarity ?? null }));
              usedFallback = 'trigram';
              break;
            }
          } catch {
            // continue
          }
        }
      }

      // ILIKE fallback
      if (!supabaseRows || supabaseRows.length === 0) {
        for (const term of allTerms) {
          const { data: ilikeRows, error: ilikeErr } = await supabase
            .from('recipes')
            .select('id,title,summary,recipe_json,hero_image_url')
            .ilike('title', `%${term}%`)
            .limit(totalWanted);
          if (!ilikeErr && Array.isArray(ilikeRows) && ilikeRows.length > 0) {
            supabaseRows = ilikeRows;
            usedFallback = 'ilike';
            break;
          }
        }
      }
    } else {
      // No text query — fetch all for filter-only browsing
      const { data: allRows } = await supabase
        .from('recipes')
        .select('id,title,summary,recipe_json,hero_image_url')
        .limit(200);
      if (Array.isArray(allRows) && allRows.length > 0) {
        supabaseRows = allRows;
      }
    }

    // --- Apply region/course filters to Supabase results ---
    if (supabaseRows && supabaseRows.length > 0) {
      const filtered = applyFilters(supabaseRows, region, country, course);
      const toRank = filtered.length > 0 ? filtered : supabaseRows;
      const reRanked = rawQ ? scoreAndRank(toRank, rawQ, totalWanted) : toRank;
      const start = (page - 1) * pageSize;
      const paged = reRanked.slice(start, start + pageSize).map((doc) => ({
        ...doc,
        rank: (supabaseRows!.find(r => r.id === (doc as any).id) as any)?.rank ?? null,
      }));
      
      // Fetch vote counts for all results in a single query
      const resultIds = paged.map((doc: any) => doc.id).filter(Boolean);
      const voteMap = await getVotesByPostIds(supabase, resultIds);
      
      // Add vote counts to results
      const pagedWithVotes = paged.map((doc: any) => ({
        ...doc,
        votes: voteMap[doc.id] || 0,
      }));
      
      const result = {
        results: pagedWithVotes,
        total: reRanked.length,
        page,
        pageSize,
        hasMore: reRanked.length > start + pageSize,
        fallback: usedFallback,
        expandedTerms: expandedTerms.length > 0 ? expandedTerms : null,
      };
      cacheSet(cacheKey, result, 30);
      return NextResponse.json(result, {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=300',
        },
      });
    }

    // --- Mock data fallback ---
    const mockDocs = MOCK_RECIPES.map(r => ({
      id: r.id,
      title: r.title,
      summary: r.summary,
      hero_image_url: r.hero_image_url,
      recipe_json: {
        name: r.title,
        recipeIngredient: [...(r.foodTags || []), ...(r.dietTags || [])],
      },
      // store region on the mock doc so applyFilters can match it
      _region: r.region,
    }));

    // Apply region filter to mock data using recipe.region field
    let filteredMock = mockDocs as any[];
    if (region && REGION_META[region]) {
      const regionLabel = REGION_META[region].label.toLowerCase();
      if (country) {
        const countryMeta = ALL_COUNTRIES.find(c => c.id === country && c.regionId === region);
        if (countryMeta) {
          const tags = countryMeta.foodTags;
          filteredMock = filteredMock.filter(r =>
            r._region.toLowerCase() === regionLabel &&
            r.recipe_json.recipeIngredient.some((t: string) => tags.includes(t))
          );
        }
      } else {
        filteredMock = filteredMock.filter(r => r._region.toLowerCase() === regionLabel);
      }
      // If filter yields nothing, fall back to full list (dev convenience)
      if (filteredMock.length === 0) filteredMock = mockDocs as any[];
    }

    if (course && COURSE_TAGS[course]) {
      const courseTags = COURSE_TAGS[course];
      const byCourse = filteredMock.filter(r =>
        r.recipe_json.recipeIngredient.some((t: string) => courseTags.includes(t))
      );
      if (byCourse.length > 0) filteredMock = byCourse;
    }

    const scored = rawQ ? scoreAndRank(filteredMock, rawQ, totalWanted) : filteredMock;
    const allResults = scored.length > 0 ? scored : filteredMock;
    const start = (page - 1) * pageSize;
    const paged = allResults.slice(start, start + pageSize);
    const result = {
      results: paged,
      total: allResults.length,
      page,
      pageSize,
      hasMore: allResults.length > start + pageSize,
      fallback: 'mock',
      expandedTerms: expandedTerms.length > 0 ? expandedTerms : null,
    };
    cacheSet(cacheKey, result, 30);
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=300',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
