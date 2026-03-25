# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is **MareChef.ro** (Food Glam Platform), a Next.js web application for discovering, saving, and planning food recipes. Live at https://marechef.ro. The project is organized as a monorepo with the main application in `food-glam-platform/`.

### What This Project Does

A Romanian-language food platform where users can:
- Discover 2000+ authentic recipes from 150+ countries, organized by region
- Scan ingredients with AI (Gemini Vision) to find matching recipes
- Save favorites to a personal cookbook ("Rețetele mele")
- Plan meals for a week with a visual calendar
- Manage pantry ("Cămara") and bar inventory
- Generate and print shopping lists
- Browse 986 cocktails with MareChef Bartender
- Chat with an AI assistant (Gemini 2.5 Flash, client-side)
- Submit recipes and cocktails
- Send messages to admin

## Key Development Commands

Run all commands from `food-glam-platform/` unless otherwise noted.

```bash
npm install                    # Install dependencies
npm run dev                    # Start Next.js dev server (http://localhost:3001)
npm run typecheck             # Run TypeScript type checking (tsc --noEmit)
npm run lint                  # Run ESLint
npm run build                 # Build for production
npx vercel --prod             # Deploy to production (marechef.ro)
```

## Architecture

### Tech Stack
- **Framework:** Next.js 16.2.1 (App Router, Turbopack)
- **React:** 19.2.4
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** Supabase (PostgreSQL) — cloud instance
- **Auth:** Google OAuth (implicit flow) via Supabase
- **AI:** Gemini 2.5 Flash (per-user API key, client-side)
- **Translation:** Ollama aya-expanse:8b (local, for recipe import)
- **Deployment:** Vercel (free tier)
- **Icons:** lucide-react 0.577

### Auth Architecture (CRITICAL — read before touching auth)

Session is stored in `localStorage('marechef-session')` by the navigation component.

**Flow:**
1. User clicks "Autentificare" → Google OAuth → Supabase callback
2. Navigation detects session via `onAuthStateChange` → saves to `marechef-session`
3. All client components read auth from `marechef-session` first, fallback to `supabase.auth.getSession()`
4. API calls include `Authorization: Bearer <token>` header
5. Server API routes verify via `getRequestUser()` (cookies → Bearer header → mock dev)

**Key files:**
- `lib/supabase-client.ts` — exports `supabase` (createClient, localStorage) + `supabaseSsr` (createBrowserClient, cookies)
- `lib/get-user.ts` — server-side auth resolution
- `lib/require-admin.ts` — admin email check (iancu1982@gmail.com)
- `components/navigation.tsx` — saves session to `marechef-session`, handles sign-out
- `middleware.ts` — refreshes cookies on all pages

**Rules:**
- Always use `getSession()` not `getUser()` in client components
- Always read `marechef-session` from localStorage as primary token source
- Always include Bearer token via `getAuthHeaders()` in fetch calls
- Never use `x-mock-user-id` in production

### Database Security (RLS)

All 30 tables have Row Level Security enabled:
- **Profiles:** public read (id, display_name, handle, avatar_url, bio, created_at) — email, gemini_api_key, is_moderator BLOCKED
- **User-private tables:** auth.uid() = user_id (pantry, votes, collections, follows, meal_plans, shopping_lists, etc.)
- **Public reference tables:** SELECT for all (approaches, cuisines, food_styles, posts, threads, replies)
- **Admin tables:** service_role only (app_roles, content_deletions, submissions)

API routes use `createServiceSupabaseClient()` (service role, bypasses RLS) for data operations.

## Project Structure

```
food-glam-platform/
├── app/                      # Next.js App Router
│   ├── api/                 # API routes
│   │   ├── admin/           # Admin APIs (users, stats, content, moderation)
│   │   ├── chat/            # AI chatbot API (Gemini)
│   │   ├── messages/        # User-admin messaging
│   │   ├── pantry/          # Pantry CRUD
│   │   ├── recipes/         # by-region, by-country, search
│   │   ├── shopping-lists/  # Lists, items, sharing
│   │   ├── submit/          # Recipe + cocktail submission
│   │   └── vision/          # Scan (recognise, match-recipes, sync-pantry)
│   ├── admin/               # Admin dashboard
│   ├── auth/                # Sign-in + OAuth callback
│   ├── cocktails/           # Cocktail pages
│   ├── cookbooks/           # Cookbooks by region/continent
│   ├── me/                  # User pages (pantry, bar, scan, cookbook, messages)
│   ├── recipes/             # Recipe detail, cook mode, print
│   ├── submit/              # Submit recipe/cocktail forms
│   └── page.tsx             # Homepage
├── components/              # Reusable React components
│   ├── ChatBot.tsx          # Floating AI assistant
│   ├── navigation.tsx       # Main nav (saves marechef-session)
│   ├── pages/               # Page-level client components
│   └── modules/             # Feature module components
├── lib/                     # Utilities
│   ├── ai-provider.ts       # Gemini Vision integration
│   ├── supabase-client.ts   # Browser Supabase client
│   ├── supabase-server.ts   # Server Supabase clients
│   ├── get-user.ts          # Auth resolution
│   ├── require-admin.ts     # Admin check
│   ├── rate-limit.ts        # In-memory rate limiter
│   ├── normalize-for-search.ts  # Ingredient parsing
│   ├── country-slug-map.ts  # Country → slug mapping
│   └── recipe-taxonomy.ts   # Region/cuisine taxonomy
├── scripts/                 # Import & maintenance scripts
│   ├── seed-google-v3.js    # Main recipe importer (Ollama translation)
│   ├── backfill-country.js  # Country column backfill
│   ├── classify-country.js  # AI country classification
│   └── fix-english-ingredients.js  # Translation fixes
├── supabase/                # Supabase config + migrations
└── backups/                 # DB backups (db-backup-2026-03-09.sql.gz)
```

## Environment Variables

**Required (`.env.local` + Vercel):**
```
NEXT_PUBLIC_SUPABASE_URL=https://zfnxpoocddqiaiyizsri.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
GOOGLE_API_KEY=AIza...  (Gemini, for server-side scan)
```

**Optional:**
```
ANTHROPIC_API_KEY=sk-ant-...  (not currently used)
PROFITSHARE_API_KEY / PROFITSHARE_API_USER  (eMAG affiliate)
NEXT_PUBLIC_ADSENSE_PUB_ID  (Google AdSense)
NEXT_PUBLIC_SITE_URL=https://marechef.ro
```

## Common Patterns

### Auth Headers (client components)
```tsx
const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  try {
    const backup = localStorage.getItem('marechef-session')
    if (backup) {
      const parsed = JSON.parse(backup)
      if (parsed?.access_token) {
        headers['Authorization'] = `Bearer ${parsed.access_token}`
        return headers
      }
    }
  } catch {}
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
  return headers
}
```

### API Route Auth Pattern
```ts
const authClient = createServerSupabaseClient()  // reads cookies
const supabase = createServiceSupabaseClient()    // bypasses RLS
const user = await getRequestUser(req, authClient)
if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
// Use `supabase` (service client) for data operations
```

### Admin Check
```ts
import { ADMIN_EMAILS } from '@/lib/require-admin'
// ADMIN_EMAILS = ['iancu1982@gmail.com']
```

## Important Notes

- **All UI text must be in Romanian** — no English strings in user-facing components
- **Image Optimization disabled** (`unoptimized: true`) — Vercel free tier limit
- **CSP active** — allowlist for Google, Supabase, Gemini, Unsplash, Pexels
- **robots.txt** — blocks AhrefsBot, SemrushBot, GPTBot, CCBot; allows Google, Bing, Yandex
- **Cocktails** — created by "MareChef Bartender" profile
- **Recipe import** — uses `seed-google-v3.js` with Ollama translation, target 40/country, Romania excluded
- **Per-user Gemini key** — stored in `profiles.gemini_api_key` (DB) + `marechef-gemini-key` (localStorage)
- **Recipe submission limit** — 3 per day per user (enforced server-side in `app/api/submit/route.ts`)
- **Comments** — client-side only (not persisted to DB), requires `marechef-session` auth
