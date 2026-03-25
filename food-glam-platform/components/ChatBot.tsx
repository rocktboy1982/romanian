'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useTheme } from '@/components/theme-provider'
import Link from 'next/link'

interface Message {
  id: string
  role: 'user' | 'bot'
  content: string
}

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map(i => (
        <span key={i} className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </span>
  )
}

const SYSTEM_PROMPT = `Ești asistentul MareChef.ro, o platformă culinară românească cu peste 2000 de rețete din toată lumea. Ajuți utilizatorii să găsească rețete, să folosească funcțiile site-ului (scanare ingrediente, plan de masă, cămara, bar, cocktailuri). Răspunzi scurt și prietenos în română. Dacă utilizatorul întreabă despre o funcție, ghidează-l pas cu pas.`

type ChatState = 'closed' | 'open' | 'setup-login' | 'setup-key'

export default function ChatBot() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [state, setState] = useState<ChatState>('closed')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Check login + API key status
  const checkStatus = useCallback(() => {
    try {
      const session = localStorage.getItem('marechef-session')
      if (session) {
        const parsed = JSON.parse(session)
        setIsLoggedIn(!!parsed?.user?.email)
      } else {
        setIsLoggedIn(false)
      }
    } catch { setIsLoggedIn(false) }

    // Check for Gemini key in profile (stored by scan setup)
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('sb-') && k.includes('auth-token'))
      for (const k of keys) {
        const raw = localStorage.getItem(k)
        if (raw) {
          const parsed = JSON.parse(raw)
          // We can't read the DB key from localStorage, check via API
          break
        }
      }
    } catch {}
  }, [])

  useEffect(() => { checkStatus() }, [checkStatus])

  // Check if user has Gemini key when opening chat
  const handleOpen = async () => {
    checkStatus()

    if (!isLoggedIn) {
      setState('setup-login')
      return
    }

    // Check if user has Gemini API key
    try {
      const backup = localStorage.getItem('marechef-session')
      const headers: Record<string, string> = {}
      if (backup) {
        const parsed = JSON.parse(backup)
        if (parsed?.access_token) headers['Authorization'] = `Bearer ${parsed.access_token}`
      }

      const res = await fetch('/api/profiles/me/api-key?include_key=true', { headers })
      if (res.ok) {
        const data = await res.json()
        if (data.has_key && data.key) {
          setApiKey(data.key)
          setState('open')
          if (messages.length === 0) {
            setMessages([{
              id: 'welcome',
              role: 'bot',
              content: 'Salut! 👨‍🍳 Sunt asistentul MareChef. Cu ce te pot ajuta? Pot să te ghidez prin rețete, planuri de masă, cămară sau cocktailuri!'
            }])
          }
          return
        }
      }
    } catch {}

    setState('setup-key')
  }

  // Send message to Gemini directly from browser
  const sendMessage = async () => {
    if (!input.trim() || loading || !apiKey) return

    const userMsg: Message = { id: generateId(), role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

      // Build conversation as a single prompt (simpler, avoids startChat issues)
      const recentMsgs = messages.filter(m => m.id !== 'welcome').slice(-8)
      const conversationText = recentMsgs.map(m =>
        m.role === 'user' ? `Utilizator: ${m.content}` : `Asistent: ${m.content}`
      ).join('\n')

      const fullPrompt = `${SYSTEM_PROMPT}\n\n${conversationText ? conversationText + '\n' : ''}Utilizator: ${input.trim()}\nAsistent:`

      const result = await model.generateContent(fullPrompt)
      const reply = result.response.text()

      setMessages(prev => [...prev, { id: generateId(), role: 'bot', content: reply }])
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error('ChatBot error:', errMsg)
      const isQuota = errMsg.includes('429') || errMsg.includes('quota')
      const isKey = errMsg.includes('API_KEY') || errMsg.includes('invalid') || errMsg.includes('401')
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'bot',
        content: isQuota
          ? 'Ai depășit limita gratuită Gemini. Încearcă din nou peste câteva minute.'
          : isKey
            ? 'Cheia Gemini API nu e validă. Mergi la Scanează → Configurare pentru a o actualiza.'
            : `Scuze, am întâmpinat o eroare: ${errMsg.slice(0, 100)}`
      }])
    } finally {
      setLoading(false)
    }
  }

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const panelBg = isDark ? '#1a1a1a' : '#fff'
  const inputBg = isDark ? '#222' : '#f5f5f5'
  const textColor = isDark ? '#f0f0f0' : '#111'

  // ── Floating bubble ──
  if (state === 'closed') {
    return (
      <button
        onClick={handleOpen}
        className="fixed bottom-8 right-8 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
        style={{ background: 'linear-gradient(135deg, #ff4d6d, #ff9500)' }}
        aria-label="Deschide asistentul"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    )
  }

  // ── Login required ──
  if (state === 'setup-login') {
    return (
      <>
        <button onClick={() => setState('closed')} className="fixed bottom-8 right-8 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, #ff4d6d, #ff9500)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
        <div className="fixed bottom-24 right-4 sm:right-8 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-2xl shadow-2xl overflow-hidden" style={{ background: panelBg, color: textColor }}>
          <div className="p-1.5" style={{ background: 'linear-gradient(135deg, #ff4d6d, #ff9500)' }}>
            <div className="text-center text-white font-semibold text-sm py-2">🤖 Asistent MareChef</div>
          </div>
          <div className="p-6 text-center">
            <div className="text-4xl mb-4">🔐</div>
            <h3 className="font-bold text-lg mb-2">Autentificare necesară</h3>
            <p className="text-sm opacity-70 mb-4">
              Pentru a folosi asistentul AI, trebuie să te autentifici cu contul Google.
            </p>
            <Link
              href="/auth/signin"
              className="inline-block px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #ff4d6d, #ff9500)' }}
              onClick={() => setState('closed')}
            >
              Autentifică-te cu Google
            </Link>
          </div>
        </div>
      </>
    )
  }

  // ── API key setup ──
  if (state === 'setup-key') {
    return (
      <>
        <button onClick={() => setState('closed')} className="fixed bottom-8 right-8 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, #ff4d6d, #ff9500)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
        <div className="fixed bottom-24 right-4 sm:right-8 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-2xl shadow-2xl overflow-hidden" style={{ background: panelBg, color: textColor }}>
          <div className="p-1.5" style={{ background: 'linear-gradient(135deg, #ff4d6d, #ff9500)' }}>
            <div className="text-center text-white font-semibold text-sm py-2">🤖 Asistent MareChef</div>
          </div>
          <div className="p-5">
            <div className="text-3xl text-center mb-3">🔑</div>
            <h3 className="font-bold text-base mb-2 text-center">Configurare necesară</h3>
            <p className="text-sm opacity-70 mb-3 text-center">
              Asistentul folosește Gemini AI. Ai nevoie de o cheie API personală — <strong>gratuită</strong>.
            </p>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex items-start gap-2">
                <span className="font-bold text-base">1.</span>
                <span>Mergi la <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="text-blue-500 underline font-medium">Google AI Studio</a></span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-base">2.</span>
                <span>Creează o cheie API (buton "Create API key")</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-base">3.</span>
                <span>Salvează cheia pe pagina de Scanare</span>
              </div>
            </div>
            <Link
              href="/me/scan"
              className="block text-center px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #ff4d6d, #ff9500)' }}
              onClick={() => setState('closed')}
            >
              Configurează cheia API →
            </Link>
            <p className="text-[11px] opacity-50 text-center mt-3">Cheia e personală, stocată în contul tău.</p>
          </div>
        </div>
      </>
    )
  }

  // ── Chat panel ──
  return (
    <>
      <button onClick={() => setState('closed')} className="fixed bottom-8 right-8 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, #ff4d6d, #ff9500)' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
      <div className="fixed bottom-24 right-4 sm:right-8 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ background: panelBg, color: textColor, height: 500 }}>
        {/* Header */}
        <div className="p-1.5 flex-shrink-0" style={{ background: 'linear-gradient(135deg, #ff4d6d, #ff9500)' }}>
          <div className="text-center text-white font-semibold text-sm py-2">🤖 Asistent MareChef</div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed"
                style={msg.role === 'user'
                  ? { background: 'linear-gradient(135deg, #ff4d6d, #ff9500)', color: '#fff' }
                  : { background: isDark ? '#2a2a2a' : '#f0f0f0', color: textColor }
                }
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="px-3.5 py-2.5 rounded-2xl text-sm" style={{ background: isDark ? '#2a2a2a' : '#f0f0f0', color: textColor }}>
                <TypingDots />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 p-3 border-t" style={{ borderColor: isDark ? '#333' : '#e5e5e5' }}>
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Întreabă orice despre rețete..."
              className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: inputBg, color: textColor, border: `1px solid ${isDark ? '#444' : '#ddd'}` }}
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="px-3 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #ff4d6d, #ff9500)' }}
            >
              ➤
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
