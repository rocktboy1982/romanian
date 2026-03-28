import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'
import { GoogleGenerativeAI } from '@google/generative-ai'

// ─── Week helpers ─────────────────────────────────────────────────────────────

function getWeekRange(which: 'current' | 'next'): { start: Date; end: Date } {
  const now = new Date()
  // Monday = 1, Sunday = 0 → offset so Monday is day 0
  const dayOfWeek = now.getDay() // 0=Sun, 1=Mon ... 6=Sat
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMonday + (which === 'next' ? 7 : 0))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { start: monday, end: sunday }
}

function dateToStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

// ─── Romanian day names ────────────────────────────────────────────────────────

const RO_DAYS = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă']

// ─── Label helpers ────────────────────────────────────────────────────────────

function caloricRegimeLabel(r: string): string {
  const m: Record<string, string> = {
    maintenance: 'Menținere greutate',
    hypocaloric: 'Hipocaloric — scădere în greutate',
    hypercaloric: 'Hipercaloric — creștere în greutate',
  }
  return m[r] ?? r
}

function dietTypeLabel(d: string): string {
  const m: Record<string, string> = {
    none: 'Fără dietă specifică',
    mediterranean: 'Dieta Mediteraneană',
    keto: 'Dieta Keto (Ketogenică)',
    atkins: 'Dieta Atkins',
    zone: 'Dieta Zone',
    vegetarian: 'Vegetarianism',
    vegan: 'Veganism',
    weight_watchers: 'Weight Watchers',
    south_beach: 'Dieta South Beach',
    raw_food: 'Dieta Raw Food',
    glycemic_index: 'Dieta bazată pe indicele glicemic',
    detox: 'Dieta de detoxifiere',
    low_fat: 'Dieta Low Fat',
    low_carb: 'Dieta Low Carb',
    rina: 'Dieta Rina (disociată 90 zile)',
    dukan: 'Dieta Dukan',
    paleo: 'Dieta Paleo',
    dash: 'Dieta DASH',
    whole30: 'Whole30',
    fodmap: 'Dieta Low FODMAP',
    carnivore: 'Dieta Carnivor',
    flexitarian: 'Flexitarianism',
  }
  return m[d] ?? d
}

// ─── POST /api/health/meal-plan ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 })

    const body = await req.json()
    const week: 'current' | 'next' = body.week === 'next' ? 'next' : 'current'
    const includeHydration: boolean = !!body.include_hydration

    // ── 1. Fetch health profile ──────────────────────────────────────────────
    const { data: profile, error: profileErr } = await supabase
      .from('user_health_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 })
    if (!profile) return NextResponse.json({ error: 'Profilul de sănătate nu a fost configurat' }, { status: 400 })

    // ── 2. Fetch user's Gemini API key ────────────────────────────────────────
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('gemini_api_key')
      .eq('id', user.id)
      .maybeSingle()

    const geminiKey = profileRow?.gemini_api_key || process.env.GOOGLE_API_KEY || ''
    if (!geminiKey) {
      return NextResponse.json({ error: 'Cheia API Gemini nu a fost configurată' }, { status: 400 })
    }

    // ── 3. Fetch user's own recipes ───────────────────────────────────────────
    const { data: ownRecipes } = await supabase
      .from('posts')
      .select('id, title, slug')
      .eq('created_by', user.id)
      .eq('type', 'recipe')
      .limit(20)

    // ── 4. Fetch user's favorite recipes ──────────────────────────────────────
    const { data: collections } = await supabase
      .from('collections')
      .select('post_id')
      .eq('user_id', user.id)
      .limit(50)

    const favIds = (collections ?? []).map(c => c.post_id).filter(Boolean)
    let favRecipes: { id: string; title: string; slug: string }[] = []
    if (favIds.length > 0) {
      const { data: favData } = await supabase
        .from('posts')
        .select('id, title, slug')
        .in('id', favIds)
        .eq('type', 'recipe')
        .limit(20)
      favRecipes = favData ?? []
    }

    // ── 5. Fetch random recipes from DB ───────────────────────────────────────
    const { data: randomRecipes } = await supabase
      .from('posts')
      .select('id, title, slug')
      .eq('type', 'recipe')
      .limit(30)

    // ── 6. Build week dates ────────────────────────────────────────────────────
    const { start, end } = getWeekRange(week)
    const weekDays: { day: string; date: string }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      weekDays.push({ day: RO_DAYS[d.getDay()], date: dateToStr(d) })
    }

    // ── 7. Build AI prompt ────────────────────────────────────────────────────
    const allergenList = (profile.allergens ?? []).join(', ') || 'niciunul'
    const medCondList = (profile.medical_conditions ?? []).join(', ') || 'niciunul'

    const ownList = (ownRecipes ?? []).map(r => `"${r.title}" (ID: ${r.id}, slug: ${r.slug})`).join('\n') || 'niciuna'
    const favList = favRecipes.map(r => `"${r.title}" (ID: ${r.id}, slug: ${r.slug})`).join('\n') || 'niciuna'
    const randomList = (randomRecipes ?? []).map(r => `"${r.title}" (ID: ${r.id}, slug: ${r.slug})`).join('\n') || 'niciuna'

    const prompt = `Ești un nutriționist certificat care creează un plan alimentar săptămânal personalizat pentru un utilizator de pe platforma MareChef.ro.

PROFILUL UTILIZATORULUI:
- Vârstă: ${profile.age ?? 'necunoscut'}
- Sex: ${profile.gender === 'M' ? 'Masculin' : profile.gender === 'F' ? 'Feminin' : 'necunoscut'}
- Înălțime: ${profile.height_cm ?? '—'} cm
- Greutate actuală: ${profile.weight_kg ?? '—'} kg
- Greutate țintă: ${profile.goal_weight_kg ?? '—'} kg
- Dată țintă: ${profile.target_date ?? 'nespecificată'}
- Nivel activitate: ${profile.activity_level ?? 'moderat'}
- Țintă calorii zilnice: ${profile.daily_calorie_target ?? 2000} kcal
- Regim caloric: ${caloricRegimeLabel(profile.caloric_regime ?? 'maintenance')}
- Tip dietă: ${dietTypeLabel(profile.diet_type ?? 'none')}
- Condiții medicale: ${medCondList}
- ALERGENI (STRICT - NU INCLUDE NICIODATĂ aceste alimente): ${allergenList}
- ALIMENTE EXCLUSE EXPLICIT (utilizatorul NU mănâncă acestea NICIODATĂ): ${(profile.excluded_foods ?? []).join(', ') || 'niciunul'}
- Fumător: ${profile.is_smoker ? 'Da' : 'Nu'}
- Sarcină/Alăptare: ${profile.pregnancy_status ?? 'none'}
- Grupă sanguină: ${profile.blood_type ?? 'necunoscută'}
- Preferințe personale (TREBUIE RESPECTATE CU STRICTEȚE): ${profile.personal_preferences || 'niciuna'}
- Protocol fasting: ${profile.fasting_protocol ?? 'niciunul'}${profile.fasting_protocol && profile.fasting_protocol !== 'none' && profile.fasting_eating_start && profile.fasting_eating_end ? `
- FEREASTRĂ DE ALIMENTARE (OBLIGATORIU): ${profile.fasting_eating_start.slice(0,5)} – ${profile.fasting_eating_end.slice(0,5)}
  TOATE mesele TREBUIE programate DOAR în acest interval. NICIO masă în afara ferestrei.
  Orele meselor trebuie distribuite uniform în fereastra de alimentare.
  Exemplu pentru fereastră 12:00-20:00: prima masă la 12:00, a doua la 15:30, a treia la 19:30.
  Exemplu pentru fereastră 14:00-20:00 (18:6): prima masă la 14:00, a doua la 17:00, a treia la 19:30.` : ''}

REȚETE DISPONIBILE (folosește-le cu prioritate):
1. Rețetele proprii ale utilizatorului (prioritate maximă):
${ownList}

2. Rețetele favorite ale utilizatorului (prioritate ridicată):
${favList}

3. Rețete din baza de date (completare):
${randomList}

REGULI STRICTE:
1. Creează un plan de 7 zile (${weekDays.map(w => `${w.day} ${w.date}`).join(', ')})
2. Fiecare zi are mesele programate CU ORA EXACTĂ (câmpul "time" obligatoriu, format "HH:MM")${profile.fasting_protocol && profile.fasting_protocol !== 'none' ? `
   IMPORTANT: Toate mesele TREBUIE să fie ÎNTRE ${profile.fasting_eating_start?.slice(0,5)} și ${profile.fasting_eating_end?.slice(0,5)}. Nicio masă în afara ferestrei!` : `
   Ore implicite: mic dejun 08:00, prânz 13:00, gustare 16:00, cină 19:00`}
3. INTERZIS ABSOLUT să incluzi alimente care conțin: ${allergenList} — verifică fiecare rețetă
4. Respectă strict dieta: ${dietTypeLabel(profile.diet_type ?? 'none')}${profile.diet_type === 'keto' ? `
   REGULI KETO: Max 20-50g carbohidrați/zi. Macro: ~70% grăsimi, ~25% proteine, ~5% carbohidrați.
   Elimină: zahăr, cereale, pâine, paste, orez, cartofi, fructe dulci, leguminoase.
   Permite: carne, pește, ouă, brânzeturi, avocado, nuci, ulei de măsline, legume cu frunze verzi.
   Pentru cetoză corectă: prima masă bogată în grăsimi, nu sări peste mese, hidratare crescută.` : ''}${profile.diet_type === 'rina' ? `
   REGULI DIETA RINA (disociată 90 zile): Ciclu de 4 zile care se repetă:
   - Ziua 1 (PROTEINE): doar carne, pește, ouă, lactate. Niciun carbohidrat sau amidon.
   - Ziua 2 (AMIDON/LEGUME): doar legume cu amidon, cereale integrale, leguminoase. Fără carne.
   - Ziua 3 (CARBOHIDRAȚI): paste, pâine, pizza, dulciuri, ciocolată. Ziua de recompensă.
   - Ziua 4 (VITAMINE/FRUCTE): doar fructe proaspete, smoothie-uri, salate crude. Fără gătit.
   La fiecare 29 de zile: o zi de DETOX cu doar apă și ceaiuri.
   IMPORTANT: Calculează ce zi din ciclul de 4 este fiecare zi din săptămână și respectă strict grupa alimentară!
   Ziua 1 a ciclului = ${weekDays[0].date} (Luni). Deci: Luni=Proteine, Marți=Amidon, Miercuri=Carbohidrați, Joi=Vitamine, Vineri=Proteine, Sâmbătă=Amidon, Duminică=Carbohidrați.` : ''}
5. Țintă calorii zilnice: ${profile.daily_calorie_target ?? 2000} kcal
6. Folosește rețetele din listele de mai sus când sunt potrivite (completează câmpurile recipe_id și recipe_slug)
7. Dacă nu există rețetă potrivită, propune o masă personalizată cu titlu și calorii estimate (recipe_id: null, recipe_slug: null)
8. Respectă preferințele personale: ${profile.personal_preferences || 'niciuna'}
9. Asigură varietate și echilibru nutrițional pe parcursul săptămânii
10. Regim caloric ${caloricRegimeLabel(profile.caloric_regime ?? 'maintenance')}: ajustează porțiile corespunzător
11. Toate textele în limba română${includeHydration ? `
12. HIDRATARE: Obiectivul zilnic de apă al utilizatorului este ${profile.daily_water_goal_ml ?? 2500}ml.
    Pentru fiecare zi, generează un program de hidratare cu 6-8 momente de băut apă distribuite uniform pe parcursul zilei (inclusiv în afara ferestrei de alimentare — apa e permisă oricând).
    Fiecare moment: { "time": "HH:MM", "amount_ml": 300, "note": "Descriere scurtă" }
    Adaugă câmpul "hydration" în fiecare obiect zi.` : ''}

Returnează DOAR JSON valid (fără text înainte sau după), cu această structură exactă:
{
  "week_start": "${dateToStr(start)}",
  "week_end": "${dateToStr(end)}",
  "daily_calorie_target": ${profile.daily_calorie_target ?? 2000},
  "diet_type": "${profile.diet_type ?? 'none'}",
  "caloric_regime": "${profile.caloric_regime ?? 'maintenance'}",
  "days": [
    {
      "day": "Luni",
      "date": "YYYY-MM-DD",
      "meals": [
        {
          "type": "breakfast",
          "label": "Mic dejun",
          "time": "08:00",
          "recipe_id": "uuid-sau-null",
          "recipe_title": "Titlul mesei",
          "recipe_slug": "slug-sau-null",
          "calories": 350,
          "notes": "Note opționale despre porție sau preparare"
        },
        { "type": "lunch", "label": "Prânz", "time": "13:00", "recipe_id": null, "recipe_title": "...", "recipe_slug": null, "calories": 650, "notes": "" },
        { "type": "dinner", "label": "Cină", "time": "19:00", "recipe_id": null, "recipe_title": "...", "recipe_slug": null, "calories": 550, "notes": "" },
        { "type": "snack", "label": "Gustare", "time": "16:00", "recipe_id": null, "recipe_title": "...", "recipe_slug": null, "calories": 200, "notes": "" }
      ],
      "total_calories": 1750${includeHydration ? `,
      "hydration": [
        { "time": "08:00", "amount_ml": 300, "note": "Un pahar de apă la trezire" },
        { "time": "10:30", "amount_ml": 250, "note": "Hidratare de dimineață" },
        { "time": "13:00", "amount_ml": 300, "note": "Apă înainte de prânz" },
        { "time": "15:30", "amount_ml": 250, "note": "Hidratare după-amiază" },
        { "time": "17:00", "amount_ml": 300, "note": "Apă înainte de antrenament" },
        { "time": "19:00", "amount_ml": 250, "note": "Apă la cină" },
        { "time": "21:00", "amount_ml": 200, "note": "Ultimul pahar înainte de somn" }
      ]` : ''}
    }
  ],
  "weekly_summary": {
    "avg_calories": 1800,
    "protein_focus": "Pui, pește, leguminoase",
    "notes": "Scurtă descriere a planului și adaptărilor făcute"
  },
  "disclaimer": "Acest plan alimentar este orientativ. Consultă un medic sau nutriționist înainte de a modifica dieta."
}`

    // ── 8. Call Gemini ────────────────────────────────────────────────────────
    const genAI = new GoogleGenerativeAI(geminiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
    })

    const rawText = result.response.text()

    // Parse JSON — strip markdown fences if present
    let planJson: unknown
    try {
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
      planJson = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ error: 'Răspuns invalid de la AI — nu s-a putut parsa JSON', raw: rawText }, { status: 500 })
    }

    return NextResponse.json({ plan: planJson })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
