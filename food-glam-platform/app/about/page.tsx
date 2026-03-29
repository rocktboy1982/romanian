import type { Metadata } from 'next'
import Link from 'next/link'
import { UtensilsCrossed, Globe, Cpu, Users, Calendar, Mail } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Despre MareChef.ro — Platforma Culinară Românească',
  description:
    'Descoperă povestea din spatele MareChef.ro: misiunea noastră de a aduce bucătăriile lumii în casele românilor prin rețete autentice, planificare mese și AI culinar.',
  alternates: { canonical: 'https://marechef.ro/about' },
  openGraph: {
    title: 'Despre MareChef.ro',
    description: 'Platformă culinară românească cu 1200+ rețete autentice din 150+ țări.',
    url: 'https://marechef.ro/about',
    siteName: 'MareChef.ro',
    locale: 'ro_RO',
    type: 'website',
  },
}

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero banner */}
      <div
        className="w-full py-16 px-4 text-center"
        style={{
          background: 'linear-gradient(135deg, #8B1A2B 0%, #b52035 50%, #d4293f 100%)',
        }}
      >
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-4">
            <UtensilsCrossed className="h-10 w-10 text-white opacity-90" />
          </div>
          <h1 className="text-4xl font-extrabold text-white mb-4 tracking-tight">
            Despre MareChef.ro
          </h1>
          <p className="text-lg text-white/80 max-w-xl mx-auto leading-relaxed">
            Platforma culinară care aduce bucătăriile lumii în casele românilor — rețete autentice,
            planificare inteligentă și inspiraţie fără limite.
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-12">

        {/* Ce este MareChef.ro */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Ce este MareChef.ro?</h2>
          </div>
          <div className="ml-[52px] space-y-3 text-muted-foreground leading-relaxed">
            <p>
              MareChef.ro este o platformă culinară românească construită cu pasiune pentru
              gastronomie și tehnologie. Reunim <strong className="text-foreground">1.200+ rețete autentice
              din peste 150 de țări</strong>, traduse și adaptate în limba română, alături de o
              colecție de <strong className="text-foreground">986 de cocktailuri</strong> create de
              MareChef Bartender.
            </p>
            <p>
              De la preparate tradiționale românești precum sarmale sau ciorbă de burtă, până la
              rețete exotice din Japonia, Maroc sau Peru — MareChef.ro este ghidul tău culinar
              complet, disponibil oricând și oriunde.
            </p>
          </div>
        </section>

        {/* Misiunea noastră */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Misiunea noastră</h2>
          </div>
          <div className="ml-[52px] space-y-3 text-muted-foreground leading-relaxed">
            <p>
              Credem că mâncarea este cel mai universal limbaj. Misiunea noastră este să facem
              diversitatea culinară a lumii accesibilă tuturor românilor — indiferent de nivelul
              de experiență în bucătărie.
            </p>
            <p>
              Fiecare rețetă este tradusă cu grijă în limba română, cu ingrediente adaptate
              disponibilității locale și instrucțiuni clare, pas cu pas. Nu trebuie să știi engleză
              sau franceză pentru a găti o rețetă Thai sau Marocană.
            </p>
          </div>
        </section>

        {/* Funcționalități */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
              <Cpu className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Ce poți face pe MareChef.ro</h2>
          </div>
          <div className="ml-[52px]">
            <ul className="space-y-3 text-muted-foreground leading-relaxed">
              <li className="flex gap-2">
                <span className="text-primary font-bold mt-0.5">→</span>
                <span>
                  <strong className="text-foreground">Descoperă rețete</strong> — Explorează
                  mii de preparate autentice organizate pe regiuni, țări și stiluri culinare.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary font-bold mt-0.5">→</span>
                <span>
                  <strong className="text-foreground">Planifică mese</strong> — Creează planuri
                  săptămânale de mese cu calendar vizual și generează liste de cumpărături automat.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary font-bold mt-0.5">→</span>
                <span>
                  <strong className="text-foreground">Scanează ingrediente</strong> — Fotografiază
                  ce ai în frigider și AI-ul găsește rețetele potrivite pentru tine.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary font-bold mt-0.5">→</span>
                <span>
                  <strong className="text-foreground">Cartea de bucate personală</strong> —
                  Salvează rețetele favorite în colecția ta personală, accesibilă oricând.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary font-bold mt-0.5">→</span>
                <span>
                  <strong className="text-foreground">Cămara și barul virtual</strong> —
                  Gestionează ingredientele pe care le ai acasă și descoperă ce poți găti acum.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary font-bold mt-0.5">→</span>
                <span>
                  <strong className="text-foreground">Asistent AI culinar</strong> — Chatbot
                  alimentat de Gemini AI care răspunde la orice întrebare culinară.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary font-bold mt-0.5">→</span>
                <span>
                  <strong className="text-foreground">986 cocktailuri</strong> — Colecție
                  completă de cocktailuri clasice și moderne cu instrucțiuni detaliate.
                </span>
              </li>
            </ul>
          </div>
        </section>

        {/* Echipa */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Povestea noastră</h2>
          </div>
          <div className="ml-[52px] space-y-3 text-muted-foreground leading-relaxed">
            <p>
              MareChef.ro a luat naștere în <strong className="text-foreground">2026</strong> din
              dorința unui pasionat de gastronomie și tehnologie din România de a crea resursa
              culinară pe care și-ar fi dorit-o întotdeauna — completă, în română, și cu adevărat
              utilă în bucătărie.
            </p>
            <p>
              Platforma este construită cu tehnologii moderne: <strong className="text-foreground">Next.js</strong> pentru
              performanță și SEO, <strong className="text-foreground">Supabase</strong> pentru baza
              de date și autentificare, și <strong className="text-foreground">Gemini AI</strong> de
              la Google pentru funcționalitățile de inteligență artificială.
            </p>
            <p>
              Suntem o echipă mică, dar dedicată să îmbunătățim constant platforma — adăugând rețete
              noi, perfecționând funcționalitățile și ascultând feedback-ul comunității.
            </p>
          </div>
        </section>

        {/* Contact CTA */}
        <section className="rounded-2xl border border-border p-6 bg-card">
          <div className="flex items-center gap-3 mb-3">
            <Mail className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Contactează-ne</h2>
          </div>
          <p className="text-muted-foreground mb-4 leading-relaxed">
            Ai o întrebare, o sugestie sau dorești să colaborezi cu noi? Suntem bucuroși să auzim
            de la tine.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #ff4d6d, #ff9500)' }}
            >
              Pagina de contact
            </Link>
          </div>
        </section>

      </div>
    </main>
  )
}
