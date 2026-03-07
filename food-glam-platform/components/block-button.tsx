'use client'

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
      const mockUserId = typeof window !== 'undefined' ? localStorage.getItem('mock_user') : null
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (mockUserId) headers['x-mock-user-id'] = mockUserId

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
