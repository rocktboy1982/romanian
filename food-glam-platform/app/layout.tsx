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
  title: 'Food Glam - Platformă Culinară',
  description: 'O platformă culinară elegantă unde poți descoperi rețete din toată lumea.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // ...existing code...
  return (
    <html lang="en">
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
