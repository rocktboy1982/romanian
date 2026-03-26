"use client"

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

type Toast = { id: string; message: string; type?: 'info'|'success'|'error' }

type ToastContext = { push: (t: Omit<Toast,'id'>) => void }

const ctx = createContext<ToastContext | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((t: Omit<Toast,'id'>) => {
    const id = Math.random().toString(36).slice(2,9)
    setToasts(s => [...s, { id, ...t }])
  }, [])

  useEffect(() => {
    if (!toasts.length) return
    const timers = toasts.map(t => setTimeout(() => {
      setToasts(s => s.filter(x => x.id !== t.id))
    }, 4500))
    return () => timers.forEach(clearTimeout)
  }, [toasts])

  return (
    <ctx.Provider value={{ push }}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 left-4 z-50 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`px-3 py-2 rounded shadow text-sm ${t.type === 'error' ? 'bg-red-600 text-white' : t.type === 'success' ? 'bg-green-600 text-white' : 'bg-gray-800 text-white'}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ctx.Provider>
  )
}

export function useToast() {
  const c = useContext(ctx)
  if (!c) throw new Error('useToast must be used within ToastProvider')
  return c
}
