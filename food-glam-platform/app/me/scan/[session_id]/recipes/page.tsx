import { Suspense } from 'react'
import type { Metadata } from 'next'
import ScanRecipesClient from '@/components/pages/scan-recipes-client'

export const metadata: Metadata = { title: 'Rețete Potrivite | MareChef.ro' }

export default async function ScanRecipesPage({ params }: { params: Promise<{ session_id: string }> }) {
  const { session_id } = await params
  return (
    <Suspense fallback={null}>
      <ScanRecipesClient sessionId={session_id} />
    </Suspense>
  )
}
