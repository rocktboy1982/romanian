'use client'

import Link from 'next/link'
import Image from 'next/image'
import FallbackImage from '@/components/FallbackImage'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { MOCK_RECIPES } from '@/lib/mock-data'

interface MockUser {
  id: string
  display_name: string
  handle: string
  avatar_url: string | null
}

interface VlogEntry {
  id: string
  date: string
  body: string
  attachedRecipe?: {
    id: string
    slug: string
    title: string
    hero_image_url: string
  }
  sponsoredProduct?: {
    name: string
    imageUrl: string
    linkUrl: string
    description: string
    disclosure: 'Ad' | 'Sponsored' | 'Partner' | 'Gifted'
  }
  createdAt: string
  updatedAt: string
}

interface RecipeInput {
  id: string
  slug: string
  title: string
  hero_image_url: string
}

const DISCLOSURE_LABELS: Record<string, string> = {
  'Ad': 'Reclamă',
  'Sponsored': 'Sponsorizat',
  'Partner': 'Partener',
  'Gifted': 'Cadou'
}

export default function NewPostPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const handle = Array.isArray(params.handle) ? params.handle[0] : params.handle || 'me'
  const editDate = searchParams.get('date')

  const [mockUser, setMockUser] = useState<MockUser | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [body, setBody] = useState('')
  const [attachedRecipe, setAttachedRecipe] = useState<RecipeInput | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<RecipeInput[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showProductSection, setShowProductSection] = useState(false)
  const [productName, setProductName] = useState('')
  const [productImageUrl, setProductImageUrl] = useState('')
  const [productLinkUrl, setProductLinkUrl] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [productDisclosure, setProductDisclosure] = useState<'Ad' | 'Sponsored' | 'Partner' | 'Gifted'>('Sponsored')

  useEffect(() => {
    const userStr = localStorage.getItem('mock_user')
    if (userStr) {
      try {
        setMockUser(JSON.parse(userStr))
      } catch {}
    }
    setHydrated(true)
  }, [])

  // Load existing entry if editing
  useEffect(() => {
    if (!hydrated || !mockUser) return

    const resolvedHandle = handle === 'me' ? mockUser.handle : handle
    const entriesStr = localStorage.getItem(`chef_vlog_${resolvedHandle}`)
    if (entriesStr && editDate) {
      try {
        const entries = JSON.parse(entriesStr) as VlogEntry[]
        const entry = entries.find(e => e.date === editDate)
        if (entry) {
          setDate(entry.date)
          setBody(entry.body)
          if (entry.attachedRecipe) {
            setAttachedRecipe(entry.attachedRecipe)
          }
          if (entry.sponsoredProduct) {
            setShowProductSection(true)
            setProductName(entry.sponsoredProduct.name)
            setProductImageUrl(entry.sponsoredProduct.imageUrl)
            setProductLinkUrl(entry.sponsoredProduct.linkUrl)
            setProductDescription(entry.sponsoredProduct.description)
            setProductDisclosure(entry.sponsoredProduct.disclosure)
          }
        }
      } catch {}
    }
  }, [hydrated, handle, mockUser, editDate])

  const inputStyle = {
    background: 'rgba(0,0,0,0.05)',
    border: '1px solid rgba(0,0,0,0.12)',
    color: '#111',
  }

   if (!hydrated) {
     return <div style={{ background: 'hsl(var(--background))', minHeight: '100vh' }} />
   }

   // Unauthenticated
   if (!mockUser) {
     return (
       <main style={{ background: 'hsl(var(--background))', minHeight: '100vh', color: 'hsl(var(--foreground))' }} className="px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="ff-display text-2xl font-bold mb-4">Autentifică-te pentru a posta</h1>
          <p className="mb-6" style={{ color: '#666' }}>Trebuie să fii autentificat pentru a crea intrări în vlog.</p>
          <Link href="/auth/signin"
            className="px-6 py-3 rounded-full text-sm font-semibold text-white inline-block"
            style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)' }}>
            Autentifică-te
          </Link>
        </div>
      </main>
    )
  }

   // Handle mismatch
   const resolvedHandle = handle === 'me' ? mockUser.handle : handle
   if (handle !== 'me' && handle !== mockUser.handle) {
     return (
       <main style={{ background: 'hsl(var(--background))', minHeight: '100vh', color: 'hsl(var(--foreground))' }} className="px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="ff-display text-2xl font-bold mb-4">Nu este pagina ta</h1>
          <p className="mb-6" style={{ color: '#666' }}>Poți edita doar propriile tale intrări de vlog.</p>
          <Link href={`/chefs/${mockUser.handle}`}
            className="px-6 py-3 rounded-full text-sm font-semibold text-white inline-block"
            style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)' }}>
            Mergi la pagina mea de chef
          </Link>
        </div>
      </main>
    )
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value.toLowerCase()
    setSearchQuery(e.target.value)

    if (query.length === 0) {
      setSearchResults([])
      setShowSearchResults(false)
    } else {
      const filtered = MOCK_RECIPES.filter(r => r.title.toLowerCase().includes(query)).slice(0, 5).map(r => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        hero_image_url: r.hero_image_url
      }))
      setSearchResults(filtered)
      setShowSearchResults(true)
    }
  }

  const handleSelectRecipe = (recipe: RecipeInput) => {
    setAttachedRecipe(recipe)
    setSearchQuery('')
    setSearchResults([])
    setShowSearchResults(false)
  }

   const handleSave = async () => {
     if (!body.trim()) {
       alert('Scrie ceva pentru intrarea ta în vlog.')
       return
     }

     setLoading(true)
     try {
       const entriesStr = localStorage.getItem(`chef_vlog_${resolvedHandle}`)
       let entries: VlogEntry[] = []
       
       if (entriesStr) {
         try {
           entries = JSON.parse(entriesStr)
         } catch {}
       }

       // Check if entry exists for this date
       const existingIndex = entries.findIndex(e => e.date === date)
       const now = new Date().toISOString()

       const newEntry: VlogEntry = {
         id: existingIndex >= 0 ? entries[existingIndex].id : crypto.randomUUID(),
         date,
         body,
         attachedRecipe: attachedRecipe || undefined,
         sponsoredProduct: (productName.trim() && productLinkUrl.trim()) ? {
           name: productName,
           imageUrl: productImageUrl,
           linkUrl: productLinkUrl,
           description: productDescription,
           disclosure: productDisclosure
         } : undefined,
         createdAt: existingIndex >= 0 ? entries[existingIndex].createdAt : now,
         updatedAt: now
       }

       if (existingIndex >= 0) {
         entries[existingIndex] = newEntry
       } else {
         entries.push(newEntry)
       }

       localStorage.setItem(`chef_vlog_${resolvedHandle}`, JSON.stringify(entries))
       router.push(`/chefs/${resolvedHandle}`)
     } catch (err) {
       console.error('Failed to save:', err)
       alert('Salvarea a eșuat')
     } finally {
       setLoading(false)
     }
   }

   return (
     <main style={{ background: 'hsl(var(--background))', minHeight: '100vh', color: 'hsl(var(--foreground))' }}>
       {/* Header */}
       <div className="sticky top-0 z-40 px-4 py-3 flex items-center gap-3"
        style={{
          background: 'rgba(245,245,245,0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(0,0,0,0.08)'
        }}>
        <Link href={`/chefs/${resolvedHandle}`} className="flex items-center gap-1 text-sm opacity-70 hover:opacity-100 transition-opacity">
          <span>←</span>
          <span>Înapoi</span>
        </Link>
      </div>

      {/* Main content */}
      <div className="px-4 py-8 max-w-2xl mx-auto">
        <h1 className="ff-display text-2xl font-bold mb-6">Intrare nouă în Vlog</h1>

        {/* Date field */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">Data</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full px-4 py-2 rounded-lg text-sm focus:outline-none"
            style={inputStyle}
          />
        </div>

        {/* Vlog text area */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">{"Ce ai în minte azi?"}</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Ce ai în minte azi?"
            className="w-full px-4 py-3 rounded-lg text-sm resize-none focus:outline-none"
            style={{ ...inputStyle, minHeight: 140 }}
          />
        </div>

        {/* Recipe attachment */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">Atașează o rețetă (opțional)</label>

          {/* Recipe search */}
          <div className="relative mb-3">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Caută rețete..."
              className="w-full px-4 py-2 rounded-lg text-sm focus:outline-none"
              style={inputStyle}
            />

            {/* Search results dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-lg overflow-hidden z-10"
                style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.12)', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
                {searchResults.map(recipe => (
                   <button
                     key={recipe.id}
                     onClick={() => handleSelectRecipe(recipe)}
                     className="w-full flex items-center gap-2 p-2 text-sm hover:bg-black/[0.04] transition-colors border-b border-b-black/[0.06] last:border-b-0"
                   >
                     <FallbackImage src={recipe.hero_image_url} alt="" width={40} height={40} className="w-10 h-10 rounded object-cover" fallbackEmoji="🍽️" />
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold truncate">{recipe.title}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

           {/* Attached recipe preview */}
           {attachedRecipe && (
             <div className="flex gap-3 p-3 rounded-lg"
               style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.1)' }}>
               <FallbackImage src={attachedRecipe.hero_image_url} alt="" width={64} height={64} className="w-16 h-16 rounded object-cover flex-shrink-0" fallbackEmoji="🍽️" />
              <div className="flex-1">
                <Link href={`/recipes/${attachedRecipe.slug}`} className="text-sm font-semibold hover:underline">
                  🍽️ {attachedRecipe.title}
                </Link>
              </div>
              <button
                onClick={() => setAttachedRecipe(null)}
                className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Promote a Product (optional) */}
        <div className="mb-6">
          <button
            onClick={() => setShowProductSection(!showProductSection)}
            className="flex items-center gap-2 text-sm font-semibold mb-3 hover:text-orange-400 transition-colors"
            style={{ color: '#ff9500' }}
          >
            {showProductSection ? '−' : '+'} Adaugă promovare produs
            <span>🛍️</span>
          </button>

          {showProductSection && (
            <div className="p-4 rounded-lg" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)' }}>
              {/* Product name */}
              <div className="mb-4">
                <label className="block text-xs font-semibold mb-2 uppercase" style={{ color: '#666' }}>Numele produsului</label>
                <input
                  type="text"
                  value={productName}
                  onChange={e => setProductName(e.target.value)}
                  placeholder="ex. Paste organice"
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={inputStyle}
                />
              </div>

              {/* Product image URL with preview */}
              <div className="mb-4">
                <label className="block text-xs font-semibold mb-2 uppercase" style={{ color: '#666' }}>URL imagine produs</label>
                <div className="flex gap-3">
                  <input
                    type="url"
                    value={productImageUrl}
                    onChange={e => setProductImageUrl(e.target.value)}
                    placeholder="https://example.com/product.jpg"
                    className="flex-1 px-3 py-2 rounded-lg text-sm focus:outline-none"
                    style={inputStyle}
                  />
                   {productImageUrl && (
                     <div className="flex-shrink-0 w-12 h-12 rounded flex items-center justify-center overflow-hidden" style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.1)' }}>
                       <FallbackImage src={productImageUrl} alt="preview" className="w-full h-full object-cover" fallbackEmoji="🛍️" />
                     </div>
                   )}
                </div>
              </div>

              {/* Shop/Affiliate link */}
              <div className="mb-4">
                <label className="block text-xs font-semibold mb-2 uppercase" style={{ color: '#666' }}>Link magazin / afiliat</label>
                <input
                  type="url"
                  value={productLinkUrl}
                  onChange={e => setProductLinkUrl(e.target.value)}
                  placeholder="https://example.com/shop"
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={inputStyle}
                />
              </div>

               {/* Description with char counter */}
               <div className="mb-4">
                 <div className="flex items-center justify-between mb-2">
                   <label className="text-xs font-semibold uppercase" style={{ color: '#666' }}>Descriere scurtă</label>
                   <span className="text-xs" style={{ color: '#aaa' }}>{productDescription.length} / 120</span>
                 </div>
                 <textarea
                   value={productDescription}
                   onChange={e => setProductDescription(e.target.value.slice(0, 120))}
                   placeholder="Descriere scurtă a produsului..."
                  maxLength={120}
                  className="w-full px-3 py-2 rounded-lg text-sm resize-none focus:outline-none"
                  style={{ ...inputStyle, minHeight: 80 }}
                />
              </div>

               {/* Disclosure label selector */}
               <div>
                 <label className="block text-xs font-semibold mb-2 uppercase" style={{ color: '#666' }}>Declarație</label>
                 <div className="flex gap-2">
                   {(['Ad', 'Sponsored', 'Partner', 'Gifted'] as const).map(label => (
                     <button
                       key={label}
                       onClick={() => setProductDisclosure(label)}
                       className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                       style={{
                         background: productDisclosure === label ? 'rgba(212,160,23,0.2)' : 'rgba(0,0,0,0.06)',
                         border: productDisclosure === label ? '1px solid rgba(212,160,23,0.5)' : '1px solid rgba(0,0,0,0.1)',
                         color: productDisclosure === label ? '#d4a017' : '#666'
                       }}
                     >
                       {DISCLOSURE_LABELS[label] || label}
                     </button>
                   ))}
                 </div>
               </div>
            </div>
          )}
        </div>

        {/* Save button */}
        <div className="flex gap-3 justify-end">
          <Link href={`/chefs/${resolvedHandle}`}
            className="px-6 py-2 rounded-full text-sm font-semibold"
            style={{
              background: 'rgba(0,0,0,0.07)',
              border: '1px solid rgba(0,0,0,0.12)',
              color: '#444'
            }}>
            Anulează
          </Link>
          <button
            onClick={handleSave}
            disabled={loading || !body.trim()}
            className="px-6 py-2 rounded-full text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)' }}>
            {loading ? 'Se salvează...' : 'Publică'}
          </button>
        </div>
      </div>
    </main>
  )
}
