import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'

/** POST /api/vision/ocr-recipe
 *  Body: multipart/form-data { image: File, type: 'recipe' | 'cocktail' }
 *  Scans a photo of a handwritten/printed recipe and returns structured data.
 */
export async function POST(req: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const user = await getRequestUser(req, supabase)
    if (!user) {
      return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 })
    }

    const serviceSupabase = createServiceSupabaseClient()
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('gemini_api_key')
      .eq('id', user.id)
      .single()

    const userApiKey = profile?.gemini_api_key?.trim() || null
    if (!userApiKey) {
      return NextResponse.json(
        { error: 'Configurează cheia Gemini API în Contul meu → Scanare' },
        { status: 403 }
      )
    }

    const formData = await req.formData()
    const imageFile = formData.get('image') as File | null
    const recipeType = (formData.get('type') as string) || 'recipe'

    if (!imageFile) {
      return NextResponse.json({ error: 'Imaginea este obligatorie' }, { status: 400 })
    }

    if (imageFile.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Imaginea este prea mare (max 5MB)' }, { status: 400 })
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(imageFile.type)) {
      return NextResponse.json({ error: 'Format invalid. Folosește JPG, PNG sau WebP.' }, { status: 400 })
    }

    const bytes = await imageFile.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    const client = new GoogleGenerativeAI(userApiKey)
    const model = client.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json' },
    })

    const prompt = recipeType === 'cocktail' ? COCKTAIL_PROMPT : RECIPE_PROMPT

    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType: imageFile.type,
          data: base64,
        },
      },
    ])

    const text = result.response.text()
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      return NextResponse.json(
        { error: 'Nu am reușit să interpretez rețeta din imagine. Încearcă cu o poză mai clară.' },
        { status: 422 }
      )
    }

    return NextResponse.json(parsed)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('OCR recipe error:', message)
    if (message.includes('API_KEY_INVALID') || message.includes('API key not valid')) {
      return NextResponse.json({ error: 'Cheia Gemini API nu este validă' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Eroare la procesarea imaginii' }, { status: 500 })
  }
}

const RECIPE_PROMPT = `Analizează această imagine care conține o rețetă culinară (scrisă de mână sau tipărită, în orice limbă).
Extrage toate informațiile și returnează-le în limba ROMÂNĂ ca JSON cu exact această structură:

{
  "title": "Numele rețetei în română",
  "summary": "O descriere scurtă de 1-2 propoziții în română",
  "servings": 4,
  "cookTime": 45,
  "ingredients": [
    { "qty": "250", "unit": "g", "name": "făină" },
    { "qty": "2", "unit": "bucăți", "name": "ouă" },
    { "qty": "1", "unit": "linguriță", "name": "sare" }
  ],
  "steps": [
    "Primul pas al rețetei în română",
    "Al doilea pas al rețetei în română"
  ]
}

Reguli:
- Traducere COMPLETĂ în limba română, inclusiv ingrediente și pași
- "qty" = cantitatea ca string (ex: "250", "2", "1/2")
- "unit" = unitatea de măsură. Folosește DOAR aceste unități: g, kg, ml, l, linguriță, lingură, cană, bucată, bucăți, felie, felii, legătură, vârf de cuțit, strop, conservă, pachet. Dacă nu există unitate, lasă string gol ""
- "cookTime" = timpul total de gătire în minute (număr întreg)
- "servings" = numărul de porții (număr întreg)
- "steps" = pașii de preparare, fiecare ca un string separat
- Dacă un câmp nu poate fi determinat, folosește null pentru numere și string gol pentru text
- NU inventa informații care nu sunt în imagine
- Dacă imaginea nu conține o rețetă, returnează: {"error": "Nu am găsit o rețetă în această imagine"}
`

const COCKTAIL_PROMPT = `Analizează această imagine care conține o rețetă de cocktail/băutură (scrisă de mână sau tipărită, în orice limbă).
Extrage toate informațiile și returnează-le în limba ROMÂNĂ ca JSON cu exact această structură:

{
  "title": "Numele cocktailului în română",
  "summary": "O descriere scurtă de 1-2 propoziții în română",
  "category": "alcoholic",
  "spirit": "gin",
  "serves": 1,
  "difficulty": "easy",
  "ingredients": [
    { "qty": "60", "unit": "ml", "name": "gin" },
    { "qty": "30", "unit": "ml", "name": "suc de lămâie" },
    { "qty": "15", "unit": "ml", "name": "sirop de zahăr" }
  ],
  "steps": [
    "Primul pas de preparare în română",
    "Al doilea pas de preparare în română"
  ],
  "glassware": "Pahar coupe",
  "garnish": "Felie de lămâie"
}

Reguli:
- Traducere COMPLETĂ în limba română
- "category" = "alcoholic" sau "non-alcoholic"
- "spirit" = spiritul de bază, DOAR una din: whisky, gin, rum, tequila, vodka, brandy, liqueur, wine, none
- "difficulty" = "easy", "medium" sau "hard"
- "qty" = cantitatea ca string
- "unit" = unitatea. Folosește DOAR: ml, cl, oz, linguriță, lingură, strop, picătură, parte, părți, felie, bucată. String gol dacă nu e unitate
- "glassware" = tipul de pahar (sau string gol)
- "garnish" = garnitura (sau string gol)
- NU inventa informații care nu sunt în imagine
- Dacă imaginea nu conține o rețetă de cocktail, returnează: {"error": "Nu am găsit o rețetă de cocktail în această imagine"}
`
