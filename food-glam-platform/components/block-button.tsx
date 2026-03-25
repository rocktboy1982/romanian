'use client'

import { supabase } from '@/lib/supabase-client'
import React, { useState } from 'react'
import { useToast } from '@/components/ui/toast'

interface BlockButtonProps {
  userId: string
  initialBlocked?: boolean
  className?: string
}

export function BlockButton({ userId, initialBlocked = false, className }: BlockButtonProps) {
  const [blocked, setBlocked] = useState(initialBlocked)
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const toggle = async () => {
    setLoading(true)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      try {
        const backup = localStorage.getItem('marechef-session')
        if (backup) {
          const parsed = JSON.parse(backup)
          if (parsed?.access_token) headers['Authorization'] = 'Bearer ' + parsed.access_token
        }
      } catch {}
      if (!headers['Authorization']) {
        const { data: { session: _s } } = await supabase.auth.getSession()
        if (_s?.access_token) headers['Authorization'] = 'Bearer ' + _s.access_token
      }

      if (blocked) {
        // Unblock
        const res = await fetch(`/api/blocks?blocked_id=${userId}`, { method: 'DELETE', headers })
        if (!res.ok) throw new Error('Failed to unblock')
        setBlocked(false)
        toast.push({ message: 'User unblocked', type: 'success' })
      } else {
        // Block
        const res = await fetch('/api/blocks', {
          method: 'POST',
          headers,
          body: JSON.stringify({ blocked_id: userId }),
        })
        if (!res.ok) throw new Error('Failed to block')
        setBlocked(true)
        toast.push({ message: 'User blocked', type: 'success' })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      toast.push({ message: msg, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`text-xs transition-colors ${
        blocked
          ? 'text-red-500 hover:text-red-700 font-medium'
          : 'text-muted-foreground hover:text-red-500'
      } ${className || ''}`}
      title={blocked ? 'Deblochează acest utilizator' : 'Blochează acest utilizator'}
     >
       {loading ? '...' : blocked ? 'Deblochează' : 'Blochează'}
    </button>
  )
}
