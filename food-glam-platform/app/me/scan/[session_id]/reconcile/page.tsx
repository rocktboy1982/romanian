import type { Metadata } from 'next'
import ScanReconcileClient from '@/components/pages/scan-reconcile-client'

export const metadata: Metadata = { title: 'Actualizează Lista | MareChef.ro' }

export default async function ScanReconcilePage({ params }: { params: Promise<{ session_id: string }> }) {
  const { session_id } = await params
  return <ScanReconcileClient sessionId={session_id} />
}
