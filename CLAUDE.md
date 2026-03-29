# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is **MareChef.ro** (Food Glam Platform), a Next.js web application for discovering, saving, and planning food recipes. Live at https://marechef.ro. The project is organized as a monorepo with the main application in `food-glam-platform/`. GitHub repo is **PRIVATE**.

### What This Project Does

A Romanian-language food platform where users can:
- Discover 1200+ authentic recipes from 150+ countries, organized by 16 regions
- Browse 986 cocktails with MareChef Bartender
- Scan ingredients with AI (Gemini Vision) to find matching recipes
- OCR: photograph a handwritten/printed recipe → AI fills the form automatically
- Save favorites to a personal cookbook ("Rețetele mele")
- Plan meals for a week with a visual calendar
- Manage pantry ("Cămara") and bar inventory
- Generate and print shopping lists
- **AI Meal Plan Generator**: personalized weekly plans based on health profile, diet type, allergens
- **14 diet protocols**: Mediterranean, Keto, Atkins, Zone, Vegetarian, Vegan, Weight Watchers, South Beach, Raw Food, Glycemic Index, Detox, Low Fat, Low Carb + regime hipo/hipercaloric
- **Calendar export (.ics)**: meal plans + hydration reminders → Google Calendar, Apple Calendar
- Health module: hydration, fasting, meal logging, weight tracking, BMR/TDEE calculator
- Health profile: medical conditions (11), allergens (8), blood type, personal preferences
- Chat with an AI assistant (Gemini 2.5 Flash, client-side)
- Submit recipes and cocktails (3/day limit)
- Import recipes from URLs (certified creators only)
- Send messages to admin (replies shown as "Moderator")
- GDPR: export all data, deactivate account (30-day grace period + permanent deletion)

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
- **Database:** Supabase (PostgreSQL) — cloud instance, 39 tables
- **Auth:** Google OAuth (implicit flow) via Supabase
- **AI:** Gemini 2.5 Flash (per-user API key, client-side + server-side OCR)
- **Translation:** Ollama aya-expanse:8b (local, for recipe import)
- **Deployment:** Vercel (free tier)
- **Icons:** lucide-react 0.577
- **Source maps:** disabled in production (`productionBrowserSourceMaps: false`)

### Auth Architecture (CRITICAL — read before touching auth)

Session is stored in `localStorage('marechef-session')` by the navigation component.

**Flow:**
1. User clicks "Autentificare" → Google OAuth → Supabase callback
2. Navigation detects session via `onAuthStateChange` on BOTH clients → saves to `marechef-session`
3. Client components read auth from: `marechef-session` → `supabaseSsr.auth.getSession()` → `supabase.auth.getSession()`
4. API calls include `Authorization: Bearer <token>` header
5. Server API routes verify via `getRequestUser()` (cookies → Bearer header)

**Key files:**
- `lib/supabase-client.ts` — exports `supabase` (createClient, localStorage) + `supabaseSsr` (createBrowserClient, cookies)
- `lib/get-user.ts` — server-side auth resolution
- `lib/require-admin.ts` — admin email check (iancu1982@gmail.com)
- `components/navigation.tsx` — saves session to `marechef-session`, handles sign-out (clears all auth data + cookies)
- `middleware.ts` — refreshes cookies on all pages

**Rules:**
- Always use `getSession()` not `getUser()` in client components
- Always read `marechef-session` from localStorage as primary token source
- Always include Bearer token via `getAuthHeaders()` in fetch calls
- Use BOTH `supabase` and `supabaseSsr` clients when detecting auth (see `me-client.tsx`)
- Mock user (Chef Anna) is DISABLED on production — only works in development
- Never use `x-mock-user-id` in production

### Database Security (RLS)

All 39 tables have Row Level Security enabled with optimized policies (`(select auth.uid())`):
- **Profiles:** public read (id, display_name, handle, avatar_url, bio, created_at) — email, gemini_api_key, is_moderator, is_certified_creator BLOCKED
- **User-private tables:** `(select auth.uid()) = user_id` (pantry, votes, collections, follows, meal_plans, shopping_lists, health data, etc.)
- **Public reference tables:** SELECT for all (approaches, cuisines, food_styles, posts, threads, replies)
- **Admin tables:** service_role only (app_roles, content_deletions, submissions)
- **Health tables:** user_health_profiles, user_hydration_logs, user_meal_logs, user_fasting_logs, user_weight_logs — all user_id restricted
- **No `*_service` policies** — service_role bypasses RLS entirely, so these were removed
- **No duplicate policies** — each table has exactly the needed policies per role/action
- **FK indexes** on all foreign key columns for performance

API routes use `createServiceSupabaseClient()` (service role, bypasses RLS) for data operations.

## Project Structure

```
food-glam-platform/
├── app/                      # Next.js App Router
│   ├── api/                 # API routes
│   │   ├── admin/           # Admin APIs (users, stats, content, moderation)
│   │   ├── chat/            # AI chatbot API (Gemini)
│   │   ├── health/          # Health profile + logs (hydration, meals, fasting, weight)
│   │   ├── import/          # URL recipe extraction (certified creators)
│   │   ├── messages/        # User-admin messaging (GET/POST/PATCH)
│   │   ├── pantry/          # Pantry CRUD
│   │   ├── privacy/         # GDPR: export, deactivate, reactivate
│   │   ├── recipes/         # by-region, by-country, search
│   │   ├── shopping-lists/  # Lists, items, sharing, presence
│   │   ├── submit/          # Recipe + cocktail submission (3/day limit)
│   │   └── vision/          # Scan (recognise, match-recipes, ocr-recipe)
│   ├── admin/               # Admin dashboard
│   ├── auth/                # Sign-in + OAuth callback
│   ├── cocktails/           # Cocktail pages
│   ├── cookbooks/           # Cookbooks by region/continent (16 regions)
│   ├── health/              # Health dashboard (hydration, fasting, meals, weight, habits)
│   ├── me/                  # User pages (pantry, bar, scan, cookbook, messages)
│   ├── privacy/             # GDPR privacy page (export + deactivate)
│   ├── recipes/             # Recipe detail, cook mode, print
│   ├── submit/              # Submit recipe/cocktail/import forms
│   └── page.tsx             # Homepage
├── components/              # Reusable React components
│   ├── ChatBot.tsx          # Floating AI assistant
│   ├── RecipeScanButton.tsx # OCR camera/upload button for submit forms
│   ├── navigation.tsx       # Main nav (dual auth clients, sign-out)
│   ├── pages/               # Page-level client components
│   │   ├── me-client.tsx    # Profile with health settings
│   │   ├── health-dashboard-client.tsx  # Health dashboard with SVG charts
│   │   ├── messages-client.tsx          # User messaging
│   │   └── admin-client.tsx             # Admin dashboard
│   └── modules/             # Feature module components
├── lib/                     # Utilities
│   ├── ai-provider.ts       # Gemini Vision integration
│   ├── supabase-client.ts   # Browser Supabase clients (supabase + supabaseSsr)
│   ├── supabase-server.ts   # Server Supabase clients
│   ├── get-user.ts          # Auth resolution
│   ├── require-admin.ts     # Admin check
│   ├── rate-limit.ts        # In-memory rate limiter
│   └── recipe-taxonomy.ts   # Region/cuisine taxonomy (16 regions, 150+ countries)
├── scripts/                 # Import & maintenance scripts
│   ├── seed-google-v3.js    # Main recipe importer (Ollama translation)
│   ├── fix-grammar.sql      # Recipe title grammar corrections (99 fixes)
│   ├── fix-cocktail-grammar.sql  # Cocktail title corrections (49 fixes)
│   └── archive/             # 38 one-time migration/seed scripts (moved from root)
├── supabase/                # Supabase config + migrations
└── backups/                 # DB backups (.gitignore'd)
```

## Environment Variables

**Required (`.env.local` + Vercel):**
```
NEXT_PUBLIC_SUPABASE_URL=https://zfnxpoocddqiaiyizsri.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
GOOGLE_API_KEY=AIza...  (Gemini, for server-side scan/OCR)
```

**Optional:**
```
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
if (!user) return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 })
// Use `supabase` (service client) for data operations
```

### Admin Check
```ts
import { ADMIN_EMAILS } from '@/lib/require-admin'
// ADMIN_EMAILS = ['iancu1982@gmail.com']
```

## Key Features

### Health Module (`/health`)
- "Modul Sănătate" toggle controls nav link visibility; health form always visible in profile
- Profile: age, sex, height, weight, goal weight, activity level, medical conditions (11), allergens (8), blood type, smoker, pregnancy status
- **Caloric regime**: hypocaloric (weight loss), hypercaloric (muscle gain), maintenance
- **14 diet protocols**: Mediterranean, Keto, Atkins, Zone, Vegetarian, Vegan, Weight Watchers, South Beach, Raw Food, Glycemic Index, Detox, Low Fat, Low Carb — each with informative description on selection
- **Personal preferences**: free text field respected strictly by AI
- **Target date**: for weight goals with caloric regime
- Auto-calculates BMR (Mifflin-St Jeor) → TDEE → daily calorie target + water goal
- Dashboard sections: daily summary, hydration tracker, meal journal, fasting timer, weight chart, habits grid
- Fasting protocols: 16:8, 18:6, 20:4, OMAD, 5:2
- All charts are pure SVG/CSS (no external chart library)
- DB tables: user_health_profiles (with caloric_regime, diet_type, personal_preferences, target_date), user_hydration_logs, user_meal_logs, user_fasting_logs, user_weight_logs
- Medical disclaimer with ⚠️ next to health settings

### AI Meal Plan Generator (`/api/health/meal-plan`)
- Generates personalized 7-day meal plans using Gemini 2.5 Flash
- Recipe priority: 33% user's own recipes, 33% favorites, 33% database recipes
- Strict allergen checking (NEVER includes allergens)
- Follows selected diet protocol (keto macros, vegan restrictions, etc.)
- Respects personal preferences, medical conditions, fasting schedule
- Optional hydration plan: 6-8 water reminders per day
- **Calendar export (.ics)**: downloadable file with meal events + water reminders
  - Compatible with Google Calendar, Apple Calendar, Outlook
  - VALARM reminders: 10 min before meals, instant for water
  - Timezone: Europe/Bucharest
- UI: day-by-day cards with calorie progress bars, recipe links, hydration pills

### OCR Recipe Scan
- Available on `/submit/recipe` and `/submit/cocktail` pages
- Button: "Scanează rețetă din foto" → camera capture or file upload
- API: `POST /api/vision/ocr-recipe` → Gemini 2.5 Flash Vision
- Extracts: title, ingredients (qty+unit+name), steps, servings, cook time
- Auto-translates to Romanian from any language
- Requires user's Gemini API key

### Certified Creator Import
- Admin toggles `is_certified_creator` on user profiles
- Certified creators access `/submit/import` to import recipes from URLs
- Uses JSON-LD extraction (`/api/import/extract`)
- Images stay on source (no hosting), `source_url` stored for attribution

### GDPR Privacy (`/privacy`)
- Export: downloads JSON with all user data (14 tables)
- Deactivate: requires checkbox + typing "ȘTERG CONTUL"
- 30-day grace period → permanent deletion of all data
- Reactivation: `POST /api/privacy/reactivate`
- Admin accounts cannot be deactivated
- user_id ALWAYS from auth token, never from request body

### Messaging
- User → Admin: compose from `/me/messages`
- Admin replies show as "Moderator" (not real name)
- Stored in `posts` table with `type = 'message'`, replies in `recipe_json.replies[]`
- Unread badge in navigation (polled every 60s)

## Important Notes

- **All UI text must be in Romanian** with proper diacritics (ă, â, î, ș, ț)
- **Image Optimization disabled** (`unoptimized: true`) — Vercel free tier limit
- **CSP active** — allowlist for Google, Supabase, Gemini, Unsplash, Pexels
- **robots.txt** — blocks AhrefsBot, SemrushBot, GPTBot, CCBot; allows Google, Bing, Yandex
- **Cocktails** — created by "MareChef Bartender" profile
- **Recipe import** — uses `seed-google-v3.js` with Ollama translation, target 40/country, Romania excluded
- **Per-user Gemini key** — stored in `profiles.gemini_api_key` (DB) + `marechef-gemini-key` (localStorage)
- **Recipe submission limit** — 3 per day per user (enforced server-side)
- **Comments** — client-side only (not persisted to DB), requires `marechef-session` auth
- **Generic chef profiles** (chef_country) — hidden from admin user management, visible on recipe cards
- **Admin delete** — permanently removes all user data (posts, collections, pantry, health data, auth)
- **Sign-out** — clears marechef-session, mock_user, gemini key, all sb-* cookies, hard reload
- **No hardcoded secrets** — scripts read from env vars, .env files in .gitignore
- **Source maps disabled** in production
- **16 cookbook regions** — including central-america-caribbean and oceania
