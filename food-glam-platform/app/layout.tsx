import React from 'react'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import '@/styles/globals.css'
import { Navigation } from '@/components/navigation'
import { FeatureFlagsProvider } from '@/components/feature-flags-provider'
import FeatureFlagPanel from '@/components/dev/feature-flag-panel'
import CookieConsent from '@/components/CookieConsent'
import ToastClient from '@/components/ui/toast-client'
import { ADSENSE_PUB_ID, ADS_ENABLED } from '@/lib/adsense-config'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MareChef.ro - Platformă Culinară',
  description: 'O platformă culinară elegantă unde poți descoperi rețete din toată lumea. Salvează rețete favorite, creează planuri de masă și generează liste de cumpărături.',
  keywords: ['rețete', 'gătit', 'mâncare', 'rețete ușoare', 'rețete sănătoase', 'planuri de masă'],
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
    title: 'MareChef.ro - Platformă Culinară',
    description: 'O platformă culinară elegantă unde poți descoperi rețete din toată lumea.',
    images: [
      {
        url: 'https://marechef.ro/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'MareChef.ro - Platformă Culinară',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MareChef.ro - Platformă Culinară',
    description: 'O platformă culinară elegantă unde poți descoperi rețete din toată lumea.',
    images: ['https://marechef.ro/og-image.jpg'],
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
      <body className={inter.className} style={{ background: '#0d0d0d' }}>
        {/* Google AdSense — loaded once globally, ad units push() individually */}
        {ADS_ENABLED && process.env.NODE_ENV === 'production' && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUB_ID}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
        <FeatureFlagsProvider>
          <ToastClient>
            <Navigation />
            {children}
            <CookieConsent />
            {process.env.NODE_ENV !== 'production' && <FeatureFlagPanel />}
          </ToastClient>
        </FeatureFlagsProvider>
      </body>
    </html>
  );
}
