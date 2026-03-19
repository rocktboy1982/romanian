import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import Script from 'next/script'
import type { Metadata } from 'next'
import FallbackImage from '@/components/FallbackImage'
import { createServiceSupabaseClient } from '@/lib/supabase-server'
import { AdInArticle, AdSidebar } from '@/components/ads/ad-placements'

export const dynamic = 'force-dynamic'

/* -- Interfaces ----------------------------------------------------------- */

interface CocktailRecipeJson {
  abv?: number
  category?: string
  difficulty?: string
  garnish?: string
  glassware?: string
  ingredients?: string[]
  serves?: number
  spirit?: string
  spiritLabel?: string
  steps?: string[]
}

interface CocktailPost {
  id: string
  slug: string
  title: string
  summary: string | null
  hero_image_url: string | null
  food_tags: string[] | null
  quality_score: number | null
  recipe_json: CocktailRecipeJson | null
  created_at: string | null
}

interface SimilarCocktail {
  id: string
  slug: string
  title: string
  hero_image_url: string | null
  recipe_json: CocktailRecipeJson | null
}

interface PageProps {
  params: Promise<{ slug: string }>
}

/* -- Helper Components ---------------------------------------------------- */

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

function StarDisplay({ score }: { score: number | null }) {
  if (!score) return null
  const stars = Math.round(score)
  return (
    <div className="flex items-center gap-1">
      {[...Array(5)].map((_, i) => (
        <span key={i} style={{ color: i < stars ? '#fbbf24' : '#ddd' }}>
          \u2605
        </span>
      ))}
      <span className="text-xs ml-1" style={{ color: '#888' }}>
        {score.toFixed(1)}/5
      </span>
    </div>
  )
}

const DIFFICULTY_LABELS: Record<string, string> = {
  'easy': 'ușor',
  'medium': 'mediu',
  'hard': 'greu'
}

/* -- JSON-LD Helpers ------------------------------------------------------ */

/**
 * Generate Recipe JSON-LD schema adapted for cocktails
 */
function generateCocktailJsonLd(cocktail: CocktailPost, rj: CocktailRecipeJson, slug: string) {
  const baseUrl = 'https://marechef.ro'
  const cocktailUrl = `${baseUrl}/cocktails/${slug}`

  const recipeInstructions = (rj.steps || []).map((step, idx) => ({
    '@type': 'HowToStep',
    position: idx + 1,
    text: step,
  }))

  const jsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: cocktail.title,
    description: cocktail.summary || cocktail.title,
    image: cocktail.hero_image_url || `${baseUrl}/og-default.jpg`,
    author: {
      '@type': 'Organization',
      name: 'MareChef.ro',
    },
    recipeCategory: 'Cocktail',
    recipeCuisine: 'Internațional',
    recipeYield: rj.serves ? `${rj.serves} porții` : '1 porție',
    recipeIngredient: rj.ingredients || [],
    recipeInstructions,
    url: cocktailUrl,
  }

  if (cocktail.created_at) {
    jsonLd.datePublished = new Date(cocktail.created_at).toISOString().split('T')[0]
  }

  // Build keywords from food_tags + spirit
  const keywordParts: string[] = []
  if (cocktail.food_tags && Array.isArray(cocktail.food_tags)) keywordParts.push(...cocktail.food_tags)
  if (rj.spirit && rj.spirit !== 'none') keywordParts.push(rj.spirit)
  if (rj.category) keywordParts.push(rj.category === 'alcoholic' ? 'cu alcool' : 'fără alcool')
  keywordParts.push('cocktail')
  if (keywordParts.length > 0) {
    jsonLd.keywords = [...new Set(keywordParts)].join(', ')
  }

  if (cocktail.quality_score) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: cocktail.quality_score,
      bestRating: 5,
      worstRating: 1,
      ratingCount: 1,
    }
  }

  if (cocktail.hero_image_url) {
    jsonLd.image = [
      {
        '@type': 'ImageObject',
        url: cocktail.hero_image_url,
        height: 800,
        width: 1200,
      },
    ]
  }

  return jsonLd
}

/**
 * Generate BreadcrumbList JSON-LD for cocktail pages
 */
function generateCocktailBreadcrumbJsonLd(title: string, slug: string) {
  const baseUrl = 'https://marechef.ro'
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: baseUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Cocktailuri',
        item: `${baseUrl}/cocktails`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: title,
        item: `${baseUrl}/cocktails/${slug}`,
      },
    ],
  }
}

/* -- Static Generation ---------------------------------------------------- */

export async function generateStaticParams() {
  const supabase = createServiceSupabaseClient()
  const { data } = await supabase
    .from('posts')
    .select('slug')
    .eq('type', 'cocktail')
    .eq('status', 'active')
    .not('slug', 'is', null)

  return (data || []).map(p => ({ slug: p.slug as string }))
}

export const revalidate = 3600

/* -- Metadata ------------------------------------------------------------- */

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = createServiceSupabaseClient()
  const { data: post } = await supabase
    .from('posts')
    .select('title, summary, hero_image_url')
    .eq('slug', slug)
    .eq('type', 'cocktail')
    .single()

  if (!post) {
    return { title: 'Cocktail | MareChef.ro' }
  }

  return {
    title: `${post.title} | MareChef.ro`,
    description: post.summary || `Rețetă ${post.title} pe MareChef.ro`,
    openGraph: {
      title: post.title,
      description: post.summary || '',
      images: post.hero_image_url ? [{ url: post.hero_image_url }] : [],
      type: 'article',
      locale: 'ro_RO',
      siteName: 'MareChef.ro',
    },
    alternates: {
      canonical: `https://marechef.ro/cocktails/${slug}`,
    },
  }
}

/* -- Main Page Component -------------------------------------------------- */

export default async function CocktailDetailPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = createServiceSupabaseClient()

  // Fetch cocktail by slug
  const { data: post } = await supabase
    .from('posts')
    .select('id, slug, title, summary, hero_image_url, food_tags, quality_score, recipe_json, created_at')
    .eq('slug', slug)
    .eq('type', 'cocktail')
    .single()

  if (!post) {
    notFound()
  }

  const cocktail = post as CocktailPost
  const rj = (cocktail.recipe_json || {}) as CocktailRecipeJson
  const ingredients = rj.ingredients || []
  const steps = rj.steps || []
  const isAlcoholic = rj.category === 'alcoholic'
  const spirit = rj.spirit && rj.spirit !== 'none' ? rj.spirit : null
  const spiritLabel = rj.spiritLabel || spirit || null

  // Fetch similar cocktails (same spirit, different slug)
  const { data: similarRaw } = await supabase
    .from('posts')
    .select('id, slug, title, hero_image_url, recipe_json')
    .eq('type', 'cocktail')
    .eq('status', 'active')
    .neq('slug', slug)
    .eq('recipe_json->>spirit', rj.spirit || 'none')
    .limit(6)

  const similar = (similarRaw || []) as SimilarCocktail[]

  const difficultyColor =
    rj.difficulty === 'easy'
      ? '#6ee7b7'
      : rj.difficulty === 'medium'
        ? '#fbbf24'
        : '#f87171'

  // Generate JSON-LD structured data
  const cocktailJsonLd = generateCocktailJsonLd(cocktail, rj, slug)
  const breadcrumbJsonLd = generateCocktailBreadcrumbJsonLd(cocktail.title, slug)

  return (
    <div
      className="min-h-screen"
      style={{ background: 'hsl(var(--background))', color: 'hsl(var(--foreground))', fontFamily: "'Inter', sans-serif" }}
    >
       {/* JSON-LD Structured Data */}
       <Script
         id="cocktail-jsonld"
         type="application/ld+json"
         dangerouslySetInnerHTML={{ __html: JSON.stringify(cocktailJsonLd) }}
         strategy="afterInteractive"
       />
       <Script
         id="cocktail-breadcrumb-jsonld"
         type="application/ld+json"
         dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
         strategy="afterInteractive"
       />

       {/* -- Hero -- */}
       <div className="relative w-full" style={{ maxHeight: 480, overflow: 'hidden' }}>
         <FallbackImage
            src={cocktail.hero_image_url || ''}
            alt={cocktail.title}
            className="w-full object-cover"
            style={{ maxHeight: 480, minHeight: 280 }}
            fallbackEmoji="\ud83c\udf78"
            width={1200}
            height={480}
         />
        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, rgba(221,227,238,1) 0%, rgba(221,227,238,0.3) 60%, transparent 100%)',
          }}
        />

        {/* Breadcrumb */}
        <nav
          className="absolute top-4 left-4 flex items-center gap-2 text-xs"
          style={{ color: 'rgba(0,0,0,0.6)' }}
        >
           <Link href="/cocktails" className="hover:text-red-300 transition-colors">
             Biblioteca de Cocktailuri
           </Link>
          <span>/</span>
          {spiritLabel && (
            <>
               <Link href={`/cocktails?spirit=${spirit}`} className="hover:text-red-300 transition-colors">
                 {spiritLabel}
               </Link>
              <span>/</span>
            </>
          )}
          <span style={{ color: 'rgba(0,0,0,0.8)' }}>{cocktail.title}</span>
        </nav>
      </div>

      {/* -- Main content -- */}
      <div className="container mx-auto px-4 max-w-4xl -mt-20 relative">
        {/* Title + badges */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2 mb-3">
             <Pill
               style={
                 isAlcoholic
                    ? {
                        background: 'rgba(139,26,43,0.3)',
                        color: '#b8394e',
                        border: '1px solid rgba(139,26,43,0.5)',
                      }
                  : {
                      background: 'rgba(5,150,105,0.3)',
                      color: '#6ee7b7',
                      border: '1px solid rgba(5,150,105,0.4)',
                    }
              }
            >
               {isAlcoholic ? '\ud83e\udd43 Cu alcool' : '\ud83c\udf3f Fără alcool'}
            </Pill>
            {spiritLabel && (
              <Pill style={{ background: 'rgba(0,0,0,0.06)', color: '#555', border: '1px solid rgba(0,0,0,0.1)' }}>
                {spiritLabel}
              </Pill>
            )}
            {isAlcoholic && rj.abv != null && rj.abv > 0 && (
              <Pill style={{ background: 'rgba(0,0,0,0.05)', color: '#444', border: '1px solid rgba(0,0,0,0.08)' }}>
                {rj.abv}% ABV
              </Pill>
            )}
             {rj.difficulty && (
               <Pill
                 style={{
                   background: 'transparent',
                   color: difficultyColor,
                   border: `1px solid ${difficultyColor}40`,
                 }}
               >
                 {DIFFICULTY_LABELS[rj.difficulty ?? ''] || rj.difficulty || '\u2014'}
               </Pill>
             )}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2" style={{ color: '#111' }}>
            {cocktail.title}
          </h1>
          <p className="text-base leading-relaxed max-w-2xl" style={{ color: '#555' }}>
            {cocktail.summary}
          </p>
        </div>

        {/* -- Two-column layout -- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* -- LEFT: Recipe content -- */}
          <div className="lg:col-span-2 space-y-8">
            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                 { label: 'Porții', value: rj.serves || '\u2014' },
                 { label: 'Dificultate', value: DIFFICULTY_LABELS[rj.difficulty ?? ''] || rj.difficulty || '\u2014' },
                 {
                   label: 'Calitate',
                   value: cocktail.quality_score ? `${cocktail.quality_score.toFixed(1)}/5` : '\u2014',
                 },
               ].map(stat => (
                <div
                  key={stat.label}
                  className="rounded-xl p-4 text-center"
                  style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.08)' }}
                >
                   <p className="text-xl font-bold capitalize" style={{ color: '#8B1A2B' }}>
                     {stat.value}
                   </p>
                  <p className="text-xs mt-0.5" style={{ color: '#888' }}>
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Ad: In-article between stats and ingredients */}
            <AdInArticle placement="cocktail-between-stats-ingredients" />

            {/* Glassware / Garnish */}
            {(rj.glassware || rj.garnish) && (
              <div className="flex flex-wrap gap-4 text-sm" style={{ color: '#555' }}>
                {rj.glassware && (
                  <div className="flex items-center gap-1.5">
                    <span style={{ color: '#888' }}>\ud83e\udd42 Pahar:</span>
                    <span>{rj.glassware}</span>
                  </div>
                )}
                {rj.garnish && (
                  <div className="flex items-center gap-1.5">
                    <span style={{ color: '#888' }}>\ud83c\udf3f Garnitură:</span>
                    <span>{rj.garnish}</span>
                  </div>
                )}
              </div>
            )}

            {/* Ingredients */}
            <section>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: '#111' }}>
                  <span className="w-1 h-5 rounded-full inline-block" style={{ background: '#8B1A2B' }} />
                  Ingrediente
                </h2>
              {ingredients.length > 0 ? (
                <ul className="space-y-2">
                  {ingredients.map((ing, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm">
                        <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#8B1A2B' }} />
                        <span style={{ color: '#333' }}>{ing}</span>
                      </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm italic" style={{ color: '#888' }}>
                  Nu sunt ingrediente listate.
                </p>
              )}
            </section>

             {/* Method / Steps */}
              <section>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: '#111' }}>
                  <span className="w-1 h-5 rounded-full inline-block" style={{ background: '#8B1A2B' }} />
                  Metodă
                </h2>
              {steps.length > 0 ? (
                <ol className="space-y-5">
                  {steps.map((step, i) => (
                    <li key={i} className="flex gap-4">
                        <span
                          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                          style={{ background: '#8B1A2B' }}
                        >
                          {i + 1}
                        </span>
                      <p className="text-sm leading-relaxed pt-1.5" style={{ color: '#333' }}>
                        {step}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm italic" style={{ color: '#888' }}>
                  Nu sunt pași listați.
                </p>
              )}
            </section>

            {/* Tags */}
            {cocktail.food_tags && cocktail.food_tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {cocktail.food_tags.map(tag => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 rounded-full text-[11px] font-medium capitalize"
                      style={{
                        background: 'rgba(139,26,43,0.08)',
                        color: '#8B1A2B',
                        border: '1px solid rgba(139,26,43,0.15)',
                      }}
                    >
                      {tag}
                    </span>
                ))}
              </div>
            )}
          </div>

          {/* -- RIGHT: Sidebar -- */}
          <div className="space-y-5">
            {/* Quality score card */}
            {cocktail.quality_score != null && (
              <div
                className="rounded-2xl p-5 space-y-3"
                style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.08)' }}
              >
                  <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B1A2B' }}>
                    Calitate
                  </h3>
                <StarDisplay score={cocktail.quality_score} />
              </div>
            )}

            {/* Ad: Sidebar */}
            <AdSidebar placement="cocktail-sidebar" />

            {/* Similar cocktails */}
            {similar.length > 0 && (
              <div
                className="rounded-2xl p-5 space-y-3"
                style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.08)' }}
              >
                  <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B1A2B' }}>
                    Cocktail-uri similare
                  </h3>
                <div className="space-y-2">
                  {similar.slice(0, 4).map(c => (
                    <Link
                      key={c.id}
                      href={`/cocktails/${c.slug}`}
                      className="flex items-start gap-2 p-2 rounded-lg transition-all hover:bg-white/50"
                    >
                       {c.hero_image_url && (
                         <FallbackImage
                           src={c.hero_image_url}
                           alt={c.title}
                           className="w-12 h-12 rounded object-cover flex-shrink-0"
                           fallbackEmoji="\ud83c\udf78"
                           width={48}
                           height={48}
                         />
                       )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold line-clamp-2" style={{ color: '#111' }}>
                          {c.title}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* CTAs */}
            <div className="space-y-2">
               <Link
                 href="/submit/cocktail"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: 'rgba(139,26,43,0.1)',
                    color: '#8B1A2B',
                    border: '1px solid rgba(139,26,43,0.25)',
                  }}
               >
                 \ud83c\udf79 Adaugă propriul cocktail
               </Link>
              <Link
                href="/cocktails"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-all"
                style={{ background: '#f5f5f5', color: '#666', border: '1px solid rgba(0,0,0,0.08)' }}
              >
                Vezi toate cocktailurile \u2192
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom padding */}
        <div className="h-16" />
      </div>
    </div>
  )
}
