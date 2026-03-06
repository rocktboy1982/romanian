'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MOCK_COMMUNITY_THREADS } from '@/lib/mock-data'

interface CommunityThread {
  id: string
  title: string
  author: string
  replies: number
  views: number
  created_at: string
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `acum ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `acum ${hours}h`
  const days = Math.floor(hours / 24)
  return `acum ${days}z`
}

export default function CommunitySection() {
  const [threads, setThreads] = useState<CommunityThread[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/community')
      .then(res => res.json())
      .then(data => {
        const fetched: CommunityThread[] = data.threads || []
        setThreads(fetched.length > 0 ? fetched : MOCK_COMMUNITY_THREADS)
        setLoading(false)
      })
      .catch(() => {
        setThreads(MOCK_COMMUNITY_THREADS)
        setLoading(false)
      })
  }, [])

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
         <div className="flex items-center gap-2">
           <span className="text-lg">💬</span>
           <span className="font-bold text-base" style={{ fontFamily: "'Syne', sans-serif" }}>Comunitate</span>
         </div>
         <Link href="/me" className="text-xs font-semibold" style={{ color: '#ff9500' }}>
           Alătură-te →
         </Link>
      </div>

      {/* List */}
      <div>
        {loading && (
          <div className="px-5 py-4 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 rounded animate-pulse" style={{ background: '#e8e8e8', width: '85%' }} />
                <div className="h-2.5 rounded animate-pulse" style={{ background: '#e8e8e8', width: '50%' }} />
              </div>
            ))}
          </div>
        )}

         {!loading && threads.length === 0 && (
           <p className="px-5 py-8 text-sm text-center" style={{ color: '#bbb' }}>Nicio discuție deocamdată</p>
         )}

         {!loading && threads.map((thread, i) => {
           const isHot = thread.replies >= 10
           return (
             <Link
               key={thread.id}
               href="/me"
               className="block px-5 py-3.5 group transition-colors"
               style={{
                 borderBottom: i < threads.length - 1 ? '1px solid rgba(0,0,0,0.07)' : 'none',
               }}
             >
               {/* Title */}
               <p
                 className="text-sm font-semibold leading-snug mb-1.5 line-clamp-2 group-hover:text-black transition-colors"
                 style={{ color: '#111' }}
               >
                 {thread.title}
               </p>

               {/* Meta row */}
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2 text-[11px]" style={{ color: '#666' }}>
                   <span>{thread.author}</span>
                   <span>·</span>
                   <span>💬 {thread.replies}</span>
                   <span>·</span>
                   <span>{thread.views} vizualizări</span>
                   <span>·</span>
                   <span>{timeAgo(thread.created_at)}</span>
                 </div>

                 {/* Badge */}
                 <span
                   className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                   style={isHot
                     ? { background: 'rgba(255,77,109,0.15)', color: '#ff4d6d', border: '1px solid rgba(255,77,109,0.25)' }
                     : { background: 'rgba(0,200,150,0.12)', color: '#00c896', border: '1px solid rgba(0,200,150,0.2)' }}
                 >
                   {isHot ? '🔥 Fierbinte' : '✨ Nou'}
                 </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
