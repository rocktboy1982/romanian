'use client'

import { useEffect, useState } from 'react'
import { useParams, notFound } from 'next/navigation'
import Link from 'next/link'
import { MOCK_COCKTAILS } from '@/lib/mock-data'
import type { MockCocktail } from '@/lib/mock-data'
import ReportButton from '@/components/ReportButton'
import DeleteContentButton from '@/components/DeleteContentButton'
import RecipeRating from '@/components/RecipeRating'
import { AdInArticle, AdSidebar } from '@/components/ads/ad-placements'

/* ── Extended cocktail with full recipe fields ─────────────────────────── */
interface CocktailDetail extends MockCocktail {
  ingredients?: string[]
  steps?: string[]
  glassware?: string
  garnish?: string
}

/* ── Helper components ─────────────────────────────────────────────────── */
function Pill({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
      style={style}
    >
      {children}
    </span>
  )
}

function ChefCard({ chef }: { chef: MockCocktail['created_by'] }) {
  return (
    <Link
      href={`/chefs/${chef.handle.replace('@', '')}`}
      className="group flex items-center gap-3 p-4 rounded-2xl border transition-all hover:border-violet-500/40"
      style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}
    >
      {/* Avatar */}
      {chef.avatar_url ? (
        <img src={chef.avatar_url} alt={chef.display_name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
      ) : (
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-lg font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
        >
          {chef.display_name.charAt(0).toUpperCase()}
        </div>
      )}
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-slate-100 group-hover:text-violet-300 transition-colors truncate">
          {chef.display_name}
        </p>
        <p className="text-xs text-slate-500 truncate">{chef.handle}</p>
      </div>
      {/* Arrow */}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-slate-600 group-hover:text-violet-400 flex-shrink-0 transition-colors">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
      </svg>
    </Link>
  )
}

/* ── Page ──────────────────────────────────────────────────────────────── */
export default function CocktailDetailPage() {
  const params = useParams()
  const slug = typeof params.slug === 'string' ? params.slug : Array.isArray(params.slug) ? params.slug[0] : ''

  const [cocktail, setCocktail] = useState<CocktailDetail | null | undefined>(undefined)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    // Try to get current user from localStorage
    try {
      const mockUser = localStorage.getItem('mock_user')
      if (mockUser) {
        const user = JSON.parse(mockUser)
        setCurrentUserId(user.id ?? null)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (!slug) return
    // First check mock data (covers all pre-seeded cocktails)
    const found = MOCK_COCKTAILS.find(c => c.slug === slug) as CocktailDetail | undefined
    if (found) {
      setCocktail(found)
      return
    }
    // Fallback: fetch from search API (covers newly submitted cocktails)
    fetch(`/api/search/cocktails?q=${encodeURIComponent(slug)}&per_page=50`)
      .then(r => r.json())
      .then(data => {
        const match = (data.cocktails as CocktailDetail[])?.find(c => c.slug === slug)
        setCocktail(match ?? null)
      })
      .catch(() => setCocktail(null))
  }, [slug])

  // Loading
  if (cocktail === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#dde3ee' }}>
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Not found
  if (cocktail === null) {
    notFound()
  }

  const spirit = cocktail.spirit && cocktail.spirit !== 'none' ? cocktail.spirit : null
  const isAlcoholic = cocktail.category === 'alcoholic'

  const difficultyColor =
    cocktail.difficulty === 'easy' ? '#6ee7b7' :
    cocktail.difficulty === 'medium' ? '#fbbf24' : '#f87171'

  return (
    <div className="min-h-screen" style={{ background: '#dde3ee', color: '#111', fontFamily: "'Inter', sans-serif" }}>

      {/* ── Hero ── */}
      <div className="relative w-full" style={{ maxHeight: 480, overflow: 'hidden' }}>
        {cocktail.hero_image_url ? (
          <img
            src={cocktail.hero_image_url}
            alt={cocktail.title}
            className="w-full object-cover"
            style={{ maxHeight: 480, minHeight: 280 }}
          />
        ) : (
          <div className="w-full h-64 flex items-center justify-center text-5xl" style={{ background: '#c8cfe0' }}>
            🍹
          </div>
        )}
        {/* Gradient overlay */}
        {/* Gradient overlay */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(200,208,224,1) 0%, rgba(200,208,224,0.3) 60%, transparent 100%)' }} />

        {/* Breadcrumb */}
        <nav className="absolute top-4 left-4 flex items-center gap-2 text-xs" style={{ color: 'rgba(0,0,0,0.6)' }}>
          <Link href="/cocktailbooks" className="hover:text-violet-300 transition-colors">Cocktail Books</Link>
          <span>/</span>
          <Link href="/search?mode=cocktails" className="hover:text-violet-300 transition-colors">Cocktails</Link>
        </nav>
      </div>

      {/* ── Main content ── */}
      <div className="container mx-auto px-4 max-w-4xl -mt-20 relative">

        {/* Title + badges */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2 mb-3">
            <Pill style={isAlcoholic
              ? { background: 'rgba(124,58,237,0.3)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.5)' }
              : { background: 'rgba(5,150,105,0.3)', color: '#6ee7b7', border: '1px solid rgba(5,150,105,0.4)' }
            }>
              {isAlcoholic ? '🥃 Alcoolic' : '🍃 Non-alcoolic'}
            </Pill>
            {spirit && (
              <Pill style={{ background: 'rgba(0,0,0,0.06)', color: '#555', border: '1px solid rgba(0,0,0,0.1)' }}>
                {spirit}
              </Pill>
            )}
            {isAlcoholic && cocktail.abv != null && cocktail.abv > 0 && (
              <Pill style={{ background: 'rgba(0,0,0,0.05)', color: '#444', border: '1px solid rgba(0,0,0,0.08)' }}>
                {cocktail.abv}% ABV
              </Pill>
            )}
            <Pill style={{ background: 'transparent', color: difficultyColor, border: `1px solid ${difficultyColor}40` }}>
              {cocktail.difficulty}
            </Pill>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2" style={{ color: '#111' }}>
            {cocktail.title}
          </h1>
          <p className="text-base leading-relaxed max-w-2xl" style={{ color: '#555' }}>{cocktail.summary}</p>
        </div>

        {/* ── Two-column layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── LEFT: Recipe content ── */}
          <div className="lg:col-span-2 space-y-8">

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Porții', value: cocktail.serves },
                  { label: 'Dificultate', value: cocktail.difficulty },
                  { label: 'Voturi', value: `♥ ${cocktail.votes.toLocaleString()}` },
                ].map(stat => (
                 <div key={stat.label} className="rounded-xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,0,0,0.08)' }}>
                   <p className="text-xl font-bold capitalize" style={{ color: '#7c3aed' }}>{stat.value}</p>
                   <p className="text-xs mt-0.5" style={{ color: '#888' }}>{stat.label}</p>
                 </div>
               ))}
             </div>

             {/* Ad: In-article between stats and ingredients */}
             <AdInArticle placement="cocktail-between-stats-ingredients" />

             {/* Glassware / Garnish */}
             {(cocktail.glassware || cocktail.garnish) && (
             <div className="flex flex-wrap gap-4 text-sm" style={{ color: '#555' }}>
                 {cocktail.glassware && (
                   <div className="flex items-center gap-1.5">
                     <span style={{ color: '#888' }}>🥂 Pahar:</span>
                     <span>{cocktail.glassware}</span>
                   </div>
                 )}
                 {cocktail.garnish && (
                   <div className="flex items-center gap-1.5">
                     <span style={{ color: '#888' }}>🌿 Garnitură:</span>
                     <span>{cocktail.garnish}</span>
                   </div>
                 )}
               </div>
             )}

             {/* Ingredients */}
             <section>
               <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: '#111' }}>
                 <span className="w-1 h-5 rounded-full inline-block" style={{ background: '#7c3aed' }} />
                 Ingrediente
               </h2>
               {cocktail.ingredients && cocktail.ingredients.length > 0 ? (
                 <ul className="space-y-2">
                   {cocktail.ingredients.map((ing, i) => (
                     <li key={i} className="flex items-start gap-3 text-sm">
                       <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#7c3aed' }} />
                       <span style={{ color: '#333' }}>{ing}</span>
                     </li>
                   ))}
                 </ul>
               ) : (
                 <p className="text-sm italic" style={{ color: '#888' }}>Nu sunt ingrediente listate.</p>
               )}
             </section>

             {/* Method / Steps */}
             <section>
               <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: '#111' }}>
                 <span className="w-1 h-5 rounded-full inline-block" style={{ background: '#7c3aed' }} />
                 Metodă
               </h2>
               {cocktail.steps && cocktail.steps.length > 0 ? (
                 <ol className="space-y-5">
                   {cocktail.steps.map((step, i) => (
                     <li key={i} className="flex gap-4">
                       <span
                         className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                         style={{ background: '#7c3aed' }}
                       >
                         {i + 1}
                       </span>
                       <p className="text-sm leading-relaxed pt-1.5" style={{ color: '#333' }}>{step}</p>
                     </li>
                   ))}
                 </ol>
               ) : (
                 <p className="text-sm italic" style={{ color: '#888' }}>Nu sunt pași listați.</p>
               )}
             </section>

            {/* Tags */}
            {cocktail.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {cocktail.tags.map(tag => (
                  <span key={tag} className="px-2.5 py-1 rounded-full text-[11px] font-medium capitalize"
                    style={{ background: 'rgba(124,58,237,0.08)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.15)' }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ── RIGHT: Sidebar ── */}
          <div className="space-y-5">

              {/* Added by */}
              <div className="rounded-2xl p-5 space-y-3" style={{ background: '#f9f5ff', border: '1px solid rgba(124,58,237,0.15)' }}>
                <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7c3aed' }}>
                  Adăugat de
                </h3>
               <ChefCard chef={cocktail.created_by} />
             </div>

             {/* Ad: Sidebar */}
             <AdSidebar placement="cocktail-sidebar" />

             {/* Community rating */}
            <RecipeRating
              recipeId={cocktail.id}
              initialVotes={cocktail.votes}
              initialQualityScore={cocktail.quality_score}
            />

             {/* CTAs */}
             <div className="space-y-2">
               <Link
                 href="/submit/cocktail"
                 className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-all"
                 style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.25)' }}
               >
                 🍹 Adaugă propriul cocktail
               </Link>
               <Link
                 href="/search?mode=cocktails"
                 className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-all"
                 style={{ background: '#f5f5f5', color: '#666', border: '1px solid rgba(0,0,0,0.08)' }}
               >
                 Vezi toate cocktailurile →
               </Link>
             </div>
             <div className="pt-1 flex flex-col items-center gap-2">
               <ReportButton contentId={cocktail.id} contentType="cocktail" contentTitle={cocktail.title} variant="full" />
               {currentUserId && cocktail.created_by.id === currentUserId && (
                 <DeleteContentButton
                   postId={cocktail.id}
                   postTitle={cocktail.title}
                   onDeleted={() => window.location.href = '/'}
                   variant="button"
                   size="sm"
                 />
               )}
             </div>

          </div>
        </div>

        {/* Bottom padding */}
        <div className="h-16" />
      </div>
    </div>
  )
}
