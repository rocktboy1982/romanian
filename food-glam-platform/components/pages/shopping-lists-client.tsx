"use client"

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type ShoppingList = {
  id: string
  name: string
  source_type?: string | null
  created_at: string
  shopping_list_items?: { count: number }[] | null
}

function getUserId() {
  if (typeof window === 'undefined') return 'anonymous'
  try { return JSON.parse(localStorage.getItem('mock_user') ?? '{}')?.id ?? 'anonymous' } catch { return 'anonymous' }
}

export default function ShoppingListsClient() {
  const router = useRouter()
  const [lists, setLists] = useState<ShoppingList[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const fetchLists = useCallback(async () => {
    try {
      const res = await fetch('/api/shopping-lists', {
        headers: { 'x-mock-user-id': getUserId() },
      })
      if (!res.ok) return
      const data = await res.json()
      setLists(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLists()
  }, [fetchLists])

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    try {
      const res = await fetch('/api/shopping-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-mock-user-id': getUserId() },
        body: JSON.stringify({ name, source_type: 'manual' }),
      })
      if (!res.ok) return
      const created = await res.json()
      setNewName('')
      setShowCreate(false)
      router.push(`/me/shopping-lists/${created.id}`)
    } catch {
      // ignore
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this shopping list?')) return
    try {
      await fetch('/api/shopping-lists', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-mock-user-id': getUserId() },
        body: JSON.stringify({ id }),
      })
      setLists((prev) => prev.filter((l) => l.id !== id))
    } catch {
      // ignore
    }
  }

  const handleShare = async (id: string) => {
    try {
      const res = await fetch('/api/shopping-lists/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-mock-user-id': getUserId() },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.url) {
        await navigator.clipboard.writeText(
          data.url.startsWith('/') ? `${window.location.origin}${data.url}` : data.url
        )
        alert('Share link copied to clipboard!')
      }
    } catch {
      // ignore
    }
  }

  const getItemCount = (list: ShoppingList): number => {
    if (!list.shopping_list_items || list.shopping_list_items.length === 0) return 0
    return list.shopping_list_items[0]?.count ?? 0
  }

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#dde3ee' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '3px solid #ccc', borderTopColor: '#111', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 13, color: '#888' }}>Loading lists…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ background: '#dde3ee', minHeight: '100vh', padding: '24px 16px' }}>
      <div style={{ maxWidth: 650, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111', margin: 0 }}>Shopping Lists</h1>
           <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
               {lists.length === 0 ? 'Creează-ți prima listă' : `${lists.length} listă${lists.length !== 1 ? ',' : ''}`}
             </p>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 16px', borderRadius: 10, border: 'none',
              background: '#111', color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#333' }}
            onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#111' }}
          >
             + Listă nouă
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div style={{
            background: '#fff', borderRadius: 16, padding: 20,
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 16,
          }}>
             <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#333', marginBottom: 8 }}>Nume listă</label>
             <div style={{ display: 'flex', gap: 8 }}>
               <input
                 autoFocus
                 type="text"
                 value={newName}
                 onChange={(e) => setNewName(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                 placeholder="ex. Cumpărături săptămânale"
                 style={{
                   flex: 1, padding: '10px 12px', fontSize: 13, border: '1px solid #ddd',
                   borderRadius: 8, outline: 'none', color: '#111',
                 }}
               />
               <button
                 onClick={handleCreate}
                 disabled={creating || !newName.trim()}
                 style={{
                   padding: '10px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                   border: 'none', background: '#111', color: '#fff', cursor: 'pointer',
                   opacity: (creating || !newName.trim()) ? 0.5 : 1,
                 }}
               >
                 {creating ? 'Se creează...' : 'Creează'}
               </button>
               <button
                 onClick={() => { setShowCreate(false); setNewName('') }}
                 style={{
                   padding: '10px 12px', fontSize: 13, color: '#888', background: 'transparent',
                   border: 'none', cursor: 'pointer',
                 }}
               >
                 Anulează
               </button>
             </div>
          </div>
        )}

        {/* Empty state */}
        {lists.length === 0 && !showCreate && (
          <div style={{
            background: '#fff', borderRadius: 16, padding: '48px 24px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)', textAlign: 'center',
          }}>
            <p style={{ fontSize: 36, marginBottom: 8 }}>📋</p>
             <h2 style={{ fontSize: 18, fontWeight: 600, color: '#111', margin: '0 0 6px 0' }}>Nicio listă de cumpărături încă</h2>
             <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
               Creează o listă de cumpărături pentru a ține evidența ingredientelor pentru rețetele tale.
             </p>
             <button
               onClick={() => setShowCreate(true)}
               style={{
                 display: 'inline-flex', alignItems: 'center', gap: 6,
                 padding: '12px 20px', borderRadius: 10, border: 'none',
                 background: '#111', color: '#fff', fontSize: 14, fontWeight: 600,
                 cursor: 'pointer',
               }}
             >
               + Creează-ți prima listă
             </button>
          </div>
        )}

        {/* List cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lists.map((list) => {
            const count = getItemCount(list)
            return (
              <div
                key={list.id}
                onClick={() => router.push(`/me/shopping-lists/${list.id}`)}
                style={{
                  background: '#fff', borderRadius: 14, padding: '16px 20px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer',
                  transition: 'all 0.15s', border: '1px solid transparent',
                }}
                onMouseOver={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)'
                  ;(e.currentTarget as HTMLDivElement).style.borderColor = '#e0e0e0'
                }}
                onMouseOut={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'
                  ;(e.currentTarget as HTMLDivElement).style.borderColor = 'transparent'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: '#111', margin: 0, lineHeight: 1.3 }}>{list.name}</h3>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, fontSize: 12, color: '#888' }}>
                       <span>{count} articol{count !== 1 ? 'e' : ''}</span>
                      {list.source_type && (
                        <span style={{
                          padding: '1px 6px', borderRadius: 4, background: '#f3f3f3',
                          fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, color: '#666',
                        }}>
                          {list.source_type}
                        </span>
                      )}
                      <span>{new Date(list.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div
                    style={{ display: 'flex', gap: 4, flexShrink: 0 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                     <button
                       onClick={() => handleShare(list.id)}
                       title="Distribuie"
                      style={{
                        width: 32, height: 32, borderRadius: 6, border: '1px solid #eee',
                        background: '#fff', cursor: 'pointer', fontSize: 14,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.15s',
                      }}
                      onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#f5f5f5' }}
                      onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
                    >
                      🔗
                    </button>
                     <button
                       onClick={() => handleDelete(list.id)}
                       title="Șterge"
                       style={{
                         width: 32, height: 32, borderRadius: 6, border: '1px solid #eee',
                        background: '#fff', cursor: 'pointer', fontSize: 14,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#ccc', transition: 'all 0.15s',
                      }}
                      onMouseOver={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = '#fff0f0'
                        ;(e.currentTarget as HTMLButtonElement).style.color = '#e00'
                        ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#ffccc'
                      }}
                      onMouseOut={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = '#fff'
                        ;(e.currentTarget as HTMLButtonElement).style.color = '#ccc'
                        ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#eee'
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}
