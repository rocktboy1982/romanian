'use client'

import { useState, useRef } from 'react'

interface ScanResult {
  title?: string
  summary?: string
  servings?: number
  cookTime?: number
  ingredients?: { qty: string; unit: string; name: string }[]
  steps?: string[]
  // cocktail-specific
  category?: string
  spirit?: string
  serves?: number
  difficulty?: string
  glassware?: string
  garnish?: string
  error?: string
}

interface RecipeScanButtonProps {
  type: 'recipe' | 'cocktail'
  onScanComplete: (data: ScanResult) => void
}

export default function RecipeScanButton({ type, onScanComplete }: RecipeScanButtonProps) {
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [showMenu, setShowMenu] = useState(false)

  async function handleFile(file: File) {
    setError('')
    setScanning(true)
    setShowMenu(false)

    try {
      const session = localStorage.getItem('marechef-session')
      if (!session) {
        setError('Trebuie să fii autentificat')
        return
      }
      const token = JSON.parse(session)?.access_token
      if (!token) {
        setError('Sesiune expirată, reconectează-te')
        return
      }

      const formData = new FormData()
      formData.append('image', file)
      formData.append('type', type)

      const res = await fetch('/api/vision/ocr-recipe', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Eroare la procesare')
        return
      }

      if (data.error) {
        setError(data.error)
        return
      }

      onScanComplete(data)
    } catch {
      setError('Eroare de conexiune')
    } finally {
      setScanning(false)
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        disabled={scanning}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
        style={{
          background: scanning
            ? 'rgba(0,0,0,0.05)'
            : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          color: scanning ? '#999' : '#fff',
          border: '1px solid rgba(0,0,0,0.08)',
        }}
      >
        {scanning ? (
          <>
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" />
            </svg>
            Se procesează...
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            Scanează rețetă din foto
          </>
        )}
      </button>

      {showMenu && !scanning && (
        <div
          className="absolute top-full left-0 mt-2 rounded-xl shadow-lg z-50 overflow-hidden"
          style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)', minWidth: '220px' }}
        >
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-gray-50 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            Fotografiază cu camera
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-gray-50 transition-colors"
            style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Încarcă din galerie
          </button>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFileChange}
        className="hidden"
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onFileChange}
        className="hidden"
      />

      {/* Close menu on click outside */}
      {showMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
      )}

      {error && (
        <p className="mt-2 text-xs" style={{ color: '#ef4444' }}>{error}</p>
      )}
    </div>
  )
}
