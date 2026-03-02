# Food Glam Platform — Session Status
**Last updated:** 2026-03-02
**Branch:** `master`
**Latest commit:** `33313a7` (uncommitted changes in working tree)
**Remote:** https://github.com/rocktboy1982/food-glam-grafana.git
**Dev server:** `http://localhost:3000` (run `npm run dev` in `D:\Grafana\Grafana\food-glam-platform`)
**TypeScript:** `npx tsc --noEmit` = **0 errors** ✅
**Build:** `npx next build` = **success, all pages compile** ✅

---

## Rules (never break)
- Home page `/` = dark theme always
- All other pages = `#dde3ee` background, inline styles (not Tailwind for new UI)
- No `as any`, `@ts-ignore`, `@ts-expect-error`
- `npx tsc --noEmit` must pass with 0 errors
- AI models: text = `gemini-2.0-flash-lite`, vision = `gemini-2.0-flash`
- Mock user system (no real OAuth) — `x-mock-user-id` header on all fetches
- Mock user UUID: `a0000000-0000-0000-0000-000000000001` (Chef Anna)

---

## Infrastructure

| Service | URL | Notes |
|---------|-----|-------|
| Dev server | `http://localhost:3000` | Next.js 15 |
| Supabase API | `http://127.0.0.1:54321` | Local instance |
| Supabase DB | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` | Direct pg |
| Supabase Anon Key | See `.env.local` | |
| Supabase Service Key | See `.env.local` | |

**Note:** PostgREST schema cache bug means new tables are not accessible via Supabase JS `.from()`. Use `lib/db.ts` direct pg Pool for affected tables.

---

## Committed Work (in master @ `33313a7`)

| Feature | Status | Key Files |
|---------|--------|-----------|
| Recipe browsing, detail, cook mode | ✅ Done | `app/recipes/[slug]/`, cook mode split-pane |
| Cocktail ecosystem | ✅ Done | `app/cocktails/`, `app/cocktailbooks/` |
| Search & discovery with filters | ✅ Done | `components/pages/search-discovery-page-client.tsx` |
| Chef profiles (Kwame, etc.) | ✅ Done | `lib/mock-chef-data.ts` |
| Community forum | ✅ Done | Direct pg, `lib/db.ts` |
| Moderation queue | ✅ Done | `app/moderation/` |
| Rate limiting (1 post/day, 1 comment/day) | ✅ Done | API routes |
| Meal planner (calendar + inline shopping) | ✅ Done | `components/pages/plan-client.tsx` |
| Shopping lists (detail, index, share) | ✅ Done | Light theme, grouped by category |
| Grocery shop integration (Module 39) | ✅ Done | `app/me/grocery/`, vendor matching |
| Recipe print page | ✅ Done | `app/recipes/[slug]/print/` |
| `#dde3ee` site theme | ✅ Done | All non-home pages |
| Recipe/cocktail rating + report system | ✅ Done | |
| Visual Ingredient Recognition (Module 40) | ✅ Scaffold done | See Module 40 section |

---

## Uncommitted Changes (current working tree — 19 files)

### Bug Fixes

#### plan-client.tsx — 27 TypeScript errors fixed
- **Root cause:** Unterminated template literal — missing closing backtick after the multi-line CSS block in the print HTML popup generator (line ~1301). TypeScript parser failed to recover, cascading into 27 errors.
- **Also:** Unicode chars (`🛒`, `·`, `–`, `✓`, `☐`) inside template literals caused `TS1127: Invalid character` with `target: "es5"`. Replaced with `\uXXXX` escapes and HTML entities (`&middot;`, `\u2013`, etc.).

#### recognise/merge/route.ts — type error + JSON support added
- Fixed `session.context` property access (field doesn't exist on session type — replaced with `''`)
- Route now accepts **two body formats**:
  1. `multipart/form-data { image, session_id }` — re-scans a new image (original behaviour)
  2. `application/json { session_id, merge_ingredients }` — merges pre-extracted ingredients without re-scanning (new — fixes the client's actual call pattern which was silently falling back to client-side merge)

#### reconcile-list/route.ts — port bug + missing auth header
- Hardcoded `localhost:3001` → `process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'`
- Now reads `x-mock-user-id` from incoming request and forwards it to both the items GET and PATCH calls (previously returned 401 → 0 matches)

#### scan-reconcile-client.tsx — missing auth headers
- Added `x-mock-user-id` to `fetch('/api/shopping-lists')` call
- Added `x-mock-user-id` to `fetch('/api/vision/reconcile-list')` POST
- Added `userId` to `useCallback` dependency array

### Print Improvements

#### Recipe print page (`app/recipes/[slug]/print/page.tsx`) — full overhaul
- **Before:** `max-w-2xl` (672px) container with `px-6`, `text-sm` (14px) ingredients/steps, `font-size: 11pt` print CSS, Tailwind `md:grid-cols-3` layout collapsing incorrectly
- **After:**
  - Screen: 860px container, `40px/48px` padding, `1rem` base text
  - Print: proper `@page { size: A4; margin: 1.8cm 2.2cm }`, `13pt` body, `24pt` h1, `16pt` h2
  - 2-column CSS grid (ingredients left, directions right) works in both screen and print
  - Extracted `RecipeBody` component — eliminates duplicated JSX between mock and live Supabase paths

#### Plan shopping list print popup (`plan-client.tsx`)
- Base font `16px` (was `13px`), container `780px` (was `600px`), `32px/40px` padding (was `20px`)
- Checkboxes `18px` (was `14px`), item rows taller, category headers more prominent
- Added `@page { size: A4; margin: 1.8cm 2cm }` print rule with scaled `pt` sizes

### Next.js 15 Async Params — 8 pages fixed total

Pages now use `params: Promise<{...}>` with `const { x } = await params`:

| File | Param |
|------|-------|
| `app/me/scan/[session_id]/review/page.tsx` | `session_id` |
| `app/me/scan/[session_id]/pantry/page.tsx` | `session_id` |
| `app/me/scan/[session_id]/recipes/page.tsx` | `session_id` |
| `app/me/scan/[session_id]/reconcile/page.tsx` | `session_id` |
| `app/approaches/[slug]/page.tsx` | `slug` |
| `app/channel/[handle]/series/page.tsx` | `handle` |
| `app/channel/[handle]/series/[slug]/page.tsx` | `handle`, `slug` |
| `app/shared/shopping-list/[token]/page.tsx` | `token` |

3 client-side pages use `useParams()` — correct pattern, no fix needed:
- `app/chefs/[handle]/page.tsx`
- `app/cuisines/[slug]/page.tsx`
- `app/cuisines/[slug]/food-styles/[style_slug]/page.tsx`

### Monetization Features

#### 1. eMAG Affiliate Links
- **`lib/affiliate.ts`** — `emagSearchUrl(ingredient)`, `ingredientSearchTerm(raw)` (strips quantity/unit prefix + preparation notes so "500g pizza dough, torn" searches "pizza dough"), `freshfulReferralUrl()`, `freshfulSearchUrl(ingredient)`
- **`components/ui/ingredient-link.tsx`** — `<IngredientLink>` component: dotted underline, opens in new tab, `rel="noopener noreferrer sponsored"`, 4 visual variants (`default` / `light` / `pill-green` / `pill-yellow`)
- **Wired into:**
  - `components/pages/recipe-ingredients-client.tsx` — each ingredient in the recipe checklist
  - `components/pages/shopping-list-detail-client.tsx` — unchecked items only (checked/strikethrough items stay plain text)
  - `components/pages/plan-client.tsx` — items in the inline shopping list view
  - `components/pages/scan-review-client.tsx` — recognised ingredient pills (high + low confidence)
- **To activate:** replace `EMAG_AFFILIATE_TAG = 'foodglam-20'` in `lib/affiliate.ts` with real tag from https://marketplace.emag.ro/afiliere

#### 2. Freshful Delivery Button
- Green "🚚 Freshful" button added to shopping list detail action bar (sits next to "🛒 Match to Store")
- Links to `https://www.freshful.ro/?ref=FOODGLAM` — swap `FRESHFUL_REFERRAL_CODE` in `lib/affiliate.ts` with real code from Freshful partner agreement
- **To activate:** contact Freshful (freshful.ro) for partner/affiliate agreement, get referral code

#### 3. Pro Plan Paywall
- **`lib/use-user-tier.ts`** — `useUserTier()` hook: reads `isPro` boolean from `localStorage.mock_user`, returns `{ tier: 'free'|'pro', isPro: boolean, loading: boolean }`
- **`components/ui/pro-paywall-modal.tsx`** — Romanian-language modal: amber gradient, lists Pro features, shows price (29 RON/lună), CTA placeholder (`alert()` — replace with real checkout URL)
- **Gated feature:** "✨ Generate Shopping List" button in meal planner
  - Free users → amber "⭐ Upgrade la Pro" button → opens paywall modal
  - Pro users → original black button, full functionality
- **To test Pro in dev:**
  ```js
  const u = JSON.parse(localStorage.getItem('mock_user')); u.isPro = true; localStorage.setItem('mock_user', JSON.stringify(u)); location.reload()
  ```
- **To activate payments:** wire the modal CTA to Stripe (international) or netopia.ro (Romanian RON), then set `isPro = true` after webhook confirms subscription

---

## Module 40 — Visual Ingredient Recognition

### Flow
1. User taps "Scan" in nav → `/me/scan`
2. Takes photo or uploads image of fridge/pantry
3. Gemini Vision identifies ingredients with confidence scores
4. Review page shows ingredient pills (high/low confidence separated)
5. User picks one of 4 actions: Find Recipes / Cook + Shop / Update List / Log Pantry
6. Each action flows to its dedicated page with real data

### Files
```
Page routes:
  app/me/scan/page.tsx                              Entry point
  app/me/scan/[session_id]/review/page.tsx          Ingredient review
  app/me/scan/[session_id]/pantry/page.tsx          Pantry sync
  app/me/scan/[session_id]/recipes/page.tsx         Recipe matching
  app/me/scan/[session_id]/reconcile/page.tsx       Shopping list cross-off

Client components:
  components/pages/scan-client.tsx                  Camera/upload UI
  components/pages/scan-review-client.tsx           Ingredient pills + 4 action cards
  components/pages/scan-pantry-client.tsx           Pantry sync UI
  components/pages/scan-recipes-client.tsx          Recipe matching with sort tabs
  components/pages/scan-reconcile-client.tsx        Shopping list cross-off

API routes:
  app/api/vision/recognise/route.ts                 POST, Gemini vision, in-memory SESSION_STORE
  app/api/vision/recognise/merge/route.ts           POST, JSON or FormData, dedup merge
  app/api/vision/sync-pantry/route.ts               GET/POST/DELETE, in-memory PANTRY_STORE
  app/api/vision/match-recipes/route.ts             POST, matches against MOCK_RECIPES
  app/api/vision/reconcile-list/route.ts            POST, cross-off shopping list items

AI:
  lib/ai-provider.ts                                recogniseIngredientsFromPhoto(), normaliseIngredients()
```

### Blockers
1. **No `GOOGLE_API_KEY` in `.env.local`** — every scan returns 0 ingredients (graceful fallback but useless). Add `GOOGLE_API_KEY=<your-key>` to `.env.local` to enable Gemini Vision.
2. **In-memory session store** — `SESSION_STORE` is a Node.js Map. Lost on server restart or hard page refresh. Client sessionStorage survives navigation but not refresh.

### Nice-to-have (not started)
- Editable ingredient pills on review page (add/remove before choosing action)
- Persist sessions to Supabase `vision_scan_sessions` table
- "Scan my fridge" shortcut on homepage / meal planner

---

## Auth Pattern

All API routes that access user data use `getRequestUser(req, supabase)` from `lib/get-user.ts`:
1. Tries real Supabase session (`supabase.auth.getUser()`)
2. Falls back to `x-mock-user-id` header
3. Non-UUID mock IDs normalize to Chef Anna (`a0000000-0000-0000-0000-000000000001`)

Client components read user ID from `localStorage.getItem('mock_user')`.

### Known missing auth (low priority, intentional)
- `/api/shopping-lists/presence/*` (4 routes) — real-time collab, works without auth in dev
- Vision routes (`recognise`, `merge`, `match-recipes`) — session-based, intentionally public

---

## New Files This Session

| File | Purpose |
|------|---------|
| `lib/affiliate.ts` | eMAG affiliate URL builder + Freshful referral URL |
| `lib/use-user-tier.ts` | `useUserTier()` hook — reads `isPro` from localStorage |
| `components/ui/ingredient-link.tsx` | eMAG affiliate link wrapper for ingredient strings |
| `components/ui/pro-paywall-modal.tsx` | Romanian Pro upgrade modal with pricing |

---

## Key Files Reference

```
Core:
  lib/db.ts                                         Direct pg Pool (bypasses PostgREST cache)
  lib/get-user.ts                                   Mock user extraction + UUID validation
  lib/supabase-server.ts                            createServiceSupabaseClient()
  lib/ai-provider.ts                                Gemini vision + text AI
  lib/affiliate.ts                                  eMAG + Freshful affiliate URLs  ← NEW
  lib/use-user-tier.ts                              Pro subscription tier hook       ← NEW
  lib/mock-data.ts                                  MOCK_RECIPES (18 recipes)
  lib/mock-chef-data.ts                             MOCK_CHEF_PROFILES, MOCK_CHEF_POSTS
  lib/grocery/vendors.ts                            mockSearchProducts() — 25+ ingredient pools
  lib/recipe-taxonomy.ts                            REGION_META, COURSES, COURSE_TAGS

UI components:
  components/ui/ingredient-link.tsx                 eMAG affiliate link              ← NEW
  components/ui/pro-paywall-modal.tsx               Pro upgrade modal                ← NEW

Major client components:
  components/pages/plan-client.tsx                  Meal planner (~1810 lines)
  components/pages/shopping-list-detail-client.tsx  Shopping list detail
  components/pages/shopping-lists-client.tsx        Shopping lists index
  components/pages/search-discovery-page-client.tsx Search with filters
  components/pages/scan-client.tsx                  Vision scan camera UI
  components/pages/recipe-ingredients-client.tsx    Ingredient checklist on recipe page
```

---

## Activation Checklist (before going live)

| Item | Action |
|------|--------|
| eMAG affiliate links | Replace `EMAG_AFFILIATE_TAG = 'foodglam-20'` in `lib/affiliate.ts` with real tag |
| Freshful button | Replace `FRESHFUL_REFERRAL_CODE = 'FOODGLAM'` in `lib/affiliate.ts` with partner code |
| Pro payments | Wire `ProPaywallModal` CTA to Stripe or netopia.ro checkout URL |
| Gemini Vision scan | Add `GOOGLE_API_KEY=<key>` to `.env.local` |

---

## Next Steps
- Wire real payment provider (Stripe or netopia.ro) to the Pro modal CTA
- Sign up for eMAG affiliate program and get real affiliate tag
- Contact Freshful for partner/referral agreement
- Add `GOOGLE_API_KEY` to `.env.local` and test scan end-to-end
- Persist scan sessions to Supabase (so page refresh doesn't lose ingredients)
- Gate ingredient scan (Module 40) behind Pro tier as well
- Add more recipes / chefs / cuisines to grow content
