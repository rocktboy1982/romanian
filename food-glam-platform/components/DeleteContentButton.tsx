'use client'

import { useState, useEffect, useRef } from 'react'

interface DeleteContentButtonProps {
  postId: string
  postTitle: string
  /** Callback when deletion is successful */
  onDeleted?: () => void
  /** Optional: additional CSS class for the trigger button */
  className?: string
  /** Optional: show as text button instead of icon */
  variant?: 'icon' | 'button'
  /** Optional: size */
  size?: 'sm' | 'md'
}

export default function DeleteContentButton({
  postId,
  postTitle,
  onDeleted,
  className = '',
  variant = 'icon',
  size = 'md',
}: DeleteContentButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

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
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  function handleOpen() {
    setOpen(true)
    setError(null)
  }

  function handleClose() {
    setOpen(false)
    setError(null)
  }

  async function handleDelete() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/posts/${postId}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'User requested deletion' }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Eroare la ștergere')
      }

      /* Success */
      handleClose()
      onDeleted?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Eroare la ștergere'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  /* ── Size classes ── */
  const buttonSize = size === 'sm' ? 'w-6 h-6' : 'w-7 h-7'
  const buttonTextSize = size === 'sm' ? 'text-xs' : 'text-sm'
  const buttonPadding = size === 'sm' ? 'px-2 py-1' : 'px-3 py-1.5'

  return (
    <>
      {/* ── Trigger button ── */}
      {variant === 'icon' ? (
        <button
          onClick={handleOpen}
          title="Șterge"
          className={`flex items-center justify-center transition-opacity hover:opacity-70 ${buttonSize} ${className}`}
          style={{ color: '#dc2626' }}
          aria-label="Șterge conținutul"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        </button>
      ) : (
        <button
          onClick={handleOpen}
          className={`flex items-center gap-1.5 rounded-lg text-red-600 transition-colors hover:bg-red-50 ${buttonTextSize} ${buttonPadding} font-medium ${className}`}
          style={{ border: '1px solid rgba(220,38,38,0.2)' }}
          aria-label="Șterge conținutul"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
          Șterge
        </button>
      )}

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
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            aria-describedby="delete-modal-description"
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}
            >
              <div className="flex items-center gap-2">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
                <span className="font-bold text-base" id="delete-modal-title">
                  Șterge conținut
                </span>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                aria-label="Închide modal"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-6">
              <p className="text-xs text-gray-500 mb-3 truncate">
                Ștergere: <span className="font-semibold text-gray-700">{postTitle}</span>
              </p>

              <p
                className="text-base font-semibold mb-2"
                id="delete-modal-description"
              >
                Ești sigur că vrei să ștergi acest conținut?
              </p>

              <p className="text-sm text-gray-600 mb-6">
                Această acțiune nu poate fi anulată.
              </p>

              {/* Error message */}
              {error && (
                <div
                  className="mb-4 p-3 rounded-lg text-sm"
                  style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}
                  role="alert"
                >
                  {error}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-opacity"
                  style={{ background: 'rgba(0,0,0,0.06)', color: '#555' }}
                >
                  Anulează
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
                  style={{ background: '#dc2626' }}
                >
                  {loading ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Se șterge...
                    </>
                  ) : (
                    'Șterge definitiv'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
