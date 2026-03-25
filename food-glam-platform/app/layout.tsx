import React from 'react'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import dynamic from 'next/dynamic'
import '@/styles/globals.css'
import { Navigation } from '@/components/navigation'
import { FeatureFlagsProvider } from '@/components/feature-flags-provider'
import { ThemeProvider } from '@/components/theme-provider'
import FeatureFlagPanel from '@/components/dev/feature-flag-panel'
import CookieConsent from '@/components/CookieConsent'
import ToastClient from '@/components/ui/toast-client'
import { ADSENSE_PUB_ID, ADS_ENABLED } from '@/lib/adsense-config'
import { Analytics } from '@vercel/analytics/next'

const ChatBot = dynamic(() => import('@/components/ChatBot'), { ssr: false })

const inter = Inter({ subsets: ['latin'] })

// Niche: rețete tradiționale românești reinterpretate + fine dining acasă + cocktailuri
// Targeting long-tail queries: "ce pot găti azi", "rețete românești tradiționale",
// "rețete fine dining acasă", "planuri de masă săptămânale", "cocktailuri de casă"
export const metadata: Metadata = {
  title: 'MareChef.ro — Rețete Culinare din Toată Lumea | Gătește cu Stil',
  description: 'Descoperă peste 4000 de rețete autentice din toată lumea, traduse în română. Planuri de masă, liste de cumpărături, cocktailuri și rețete tradiționale românești pe MareChef.ro.',
  keywords: [
    // Cele mai căutate query-uri în România (Google Trends data)
    'rețete',
    'rețete simple',
    'rețete rapide',
    'rețete de casă',
    'cum se face',
    // Top preparate căutate (volum ultra-ridicat)
    'ciorbă de pui',
    'sarmale',
    'mici de casă',
    'ciorbă de burtă',
    'mămăligă',
    // Long-tail cu intenție ridicată
    'rețete rapide cu pui',
    'tort de casă',
    'retete gata in 30 de minute',
    'cina rapida in 15 minute',
    // Funcționalități platformă
    'plan de masă săptămânal',
    'listă de cumpărături automată',
    'cocktailuri de casă',
    'rețete internaționale în română',
    // Trending 2025
    'kebab la tavă',
    'rețete la air fryer',
    'rețete de post',
  ],
  verification: {
    google: 'google74b41e035b440d26',
  },
  other: {
    'profitshareid': 'd71654ad223cdf6397214d8057b92c38',
  },
  authors: [{ name: 'MareChef.ro' }],
  creator: 'MareChef.ro',
  publisher: 'MareChef.ro',
  formatDetection: {
    email: false,
    telephone: false,
    address: false,
  },
  openGraph: {
    type: 'website',
    locale: 'ro_RO',
    url: 'https://marechef.ro',
    siteName: 'MareChef.ro',
    title: 'MareChef.ro — Rețete Culinare din Toată Lumea | Gătește cu Stil',
    description: 'Descoperă peste 4000 de rețete autentice din toată lumea, traduse în română. Planuri de masă, liste de cumpărături, cocktailuri și rețete tradiționale românești pe MareChef.ro.',
    images: [
      {
        url: 'https://marechef.ro/og',
        width: 1200,
        height: 630,
        alt: 'MareChef.ro - Platformă Culinară',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MareChef.ro — Rețete Tradiționale Românești & Fine Dining Acasă',
    description: 'Rețete românești tradiționale reinterpretate, fine dining acasă și cocktailuri elegante.',
    images: ['https://marechef.ro/og'],
  },
  alternates: {
    canonical: 'https://marechef.ro',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // ...existing code...
  return (
    <html lang="ro">
      <head>
        {/* Google Analytics (GA4) */}
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-4X6TFY53BY" strategy="afterInteractive" />
        <Script id="ga4-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-4X6TFY53BY');`}
        </Script>
      </head>
      <body className={inter.className}>
        {/* WebSite + Organization schema.org — tells Google what this site is */}
        <Script
          id="website-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'WebSite',
                  '@id': 'https://marechef.ro/#website',
                  url: 'https://marechef.ro',
                  name: 'MareChef.ro',
                  description: 'Descoperă peste 4000 de rețete autentice din toată lumea, traduse în română. Planuri de masă, liste de cumpărături, cocktailuri și rețete tradiționale românești pe MareChef.ro.',
                  inLanguage: 'ro-RO',
                  potentialAction: {
                    '@type': 'SearchAction',
                    target: { '@type': 'EntryPoint', urlTemplate: 'https://marechef.ro/search?q={search_term_string}' },
                    'query-input': 'required name=search_term_string',
                  },
                },
                {
                  '@type': 'Organization',
                  '@id': 'https://marechef.ro/#organization',
                  name: 'MareChef.ro',
                  url: 'https://marechef.ro',
                  logo: {
                    '@type': 'ImageObject',
                    url: 'https://marechef.ro/logo.svg',
                    width: 512,
                    height: 512,
                  },
                  description: 'Descoperă peste 4000 de rețete autentice din toată lumea, traduse în română. Planuri de masă, liste de cumpărături, cocktailuri și rețete tradiționale românești pe MareChef.ro.',
                  sameAs: [],
                },
              ],
            }),
          }}
          strategy="afterInteractive"
        />

        {/* Google AdSense — loaded once globally, ad units push() individually */}
        {ADS_ENABLED && process.env.NODE_ENV === 'production' && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUB_ID}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
        <ThemeProvider>
          <FeatureFlagsProvider>
            <ToastClient>
              <Navigation />
              {children}
              {/* Global Footer */}
              <footer className="w-full border-t border-gray-200 dark:border-gray-800 mt-auto py-8 px-4 bg-gray-50 dark:bg-[#0d0d0d]">
                <div className="max-w-7xl mx-auto flex flex-col items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-4">
                    <p>© {new Date().getFullYear()} MareChef.ro — Platformă Culinară</p>
                    <div className="flex items-center gap-4">
                      <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer" className="hover:underline">
                        Fotografii furnizate de Pexels
                      </a>
                    </div>
                  </div>
                  <p className="text-center text-[10px] text-gray-400 dark:text-gray-500 max-w-2xl">
                    MareChef.ro este o platformă culinară independentă. Funcționalitățile platformei sunt proprietatea MareChef.ro. 
                    Rețetele și fotografiile aparțin autorilor respectivi și sunt utilizate conform licențelor aplicabile. Toate drepturile rezervate.
                  </p>
                </div>
              </footer>
              <Analytics />
              <CookieConsent />
              <ChatBot />
              {process.env.NODE_ENV !== 'production' && <FeatureFlagPanel />}
            </ToastClient>
          </FeatureFlagsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
