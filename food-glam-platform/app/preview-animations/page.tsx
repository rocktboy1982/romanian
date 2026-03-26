'use client'

import '../globals-animations.css'
import { useEffect, useRef, useState, useCallback } from 'react'

/* ── Types ─────────────────────────────────────────────────────────────── */

interface RecipeCard {
  id: number
  title: string
  description: string
  tag: string
}

interface StatItem {
  label: string
  value: string
  numericValue: number
}

interface AccordionItem {
  title: string
  content: string
}

/* ── Static data ────────────────────────────────────────────────────────── */

const RECIPE_CARDS: RecipeCard[] = [
  { id: 1, title: 'Ciorbă de Burtă', description: 'Rețetă tradițională românească cu smântână și ardei iute, gătită lent 3 ore.', tag: 'Tradițional' },
  { id: 2, title: 'Mici la Grătar', description: 'Mici suculenți din amestec de vită și porc, cu usturoi și cimbru.', tag: 'Grill' },
  { id: 3, title: 'Sarmale cu Smântână', description: 'Sarmale în foi de varză cu umplutură de carne și orez, servite cu smântână.', tag: 'Festiv' },
  { id: 4, title: 'Plăcintă cu Mere', description: 'Plăcintă pufoasă cu mere caramelizate, scorțișoară și zahăr vanilat.', tag: 'Desert' },
  { id: 5, title: 'Supă Cremă de Dovleac', description: 'Supă catifelată cu dovleac copt, ghimbir proaspăt și semințe de dovleac prăjite.', tag: 'Vegetarian' },
  { id: 6, title: 'Friptură de Miel', description: 'Pulpă de miel marinată cu rozmarin și usturoi, coaptă la cuptor 4 ore.', tag: 'Special' },
]

const BAR_DATA = [
  { label: 'Lun', height: 60 },
  { label: 'Mar', height: 85 },
  { label: 'Mie', height: 45 },
  { label: 'Joi', height: 90 },
  { label: 'Vin', height: 70 },
  { label: 'Sâm', height: 100 },
  { label: 'Dum', height: 55 },
]

const STATS: StatItem[] = [
  { label: 'Rețete', value: '1.202', numericValue: 1202 },
  { label: 'Cocktailuri', value: '986', numericValue: 986 },
  { label: 'Țări', value: '150+', numericValue: 150 },
  { label: 'Utilizatori', value: '174', numericValue: 174 },
]

const STAGGER_ITEMS = [
  'Ciorbă de Burtă cu Smântână',
  'Mici Tradiționali la Grătar',
  'Sarmale în Foi de Varză',
  'Plăcintă cu Mere și Scorțișoară',
  'Supă Cremă de Dovleac',
  'Friptură de Miel la Cuptor',
]

const ACCORDION_ITEMS: AccordionItem[] = [
  {
    title: 'Cum funcționează animațiile de scroll?',
    content: 'Animațiile de scroll folosesc IntersectionObserver pentru a detecta când un element intră în viewport. Când elementul devine vizibil, se adaugă clasa .visible care declanșează tranziția CSS de la opacity: 0 la opacity: 1 și translateY(20px) la translateY(0).',
  },
  {
    title: 'Sunt animațiile accesibile?',
    content: 'Da. Toate animațiile respectă prefers-reduced-motion. Utilizatorii care au activată această preferință în sistemul lor de operare vor vedea conținutul direct, fără animații.',
  },
]

const IMAGE_URLS = [
  'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?w=400',
  'https://images.pexels.com/photos/1565982/pexels-photo-1565982.jpeg?w=400',
  'https://images.pexels.com/photos/376464/pexels-photo-376464.jpeg?w=400',
]

const NAV_LINKS = ['Rețete', 'Cocktailuri', 'Planificare', 'Cămara', 'Despre noi']

/* ── Section wrapper ────────────────────────────────────────────────────── */

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="mb-16">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-500 text-sm">{description}</p>
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
        {children}
      </div>
    </section>
  )
}

/* ── Main page ──────────────────────────────────────────────────────────── */

export default function PreviewAnimationsPage() {
  /* Scroll cards */
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  /* Image loading state */
  const [loadedImages, setLoadedImages] = useState<Record<number, boolean>>({})

  /* Chart animation key — changing it remounts the bars to replay */
  const [chartKey, setChartKey] = useState(0)

  /* Heart bounce */
  const [heartSaved, setHeartSaved] = useState(false)
  const [heartBouncing, setHeartBouncing] = useState(false)

  /* Toast */
  const [toastVisible, setToastVisible] = useState(false)
  const [toastExiting, setToastExiting] = useState(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* Accordion */
  const [openAccordion, setOpenAccordion] = useState<number | null>(null)

  /* Stats re-trigger */
  const [statsKey, setStatsKey] = useState(0)

  /* ── Scroll observer ──────────────────────────────────────────────────── */
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const cards = container.querySelectorAll<HTMLElement>('.animate-on-scroll')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      },
      { threshold: 0.15 }
    )

    cards.forEach((card) => observer.observe(card))
    return () => observer.disconnect()
  }, [])

  /* ── Heart handler ────────────────────────────────────────────────────── */
  const handleHeart = useCallback(() => {
    setHeartSaved((prev) => !prev)
    setHeartBouncing(true)
    setTimeout(() => setHeartBouncing(false), 450)
  }, [])

  /* ── Toast handler ────────────────────────────────────────────────────── */
  const showToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToastExiting(false)
    setToastVisible(true)

    toastTimerRef.current = setTimeout(() => {
      setToastExiting(true)
      setTimeout(() => setToastVisible(false), 320)
    }, 2800)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  /* ── Image load handler ───────────────────────────────────────────────── */
  const handleImageLoad = useCallback((index: number) => {
    setLoadedImages((prev) => ({ ...prev, [index]: true }))
  }, [])

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <main className="page-enter min-h-screen bg-gray-50 pb-24">
      {/* ── Toast overlay ─────────────────────────────────────────────── */}
      {toastVisible && (
        <div
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-white border border-gray-200 shadow-lg rounded-xl px-5 py-3 text-sm font-medium text-gray-800 ${toastExiting ? 'toast-exit' : 'toast-enter'}`}
        >
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)' }}
          />
          Rețeta a fost salvată în colecție!
        </div>
      )}

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div
        className="relative py-20 px-4 text-center overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        }}
      >
        <div className="max-w-3xl mx-auto">
          <div
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest mb-6 px-4 py-2 rounded-full border"
            style={{ color: '#ff9500', borderColor: 'rgba(255,149,0,0.3)', background: 'rgba(255,149,0,0.08)' }}
          >
            Pagina de previzualizare
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 text-shimmer leading-tight">
            Previzualizare Animații MareChef
          </h1>
          <p className="text-gray-300 text-lg max-w-xl mx-auto leading-relaxed">
            Toate animațiile propuse pentru site sunt demonstrate mai jos. Aprobă-le înainte de aplicarea globală.
          </p>
          <p className="mt-4 text-sm text-gray-500">15 tipuri de animații · Fără librării externe · Accesibil</p>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 py-16">

        {/* 1. Recipe cards — scroll fade-in */}
        <Section
          title="1. Fade-in la scroll (Carduri rețete)"
          description="Cardurile apar progresiv când intri în viewport. Implementat cu IntersectionObserver — fără librării externe."
        >
          <div ref={scrollContainerRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {RECIPE_CARDS.map((card, i) => {
              const delayClass = i % 3 === 1 ? 'delay-1' : i % 3 === 2 ? 'delay-2' : ''
              return (
                <div
                  key={card.id}
                  className={`animate-on-scroll card-hover bg-gray-50 border border-gray-100 rounded-xl overflow-hidden cursor-pointer ${delayClass}`}
                >
                  {/* Skeleton image placeholder */}
                  <div className="h-36 skeleton-shimmer bg-gray-200 rounded-t-xl" />
                  <div className="p-4">
                    <span
                      className="text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(255,77,109,0.1)', color: '#ff4d6d' }}
                    >
                      {card.tag}
                    </span>
                    <h3 className="mt-2 font-bold text-gray-900 text-sm">{card.title}</h3>
                    <p className="mt-1 text-xs text-gray-500 line-clamp-2">{card.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-4 text-xs text-gray-400 text-center">Imaginile de mai sus sunt placeholder-uri (skeleton shimmer). Derulează în jos pentru a declanșa animația.</p>
        </Section>

        {/* 2. Image loading */}
        <Section
          title="2. Skeleton shimmer + Fade reveal imagine"
          description="Placeholder-ul animat se afișează cât timp imaginea se încarcă. Când imaginea e gata, apare cu fade-in."
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {IMAGE_URLS.map((url, i) => (
              <div key={i} className="relative rounded-xl overflow-hidden aspect-video bg-gray-200">
                {/* Shimmer shown until image loads */}
                {!loadedImages[i] && (
                  <div className="absolute inset-0 skeleton-shimmer" />
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Mâncare ${i + 1}`}
                  className={`w-full h-full object-cover image-reveal ${loadedImages[i] ? 'loaded' : ''}`}
                  onLoad={() => handleImageLoad(i)}
                />
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-gray-400 text-center">Reîncarcă pagina pentru a vedea shimmer-ul din nou (imaginile sunt cache-uite după prima încărcare).</p>
        </Section>

        {/* 3. Buttons */}
        <Section
          title="3. Efecte hover butoane"
          description="Butoanele se ridică ușor la hover și coboară la click — feedback vizual subtil."
        >
          <div className="flex flex-wrap gap-4 items-center">
            <button
              className="btn-animate px-6 py-2.5 rounded-xl text-white text-sm font-semibold"
              style={{ background: 'linear-gradient(135deg, #ff4d6d, #ff9500)' }}
            >
              Salvează rețeta
            </button>
            <button
              className="btn-animate px-6 py-2.5 rounded-xl text-sm font-semibold border-2 bg-white text-gray-800"
              style={{ borderColor: '#ff4d6d', color: '#ff4d6d' }}
            >
              Adaugă la plan
            </button>
            <button
              className="btn-animate px-6 py-2.5 rounded-xl text-white text-sm font-semibold bg-gray-800"
            >
              Vizualizează
            </button>
            <button
              className="btn-animate px-6 py-2.5 rounded-xl text-white text-sm font-semibold"
              style={{ background: '#dc2626' }}
            >
              Șterge
            </button>
          </div>
          <p className="mt-4 text-xs text-gray-400">Trece cu mouse-ul peste butoane pentru a vedea efectul translateY(-2px) + box-shadow.</p>
        </Section>

        {/* 4. Charts */}
        <Section
          title="4. Animații grafice (bare + inel de progres)"
          description="Barele cresc de la zero la valoare finală. Inelul de progres SVG se umple progresiv."
        >
          <div className="flex flex-col sm:flex-row gap-10 items-start">
            {/* Bar chart */}
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Rețete gătite pe săptămână</p>
              <div key={chartKey} className="flex items-end gap-2 h-28">
                {BAR_DATA.map((bar, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 flex-1">
                    <div
                      className={`chart-bar bar-${i + 1} w-full rounded-t-md`}
                      style={{
                        height: `${bar.height}%`,
                        background: 'linear-gradient(180deg, #ff4d6d, #ff9500)',
                        opacity: 0.85,
                      }}
                    />
                    <span className="text-[10px] text-gray-400">{bar.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Progress ring */}
            <div className="flex flex-col items-center gap-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Progres săptămânal</p>
              <div key={`ring-${chartKey}`} className="relative w-24 h-24">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="url(#ringGrad)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray="283"
                    strokeDashoffset="80"
                    className="progress-ring-animate"
                  />
                  <defs>
                    <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#ff4d6d" />
                      <stop offset="100%" stopColor="#ff9500" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold text-gray-900">72%</span>
                  <span className="text-[10px] text-gray-400">obiectiv</span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setChartKey((k) => k + 1)}
            className="btn-animate mt-6 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 bg-gray-50 hover:bg-gray-100"
          >
            Reanimează graficele
          </button>
        </Section>

        {/* 5. Nav links */}
        <Section
          title="5. Subliniere animată linkuri navigație"
          description="O linie gradient apare dinspre centru spre exterior la hover. Linkul activ menține linia permanent."
        >
          <nav className="flex flex-wrap gap-6 items-center py-2">
            {NAV_LINKS.map((link, i) => (
              <button
                key={i}
                className={`nav-link-animated text-sm font-medium text-gray-700 hover:text-gray-900 pb-1 cursor-pointer bg-transparent border-none ${i === 0 ? 'active' : ''}`}
              >
                {link}
              </button>
            ))}
          </nav>
          <p className="mt-4 text-xs text-gray-400">
            &quot;Rețete&quot; este marcat ca activ (linie permanentă). Trece cu mouse-ul peste celelalte linkuri.
          </p>
        </Section>

        {/* 6. Heart + Pulse glow */}
        <Section
          title="6. Animație inimă (salvare) + Pulsație badge"
          description="Clicul pe inimă declanșează o animație heartbeat. Badge-ul pulsează continuu pentru a atrage atenția."
        >
          <div className="flex flex-wrap gap-8 items-center">
            {/* Heart button */}
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={handleHeart}
                className="relative w-14 h-14 rounded-full flex items-center justify-center bg-white border-2 shadow-sm hover:shadow-md transition-shadow"
                style={{ borderColor: heartSaved ? '#ff4d6d' : '#e5e7eb' }}
                aria-label="Salvează rețeta"
              >
                <svg
                  viewBox="0 0 24 24"
                  className={`w-7 h-7 transition-colors ${heartBouncing ? 'heart-bounce' : ''}`}
                  style={{
                    fill: heartSaved ? '#ff4d6d' : 'none',
                    stroke: heartSaved ? '#ff4d6d' : '#9ca3af',
                    strokeWidth: 2,
                  }}
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </button>
              <span className="text-xs text-gray-500">{heartSaved ? 'Salvat!' : 'Apasă inima'}</span>
            </div>

            {/* Pulse glow badge */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xs font-bold pulse-glow"
                  style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)' }}>
                  NOU
                </div>
              </div>
              <span className="text-xs text-gray-500">Badge pulsant</span>
            </div>

            {/* Notification dot */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <span
                  className="absolute top-0 right-0 w-4 h-4 rounded-full text-[9px] text-white font-bold flex items-center justify-center pulse-glow"
                  style={{ background: '#ff4d6d' }}
                >
                  3
                </span>
              </div>
              <span className="text-xs text-gray-500">Notificare pulsantă</span>
            </div>
          </div>
        </Section>

        {/* 7. Toast */}
        <Section
          title="7. Notificare toast (slide-in / slide-out)"
          description="Toast-ul apare din sus cu slide-in, dispare automat după 2.8 secunde cu slide-out."
        >
          <div className="flex items-center gap-4">
            <button
              onClick={showToast}
              className="btn-animate px-5 py-2.5 rounded-xl text-white text-sm font-semibold"
              style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)' }}
            >
              Arată toast
            </button>
            <span className="text-xs text-gray-400">Toast-ul apare fix în partea de sus a ecranului.</span>
          </div>
        </Section>

        {/* 8. Accordion */}
        <Section
          title="8. Accordion cu animație de înălțime"
          description="Conținutul se deschide și se închide cu o tranziție fluidă de înălțime și opacitate."
        >
          <div className="space-y-2">
            {ACCORDION_ITEMS.map((item, i) => (
              <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  className="w-full text-left px-5 py-4 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors"
                  onClick={() => setOpenAccordion(openAccordion === i ? null : i)}
                >
                  <span className="text-sm font-semibold text-gray-800">{item.title}</span>
                  <svg
                    viewBox="0 0 24 24"
                    className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${openAccordion === i ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {openAccordion === i && (
                  <div className="accordion-content px-5 pb-4 text-sm text-gray-500 leading-relaxed bg-white">
                    {item.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* 9. Stats count-up */}
        <Section
          title="9. Statistici cu animație count-up"
          description="Numerele apar cu un efect de pop-in (scale + fade). Apasă butonul pentru a reporni animația."
        >
          <div key={statsKey} className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {STATS.map((stat, i) => (
              <div key={i} className="text-center">
                <div
                  className="text-3xl font-extrabold count-up"
                  style={{
                    background: 'linear-gradient(135deg,#ff4d6d,#ff9500)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    animationDelay: `${i * 0.1}s`,
                  }}
                >
                  {stat.value}
                </div>
                <div className="text-xs text-gray-500 mt-1 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setStatsKey((k) => k + 1)}
            className="btn-animate mt-6 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 bg-gray-50 hover:bg-gray-100"
          >
            Reanimează statisticile
          </button>
        </Section>

        {/* 10. Staggered list */}
        <Section
          title="10. Listă cu intrare eșalonată"
          description="Elementele listei apar unul câte unul cu o mică întârziere între ele. Ideal pentru rezultate de căutare."
        >
          <ul key={statsKey} className="stagger-in space-y-2">
            {STAGGER_ITEMS.map((item, i) => (
              <li
                key={i}
                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-50 border border-gray-100 text-sm text-gray-700"
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)' }}
                >
                  {i + 1}
                </span>
                {item}
              </li>
            ))}
          </ul>
        </Section>

        {/* 11–15 summary */}
        <Section
          title="11–15. Alte efecte CSS incluse"
          description="Animate în CSS pur, gata de aplicat prin clase. Nicio librărie externă necesară."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            {[
              { num: '11', name: 'Card hover lift', desc: 'translateY(-4px) + shadow la hover pe orice card.' },
              { num: '12', name: 'Text shimmer gradient', desc: 'Titluri cu gradient animat (folosit în hero-ul de mai sus).' },
              { num: '13', name: 'Pulse glow badge', desc: 'Pulsație radială pentru badge-uri și notificări.' },
              { num: '14', name: 'Count-up pop', desc: 'Scale + fade la apariția statisticilor.' },
              { num: '15', name: 'Page enter', desc: 'Fade + slide de 8px la încărcarea oricărei pagini.' },
            ].map((item) => (
              <div key={item.num} className="flex gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50">
                <span
                  className="text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)' }}
                >
                  {item.num}
                </span>
                <div>
                  <p className="font-semibold text-gray-800">{item.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Implementation note */}
        <div className="mt-4 p-6 rounded-2xl border-2 border-dashed border-gray-200 text-center">
          <p className="text-sm font-semibold text-gray-700 mb-1">Animațiile nu sunt aplicate site-wide.</p>
          <p className="text-xs text-gray-400 max-w-lg mx-auto">
            Fișierul <code className="bg-gray-100 px-1 rounded text-gray-600">app/globals-animations.css</code> este importat
            doar pe această pagină. Dupa aprobare, va fi adăugat în{' '}
            <code className="bg-gray-100 px-1 rounded text-gray-600">styles/globals.css</code> și clasele vor fi aplicate
            componentelor respective.
          </p>
        </div>
      </div>
    </main>
  )
}
