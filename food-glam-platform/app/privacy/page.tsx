import type { Metadata } from 'next'
import PrivacyClient from '@/components/modules/privacy-client'
import { Shield } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Confidențialitate și date personale | MareChef.ro',
  description:
    'Gestionează datele tale personale pe MareChef.ro. Exportă toate datele tale sau solicită dezactivarea contului.',
  robots: { index: false },
}

export default function PrivacyPage() {
  return (
    <main className="container mx-auto px-4 py-10 max-w-2xl">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Confidențialitate și date personale
          </h1>
        </div>
        <p className="text-sm text-muted-foreground ml-[52px]">
          Controlul complet asupra datelor tale pe MareChef.ro, conform GDPR.
        </p>
      </div>

      {/* Main content */}
      <PrivacyClient />

      {/* Footer legal note */}
      <div className="mt-12 pt-6 border-t border-border">
        <p className="text-xs text-muted-foreground">
          MareChef.ro respectă Regulamentul General privind Protecția Datelor (GDPR —
          Regulamentul UE 2016/679). Pentru întrebări privind datele tale personale,
          ne poți contacta prin secțiunea{' '}
          <a href="/me/messages" className="underline underline-offset-2 hover:text-foreground">
            Mesaje
          </a>
          .
        </p>
      </div>
    </main>
  )
}
