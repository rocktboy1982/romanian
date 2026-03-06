"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from '@/components/ui/toast'

type Post = {
  id: string
  title: string
  type: string
  created_by: string
  created_at?: string
  hero_image_url?: string
  content?: string | Record<string, unknown>
}

type Report = {
  id: string
  entity_type: string
  entity_id: string
  reporter_id: string
  category: string
  details?: string
  status: string
  created_at: string
}

type Tab = 'queue' | 'reports'

export default function ModerationClient() {
  const [tab, setTab] = useState<Tab>('queue')
  const [items, setItems] = useState<Post[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [rejectReasonId, setRejectReasonId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const toast = useToast()

  const fetchPending = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/moderation')
      if (!res.ok) throw new Error('Fetch failed')
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/reports?status=open')
      if (!res.ok) throw new Error('Fetch failed')
      const data = await res.json()
      setReports(data.reports || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'queue') fetchPending()
    else fetchReports()
  }, [tab, fetchPending, fetchReports])

  const act = async (id: string | string[], status: string, reason?: string) => {
    try {
      const body: Record<string, unknown> = { id, status }
      if (reason) body.reason = reason
      const res = await fetch('/api/moderation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Action failed')
      toast.push({ message: `Post ${status === 'active' ? 'approved' : 'rejected'}`, type: 'success' })
      await fetchPending()
      setRejectReasonId(null)
      setRejectReason('')
    } catch (e) {
      console.error(e)
      toast.push({ message: 'Action failed', type: 'error' })
    }
  }

  const bulkAct = async (status: string) => {
    const ids = Object.keys(selected).filter(k => selected[k])
    if (!ids.length) return toast.push({ message: 'No items selected', type: 'info' })
    await act(ids, status)
    setSelected({})
  }

  const closeReport = async (reportId: string) => {
    try {
      const res = await fetch('/api/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reportId, status: 'closed' }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.push({ message: 'Report closed', type: 'success' })
      await fetchReports()
    } catch (e) {
      console.error(e)
      toast.push({ message: 'Failed to close report', type: 'error' })
    }
  }

  const tabCls = (t: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      tab === t ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-muted/80'
    }`

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Moderare</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
         <button className={tabCls('queue')} onClick={() => setTab('queue')}>
           Coadă în așteptare {items.length > 0 && <span className="ml-1 text-xs opacity-70">({items.length})</span>}
         </button>
         <button className={tabCls('reports')} onClick={() => setTab('reports')}>
           Rapoarte {reports.length > 0 && <span className="ml-1 text-xs opacity-70">({reports.length})</span>}
         </button>
       </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-2 border-foreground/20 border-t-foreground/70 rounded-full animate-spin" />
        </div>
      )}

      {/* Queue tab */}
      {!loading && tab === 'queue' && (
        <div>
           {items.length > 0 && (
             <div className="mb-4 flex gap-2">
               <Button size="sm" onClick={() => bulkAct('active')}>Aprobă selectate</Button>
               <Button size="sm" variant="destructive" onClick={() => bulkAct('rejected')}>Respinge selectate</Button>
             </div>
           )}

           {items.length === 0 && (
             <div className="text-center py-16 text-muted-foreground">
               <p className="text-lg font-medium mb-1">Totul e clar</p>
               <p className="text-sm">Nicio postare în așteptare de revizuire acum.</p>
             </div>
           )}

          <ul className="space-y-3">
            {items.map((it) => (
              <li key={it.id} className="border rounded-xl p-4 bg-card">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={!!selected[it.id]}
                    onChange={(e) => setSelected(s => ({ ...s, [it.id]: e.target.checked }))}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                     <div className="flex items-center gap-2 flex-wrap">
                       <span className="font-medium text-sm">{it.title || 'Fără titlu'}</span>
                       <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{it.type}</span>
                     </div>
                     <p className="text-xs text-muted-foreground mt-0.5">
                       de {it.created_by} · {it.created_at ? new Date(it.created_at).toLocaleString() : ''}
                     </p>

                    {/* Preview content */}
                    {previewId === it.id && (
                      <div className="mt-3 p-3 bg-muted/50 rounded-lg border">
                        {it.hero_image_url && (
                          <img src={it.hero_image_url} alt="" className="h-32 w-auto object-cover rounded mb-2" />
                        )}
                        <pre className="text-xs whitespace-pre-wrap max-h-60 overflow-y-auto">
                          {typeof it.content === 'string' ? it.content : JSON.stringify(it.content, null, 2)}
                        </pre>
                      </div>
                    )}

                     {/* Reject reason input */}
                     {rejectReasonId === it.id && (
                       <div className="mt-3 flex gap-2 items-center">
                         <input
                           type="text"
                           value={rejectReason}
                           onChange={(e) => setRejectReason(e.target.value)}
                           placeholder="Motiv pentru respingere (opțional)"
                           className="flex-1 rounded-lg border px-3 py-1.5 text-sm"
                         />
                         <Button size="sm" variant="destructive" onClick={() => act(it.id, 'rejected', rejectReason)}>
                           Confirmă respingere
                         </Button>
                         <Button size="sm" variant="ghost" onClick={() => { setRejectReasonId(null); setRejectReason('') }}>
                           Anulează
                         </Button>
                       </div>
                     )}
                  </div>

                   <div className="flex gap-1.5 shrink-0">
                     <Button size="sm" variant="outline" onClick={() => act(it.id, 'active')}>Aprobă</Button>
                     <Button size="sm" variant="destructive" onClick={() => setRejectReasonId(p => p === it.id ? null : it.id)}>
                       Respinge
                     </Button>
                     <Button size="sm" variant="ghost" onClick={() => setPreviewId(p => p === it.id ? null : it.id)}>
                       {previewId === it.id ? 'Ascunde' : 'Previzualizare'}
                     </Button>
                   </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Reports tab */}
      {!loading && tab === 'reports' && (
        <div>
           {reports.length === 0 && (
             <div className="text-center py-16 text-muted-foreground">
               <p className="text-lg font-medium mb-1">Niciun raport deschis</p>
               <p className="text-sm">Toate rapoartele au fost rezolvate.</p>
             </div>
           )}

          <ul className="space-y-3">
            {reports.map((r) => (
              <li key={r.id} className="border rounded-xl p-4 bg-card">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold uppercase bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{r.category}</span>
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{r.entity_type}</span>
                    </div>
                    <p className="text-sm mt-1">
                      <span className="text-muted-foreground">Entity:</span> {r.entity_id}
                    </p>
                    {r.details && (
                      <p className="text-sm text-muted-foreground mt-1">{r.details}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Reported by {r.reporter_id} · {new Date(r.created_at).toLocaleString()}
                    </p>
                  </div>
                   <Button size="sm" variant="outline" onClick={() => closeReport(r.id)}>
                     Închide
                   </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  )
}
