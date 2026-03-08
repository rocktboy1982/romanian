# Data-Access Layer

This directory contains the centralized data-access layer for the Food Glam Platform, eliminating repeated Supabase query patterns across 18+ API routes.

## Files

### `types.ts` (112 lines)
Shared TypeScript interfaces used across posts and votes queries:

- **RecipeCard** — Full recipe with creator profile and approach info
- **MinimalRecipe** — Lightweight recipe for planner/autocomplete (id, title, slug, hero_image_url, recipe_json, diet_tags, food_tags)
- **CreatorProfile** — Creator info (id, display_name, handle, avatar_url)
- **ApproachInfo** — Region/approach info (id, name, slug)
- **VoteMap** — Record<string, number> (post_id → net votes)
- **VoteStats** — Vote aggregation with trending component
- **VoteStatsMap** — Record<string, VoteStats> (post_id → { net, trending })
- **PostFilters** — Query filters (type, status, region, diet_tags, food_tags, search query, etc.)
- **PaginationOptions** — Pagination and sorting (page, perPage, sortBy, sortOrder)
- **VoteRecord** — Vote table record

### `posts.ts` (468 lines)
Data-access functions for posts (recipes) queries:

**Column Constants:**
- `RECIPE_CARD_COLUMNS` — Full card query with joins
- `MINIMAL_RECIPE_COLUMNS` — Lightweight query columns

**Query Functions:**
- `getRecipeCards(supabase, filters?, pagination?)` — Full cards with profile/approach joins
- `getRecipeById(supabase, id)` — Single recipe by UUID
- `getRecipeBySlug(supabase, slug)` — Single recipe by slug
- `getMinimalRecipes(supabase, filters?, limit?)` — Lightweight for planner/autocomplete
- `getRecipesByRegion(supabase, region, pagination?)` — Filter by approach slug
- `getRecipesByCountry(supabase, countrySlug, pagination?)` — Filter by country slug
- `searchRecipes(supabase, query, filters?, pagination?)` — Text search on title/summary

**Write Functions:**
- `createPost(supabase, data)` — Insert new post with required fields
- `updatePost(supabase, id, userId, data)` — Update with ownership check
- `softDeletePost(supabase, id, userId)` — Set status to 'deleted'

### `votes.ts` (238 lines)
Data-access functions for votes queries:

**Query Functions:**
- `getVotesByPostIds(supabase, postIds)` — Returns VoteMap (post_id → net votes)
- `getRecentVotes(supabase, postIds, days?)` — For trending (time-filtered, returns VoteStatsMap)
- `getUserVote(supabase, postId, userId)` — Check if user voted (returns 1, -1, or null)
- `getNetVotes(supabase, postId)` — Aggregate sum for single post

**Write Functions:**
- `upsertVote(supabase, postId, userId, value)` — Insert or update vote
- `deleteVote(supabase, postId, userId)` — Remove a vote

## Design Principles

1. **Dependency Injection** — All functions accept a Supabase client as the first argument (no global client)
2. **Type Safety** — No `any` types; all functions return properly typed results
3. **Error Handling** — Uses `unwrapSupabase` utility for consistent error handling
4. **JSDoc Comments** — All exported functions have clear documentation
5. **Reusability** — Centralizes patterns used across 18+ API routes

## Usage Example

```typescript
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getRecipeCards, getVotesByPostIds } from '@/lib/data-access/posts'
import { getRecentVotes } from '@/lib/data-access/votes'

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient()

  // Fetch recipe cards with filters
  const recipes = await getRecipeCards(supabase, {
    type: 'recipe',
    status: 'active',
    dietTags: ['vegan'],
  }, {
    page: 1,
    perPage: 12,
    sortBy: 'created_at',
    sortOrder: 'desc',
  })

  // Fetch vote stats for trending
  const postIds = recipes.map(r => r.id)
  const voteStats = await getRecentVotes(supabase, postIds, 7)

  return NextResponse.json({ recipes, voteStats })
}
```

## Next Steps

These files are ready to be integrated into existing API routes:
- `app/api/homepage/route.ts`
- `app/api/search/recipes/route.ts`
- `app/api/trending/route.ts`
- `app/api/recipes/search-for-planner/route.ts`
- `app/api/posts/[id]/vote/route.ts`
- And 13+ other routes

Refactoring existing routes to use these functions will:
- Reduce code duplication
- Improve maintainability
- Ensure consistent error handling
- Make testing easier
