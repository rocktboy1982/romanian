import type { Metadata } from 'next'
import Link from 'next/link'
import HealthDashboardClient from '@/components/pages/health-dashboard-client'

export const metadata: Metadata = {
  title: 'Modul Sănătate — Hidratare, Post, Nutriție | MareChef.ro',
  description:
    'Urmărește-ți hidratarea zilnică, caloriile, postul intermitent și greutatea. Generează planuri de mese personalizate cu AI, alege din 14 protocoale dietetice și exportă în Google Calendar.',
  alternates: { canonical: 'https://marechef.ro/health' },
  openGraph: {
    title: 'Modul Sănătate | MareChef.ro',
    description:
      'Tracker de hidratare, post intermitent, jurnal alimentar, greutate și generator AI de planuri de mese săptămânale.',
    url: 'https://marechef.ro/health',
    siteName: 'MareChef.ro',
    locale: 'ro_RO',
    type: 'website',
  },
}

export default function HealthPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* ─── Public landing section — always visible to crawlers ─── */}
      <section className="w-full bg-gradient-to-br from-teal-600 to-teal-800 text-white py-14 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-extrabold mb-4 tracking-tight">
            Modul Sănătate MareChef
          </h1>
          <p className="text-lg text-teal-100 max-w-2xl mx-auto leading-relaxed">
            Un instrument complet pentru a-ți monitoriza sănătatea, a-ți optimiza alimentația și a-ți
            atinge obiectivele prin planuri personalizate generate cu Inteligență Artificială.
          </p>
        </div>
      </section>

      {/* Feature overview cards */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-8 text-center">
          Ce poți face în Modulul Sănătate
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {[
            {
              icon: '💧',
              title: 'Tracker hidratare',
              desc: 'Monitorizează aportul zilnic de apă cu obiectiv personalizat calculat din greutatea și activitatea ta. Înregistrează pahare rapid și urmărește progresul zilei.',
            },
            {
              icon: '⏱️',
              title: 'Post intermitent',
              desc: 'Suportă protocoalele 16:8, 18:6, 20:4, OMAD și 5:2. Timer vizual cu ore rămase, faze de post și istoricul sesiunilor anterioare.',
            },
            {
              icon: '🥗',
              title: 'Jurnal alimentar',
              desc: 'Înregistrează fiecare masă cu calorii, macronutrienți și oră. Vizualizează distribuția calorică pe parcursul zilei față de ținta ta zilnică.',
            },
            {
              icon: '⚖️',
              title: 'Urmărirea greutății',
              desc: 'Grafic SVG interactiv al evoluției greutății în timp. Calcul automat BMR (Mifflin-St Jeor) și TDEE adaptat nivelului de activitate fizică.',
            },
            {
              icon: '🤖',
              title: 'Generator AI de planuri de mese',
              desc: 'Plan personalizat de 7 zile generat de Gemini AI, adaptat profilului tău: alergii, condiții medicale, protocol dietetic și preferințe personale.',
            },
            {
              icon: '📅',
              title: 'Export Calendar (.ics)',
              desc: 'Exportă planul de mese și reminderele de hidratare ca fișier .ics compatibil cu Google Calendar, Apple Calendar și Outlook.',
            },
          ].map(({ icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6"
            >
              <div className="text-3xl mb-3">{icon}</div>
              <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Diet protocols */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-8 mb-12">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            14 protocoale dietetice suportate
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
            Planurile AI sunt adaptate protocoalelor dietetice cele mai cunoscute, cu macronutrienți și
            restricții corecte pentru fiecare.
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              'Mediteraneană', 'Keto', 'Atkins', 'Zone', 'Vegetariană', 'Vegană',
              'Weight Watchers', 'South Beach', 'Raw Food', 'Indice Glicemic',
              'Detox', 'Low Fat', 'Low Carb', 'Hipocalorică / Hipercalorică',
            ].map((d) => (
              <span
                key={d}
                className="px-3 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300"
              >
                {d}
              </span>
            ))}
          </div>
        </div>

        {/* Health profile features */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-8 mb-12">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Profil de sănătate complet
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
            Toate recomandările sunt personalizate pe baza profilului tău complet de sănătate.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-700 dark:text-gray-300">
            <ul className="space-y-1.5">
              <li>Vârstă, sex, înălțime, greutate actuală și țintă</li>
              <li>Nivel de activitate fizică (5 niveluri)</li>
              <li>11 condiții medicale (diabet, hipertensiune, etc.)</li>
              <li>8 tipuri de alergii alimentare</li>
            </ul>
            <ul className="space-y-1.5">
              <li>Grupă sanguină și preferințe personale</li>
              <li>Regim caloric: hipocaloric, hipercaloric, menținere</li>
              <li>Protocol de post intermitent activ</li>
              <li>Dată țintă pentru obiective de greutate</li>
            </ul>
          </div>
        </div>

        {/* CTA + disclaimer */}
        <div className="text-center mb-8">
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xl mx-auto mb-6">
            Autentifică-te pentru a accesa tabloul de bord complet. Datele tale de sănătate sunt
            private și protejate — niciodată partajate cu terți.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/auth/signin"
              className="px-6 py-3 rounded-xl font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-colors"
            >
              Intră în cont
            </Link>
            <Link
              href="/blog/fasting-intermitent"
              className="px-6 py-3 rounded-xl font-semibold text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
            >
              Citește despre fasting
            </Link>
          </div>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500 text-center max-w-2xl mx-auto">
          Informațiile din Modulul Sănătate au caracter informativ și nu reprezintă sfat medical.
          Consultați un medic înainte de a face modificări semnificative în alimentație sau stilul de viață.
        </p>
      </section>

      {/* ─── Dashboard for authenticated users (client component) ─── */}
      <HealthDashboardClient />
    </main>
  )
}
