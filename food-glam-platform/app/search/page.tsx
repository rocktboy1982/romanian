import { Suspense } from 'react'
import type { Metadata } from 'next'
import SearchDiscoveryPageClient from '@/components/pages/search-discovery-page-client'

export const metadata: Metadata = {
  title: 'Caută Rețete | MareChef.ro',
  description: 'Caută rețete după titlu, abordare, dietă și multe altele. Descoperă mii de rețete delicioase pe MareChef.ro.',
  openGraph: {
    title: 'Caută Rețete | MareChef.ro',
    description: 'Caută rețete după titlu, abordare, dietă și multe altele.',
    url: 'https://marechef.ro/search',
    type: 'website',
    locale: 'ro_RO',
    siteName: 'MareChef.ro',
  },
  twitter: {
    card: 'summary',
    title: 'Caută Rețete | MareChef.ro',
    description: 'Caută rețete după titlu, abordare, dietă și multe altele.',
  },
  alternates: {
    canonical: 'https://marechef.ro/search',
  },
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#dde3ee' }}>
        <div className="animate-spin w-8 h-8 border-2 border-stone-300 border-t-stone-800 rounded-full" />
      </div>
    }>
      <SearchDiscoveryPageClient />
    </Suspense>
  )
}