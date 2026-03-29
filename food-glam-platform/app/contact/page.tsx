import type { Metadata } from 'next'
import Link from 'next/link'
import { MapPin, MessageSquare } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Contact | MareChef.ro',
  description:
    'Contactează echipa MareChef.ro pentru întrebări, sugestii sau colaborări. Scrie-ne la contact@marechef.ro.',
  alternates: { canonical: 'https://marechef.ro/contact' },
  openGraph: {
    title: 'Contact | MareChef.ro',
    description: 'Contactează echipa MareChef.ro pentru întrebări, sugestii sau colaborări.',
    url: 'https://marechef.ro/contact',
    siteName: 'MareChef.ro',
    locale: 'ro_RO',
    type: 'website',
  },
}

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div
        className="w-full py-14 px-4 text-center"
        style={{
          background: 'linear-gradient(135deg, #8B1A2B 0%, #b52035 50%, #d4293f 100%)',
        }}
      >
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-4">
            <MessageSquare className="h-9 w-9 text-white opacity-90" />
          </div>
          <h1 className="text-4xl font-extrabold text-white mb-3 tracking-tight">Contact</h1>
          <p className="text-white/80 text-lg max-w-lg mx-auto">
            Suntem bucuroși să auzim de la tine. Scrie-ne oricând!
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">

        {/* Contact cards */}
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Location */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <h2 className="font-bold text-lg">Locație</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-1">
              MareChef.ro este un proiect independent.
            </p>
            <p className="font-semibold">România</p>
          </div>
        </div>

        {/* Messages via platform */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-bold text-xl">Mesagerie internă</h2>
          </div>
          <p className="text-muted-foreground mb-4 leading-relaxed">
            Dacă ești autentificat pe platformă, poți trimite un mesaj direct prin sistemul
            intern de mesagerie. Este cea mai rapidă metodă de a ne contacta.
          </p>
          <Link
            href="/me/messages"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #ff4d6d, #ff9500)' }}
          >
            <MessageSquare className="h-4 w-4" />
            Deschide mesageria
          </Link>
        </div>

        {/* Topics */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-bold text-xl mb-4">Cu ce te putem ajuta?</h2>
          <ul className="space-y-2 text-muted-foreground">
            <li className="flex gap-2">
              <span className="text-primary font-bold">→</span>
              <span><strong className="text-foreground">Sugestii de rețete</strong> — Ai o rețetă tradițională pe care ai dori să o adăugăm?</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold">→</span>
              <span><strong className="text-foreground">Erori și probleme tehnice</strong> — Ai descoperit un bug sau o funcționalitate care nu merge?</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold">→</span>
              <span><strong className="text-foreground">Colaborări</strong> — Ești chef, blogger culinar sau influencer și dorești să colaborezi?</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold">→</span>
              <span><strong className="text-foreground">Date personale (GDPR)</strong> — Solicitări legate de datele tale personale.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold">→</span>
              <span><strong className="text-foreground">Drepturi de autor</strong> — Ai identificat un conținut protejat utilizat fără acordul tău?</span>
            </li>
          </ul>
        </div>

        {/* Response time note */}
        <p className="text-center text-sm text-muted-foreground">
          Ne angajăm să răspundem la toate mesajele în termen de <strong>1 săptămână</strong>.
        </p>

      </div>
    </main>
  )
}
