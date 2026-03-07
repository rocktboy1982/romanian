import type { Metadata } from 'next'
import ScanReviewClient from '@/components/pages/scan-review-client'

export const metadata: Metadata = { title: 'Verifică Ingrediente | MareChef.ro' }

export default async function ScanReviewPage({ params }: { params: Promise<{ session_id: string }> }) {
  const { session_id } = await params
  return <ScanReviewClient sessionId={session_id} />
}
