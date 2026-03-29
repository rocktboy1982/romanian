'use client'

import Link from 'next/link'

import { useState, useEffect, useRef } from 'react'
import { sanitizeText } from '@/lib/sanitize'

function sanitizeImgSrc(url: string): string {
  if (!url) return ''
  if (url.startsWith('data:image/') || url.startsWith('/')) return url
  try { const u = new URL(url); if (u.protocol === 'https:') return u.href } catch { /* invalid */ }
  return ''
}

interface AuthUser {
  id: string
  display_name: string
  handle: string
  avatar_url: string | null
}

interface Comment {
  id: string
  author: {
    name: string
    handle: string
    avatar: string
  }
  text: string
  createdAt: Date
}

interface RecipeCommentsClientProps {
  recipeId: string
  slug: string
}

/* ─── captcha helpers ────────────────────────────────────────────────────── */

type CaptchaType = 'math' | 'checkbox'

interface MathChallenge {
  type: 'math'
  a: number
  b: number
  op: '+' | '-'
  answer: number
}

interface CheckboxChallenge {
  type: 'checkbox'
}

type Challenge = MathChallenge | CheckboxChallenge

let captchaCounter = 0 // alternates every submit attempt

function generateChallenge(): Challenge {
  captchaCounter++
  const type: CaptchaType = captchaCounter % 2 === 0 ? 'checkbox' : 'math'

  if (type === 'math') {
    const a = Math.floor(Math.random() * 9) + 1
    const b = Math.floor(Math.random() * 9) + 1
    const ops: Array<'+' | '-'> = ['+', '-']
    const op = ops[Math.floor(Math.random() * ops.length)]
    const answer = op === '+' ? a + b : a - b
    return { type: 'math', a, b, op, answer }
  }

  return { type: 'checkbox' }
}

/* ─── time helper ────────────────────────────────────────────────────────── */

function timeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

/* ══════════════════════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════════════════════ */

export default function RecipeCommentsClient({ recipeId, slug }: RecipeCommentsClientProps) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [hydrated, setHydrated] = useState(false)

  /* captcha state */
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [mathInput, setMathInput] = useState('')
  const [checkboxChecked, setCheckboxChecked] = useState(false)
  const [captchaError, setCaptchaError] = useState('')
  const [captchaPassed, setCaptchaPassed] = useState(false)

  /* honeypot — invisible field; bots fill it, humans don't */
  const honeypotRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Read real auth from marechef-session (set by navigation on Google sign-in)
    try {
      const sessionStr = localStorage.getItem('marechef-session')
      if (sessionStr) {
        const session = JSON.parse(sessionStr)
        const u = session?.user
        if (u?.id) {
          const meta = u.user_metadata || {}
          setAuthUser({
            id: u.id,
            display_name: meta.full_name || meta.name || u.email?.split('@')[0] || 'User',
            handle: u.email?.split('@')[0] || 'user',
            avatar_url: meta.avatar_url || meta.picture || null,
          })
        }
      }
    } catch { /* ignore */ }
    setHydrated(true)
  }, [])

  if (!hydrated) return null

  /* ── logged-out gate ──────────────────────────────────────────────────── */

  if (!authUser) {
    return (
       <div id="comments" className="mt-8 pt-6 border-t" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
         <p className="ff-display text-lg font-bold mb-4">Comentarii</p>
         <div className="rounded-2xl p-6 flex flex-col items-center gap-4" style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)' }}>
           <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
             <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
             <path d="M7 11V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4"/>
           </svg>
           <p className="text-center text-sm" style={{ color: '#888' }}>Conectează-te pentru a citi și posta comentarii</p>
           <Link
             href={`/auth/signin?redirect=/recipes/${slug}`}
             className="px-6 py-2 rounded-full text-sm font-semibold text-white"
             style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)' }}
           >
             Conectează-te
           </Link>
         </div>
       </div>
    )
  }

  /* ── captcha verification ─────────────────────────────────────────────── */

  function openCaptcha() {
    setCaptchaError('')
    setMathInput('')
    setCheckboxChecked(false)
    setCaptchaPassed(false)
    setChallenge(generateChallenge())
  }

  function verifyCaptcha(): boolean {
    /* honeypot check — if filled, silently reject */
    if (honeypotRef.current?.value) return false

    if (!challenge) return false

    if (challenge.type === 'math') {
      if (parseInt(mathInput, 10) !== challenge.answer) {
        setCaptchaError('Incorrect answer. Try again.')
        /* regenerate so the numbers change */
        setChallenge(generateChallenge())
        setMathInput('')
        return false
      }
    }

    if (challenge.type === 'checkbox') {
      if (!checkboxChecked) {
        setCaptchaError('Please confirm you are not a robot.')
        return false
      }
    }

    setCaptchaPassed(true)
    setChallenge(null)
    setCaptchaError('')
    return true
  }

  /* ── post comment ─────────────────────────────────────────────────────── */

  function handlePostComment() {
    if (!newComment.trim()) return

    /* captcha not yet shown — open it */
    if (!captchaPassed && !challenge) {
      openCaptcha()
      return
    }

    /* captcha shown but not yet verified */
    if (!captchaPassed && challenge) {
      const ok = verifyCaptcha()
      if (!ok) return
    }

    /* honeypot final check */
    if (honeypotRef.current?.value) return

    if (!authUser) return

    const comment: Comment = {
      id: String(Date.now()),
      author: {
        name: authUser.display_name,
        handle: authUser.handle,
        avatar: authUser.avatar_url || `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}`
      },
      text: newComment,
      createdAt: new Date()
    }

    setComments([comment, ...comments])
    setNewComment('')
    setCaptchaPassed(false) /* require captcha again for next comment */
  }

  /* ── render ───────────────────────────────────────────────────────────── */

  return (
     <div id="comments" className="mt-8 pt-6 border-t" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
       <p className="ff-display text-lg font-bold mb-4">Comentarii ({comments.length})</p>

      {/* Comments list */}
      {comments.length === 0 && (
        <p className="text-sm mb-6" style={{ color: '#999' }}>Fii primul care comentează această rețetă!</p>
      )}
      <div className="space-y-4 mb-6">
        {comments.map(comment => (
          <div key={comment.id} className="flex gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sanitizeImgSrc(comment.author.avatar)}
              alt={comment.author.name}
              width={40}
              height={40}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold">{comment.author.name}</span>
                <span className="text-xs" style={{ color: '#666' }}>@{comment.author.handle}</span>
                <span className="text-xs" style={{ color: '#555' }}>·</span>
                <span className="text-xs" style={{ color: '#666' }}>{timeAgo(comment.createdAt)}</span>
              </div>
               <p className="text-sm leading-relaxed" style={{ color: '#444' }}>{sanitizeText(comment.text)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Comment input box */}
      <div className="rounded-2xl p-4" style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)' }}>
        {/* Author row */}
        <div className="flex gap-3 mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sanitizeImgSrc(authUser.avatar_url || `https://i.pravatar.cc/150?img=5`)}
            alt={authUser.display_name}
            width={40}
            height={40}
            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
          />
          <div className="flex-1">
            <p className="text-sm font-semibold">{authUser.display_name}</p>
            <p className="text-xs" style={{ color: '#666' }}>@{authUser.handle}</p>
          </div>
        </div>

        {/* Honeypot — visually hidden, accessible only to bots */}
        <input
          ref={honeypotRef}
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, width: 0 }}
        />

         <textarea
           value={newComment}
           onChange={e => setNewComment(e.target.value)}
           placeholder="Adaugă un comentariu..."
          className="w-full px-4 py-3 rounded-lg text-sm resize-none mb-3 focus:outline-none"
          style={{
            background: 'rgba(0,0,0,0.05)',
            border: '1px solid rgba(0,0,0,0.12)',
            color: '#111'
          }}
          rows={3}
        />

        {/* ── Captcha challenge (appears after first Post click) ── */}
        {challenge && !captchaPassed && (
          <div
            className="mb-3 rounded-xl p-4"
            style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.1)' }}
          >
             {challenge.type === 'math' && (
               <div>
                 <p className="text-xs font-semibold mb-2" style={{ color: '#555' }}>
                   Verificare rapidă — cât este {challenge.a} {challenge.op} {challenge.b}?
                 </p>
                <input
                  type="number"
                  value={mathInput}
                  onChange={e => { setMathInput(e.target.value); setCaptchaError('') }}
                   placeholder="Răspunsul tău"
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{
                    background: '#fff',
                    border: captchaError ? '1px solid #ff4d6d' : '1px solid rgba(0,0,0,0.15)',
                    color: '#111'
                  }}
                  onKeyDown={e => e.key === 'Enter' && handlePostComment()}
                />
              </div>
            )}

            {challenge.type === 'checkbox' && (
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => { setCheckboxChecked(v => !v); setCaptchaError('') }}
                  className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all"
                  style={{
                    background: checkboxChecked ? 'linear-gradient(135deg,#ff4d6d,#ff9500)' : '#fff',
                    border: captchaError ? '1.5px solid #ff4d6d' : '1.5px solid rgba(0,0,0,0.25)',
                    cursor: 'pointer'
                  }}
                >
                  {checkboxChecked && (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                 <span className="text-sm" style={{ color: '#444' }}>Nu sunt robot</span>
                <span className="ml-auto text-[10px] font-mono" style={{ color: '#bbb' }}>🛡 protected</span>
              </label>
            )}

            {captchaError && (
              <p className="mt-2 text-xs" style={{ color: '#ff4d6d' }}>{captchaError}</p>
            )}
          </div>
        )}

        <div className="flex justify-end">
           <button
             onClick={handlePostComment}
             disabled={!newComment.trim()}
             className="px-5 py-2 rounded-full text-sm font-semibold text-white transition-opacity disabled:opacity-50"
             style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)' }}
           >
             {challenge && !captchaPassed ? 'Verifică și publică' : 'Publică'}
           </button>
        </div>
      </div>
    </div>
  )
}
