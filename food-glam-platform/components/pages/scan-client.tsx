'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import Image from 'next/image'
import FallbackImage from '@/components/FallbackImage'
import { useRouter, useSearchParams } from 'next/navigation'

const BG = '#dde3ee'

export default function ScanClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const existingSessionId = searchParams.get('session_id') // set when adding another photo
  const isMergeMode = !!existingSessionId

  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [context, setContext] = useState('')
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existingCount, setExistingCount] = useState(0)

  // If we're in merge mode, show how many ingredients already found
  useEffect(() => {
    if (!existingSessionId) return
    try {
      const raw = sessionStorage.getItem(`scan_result_${existingSessionId}`)
      if (raw) {
        const r = JSON.parse(raw)
        setExistingCount(r.ingredients?.length ?? 0)
      }
    } catch { /* ignore */ }
  }, [existingSessionId])

  const loadFile = useCallback((f: File) => {
    if (!f.type.startsWith('image/')) { setError('Alege un fișier imagine.'); return }
    setFile(f)
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target?.result as string)
    reader.readAsDataURL(f)
    setError(null)
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) loadFile(f)
  }, [loadFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) loadFile(f)
  }, [loadFile])

  const handleScan = async () => {
    if (!file) return
    setScanning(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('image', file)
      if (context) formData.append('context', context)
      if (existingSessionId) formData.append('session_id', existingSessionId)

      // Determine endpoint: merge if we have an existing session, otherwise fresh recognise
      const endpoint = isMergeMode
        ? '/api/vision/recognise' // recognise always returns a full result; we'll merge client-side
        : '/api/vision/recognise'

      const res = await fetch(endpoint, { method: 'POST', body: formData })

      if (!res.ok) {
        const d = await res.json()
         throw new Error(d.error ?? 'Scanarea a eșuat')
      }

      const data = await res.json()

      if (isMergeMode && existingSessionId) {
        // Merge new ingredients into the existing session via the merge endpoint
        const existingRaw = sessionStorage.getItem(`scan_result_${existingSessionId}`)
        const existing = existingRaw ? JSON.parse(existingRaw) : { ingredients: [] }
        const newIngredients = data.ingredients ?? []

        const mergeRes = await fetch('/api/vision/recognise/merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: existingSessionId,
            merge_ingredients: newIngredients,
          }),
        })

        if (mergeRes.ok) {
          const merged = await mergeRes.json()
          // Update the sessionStorage with the merged result
          const updated = { ...existing, ...merged, session_id: existingSessionId }
          try { sessionStorage.setItem(`scan_result_${existingSessionId}`, JSON.stringify(updated)) } catch { /* ignore */ }
          router.push(`/me/scan/${existingSessionId}/review`)
        } else {
          // Fallback: just update ingredients by combining
          const combined = {
            ...existing,
            ingredients: [...(existing.ingredients ?? []), ...newIngredients],
            scans_count: (existing.scans_count ?? 1) + 1,
          }
          try { sessionStorage.setItem(`scan_result_${existingSessionId}`, JSON.stringify(combined)) } catch { /* ignore */ }
          router.push(`/me/scan/${existingSessionId}/review`)
        }
      } else {
        // Fresh scan
        try { sessionStorage.setItem(`scan_result_${data.session_id}`, JSON.stringify(data)) } catch { /* ignore */ }
        router.push(`/me/scan/${data.session_id}/review`)
      }
    } catch (e) {
       setError(e instanceof Error ? e.message : 'Ceva a mers greșit')
    } finally {
      setScanning(false)
    }
  }

  return (
    <main style={{ background: BG, minHeight: '100vh', color: '#111', paddingBottom: 80 }}>
      <div style={{ maxWidth: 540, margin: '0 auto', padding: '24px 16px' }}>

        {/* Back */}
        <button
          onClick={() => router.back()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 14, padding: '8px 0', marginBottom: 8, minHeight: 44 }}
        >
           ← {isMergeMode ? 'Înapoi la rezultate' : 'Înapoi'}
        </button>

        {/* Header */}
        {isMergeMode ? (
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>📷 Adaugă altă fotografie</h1>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#e8f0fe', borderRadius: 8, padding: '5px 10px' }}>
              <span style={{ fontSize: 13, color: '#1a56db', fontWeight: 600 }}>
                {existingCount} ingredient{existingCount !== 1 ? 'e' : ''} găsite deja
              </span>
            </div>
            <p style={{ color: '#555', fontSize: 13, marginTop: 8 }}>
              Fotografia nouă va fi combinată cu rezultatele scanării existente.
            </p>
          </div>
        ) : (
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 4px' }}>📷 Scanează ingrediente</h1>
            <p style={{ color: '#555', fontSize: 14, margin: 0 }}>
              Fotografiază sau încarcă o poză cu frigiderul, cămara sau cumpărăturile.
            </p>
          </div>
        )}

        {error && (
          <div style={{ background: '#ffe0e0', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#c00', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Drop zone */}
        <div
          onClick={() => fileRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          style={{
            border: preview ? 'none' : '2px dashed #aab',
            borderRadius: 18,
            minHeight: 220,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: preview ? 'transparent' : '#eef0f5',
            cursor: 'pointer',
            marginBottom: 12,
            overflow: 'hidden',
            position: 'relative',
            transition: 'background 0.15s',
          }}
        >
           {preview ? (
             // eslint-disable-next-line @next/next/no-img-element
             <FallbackImage src={preview} alt="Preview" style={{ width: '100%', borderRadius: 18, objectFit: 'cover', maxHeight: 360 }} fallbackEmoji="🍽️" />
           ) : (
            <div style={{ textAlign: 'center', padding: 24, color: '#667' }}>
              <div style={{ fontSize: 52, marginBottom: 8 }}>🖼️</div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Atinge pentru a alege o fotografie</div>
              <div style={{ fontSize: 13 }}>sau trage și plasează aici</div>
            </div>
          )}
        </div>

        {/* Hidden file inputs — separate for gallery vs camera so user gets the choice */}
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} style={{ display: 'none' }} />

        {!preview ? (
          /* Two pick options — shown only before a photo is chosen */
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => fileRef.current?.click()}
              style={{ padding: '11px', borderRadius: 10, border: '1.5px solid #ccc', background: '#fff', color: '#333', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44 }}
            >
              🗂️ Galerie
            </button>
            <button
              onClick={() => cameraRef.current?.click()}
              style={{ padding: '11px', borderRadius: 10, border: '1.5px solid #ccc', background: '#fff', color: '#333', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44 }}
            >
              📷 Cameră
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setPreview(null); setFile(null) }}
            style={{ background: 'none', border: 'none', color: '#c00', fontSize: 13, cursor: 'pointer', marginBottom: 12, padding: '4px 0' }}
          >
            ✕ Șterge fotografia
          </button>
        )}

        {/* Context hint */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#333', display: 'block', marginBottom: 6 }}>
            Indiciu <span style={{ fontWeight: 400, color: '#888' }}>(opțional — ajută AI-ul)</span>
          </label>
          <input
            type="text"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="ex. frigider, piața de legume, resturi de legume…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 10, border: '1px solid #ccc', fontSize: 14, background: '#fff', color: '#111', minHeight: 44 }}
          />
        </div>

        <button
          onClick={handleScan}
          disabled={!file || scanning}
          style={{
            width: '100%', padding: '15px 0', borderRadius: 14,
            background: !file || scanning ? '#bbb' : '#111',
            color: '#fff', border: 'none', fontSize: 16, fontWeight: 700,
            cursor: !file || scanning ? 'not-allowed' : 'pointer',
            boxShadow: !file || scanning ? 'none' : '0 4px 14px rgba(0,0,0,0.18)',
            transition: 'background 0.15s',
            minHeight: 52,
          }}
        >
          {scanning
             ? '⏳ Se scanează…'
             : isMergeMode
               ? '✨ Adaugă și combină'
               : '✨ Identifică ingredientele'}
        </button>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#999', marginTop: 12 }}>
          Powered by Gemini Vision · Rezultatele sunt generate de AI
        </p>
      </div>
    </main>
  )
}
