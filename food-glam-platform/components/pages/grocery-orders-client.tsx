'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'

interface GroceryOrder {
  id: string
  vendor_id: string
  status: string
  items: unknown[]
  total_estimated_price: number | null
  currency: string
  created_at: string
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: '⏳ Pending', color: '#856404', bg: '#fff3cd' },
  sent: { label: '📤 Sent', color: '#155724', bg: '#d4edda' },
  confirmed: { label: '✅ Confirmed', color: '#155724', bg: '#d4edda' },
  delivered: { label: '📦 Delivered', color: '#004085', bg: '#cce5ff' },
  cancelled: { label: '❌ Cancelled', color: '#721c24', bg: '#f8d7da' },
}

const VENDOR_LABELS: Record<string, string> = {
  freshful: 'Freshful',
  bringo: 'Bringo',
  glovo: 'Glovo',
  'kaufland-ro': 'Kaufland',
  'carrefour-ro': 'Carrefour',
}

const BG = '#dde3ee'

export default function GroceryOrdersClient() {
  const router = useRouter()
  const [orders, setOrders] = useState<GroceryOrder[]>([])
  const [loading, setLoading] = useState(true)

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    // Primary: read from our persisted session
    try {
      const backup = localStorage.getItem('marechef-session')
      if (backup) {
        const parsed = JSON.parse(backup)
        if (parsed?.access_token) {
          headers['Authorization'] = `Bearer ${parsed.access_token}`
          return headers
        }
      }
    } catch {}
    // Fallback: try Supabase client
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
    return headers
  }, [])

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/grocery/orders', { headers: await getAuthHeaders() })
      if (res.ok) setOrders(await res.json())
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [getAuthHeaders])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  if (loading) {
    return (
      <main style={{ background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#555' }}>
          <div style={{ width: 32, height: 32, border: '3px solid #ccc', borderTopColor: '#555', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          Loading…
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </main>
    )
  }

  return (
    <main style={{ background: BG, minHeight: '100vh', color: '#111', paddingBottom: 40 }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px' }}>

        <button
          onClick={() => router.push('/me/grocery')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 14, padding: '8px 0', marginBottom: 12, minHeight: 44 }}
        >
          ← Back to Grocery
        </button>

        <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 4px' }}>📋 Order History</h1>
        <p style={{ color: '#666', fontSize: 14, margin: '0 0 20px' }}>
          Your past grocery orders.
        </p>

        {orders.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 14, padding: '28px 20px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🛒</div>
            <p style={{ color: '#888', fontSize: 14 }}>No orders yet. Send a shopping list to a store to create your first order.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {orders.map(order => {
              const statusMeta = STATUS_META[order.status] ?? STATUS_META.pending
              const vendorName = VENDOR_LABELS[order.vendor_id] ?? order.vendor_id
              const itemCount = Array.isArray(order.items) ? order.items.length : 0

              return (
                <div
                  key={order.id}
                  style={{
                    background: '#fff', borderRadius: 12, padding: '14px 16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{vendorName}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                        background: statusMeta.bg, color: statusMeta.color,
                      }}>
                        {statusMeta.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#888' }}>
                      {itemCount} item{itemCount !== 1 ? 's' : ''}
                      {order.total_estimated_price != null && (
                        <span> · ~{order.total_estimated_price.toFixed(2)} {order.currency}</span>
                      )}
                      <span> · {new Date(order.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
