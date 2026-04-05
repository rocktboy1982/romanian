import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ARTICLES, type Article } from '@/lib/blog-articles'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const article = ARTICLES.find((a) => a.slug === slug)
  if (!article) return {}

  return {
    title: `${article.title} | Blog MareChef.ro`,
    description: article.metaDescription,
    alternates: { canonical: `https://marechef.ro/blog/${article.slug}` },
    openGraph: {
      title: article.title,
      description: article.metaDescription,
      url: `https://marechef.ro/blog/${article.slug}`,
      siteName: 'MareChef.ro',
      locale: 'ro_RO',
      type: 'article',
      publishedTime: article.publishedAt,
      authors: ['MareChef.ro'],
    },
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const HEALTH_SLUGS = new Set(['fasting-intermitent', 'alimentatie-sarcina'])

const RELATED_LINKS: Record<string, Array<{ href: string; label: string }>> = {
  'ghid-condimente': [
    { href: '/cookbooks', label: 'Explorează rețete din lume' },
    { href: '/search?q=condimente', label: 'Rețete cu condimente' },
  ],
  'greseli-bucatarie': [
    { href: '/blog/gatit-profesionist', label: 'Tehnici de gătit profesionist' },
    { href: '/submit/recipe', label: 'Trimite propria rețetă' },
  ],
  'planificare-mese': [
    { href: '/plan', label: 'Planificatorul de mese MareChef' },
    { href: '/health', label: 'Modul Sănătate — plan personalizat' },
  ],
  'dieta-mediteraneana': [
    { href: '/health', label: 'Calculator calorii și profil nutrițional' },
    { href: '/cookbooks/mediterranean', label: 'Rețete mediteraneene' },
  ],
  'bucataria-romaneasca': [
    { href: '/cookbooks/eastern-europe', label: 'Bucătăria est-europeană' },
    { href: '/search?q=romanesc', label: 'Rețete românești' },
  ],
  'gatit-profesionist': [
    { href: '/blog/greseli-bucatarie', label: 'Greșeli de evitat în bucătărie' },
    { href: '/submit/recipe', label: 'Publică propria rețetă' },
  ],
  'fasting-intermitent': [
    { href: '/health', label: 'Tracker de fasting MareChef' },
    { href: '/blog/dieta-mediteraneana', label: 'Dieta mediteraneană' },
  ],
  'ingrediente-esentiale': [
    { href: '/me/pantry', label: 'Gestionează Cămara ta' },
    { href: '/search', label: 'Caută rețete după ingrediente' },
  ],
  'arta-cocktailurilor': [
    { href: '/cocktails', label: 'Toate cocktailurile MareChef Bartender' },
    { href: '/submit/cocktail', label: 'Trimite un cocktail' },
  ],
  'alimentatie-sarcina': [
    { href: '/health', label: 'Modul Sănătate — profil nutrițional' },
    { href: '/blog/dieta-mediteraneana', label: 'Dieta mediteraneană' },
  ],
  'bucatariile-lumii': [
    { href: '/cookbooks', label: 'Cărți de bucate din 16 regiuni' },
    { href: '/search', label: 'Caută rețete din orice țară' },
  ],
  'etichete-alimentare': [
    { href: '/health', label: 'Calculator calorii și nutrienți' },
    { href: '/blog/dieta-mediteraneana', label: 'Ghid nutriție — dieta mediteraneană' },
  ],
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params
  const article = ARTICLES.find((a) => a.slug === slug)
  if (!article) notFound()

  const isHealthArticle = HEALTH_SLUGS.has(slug)
  const relatedLinks = RELATED_LINKS[slug] ?? []

  // Pick 3 similar articles (same category first, then others)
  const similar = ARTICLES.filter((a) => a.slug !== slug)
    .sort((a, b) => {
      const sameA = a.category === article.category ? -1 : 0
      const sameB = b.category === article.category ? -1 : 0
      return sameA - sameB
    })
    .slice(0, 3)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.metaDescription,
    datePublished: article.publishedAt,
    dateModified: article.publishedAt,
    author: {
      '@type': 'Organization',
      name: 'MareChef.ro',
      url: 'https://marechef.ro',
    },
    publisher: {
      '@type': 'Organization',
      name: 'MareChef.ro',
      url: 'https://marechef.ro',
      logo: {
        '@type': 'ImageObject',
        url: 'https://marechef.ro/logo.svg',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://marechef.ro/blog/${slug}`,
    },
  }

  return (
    <main className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Article header */}
      <div
        className="w-full py-12 px-4"
        style={{ background: 'linear-gradient(135deg, #8B1A2B 0%, #b52035 50%, #d4293f 100%)' }}
      >
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-4 text-white/70 text-sm">
            <Link href="/blog" className="hover:text-white transition-colors">
              Blog
            </Link>
            <span>/</span>
            <span>{article.category}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight mb-4">
            {article.title}
          </h1>
          <div className="flex items-center gap-4 text-white/70 text-sm">
            <span>{formatDate(article.publishedAt)}</span>
            <span>·</span>
            <span>{article.readingTime} minute de citire</span>
          </div>
        </div>
      </div>

      {/* Article body */}
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Excerpt */}
        <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed border-l-4 border-[#b52035] pl-4 mb-8 italic">
          {article.excerpt}
        </p>

        {/* Health disclaimer */}
        {isHealthArticle && (
          <div className="mb-8 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-sm text-amber-800 dark:text-amber-300">
            <strong>Notă medicală:</strong> Informațiile din acest articol au scop educativ și informativ. Nu reprezintă sfat medical. Consultați un medic sau specialist în nutriție înainte de a modifica semnificativ dieta sau stilul de viață.
          </div>
        )}

        {/* Article HTML content */}
        <article
          className="prose prose-gray dark:prose-invert max-w-none
            prose-headings:font-bold prose-headings:text-gray-900 dark:prose-headings:text-gray-100
            prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4
            prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3
            prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-p:leading-relaxed prose-p:mb-4
            prose-ul:my-4 prose-li:text-gray-700 dark:prose-li:text-gray-300 prose-li:mb-1
            prose-strong:text-gray-900 dark:prose-strong:text-gray-100
            prose-blockquote:border-l-4 prose-blockquote:border-amber-400 prose-blockquote:bg-amber-50 dark:prose-blockquote:bg-amber-900/20 prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:rounded-r-lg prose-blockquote:not-italic prose-blockquote:text-amber-800 dark:prose-blockquote:text-amber-300"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />

        {/* Internal links */}
        {relatedLinks.length > 0 && (
          <div className="mt-10 p-6 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
            <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-3">
              Pe MareChef.ro
            </h3>
            <ul className="space-y-2">
              {relatedLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-[#b52035] dark:text-[#e05068] hover:underline text-sm font-medium"
                  >
                    {label} →
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Similar articles */}
        {similar.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
              Articole similare
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {similar.map((a: Article) => (
                <Link
                  key={a.slug}
                  href={`/blog/${a.slug}`}
                  className="group flex flex-col p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:shadow-md transition-shadow"
                >
                  <span className="text-xs font-semibold text-[#b52035] dark:text-[#e05068] mb-2">
                    {a.category}
                  </span>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-snug group-hover:text-[#b52035] dark:group-hover:text-[#e05068] transition-colors">
                    {a.title}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {a.readingTime} min citire
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Back to blog */}
        <div className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-700">
          <Link
            href="/blog"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-[#b52035] dark:hover:text-[#e05068] transition-colors"
          >
            ← Înapoi la Blog
          </Link>
        </div>
      </div>
    </main>
  )
}
