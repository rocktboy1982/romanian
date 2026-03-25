import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { rateLimit } from '@/lib/rate-limit'

const SYSTEM_PROMPT = `Ești asistentul MareChef.ro, o platformă culinară românească cu peste 2000 de rețete din toată lumea. Ajuți utilizatorii să găsească rețete, să folosească funcțiile site-ului (scanare ingrediente, plan de masă, cămara, bar, cocktailuri). Răspunzi scurt și prietenos în română.`

const MAX_HISTORY = 10

export async function POST(req: Request) {
  // Rate limit: 20 requests per minute per IP
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'

  const { success } = rateLimit(`chat:${ip}`, 20, 60_000)
  if (!success) {
    return NextResponse.json(
      { error: 'Prea multe mesaje. Încearcă din nou într-un minut.' },
      { status: 429 }
    )
  }

  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Serviciul AI nu este configurat.' },
      { status: 503 }
    )
  }

  let body: { message?: string; history?: Array<{ role: string; content: string }> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Cerere invalidă.' }, { status: 400 })
  }

  const { message, history = [] } = body

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return NextResponse.json({ error: 'Mesajul este gol.' }, { status: 400 })
  }

  // Limit history to last MAX_HISTORY messages to control costs
  const trimmedHistory = history.slice(-MAX_HISTORY)

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_PROMPT,
    })

    // Build chat history in Gemini format
    const chatHistory = trimmedHistory
      .filter((m) => m.role === 'user' || m.role === 'model')
      .map((m) => ({
        role: m.role as 'user' | 'model',
        parts: [{ text: m.content }],
      }))

    const chat = model.startChat({ history: chatHistory })
    const result = await chat.sendMessage(message.trim())
    const reply = result.response.text()

    return NextResponse.json({ reply })
  } catch (err) {
    console.error('[chat/route] Gemini error:', err)
    return NextResponse.json(
      { error: 'Eroare la generarea răspunsului. Încearcă din nou.' },
      { status: 500 }
    )
  }
}
