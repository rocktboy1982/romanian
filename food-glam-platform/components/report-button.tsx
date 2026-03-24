'use client'

import { supabase } from '@/lib/supabase-client'
import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

const CATEGORIES = [
  { value: 'spam', label: 'Spam' },
  { value: 'hate', label: 'Hate speech' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'copyright', label: 'Copyright violation' },
  { value: 'misinfo', label: 'Misinformation' },
  { value: 'other', label: 'Other' },
] as const

interface ReportButtonProps {
  entityType: 'post' | 'thread' | 'reply' | 'profile'
  entityId: string
  className?: string
}

export function ReportButton({ entityType, entityId, className }: ReportButtonProps) {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState('')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()

  const submit = async () => {
    if (!category) return toast.push({ message: 'Select a category', type: 'info' })
    setSubmitting(true)
    try {
      const mockUserId = typeof window !== 'undefined' ? localStorage.getItem('mock_user') : null
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const { data: { session: _s } } = await supabase.auth.getSession(); if (_s?.access_token) headers['Authorization'] = 'Bearer ' + _s.access_token

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers,
        body: JSON.stringify({ entity_type: entityType, entity_id: entityId, category, details: details || null }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Failed to submit report')
      }
      toast.push({ message: 'Report submitted. Thank you.', type: 'success' })
      setOpen(false)
      setCategory('')
      setDetails('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      toast.push({ message: msg, type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`text-xs text-muted-foreground hover:text-red-500 transition-colors ${className || ''}`}
        title="Report this content"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 inline mr-1">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
        </svg>
        Report
      </button>
    )
  }

  return (
    <div className="border rounded-xl p-4 bg-card space-y-3 mt-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Report this {entityType}</p>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground text-xs">
          Cancel
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map(c => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
              category === c.value
                ? 'border-red-500 bg-red-50 text-red-700'
                : 'border-border text-muted-foreground hover:border-foreground/30'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Additional details (optional)"
        rows={2}
        className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
      />

      <Button size="sm" variant="destructive" onClick={submit} disabled={submitting || !category}>
        {submitting ? 'Submitting...' : 'Submit Report'}
      </Button>
    </div>
  )
}
