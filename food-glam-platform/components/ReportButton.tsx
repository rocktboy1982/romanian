'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase-client'

const REPORT_THRESHOLD = 20

const REASONS = [
  { id: 'incorrect',    label: 'Informații incorecte / înșelătoare' },
  { id: 'harmful',      label: 'Conținut dăunător sau periculos' },
  { id: 'spam',         label: 'Spam sau auto-promovare' },
  { id: 'plagiarism',   label: 'Plagiat / rețetă furată' },
  { id: 'offensive',    label: 'Ofensator sau nepotrivit' },
  { id: 'other',        label: 'Altceva' },
]

interface ReportButtonProps {
  contentId: string
  contentType: 'recipe' | 'cocktail'
  contentTitle: string
  /** compact = just a flag icon, full = icon + "Report" label */
  variant?: 'compact' | 'full'
}

export default function ReportButton({
  contentId,
  contentType,
  contentTitle,
  variant = 'compact',
}: ReportButtonProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'pick' | 'confirm' | 'done' | 'deactivated' | 'already'>('pick')
  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reportCount, setReportCount] = useState(0)
  const [isDeactivated, setIsDeactivated] = useState(false)
  const [hasReported, setHasReported] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  /* ── load persisted state from localStorage ── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`report_${contentId}`)
      if (raw) {
        const data = JSON.parse(raw)
        setReportCount(data.count ?? 0)
        setIsDeactivated(data.deactivated ?? false)
        setHasReported(data.hasReported ?? false)
      }
    } catch { /* ignore */ }
  }, [contentId])

  /* ── close on outside click ── */
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        handleClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  /* ── close on Escape ── */
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  function handleOpen() {
    if (hasReported) { setStep('already'); setOpen(true); return }
    if (isDeactivated) { setStep('deactivated'); setOpen(true); return }
    setStep('pick')
    setReason('')
    setDetail('')
    setOpen(true)
  }

  function handleClose() {
    setOpen(false)
    setTimeout(() => setStep('pick'), 300)
  }

  async function handleSubmit() {
    if (!reason) return
    setSubmitting(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`

      const res = await fetch('/api/report', {
        method: 'POST',
        headers,
        body: JSON.stringify({ contentId, contentType, contentTitle, reason, detail }),
      })
      const data = await res.json()

      if (res.status === 409) {
        /* already reported this session (server-side check) */
        setHasReported(true)
        setStep('already')
        localStorage.setItem(`report_${contentId}`, JSON.stringify({ count: reportCount, deactivated: isDeactivated, hasReported: true }))
        setSubmitting(false)
        return
      }

      const newCount: number = data.count ?? reportCount + 1
      const deactivated: boolean = data.deactivated ?? newCount >= REPORT_THRESHOLD

      setReportCount(newCount)
      setIsDeactivated(deactivated)
      setHasReported(true)

      /* persist locally */
      localStorage.setItem(`report_${contentId}`, JSON.stringify({ count: newCount, deactivated, hasReported: true }))

      setStep(deactivated ? 'deactivated' : 'done')
    } catch {
      /* optimistic local-only fallback */
      const newCount = reportCount + 1
      const deactivated = newCount >= REPORT_THRESHOLD
      setReportCount(newCount)
      setIsDeactivated(deactivated)
      setHasReported(true)
      localStorage.setItem(`report_${contentId}`, JSON.stringify({ count: newCount, deactivated, hasReported: true }))
      setStep(deactivated ? 'deactivated' : 'done')
    } finally {
      setSubmitting(false)
    }
  }

  /* ── deactivated banner (replaces content when threshold hit) ── */
  if (isDeactivated) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
        style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)' }}>
         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
           <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
           <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
         </svg>
         Conținut eliminat — prea multe rapoarte
       </div>
     )
   }

  return (
    <>
      {/* ── Trigger button ── */}
      <button
        onClick={handleOpen}
        title="Report this content"
        className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
        style={{ color: hasReported ? '#ef4444' : '#888' }}
      >
         <svg width="15" height="15" viewBox="0 0 24 24" fill={hasReported ? '#ef4444' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
           <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
           <line x1="4" y1="22" x2="4" y2="15"/>
         </svg>
         {variant === 'full' && (
           <span className="text-xs font-medium">{hasReported ? 'Raportată' : 'Raportează'}</span>
         )}
      </button>

      {/* ── Modal overlay ── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        >
          <div
            ref={modalRef}
            className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: '#fff', color: '#111' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                  <line x1="4" y1="22" x2="4" y2="15"/>
                </svg>
                <span className="font-bold text-sm">Raportează conținut</span>
              </div>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>

            {/* Body */}
            <div className="px-5 py-4">

              {/* ── step: pick reason ── */}
              {step === 'pick' && (
                <>
                   <p className="text-xs text-gray-500 mb-1 truncate">
                     Raportare: <span className="font-semibold text-gray-700">{contentTitle}</span>
                   </p>
                   <p className="text-sm font-semibold mb-3">De ce raportezi asta?</p>
                   <div className="space-y-1.5 mb-4">
                     {REASONS.map(r => (
                       <label key={r.id}
                         className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all"
                         style={{
                           background: reason === r.id ? 'rgba(239,68,68,0.08)' : 'rgba(0,0,0,0.03)',
                           border: reason === r.id ? '1.5px solid rgba(239,68,68,0.4)' : '1.5px solid transparent',
                         }}
                       >
                         <input type="radio" name="reason" value={r.id}
                           checked={reason === r.id}
                           onChange={() => setReason(r.id)}
                           className="sr-only" />
                         <div className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
                           style={{ borderColor: reason === r.id ? '#ef4444' : '#ccc' }}>
                           {reason === r.id && <div className="w-2 h-2 rounded-full bg-red-500" />}
                         </div>
                         <span className="text-sm">{r.label}</span>
                       </label>
                     ))}
                   </div>

                   {reason && (
                     <textarea
                       value={detail}
                       onChange={e => setDetail(e.target.value)}
                       placeholder="Opțional: adaugă mai multe detalii…"
                       rows={2}
                       maxLength={280}
                       className="w-full px-3 py-2 rounded-lg text-sm resize-none focus:outline-none mb-4"
                       style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.12)', color: '#111' }}
                     />
                   )}

                   <div className="flex gap-2">
                     <button onClick={handleClose}
                       className="flex-1 py-2.5 rounded-full text-sm font-semibold"
                       style={{ background: 'rgba(0,0,0,0.06)', color: '#555' }}>
                       Anulează
                     </button>
                     <button
                       onClick={handleSubmit}
                       disabled={!reason || submitting}
                       className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
                       style={{ background: '#ef4444' }}
                     >
                       {submitting ? 'Se trimite…' : 'Trimite raportul'}
                     </button>
                   </div>
                </>
              )}

               {/* ── step: done ── */}
               {step === 'done' && (
                 <div className="text-center py-4">
                   <div className="text-4xl mb-3">✅</div>
                   <p className="font-bold text-base mb-1">Raport trimis</p>
                   <p className="text-sm text-gray-500 mb-4">
                     Mulțumim. Echipa noastră va revizui acest conținut.
                     {reportCount > 1 && ` (${reportCount} rapoarte până acum)`}
                   </p>
                   <button onClick={handleClose}
                     className="px-6 py-2 rounded-full text-sm font-semibold text-white"
                     style={{ background: '#ef4444' }}>
                     Gata
                   </button>
                 </div>
               )}

               {/* ── step: deactivated (threshold hit) ── */}
               {step === 'deactivated' && (
                 <div className="text-center py-4">
                   <div className="text-4xl mb-3">🚫</div>
                   <p className="font-bold text-base mb-1">Conținut eliminat</p>
                   <p className="text-sm text-gray-500 mb-4">
                     Această {contentType} a atins {REPORT_THRESHOLD} rapoarte și a fost dezactivată în așteptarea revizuirii.
                   </p>
                   <button onClick={handleClose}
                     className="px-6 py-2 rounded-full text-sm font-semibold text-white"
                     style={{ background: '#ef4444' }}>
                     Închide
                   </button>
                 </div>
               )}

               {/* ── step: already reported ── */}
               {step === 'already' && (
                 <div className="text-center py-4">
                   <div className="text-4xl mb-3">🚩</div>
                   <p className="font-bold text-base mb-1">Deja raportată</p>
                   <p className="text-sm text-gray-500 mb-4">Ai deja raportată această conținut. O revizuim.</p>
                   <button onClick={handleClose}
                     className="px-6 py-2 rounded-full text-sm font-semibold"
                     style={{ background: 'rgba(0,0,0,0.06)', color: '#555' }}>
                     Închide
                   </button>
                 </div>
               )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
