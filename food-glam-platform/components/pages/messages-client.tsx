'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase-client'

/* ─── types ─────────────────────────────────────────────────────────────── */

interface MessageReply {
  id: string
  from_user_id: string
  from_display_name: string
  body: string
  created_at: string
  is_admin: boolean
}

interface Message {
  id: string
  from_user_id: string
  from_display_name: string
  from_handle: string
  subject: string
  body: string
  is_read: boolean
  created_at: string
  replies: MessageReply[]
}

/* ─── auth helper ────────────────────────────────────────────────────────── */

async function getAuthHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  try {
    const backup = localStorage.getItem('marechef-session')
    if (backup) {
      const parsed = JSON.parse(backup)
      if (parsed?.access_token) {
        h['Authorization'] = `Bearer ${parsed.access_token}`
        return h
      }
    }
  } catch { /* ignore */ }
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) h['Authorization'] = `Bearer ${session.access_token}`
  if (!h['Authorization']) {
    try {
      const raw = localStorage.getItem('mock_user')
      const id = raw ? JSON.parse(raw).id : 'a0000000-0000-0000-0000-000000000001'
      h['x-mock-user-id'] = id || 'a0000000-0000-0000-0000-000000000001'
    } catch { /* ignore */ }
  }
  return h
}

/* ─── date formatter ─────────────────────────────────────────────────────── */

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('ro-RO', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

/* ════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════ */

export default function MessagesClient() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Compose state
  const [composing, setComposing] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendOk, setSendOk] = useState(false)

  // Thread view
  const [openMsg, setOpenMsg] = useState<Message | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [replying, setReplying] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)

  /* ─── load messages ──────────────────────────────────────────────── */

  const loadMessages = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/messages', { headers })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Eroare la încărcare')
      setMessages(data.messages || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadMessages() }, [loadMessages])

  /* ─── open message (also mark read) ─────────────────────────────── */

  const openMessage = useCallback(async (msg: Message) => {
    setOpenMsg(msg)
    setReplyBody('')
    setReplyError(null)

    if (!msg.is_read) {
      try {
        const headers = await getAuthHeaders()
        await fetch('/api/messages', {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ id: msg.id, action: 'mark_read' }),
        })
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: true } : m))
        setOpenMsg(prev => prev ? { ...prev, is_read: true } : prev)
      } catch { /* non-critical */ }
    }
  }, [])

  /* ─── send new message ───────────────────────────────────────────── */

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    setSendError(null)
    setSendOk(false)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify({ subject: subject.trim() || 'Mesaj nou', message: body }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Eroare la trimitere')
      setSendOk(true)
      setSubject('')
      setBody('')
      setTimeout(() => {
        setComposing(false)
        setSendOk(false)
        loadMessages()
      }, 1800)
    } catch (e: unknown) {
      setSendError(e instanceof Error ? e.message : String(e))
    } finally {
      setSending(false)
    }
  }

  /* ─── send reply ─────────────────────────────────────────────────── */

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!openMsg) return
    setReplying(true)
    setReplyError(null)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/messages', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ id: openMsg.id, action: 'reply', reply_body: replyBody }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Eroare la trimitere')
      const newReply: MessageReply = data.reply
      const updated = { ...openMsg, replies: [...openMsg.replies, newReply] }
      setOpenMsg(updated)
      setMessages(prev => prev.map(m => m.id === openMsg.id ? updated : m))
      setReplyBody('')
    } catch (e: unknown) {
      setReplyError(e instanceof Error ? e.message : String(e))
    } finally {
      setReplying(false)
    }
  }

  /* ─── unread count ───────────────────────────────────────────────── */

  const unreadCount = messages.filter(m => !m.is_read).length

  /* ─── render ─────────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Mesaje</h1>
            {unreadCount > 0 && (
              <p className="text-sm mt-0.5" style={{ color: '#ff9500' }}>
                {unreadCount} {unreadCount === 1 ? 'mesaj necitit' : 'mesaje necitite'}
              </p>
            )}
          </div>
          <button
            onClick={() => { setComposing(true); setOpenMsg(null) }}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff' }}
          >
            + Mesaj nou
          </button>
        </div>

        {/* ── Compose form ── */}
        {composing && (
          <div className="rounded-2xl p-6 mb-6" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h2 className="text-lg font-semibold mb-4">Trimite un mesaj adminului</h2>
            <form onSubmit={sendMessage} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#888' }}>Subiect</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="ex. Ajutor cu o rețetă..."
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f0' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#888' }}>Mesaj <span style={{ color: '#ff4d6d' }}>*</span></label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  required
                  rows={5}
                  placeholder="Scrie mesajul tău..."
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none resize-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f0' }}
                />
              </div>
              {sendError && (
                <p className="text-sm" style={{ color: '#ff4d6d' }}>{sendError}</p>
              )}
              {sendOk && (
                <p className="text-sm font-semibold" style={{ color: '#22c55e' }}>Mesaj trimis cu succes!</p>
              )}
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={sending || !body.trim()}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff' }}
                >
                  {sending ? 'Se trimite...' : 'Trimite'}
                </button>
                <button
                  type="button"
                  onClick={() => { setComposing(false); setSendError(null); setSendOk(false) }}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: 'rgba(255,255,255,0.07)', color: '#aaa', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  Anulează
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Thread view ── */}
        {openMsg && !composing && (
          <div className="rounded-2xl mb-6 overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            {/* Thread header */}
            <div className="flex items-center gap-3 px-5 py-4" style={{ background: '#161616', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <button
                onClick={() => setOpenMsg(null)}
                className="text-sm"
                style={{ color: '#666' }}
              >
                ← Înapoi
              </button>
              <h2 className="text-base font-semibold flex-1 truncate">{openMsg.subject}</h2>
              <span className="text-xs" style={{ color: '#555' }}>{formatDate(openMsg.created_at)}</span>
            </div>

            {/* Original message */}
            <div className="px-5 py-5" style={{ background: '#111' }}>
              <div className="flex items-start gap-3 mb-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff' }}>
                  {openMsg.from_display_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold">{openMsg.from_display_name}</span>
                    <span className="text-xs" style={{ color: '#555' }}>{formatDate(openMsg.created_at)}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: '#ccc' }}>{openMsg.body}</p>
                </div>
              </div>
            </div>

            {/* Replies */}
            {openMsg.replies.length > 0 && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {openMsg.replies.map(r => (
                  <div key={r.id} className="px-5 py-4" style={{
                    background: r.is_admin ? 'rgba(255,149,0,0.05)' : '#111',
                    borderTop: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{
                          background: r.is_admin ? 'linear-gradient(135deg,#ff9500,#ff4d6d)' : 'rgba(255,255,255,0.1)',
                          color: '#fff',
                        }}>
                        {r.from_display_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold">{r.from_display_name}</span>
                          {r.is_admin && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                              style={{ background: 'rgba(255,149,0,0.2)', color: '#ff9500' }}>Moderator</span>
                          )}
                          <span className="text-xs" style={{ color: '#555' }}>{formatDate(r.created_at)}</span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap" style={{ color: '#ccc' }}>{r.body}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Reply box */}
            <div className="px-5 py-4" style={{ background: '#161616', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <form onSubmit={sendReply} className="flex flex-col gap-3">
                <textarea
                  value={replyBody}
                  onChange={e => setReplyBody(e.target.value)}
                  required
                  rows={3}
                  placeholder="Scrie un răspuns..."
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none resize-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f0' }}
                />
                {replyError && <p className="text-sm" style={{ color: '#ff4d6d' }}>{replyError}</p>}
                <div>
                  <button
                    type="submit"
                    disabled={replying || !replyBody.trim()}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff' }}
                  >
                    {replying ? 'Se trimite...' : 'Răspunde'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Message list ── */}
        {!openMsg && !composing && (
          <>
            {loading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: '#161616' }} />
                ))}
              </div>
            ) : error ? (
              <div className="py-12 text-center">
                <div className="text-3xl mb-2">!</div>
                <p className="text-sm" style={{ color: '#ff4d6d' }}>{error}</p>
                <button onClick={loadMessages} className="mt-3 text-xs underline" style={{ color: '#888' }}>
                  Reîncearcă
                </button>
              </div>
            ) : messages.length === 0 ? (
              <div className="py-16 text-center rounded-2xl" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="text-4xl mb-3">✉️</div>
                <h3 className="text-base font-semibold mb-1">Niciun mesaj încă</h3>
                <p className="text-sm" style={{ color: '#666' }}>
                  Trimite primul mesaj adminului folosind butonul de mai sus.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                {messages.map((msg, i) => (
                  <button
                    key={msg.id}
                    onClick={() => openMessage(msg)}
                    className="w-full text-left flex items-start gap-4 px-5 py-4 transition-colors"
                    style={{
                      background: msg.is_read ? 'transparent' : 'rgba(255,149,0,0.04)',
                      borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    }}
                  >
                    {/* Unread dot */}
                    <div className="flex-shrink-0 w-2 h-2 rounded-full mt-2"
                      style={{ background: msg.is_read ? 'transparent' : '#ff9500' }} />

                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff' }}>
                      {msg.from_display_name.charAt(0).toUpperCase()}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-sm font-semibold truncate"
                          style={{ color: msg.is_read ? '#aaa' : '#f0f0f0' }}>
                          {msg.subject}
                        </span>
                        <span className="text-xs flex-shrink-0" style={{ color: '#555' }}>
                          {formatDate(msg.created_at)}
                        </span>
                      </div>
                      <p className="text-xs truncate" style={{ color: '#666' }}>
                        {msg.from_display_name} &mdash; {msg.body.slice(0, 80)}{msg.body.length > 80 ? '...' : ''}
                      </p>
                      {msg.replies.length > 0 && (
                        <p className="text-xs mt-0.5" style={{ color: '#555' }}>
                          {msg.replies.length} {msg.replies.length === 1 ? 'răspuns' : 'răspunsuri'}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
