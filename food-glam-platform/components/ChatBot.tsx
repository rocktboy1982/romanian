'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useTheme } from '@/components/theme-provider'

interface Message {
  id: string
  role: 'user' | 'bot'
  content: string
}

type HistoryEntry = { role: 'user' | 'model'; content: string }

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'bot',
  content:
    'Salut! Sunt asistentul MareChef 👨‍🍳 Cu ce te pot ajuta? Pot să te ghidez prin rețete, planuri de masă, cămară sau cocktailuri!',
}

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

/* ─── Typing indicator (three dots) ─────────────────────────────────────── */

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 px-1 py-0.5">
      <span
        className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
        style={{ animationDelay: '0ms' }}
      />
      <span
        className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
        style={{ animationDelay: '150ms' }}
      />
      <span
        className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
        style={{ animationDelay: '300ms' }}
      />
    </span>
  )
}

/* ─── Single message bubble ──────────────────────────────────────────────── */

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end mb-3">
        <div
          className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-sm text-white text-sm leading-relaxed"
          style={{
            background: 'linear-gradient(135deg, #ff4d6d, #ff9500)',
          }}
        >
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tl-sm bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm leading-relaxed">
        {message.content}
      </div>
    </div>
  )
}

/* ─── Main ChatBot component ─────────────────────────────────────────────── */

export default function ChatBot() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  // Build history array for API (exclude welcome message, convert to model format)
  const buildHistory = useCallback((): HistoryEntry[] => {
    return messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        content: m.content,
      }))
  }, [messages])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMessage: Message = { id: generateId(), role: 'user', content: text }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const history = buildHistory()
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: 'bot',
            content: data.error ?? 'A apărut o eroare. Încearcă din nou.',
          },
        ])
      } else {
        setMessages((prev) => [
          ...prev,
          { id: generateId(), role: 'bot', content: data.reply },
        ])
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'bot',
          content: 'Nu pot conecta la server. Verifică conexiunea și încearcă din nou.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }, [input, loading, buildHistory])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const canSend = input.trim().length > 0 && !loading

  return (
    <>
      {/* ── Chat panel ─────────────────────────────────────────────────── */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Asistent MareChef"
          className="fixed bottom-24 right-4 sm:right-8 z-50 w-[calc(100vw-2rem)] max-w-sm flex flex-col"
          style={{
            height: '500px',
            borderRadius: '1rem',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            background: isDark ? '#1a1a1a' : '#ffffff',
            border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{
              borderRadius: '1rem 1rem 0 0',
              background: 'linear-gradient(135deg, #ff4d6d, #ff9500)',
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">🤖</span>
              <span className="font-semibold text-white text-sm">Asistent MareChef</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Închide asistentul"
              className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Message list */}
          <div
            className="flex-1 overflow-y-auto px-4 py-4"
            style={{ scrollbarWidth: 'thin' }}
          >
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="flex justify-start mb-3">
                <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm bg-gray-100 dark:bg-gray-700">
                  <TypingDots />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div
            className="flex-shrink-0 px-3 py-3"
            style={{
              borderTop: isDark
                ? '1px solid rgba(255,255,255,0.08)'
                : '1px solid rgba(0,0,0,0.08)',
            }}
          >
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Întreabă orice despre rețete..."
                disabled={loading}
                className="flex-1 text-sm px-3 py-2.5 rounded-xl outline-none transition-all disabled:opacity-50"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                  border: isDark
                    ? '1px solid rgba(255,255,255,0.12)'
                    : '1px solid rgba(0,0,0,0.12)',
                  color: isDark ? '#f0f0f0' : '#111',
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!canSend}
                aria-label="Trimite mesaj"
                className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: canSend
                    ? 'linear-gradient(135deg, #ff4d6d, #ff9500)'
                    : isDark
                    ? 'rgba(255,255,255,0.1)'
                    : 'rgba(0,0,0,0.08)',
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={canSend ? '#ffffff' : isDark ? '#888' : '#aaa'}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Floating bubble button ──────────────────────────────────────── */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? 'Închide asistentul' : 'Deschide asistentul MareChef'}
        className="fixed bottom-8 right-8 z-50 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #ff4d6d, #ff9500)',
          boxShadow: open
            ? '0 8px 32px rgba(255, 77, 109, 0.5)'
            : '0 4px 20px rgba(255, 77, 109, 0.4)',
        }}
      >
        {open ? (
          /* X icon when open */
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          /* Chat icon when closed */
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>
    </>
  )
}
