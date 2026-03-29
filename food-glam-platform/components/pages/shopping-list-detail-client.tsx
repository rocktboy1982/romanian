"use client"

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { freshfulReferralUrl } from '@/lib/affiliate'
import { sanitizeUrl } from '@/lib/sanitize'
import IngredientLink from '@/components/ui/ingredient-link'
import { supabase } from '@/lib/supabase-client'

type ItemMeta = { subtype?: string; category?: string; recipes?: string[] }

type ListItem = {
  id: string
  name: string
  amount?: number | null
  unit?: string | null
  notes?: string | null
  checked: boolean
  created_at?: string
  // Parsed from notes JSON (set client-side)
  _meta?: ItemMeta
}

type ListMeta = {
  id: string
  name: string
  source_type?: string | null
  created_at: string
}

function parseMeta(notes: string | null | undefined): ItemMeta {
  if (!notes) return {}
  try {
    const parsed = JSON.parse(notes)
    if (typeof parsed === 'object' && parsed !== null) return parsed as ItemMeta
  } catch {
    // Not JSON — treat as plain text subtype
    return { subtype: notes }
  }
  return {}
}

function enrichItems(items: ListItem[]): ListItem[] {
  return items.map((item) => ({ ...item, _meta: parseMeta(item.notes) }))
}

function groupByCategory(items: ListItem[]): Record<string, ListItem[]> {
  const groups: Record<string, ListItem[]> = {}
  items.forEach((item) => {
    const cat = item._meta?.category || 'Other'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(item)
  })
  return groups
}

export default function ShoppingListDetailClient({ listId }: { listId: string }) {
  const router = useRouter()
  const [meta, setMeta] = useState<ListMeta | null>(null)
  const [items, setItems] = useState<ListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [newItemAmount, setNewItemAmount] = useState('')
  const [newItemUnit, setNewItemUnit] = useState('')
  const [addingItem, setAddingItem] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<{ name: string; amount: string; unit: string }>({ name: '', amount: '', unit: '' })
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [pantryItems, setPantryItems] = useState<Array<{ id: string; name: string; qty: string }>>([])
  const [showPantryCheck, setShowPantryCheck] = useState(false)
  const [loadingPantry, setLoadingPantry] = useState(false)
  const addInputRef = useRef<HTMLInputElement>(null)

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

  const fetchData = useCallback(async () => {
    try {
      const headers = await getAuthHeaders()
      const [listsRes, itemsRes] = await Promise.all([
        fetch('/api/shopping-lists', { headers }),
        fetch(`/api/shopping-lists/${listId}/items`, { headers }),
      ])
      if (listsRes.ok) {
        const allLists = await listsRes.json()
        const thisList = allLists.find((l: ListMeta) => l.id === listId)
        if (thisList) {
          setMeta(thisList)
          setNameValue(thisList.name)
        }
      }
      if (itemsRes.ok) {
        const data = await itemsRes.json()
        setItems(enrichItems(data))
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [listId, getAuthHeaders])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRenameSave = async () => {
    const trimmed = nameValue.trim()
    if (!trimmed || !meta) return
    setEditingName(false)
    try {
      const res = await fetch('/api/shopping-lists', {
        method: 'PATCH',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ id: listId, name: trimmed }),
      })
      if (res.ok) {
        const updated = await res.json()
        setMeta((prev) => prev ? { ...prev, name: updated.name } : prev)
      }
    } catch {
      // ignore
    }
  }

  const handleAddItem = async () => {
    const name = newItemName.trim()
    if (!name) return
    setAddingItem(true)
    try {
      const res = await fetch(`/api/shopping-lists/${listId}/items`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          name,
          amount: newItemAmount ? parseFloat(newItemAmount) : undefined,
          unit: newItemUnit || undefined,
        }),
      })
      if (res.ok) {
        const item = await res.json()
        setItems((prev) => [...prev, { ...item, _meta: parseMeta(item.notes) }])
        setNewItemName('')
        setNewItemAmount('')
        setNewItemUnit('')
        addInputRef.current?.focus()
      }
    } catch {
      // ignore
    } finally {
      setAddingItem(false)
    }
  }

  const handleToggleCheck = async (item: ListItem) => {
    const newChecked = !item.checked
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, checked: newChecked } : i))
    try {
      await fetch(`/api/shopping-lists/${listId}/items`, {
        method: 'PATCH',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ item_id: item.id, checked: newChecked }),
      })
    } catch {
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, checked: !newChecked } : i))
    }
  }

  const handleCheckAll = async (checked: boolean) => {
    const prev = [...items]
    setItems((items) => items.map((i) => ({ ...i, checked })))
    try {
      const batchHeaders = await getAuthHeaders()
      await Promise.all(
        items.map((item) =>
          fetch(`/api/shopping-lists/${listId}/items`, {
            method: 'PATCH',
            headers: batchHeaders,
            body: JSON.stringify({ item_id: item.id, checked }),
          })
        )
      )
    } catch {
      setItems(prev)
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId))
    try {
      await fetch(`/api/shopping-lists/${listId}/items`, {
        method: 'DELETE',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ item_id: itemId }),
      })
    } catch {
      fetchData()
    }
  }

  const handleStartEdit = (item: ListItem) => {
    setEditingItemId(item.id)
    setEditValues({
      name: item.name,
      amount: item.amount != null ? String(item.amount) : '',
      unit: item.unit || '',
    })
  }

  const handleSaveEdit = async () => {
    if (!editingItemId) return
    const name = editValues.name.trim()
    if (!name) return
    setEditingItemId(null)
    try {
      const res = await fetch(`/api/shopping-lists/${listId}/items`, {
        method: 'PATCH',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          item_id: editingItemId,
          name,
          amount: editValues.amount ? parseFloat(editValues.amount) : null,
          unit: editValues.unit || null,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setItems((prev) => prev.map((i) => i.id === updated.id ? { ...updated, _meta: parseMeta(updated.notes) } : i))
      }
    } catch {
      // ignore
    }
  }

   const handleShare = async () => {
     setSharing(true)
     try {
       const res = await fetch('/api/shopping-lists/share', {
         method: 'POST',
         headers: await getAuthHeaders(),
         body: JSON.stringify({ id: listId }),
       })
       if (res.ok) {
         const data = await res.json()
         const fullUrl = data.url.startsWith('/') ? `${window.location.origin}${data.url}` : data.url
         const validatedUrl = sanitizeUrl(fullUrl)
         if (validatedUrl !== '#') {
           setShareUrl(validatedUrl)
           setShowShareModal(true)
         }
       }
     } catch {
       // ignore
     } finally {
       setSharing(false)
     }
   }

  const handleCopyShareLink = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl).catch(() => { /* copy not available */ })
  }

  const handlePrint = () => {
    window.print()
  }

  const handleCopyList = () => {
    const text = items.map((i) => {
      const qty = i.amount != null ? `${i.amount}` : ''
      const unit = i.unit || ''
      const sub = i._meta?.subtype ? ` (${i._meta.subtype})` : ''
      return `${i.checked ? '✓' : '☐'} ${i.name}${qty || unit ? ` — ${qty} ${unit}`.trim() : ''}${sub}`
    }).join('\n')
    navigator.clipboard.writeText(text).catch(() => {})
  }

  const handleFetchPantry = async () => {
    setLoadingPantry(true)
    try {
      const res = await fetch('/api/pantry', { headers: await getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        setPantryItems(data)
        setShowPantryCheck(true)
      }
    } catch {
      // ignore
    } finally {
      setLoadingPantry(false)
    }
  }

  const handleCheckPantryMatches = async () => {
    const pantryNames = pantryItems.map((p) => p.name.toLowerCase())
    const matchedIds = items
      .filter((item) => pantryNames.some((pName) => item.name.toLowerCase().includes(pName) || pName.includes(item.name.toLowerCase())))
      .map((item) => item.id)

    if (matchedIds.length === 0) return

    setItems((prev) => prev.map((i) => matchedIds.includes(i.id) ? { ...i, checked: true } : i))
    try {
      const pantryMatchHeaders = await getAuthHeaders()
      await Promise.all(
        matchedIds.map((itemId) =>
          fetch(`/api/shopping-lists/${listId}/items`, {
            method: 'PATCH',
            headers: pantryMatchHeaders,
            body: JSON.stringify({ item_id: itemId, checked: true }),
          })
        )
      )
    } catch {
      fetchData()
    }
    setShowPantryCheck(false)
  }

  const handleDeleteChecked = async () => {
    if (checked.length === 0) return
    const confirmed = confirm(`Sigur vrei să ștergi ${checked.length} produse bifate?`)
    if (!confirmed) return

    const checkedIds = checked.map((i) => i.id)
    setItems((prev) => prev.filter((i) => !checkedIds.includes(i.id)))
    try {
      const clearHeaders = await getAuthHeaders()
      await Promise.all(
        checkedIds.map((itemId) =>
          fetch(`/api/shopping-lists/${listId}/items`, {
            method: 'DELETE',
            headers: clearHeaders,
            body: JSON.stringify({ item_id: itemId }),
          })
        )
      )
    } catch {
      fetchData()
    }
  }

  const filteredItems = items.filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
  const unchecked = filteredItems.filter((i) => !i.checked)
  const checked = filteredItems.filter((i) => i.checked)
  const uncheckedGrouped = groupByCategory(unchecked)
  const checkedGrouped = groupByCategory(checked)
  const sortedCategories = (groups: Record<string, ListItem[]>) =>
    Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'hsl(var(--background))' }}>
         <div style={{ textAlign: 'center' }}>
           <div style={{ width: 32, height: 32, border: '3px solid #ccc', borderTopColor: '#111', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 13, color: '#888' }}>Se încarcă lista…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (!meta) {
    return (
      <div style={{ padding: '40px 20px', maxWidth: 600, margin: '0 auto', background: 'hsl(var(--background))', minHeight: '80vh' }}>
           <p style={{ color: '#888', fontSize: 14 }}>Lista nu a fost găsită.</p>
         <button
           onClick={() => router.push('/me/shopping-lists')}
           style={{ marginTop: 16, fontSize: 13, color: '#111', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
         >
           ← Înapoi la liste
         </button>
      </div>
    )
  }

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-page { background: #fff !important; padding: 10px !important; }
          .print-page * { color: #111 !important; }
          .share-modal-overlay { display: none !important; }
        }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>

      <div className="print-page" style={{ background: 'hsl(var(--background))', minHeight: '100vh', padding: '24px 16px' }}>
        <div style={{ maxWidth: 650, margin: '0 auto' }}>

          {/* Back link */}
          <button
            className="no-print"
            onClick={() => router.push('/me/shopping-lists')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 13, color: '#666', background: 'transparent', border: 'none',
              cursor: 'pointer', marginBottom: 16, padding: 0,
            }}
            onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#111' }}
            onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#666' }}
          >
             ← Toate listele
          </button>

          {/* Header card */}
          <div style={{
            background: '#fff', borderRadius: 16, padding: '20px 24px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingName ? (
                  <input
                    autoFocus
                    type="text"
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    onBlur={handleRenameSave}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSave(); if (e.key === 'Escape') { setEditingName(false); setNameValue(meta.name) } }}
                    style={{
                      fontSize: 20, fontWeight: 700, color: '#111', width: '100%',
                      background: 'transparent', border: 'none', borderBottom: '2px solid #111',
                      outline: 'none', paddingBottom: 2,
                    }}
                  />
                ) : (
                  <h1
                    onClick={() => setEditingName(true)}
                    style={{
                      fontSize: 20, fontWeight: 700, color: '#111', margin: 0,
                      cursor: 'text', lineHeight: 1.3,
                    }}
                    title="Click pentru a redenumi"
                  >
                    {meta.name}
                  </h1>
                )}
                 <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 12, color: '#888' }}>
                   <span>{items.length} articol{items.length !== 1 ? 'e' : ''}</span>
                   <span>·</span>
                   <span>{checked.length} bifate</span>
                  {meta.source_type && (
                    <>
                      <span>·</span>
                      <span style={{
                        padding: '1px 6px', borderRadius: 4, background: '#f3f3f3',
                        fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, color: '#666',
                      }}>
                        {meta.source_type}
                      </span>
                    </>
                  )}
                  <span>·</span>
                  <span>{new Date(meta.created_at).toLocaleDateString()}</span>
                </div>
              </div>

               {/* Action buttons */}
               <div className="no-print" style={{ display: 'flex', gap: 4, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                 {([
                    { label: '📋', title: 'Copiază', fn: handleCopyList, disabled: false },
                    { label: '🖨️', title: 'Tipărire', fn: handlePrint, disabled: false },
                    { label: '🔗', title: 'Partajează', fn: handleShare, disabled: sharing },
                 ] as const).map(({ label, title, fn, disabled }) => (
                   <button
                     key={title}
                     onClick={fn}
                     disabled={disabled}
                     title={title}
                     style={{
                       width: 36, height: 36, borderRadius: 8, border: '1px solid #e5e5e5',
                       background: '#fff', cursor: disabled ? 'not-allowed' : 'pointer',
                       fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                       transition: 'all 0.15s', opacity: disabled ? 0.5 : 1,
                     }}
                     onMouseOver={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = '#f5f5f5' }}
                     onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
                   >
                     {label}
                   </button>
                 ))}
                 <button
                   onClick={handleFetchPantry}
                   disabled={loadingPantry}
                   title="Verifică cămara"
                   style={{
                     padding: '0 12px', height: 36, borderRadius: 8, border: '1px solid #e5e5e5',
                     background: '#fff', color: '#111', fontSize: 12, fontWeight: 600,
                     cursor: loadingPantry ? 'not-allowed' : 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                     opacity: loadingPantry ? 0.5 : 1,
                   }}
                   onMouseOver={(e) => { if (!loadingPantry) (e.currentTarget as HTMLButtonElement).style.background = '#f5f5f5' }}
                   onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
                 >
                   🏠 Ce am deja?
                 </button>
                <button
                  onClick={() => router.push(`/me/grocery/match/${listId}`)}
                   title="Potrivește cu magazinul"
                  style={{
                    padding: '0 12px', height: 36, borderRadius: 8, border: 'none',
                    background: '#111', color: '#fff', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                  }}
                  onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#333' }}
                  onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#111' }}
                >
                  🛒 Match to Store
                </button>
                <a
                  href={freshfulReferralUrl()}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                   title="Comandă ingrediente prin Freshful (livrare)"
                  style={{
                    padding: '0 12px', height: 36, borderRadius: 8, border: 'none',
                    background: '#00a651', color: '#fff', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', textDecoration: 'none', display: 'inline-flex',
                    alignItems: 'center', whiteSpace: 'nowrap', transition: 'background 0.15s',
                  }}
                  onMouseOver={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = '#008c44' }}
                  onMouseOut={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = '#00a651' }}
                >
                  🚚 Freshful
                </a>
              </div>
            </div>

            {/* Bulk actions */}
            {items.length > 0 && (
              <div className="no-print" style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
                <button
                   onClick={() => handleCheckAll(true)}
                   style={{
                     fontSize: 11, padding: '5px 10px', borderRadius: 6, border: '1px solid #ddd',
                     background: '#fff', color: '#555', cursor: 'pointer', fontWeight: 500,
                   }}
                   onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#f5f5f5' }}
                   onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
                 >
                   Bifează toate
                </button>
                <button
                   onClick={() => handleCheckAll(false)}
                   style={{
                     fontSize: 11, padding: '5px 10px', borderRadius: 6, border: '1px solid #ddd',
                     background: '#fff', color: '#555', cursor: 'pointer', fontWeight: 500,
                   }}
                   onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#f5f5f5' }}
                   onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
                 >
                   Debifează toate
                </button>
              </div>
            )}
          </div>

           {/* Search bar */}
           {items.length > 0 && (
             <div className="no-print" style={{ marginBottom: 16 }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 16, padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                 <span style={{ fontSize: 14, color: '#999' }}>🔍</span>
                 <input
                   type="text"
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   placeholder="Caută în listă…"
                   style={{
                     flex: 1, fontSize: 13, background: 'transparent', border: 'none',
                     outline: 'none', color: '#111', padding: '4px 0',
                   }}
                 />
                 {searchQuery && (
                   <button
                     onClick={() => setSearchQuery('')}
                     style={{
                       padding: '4px 8px', fontSize: 12, color: '#999', background: 'transparent',
                       border: 'none', cursor: 'pointer', borderRadius: 4,
                     }}
                     onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#111' }}
                     onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#999' }}
                   >
                     ✕
                   </button>
                 )}
                 {searchQuery && (
                   <span style={{ fontSize: 11, color: '#999', whiteSpace: 'nowrap' }}>
                     {filteredItems.length} rezultat{filteredItems.length !== 1 ? 'e' : ''}
                   </span>
                 )}
               </div>
             </div>
           )}

           {/* Items card — grouped by category */}
           {unchecked.length > 0 && (
            <div style={{
              background: '#fff', borderRadius: 16, padding: '20px 24px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 16,
            }}>
               <h2 style={{ fontSize: 14, fontWeight: 600, color: '#111', margin: '0 0 16px 0' }}>
                 🛒 {unchecked.length} articol{unchecked.length !== 1 ? 'e' : ''} rămase
               </h2>

              {sortedCategories(uncheckedGrouped).map(([category, catItems]) => (
                <div key={category} style={{ marginBottom: 14 }}>
                  <h3 style={{
                    fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
                    color: '#999', margin: '0 0 6px 0', paddingBottom: 4, borderBottom: '1px solid #f0f0f0',
                  }}>
                    {category}
                  </h3>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {catItems.map((item) => (
                      <li
                        key={item.id}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 8,
                          padding: '4px 6px', borderRadius: 6, transition: 'background 0.15s',
                        }}
                        onMouseOver={(e) => { (e.currentTarget as HTMLLIElement).style.background = '#fafafa' }}
                        onMouseOut={(e) => { (e.currentTarget as HTMLLIElement).style.background = 'transparent' }}
                      >
                        {/* Checkbox */}
                        <input
                          className="no-print"
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => handleToggleCheck(item)}
                          style={{
                            marginTop: 2, width: 16, height: 16, cursor: 'pointer',
                            flexShrink: 0, accentColor: '#111',
                          }}
                        />
                        {/* Print checkbox */}
                        <span className="hidden print:inline-block" style={{ width: 14, height: 14, border: '1.5px solid #999', borderRadius: 3, flexShrink: 0, marginTop: 2 }} />

                        {editingItemId === item.id ? (
                          <div className="no-print" style={{ flex: 1, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <input
                              autoFocus
                              type="text"
                              value={editValues.name}
                              onChange={(e) => setEditValues((v) => ({ ...v, name: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditingItemId(null) }}
                              style={{ flex: 1, minWidth: 120, padding: '3px 8px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, outline: 'none' }}
                            />
                            <input
                              type="text"
                              value={editValues.amount}
                              onChange={(e) => setEditValues((v) => ({ ...v, amount: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit() }}
                              placeholder="Qty"
                              style={{ width: 50, padding: '3px 6px', fontSize: 12, border: '1px solid #ddd', borderRadius: 6, outline: 'none', textAlign: 'center' }}
                            />
                            <input
                              type="text"
                              value={editValues.unit}
                              onChange={(e) => setEditValues((v) => ({ ...v, unit: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit() }}
                              placeholder="Unit"
                              style={{ width: 50, padding: '3px 6px', fontSize: 12, border: '1px solid #ddd', borderRadius: 6, outline: 'none', textAlign: 'center' }}
                            />
                             <button onClick={handleSaveEdit} style={{ padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none', background: '#111', color: '#fff', cursor: 'pointer' }}>Salvează</button>
                             <button onClick={() => setEditingItemId(null)} style={{ padding: '3px 8px', fontSize: 11, color: '#888', background: 'transparent', border: 'none', cursor: 'pointer' }}>Anulează</button>
                          </div>
                        ) : (
                          <div
                            className="no-print"
                            style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                            onClick={() => handleStartEdit(item)}
                            title="Click pentru a edita"
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>
                                <IngredientLink ingredient={item.name} variant="light" style={{ fontSize: 13, fontWeight: 500 }} />
                              </span>
                              {(item.amount != null || item.unit) && (
                                <span style={{ fontSize: 11, color: '#888' }}>
                                  {item.amount != null && (item.amount % 1 === 0 ? item.amount : Number(item.amount).toFixed(1))}{item.unit && ` ${item.unit}`}
                                </span>
                              )}
                              {item._meta?.subtype && (
                                <span style={{
                                  fontSize: 10, color: '#866a00', background: '#fff3cd',
                                  border: '1px solid #eed484', borderRadius: 4, padding: '0px 5px',
                                  fontStyle: 'italic',
                                }}>
                                  {item._meta.subtype}
                                </span>
                              )}
                            </div>
                            {item._meta?.recipes && item._meta.recipes.length > 0 && (
                              <p style={{ fontSize: 10, color: '#aaa', margin: '1px 0 0 0', lineHeight: 1.2 }}>
                                {item._meta.recipes.join(' · ')}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Print-only text */}
                        <div className="hidden print:flex" style={{ flex: 1, minWidth: 0, flexDirection: 'column' }}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</span>
                            {(item.amount != null || item.unit) && (
                              <span style={{ fontSize: 11, color: '#666' }}>
                                {item.amount != null && item.amount}{item.unit && ` ${item.unit}`}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Delete button */}
                        <button
                          className="no-print"
                          onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id) }}
                          title="Delete"
                          style={{
                            flexShrink: 0, padding: 4, borderRadius: 4, border: 'none',
                            background: 'transparent', cursor: 'pointer', color: '#ccc',
                            fontSize: 14, lineHeight: 1, transition: 'color 0.15s',
                          }}
                          onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#e00' }}
                          onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ccc' }}
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              {/* Add item inline */}
              <div className="no-print" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, color: '#ccc', flexShrink: 0 }}>+</span>
                  <input
                    ref={addInputRef}
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                    placeholder="Adaugă un articol…"
                    style={{
                      flex: 1, fontSize: 13, background: 'transparent', border: 'none',
                      outline: 'none', color: '#111', padding: '4px 0',
                    }}
                  />
                  <input
                    type="text"
                    value={newItemAmount}
                    onChange={(e) => setNewItemAmount(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                    placeholder="Qty"
                    style={{
                      width: 44, fontSize: 12, textAlign: 'center', background: 'transparent',
                      border: 'none', borderBottom: '1px solid #e5e5e5', outline: 'none', color: '#555', padding: '4px 0',
                    }}
                  />
                  <input
                    type="text"
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                    placeholder="Unit"
                    style={{
                      width: 44, fontSize: 12, textAlign: 'center', background: 'transparent',
                      border: 'none', borderBottom: '1px solid #e5e5e5', outline: 'none', color: '#555', padding: '4px 0',
                    }}
                  />
                  {newItemName.trim() && (
                    <button
                      onClick={handleAddItem}
                      disabled={addingItem}
                      style={{
                       padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                       border: 'none', background: '#111', color: '#fff', cursor: 'pointer',
                       opacity: addingItem ? 0.5 : 1,
                     }}
                   >
                     Adaugă
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Empty state (no unchecked) + add item when list is empty */}
          {unchecked.length === 0 && checked.length === 0 && (
            <div style={{
              background: '#fff', borderRadius: 16, padding: '40px 24px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 16, textAlign: 'center',
            }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>🛒</p>
               <p style={{ fontSize: 14, fontWeight: 500, color: '#666', marginBottom: 4 }}>Niciun articol încă</p>
               <p style={{ fontSize: 12, color: '#999' }}>Începe să adaugi articole mai jos</p>

              {/* Add item inline */}
              <div className="no-print" style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                <input
                  ref={addInputRef}
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                  placeholder="Add an item…"
                  style={{
                    flex: 1, minWidth: 150, maxWidth: 250, fontSize: 13, padding: '8px 12px',
                    border: '1px solid #ddd', borderRadius: 8, outline: 'none',
                  }}
                />
                {newItemName.trim() && (
                  <button
                    onClick={handleAddItem}
                    disabled={addingItem}
                    style={{
                      padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                      border: 'none', background: '#111', color: '#fff', cursor: 'pointer',
                    }}
                  >
                    Add
                  </button>
                )}
              </div>
            </div>
          )}

          {/* All done state */}
          {unchecked.length === 0 && checked.length > 0 && (
            <div style={{
              background: '#fff', borderRadius: 16, padding: '24px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 16, textAlign: 'center',
            }}>
               <p style={{ fontSize: 28, marginBottom: 4 }}>🎉</p>
               <p style={{ fontSize: 14, fontWeight: 600, color: '#1a7f37' }}>Gata!</p>
               <p style={{ fontSize: 12, color: '#999', marginTop: 2 }}>Toate {checked.length} articolele sunt bifate</p>

              {/* Add item inline */}
              <div className="no-print" style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                  placeholder="Add an item…"
                  style={{
                    flex: 1, minWidth: 150, maxWidth: 250, fontSize: 13, padding: '8px 12px',
                    border: '1px solid #ddd', borderRadius: 8, outline: 'none',
                  }}
                />
                {newItemName.trim() && (
                  <button
                    onClick={handleAddItem}
                    disabled={addingItem}
                    style={{
                      padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                      border: 'none', background: '#111', color: '#fff', cursor: 'pointer',
                    }}
                  >
                    Add
                  </button>
                )}
              </div>
            </div>
          )}

           {/* Checked items — collapsed card */}
           {checked.length > 0 && (
             <div style={{
               background: '#fff', borderRadius: 16, padding: '16px 24px',
               boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 16, opacity: 0.7,
             }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <h3 style={{ fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, margin: 0 }}>
                    ✓ Bifate ({checked.length})
                  </h3>
                  <button
                    className="no-print"
                    onClick={handleDeleteChecked}
                    title="Șterge bifate"
                    style={{
                      padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                      border: '1px solid #ddd', background: '#fff', color: '#e00', cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fee' }}
                    onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
                  >
                    🗑️ Șterge bifate
                  </button>
                </div>

              {sortedCategories(checkedGrouped).map(([category, catItems]) => (
                <div key={category} style={{ marginBottom: 8 }}>
                  <h4 style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
                    color: '#bbb', margin: '0 0 4px 0',
                  }}>
                    {category}
                  </h4>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {catItems.map((item) => (
                      <li
                        key={item.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '2px 6px', borderRadius: 4,
                        }}
                      >
                        <input
                          className="no-print"
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => handleToggleCheck(item)}
                          style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#111', flexShrink: 0 }}
                        />
                        <span style={{ fontSize: 12, color: '#aaa', textDecoration: 'line-through', flex: 1 }}>
                          {item.name}
                          {(item.amount != null || item.unit) && (
                            <span style={{ marginLeft: 6, fontSize: 11 }}>
                              {item.amount != null && item.amount}{item.unit && ` ${item.unit}`}
                            </span>
                          )}
                        </span>
                        <button
                          className="no-print"
                          onClick={() => handleDeleteItem(item.id)}
                          title="Delete"
                          style={{
                            flexShrink: 0, padding: 2, border: 'none', background: 'transparent',
                            cursor: 'pointer', color: '#ddd', fontSize: 12, transition: 'color 0.15s',
                          }}
                          onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#e00' }}
                          onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ddd' }}
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>

       {/* Pantry check modal */}
       {showPantryCheck && (
         <div
           className="share-modal-overlay no-print"
           onClick={() => setShowPantryCheck(false)}
           style={{
             position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.4)',
             display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
           }}
         >
           <div
             onClick={(e) => e.stopPropagation()}
             style={{
               background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420,
               boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
             }}
           >
             <h2 style={{ fontSize: 18, fontWeight: 600, color: '#111', margin: '0 0 4px 0' }}>Ce am deja?</h2>
             <p style={{ fontSize: 13, color: '#888', margin: '0 0 16px 0' }}>
               {pantryItems.length === 0
                 ? 'Cămara este goală. Adaugă produse în cămară pentru a le exclude automat.'
                 : `Găsite ${pantryItems.length} produse în cămară. Bifează-le automat?`}
             </p>

             {pantryItems.length > 0 && (
               <div style={{ marginBottom: 16, maxHeight: 300, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 8, padding: 12 }}>
                 <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                   {pantryItems.map((item) => (
                     <li key={item.id} style={{ fontSize: 12, color: '#666', display: 'flex', alignItems: 'center', gap: 6 }}>
                       <span style={{ fontSize: 14 }}>📦</span>
                       <span>{item.name}</span>
                       {item.qty && <span style={{ color: '#999', fontSize: 11 }}>({item.qty})</span>}
                     </li>
                   ))}
                 </ul>
               </div>
             )}

             <div style={{ display: 'flex', gap: 8 }}>
               {pantryItems.length > 0 && (
                 <button
                   onClick={handleCheckPantryMatches}
                   style={{
                     flex: 1, padding: '10px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                     border: 'none', background: '#1a7f37', color: '#fff', cursor: 'pointer',
                   }}
                   onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#166534' }}
                   onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#1a7f37' }}
                 >
                   Bifează toate din cămară
                 </button>
               )}
               <button
                 onClick={() => setShowPantryCheck(false)}
                 style={{
                   flex: 1, padding: '10px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                   border: '1px solid #ddd', background: '#fff', color: '#111', cursor: 'pointer',
                 }}
                 onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#f5f5f5' }}
                 onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
               >
                 Gata
               </button>
             </div>
           </div>
         </div>
       )}

       {/* Share modal */}
       {showShareModal && (
        <div
          className="share-modal-overlay no-print"
          onClick={() => setShowShareModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420,
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            }}
          >
             <h2 style={{ fontSize: 18, fontWeight: 600, color: '#111', margin: '0 0 4px 0' }}>Partajează Lista de Cumpărături</h2>
             <p style={{ fontSize: 13, color: '#888', margin: '0 0 16px 0' }}>Oricine cu acest link poate vedea lista.</p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                type="text"
                readOnly
                value={shareUrl || ''}
                style={{
                  flex: 1, padding: '10px 12px', fontSize: 13, border: '1px solid #ddd',
                  borderRadius: 8, background: '#f9f9f9', color: '#333', outline: 'none',
                }}
              />
              <button
                 onClick={handleCopyShareLink}
                 style={{
                   padding: '10px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                   border: 'none', background: '#111', color: '#fff', cursor: 'pointer',
                 }}
                 onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#333' }}
                 onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#111' }}
               >
                 Copiază
              </button>
            </div>

            <div style={{ textAlign: 'right' }}>
              <button
                onClick={() => setShowShareModal(false)}
                 style={{ fontSize: 13, color: '#888', background: 'transparent', border: 'none', cursor: 'pointer' }}
                 onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#111' }}
                 onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#888' }}
               >
                 Gata
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
