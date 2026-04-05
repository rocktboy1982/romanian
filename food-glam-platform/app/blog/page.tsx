import type { Metadata } from 'next'
import Link from 'next/link'
import { ARTICLES } from '@/lib/blog-articles'

export const metadata: Metadata = {
  title: 'Blog Culinar | MareChef.ro',
  description: 'Articole originale despre gătit, nutriție, tehnici culinare, diete și tradiții alimentare din România și din lume. Scrise de pasionați pentru pasionați.',
  alternates: { canonical: 'https://marechef.ro/blog' },
  openGraph: {
    title: 'Blog Culinar | MareChef.ro',
    description: 'Articole originale despre gătit, nutriție, tehnici culinare și tradiții alimentare.',
    url: 'https://marechef.ro/blog',
    siteName: 'MareChef.ro',
    locale: 'ro_RO',
    type: 'website',
  },
}

const CATEGORY_COLORS: Record<string, string> = {
  'Ghiduri': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'Sfaturi': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  'Organizare': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'Nutriție': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'Tradiții': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'Tehnici': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  'Sănătate': 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  'Băuturi': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  'Cultură': 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function BlogPage() {
  const sortedArticles = [...ARTICLES].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )

  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <div
        className="w-full py-16 px-4 text-center"
        style={{ background: 'linear-gradient(135deg, #8B1A2B 0%, #b52035 50%, #d4293f 100%)' }}
      >
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-extrabold text-white mb-4 tracking-tight">
            Blog Culinar MareChef
          </h1>
          <p className="text-lg text-white/80 max-w-xl mx-auto leading-relaxed">
            Articole originale despre gătit, nutriție, tehnici culinare, diete și tradiții alimentare
            din România și din toată lumea.
          </p>
        </div>
      </div>

      {/* Articles grid */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedArticles.map((article) => {
            const categoryColor =
              CATEGORY_COLORS[article.category] ??
              'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'

            return (
              <Link
                key={article.slug}
                href={`/blog/${article.slug}`}
                className="group flex flex-col rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden hover:shadow-lg transition-shadow duration-200"
              >
                <div className="flex flex-col flex-1 p-6 gap-3">
                  {/* Category + reading time */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${categoryColor}`}
                    >
                      {article.category}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                      {article.readingTime} min citire
                    </span>
                  </div>

                  {/* Title */}
                  <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 leading-snug group-hover:text-[#b52035] dark:group-hover:text-[#e05068] transition-colors">
                    {article.title}
                  </h2>

                  {/* Excerpt */}
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed flex-1">
                    {article.excerpt}
                  </p>

                  {/* Date */}
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-auto pt-2 border-t border-gray-100 dark:border-gray-800">
                    {formatDate(article.publishedAt)}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Internal links section */}
        <div className="mt-16 p-8 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Explorează MareChef.ro
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Pe lângă articolele de blog, MareChef.ro oferă o platformă completă pentru pasionații de gătit.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            {[
              { href: '/cookbooks', label: 'Cărți de bucate' },
              { href: '/cocktails', label: 'Cocktailuri' },
              { href: '/health', label: 'Modul Sănătate' },
              { href: '/search', label: 'Caută rețete' },
              { href: '/plan', label: 'Planificator mese' },
              { href: '/submit/recipe', label: 'Trimite o rețetă' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-[#b52035] dark:text-[#e05068] hover:underline font-medium"
              >
                {label} →
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
