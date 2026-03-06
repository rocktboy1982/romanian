'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Props {
  handle: string | null
  displayName: string
}

export default function FollowChefButton({ handle, displayName }: Props) {
  const cleanHandle = (handle ?? displayName.toLowerCase().replace(/\s+/g, '-')).replace(/^@/, '')
  const storageKey = `following_chef_${cleanHandle}`

  const [following, setFollowing] = useState(false)

  useEffect(() => {
    try {
      setFollowing(localStorage.getItem(storageKey) === '1')
    } catch { /* ignore */ }
  }, [storageKey])

  const toggle = () => {
    const next = !following
    setFollowing(next)
    try {
      if (next) {
        localStorage.setItem(storageKey, '1')
      } else {
        localStorage.removeItem(storageKey)
      }
    } catch { /* ignore */ }
  }

  return (
    <div className="flex gap-2 mt-3">
      <button
        onClick={toggle}
        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all"
        style={following
          ? { background: 'rgba(0,0,0,0.06)', color: '#555', border: '1px solid rgba(0,0,0,0.12)' }
          : { background: 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff' }}
      >
         {following ? '✓ Urmăresc' : '+ Urmărește'}
      </button>
       <Link
         href={`/chefs/${cleanHandle}`}
         className="px-3 py-2 rounded-lg text-sm font-medium flex items-center"
         style={{ background: 'rgba(0,0,0,0.04)', color: '#555', border: '1px solid rgba(0,0,0,0.1)' }}
       >
         Profil →
       </Link>
    </div>
  )
}
