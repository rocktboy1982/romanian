import type { Metadata } from 'next'
import Link from 'next/link'
import { Scale } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Termeni și Condiții | MareChef.ro',
  description:
    'Termenii și condițiile de utilizare a platformei MareChef.ro. Citește regulile privind utilizarea serviciului, drepturile de autor și limitarea răspunderii.',
  alternates: { canonical: 'https://marechef.ro/terms' },
  openGraph: {
    title: 'Termeni și Condiții | MareChef.ro',
    description: 'Termenii și condițiile de utilizare a platformei MareChef.ro.',
    url: 'https://marechef.ro/terms',
    siteName: 'MareChef.ro',
    locale: 'ro_RO',
    type: 'website',
  },
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div
        className="w-full py-14 px-4 text-center"
        style={{
          background: 'linear-gradient(135deg, #8B1A2B 0%, #b52035 50%, #d4293f 100%)',
        }}
      >
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Scale className="h-9 w-9 text-white opacity-90" />
          </div>
          <h1 className="text-4xl font-extrabold text-white mb-3 tracking-tight">
            Termeni și Condiții
          </h1>
          <p className="text-white/80 text-base max-w-xl mx-auto">
            Ultima actualizare: Martie 2026
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="prose prose-sm max-w-none space-y-10">

          {/* Introducere */}
          <section>
            <h2 className="text-xl font-bold mb-3">1. Introducere</h2>
            <p className="text-muted-foreground leading-relaxed">
              Acești Termeni și Condiții (&quot;Termeni&quot;) guvernează accesul și utilizarea platformei
              MareChef.ro (&quot;Platforma&quot;, &quot;Serviciul&quot;), disponibilă la adresa{' '}
              <strong className="text-foreground">https://marechef.ro</strong>. Prin accesarea sau
              utilizarea Platformei, ești de acord să fii legat de acești Termeni. Dacă nu ești de
              acord cu aceștia, te rugăm să nu utilizezi Platforma.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Ne rezervăm dreptul de a modifica acești Termeni în orice moment. Modificările vor fi
              comunicate prin actualizarea datei de &quot;Ultima actualizare&quot; de mai sus. Utilizarea
              continuă a Platformei după publicarea modificărilor constituie acceptarea noilor Termeni.
            </p>
          </section>

          <div className="border-t border-border" />

          {/* Definiții */}
          <section>
            <h2 className="text-xl font-bold mb-3">2. Definiții</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <strong className="text-foreground">Platformă / Serviciu</strong> — ansamblul de
                funcționalități disponibile la https://marechef.ro, inclusiv aplicația web, API-urile
                și conținutul editorial.
              </li>
              <li>
                <strong className="text-foreground">Utilizator</strong> — orice persoană fizică care
                accesează Platforma, fie neautentificat, fie cu cont înregistrat.
              </li>
              <li>
                <strong className="text-foreground">Cont</strong> — profilul de utilizator creat
                prin autentificare cu Google OAuth pe MareChef.ro.
              </li>
              <li>
                <strong className="text-foreground">Conținut</strong> — orice text, rețetă,
                fotografie, comentariu, rating sau altă informație publicată pe Platformă de
                utilizatori sau de echipa MareChef.ro.
              </li>
              <li>
                <strong className="text-foreground">Operator</strong> — persoana sau entitatea care
                administrează MareChef.ro, cu sediul în România.
              </li>
            </ul>
          </section>

          <div className="border-t border-border" />

          {/* Utilizarea Serviciului */}
          <section>
            <h2 className="text-xl font-bold mb-3">3. Utilizarea Serviciului</h2>

            <h3 className="font-semibold text-foreground mb-2">3.1. Eligibilitate</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Platforma este destinată utilizatorilor care au împlinit vârsta de{' '}
              <strong className="text-foreground">16 ani</strong>. Prin crearea unui cont, confirmi
              că îndeplinești această condiție. Dacă ești minor sub 16 ani, poți utiliza Platforma
              doar cu acordul unui părinte sau tutore legal.
            </p>

            <h3 className="font-semibold text-foreground mb-2">3.2. Înregistrare și cont</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Înregistrarea se realizează exclusiv prin <strong className="text-foreground">Google OAuth</strong>.
              Ești responsabil pentru securitatea contului tău. Nu poți transfera contul unei alte
              persoane. Operatorul poate suspenda sau șterge conturile care încalcă acești Termeni.
            </p>

            <h3 className="font-semibold text-foreground mb-2">3.3. Utilizare acceptabilă</h3>
            <p className="text-muted-foreground leading-relaxed mb-2">
              Ești de acord să utilizezi Platforma numai în scopuri legale și conforme cu acești
              Termeni. Este interzis:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Utilizarea automatizată (scraping, bot-uri) fără acordul prealabil scris al Operatorului</li>
              <li>Publicarea de conținut spam, înșelător sau publicitate nesolicitată</li>
              <li>Tentativele de a compromite securitatea Platformei</li>
              <li>Utilizarea Platformei pentru activități ilegale</li>
              <li>Uzurparea identității altei persoane sau entități</li>
            </ul>
          </section>

          <div className="border-t border-border" />

          {/* Conținut interzis */}
          <section>
            <h2 className="text-xl font-bold mb-3">4. Conținut Interzis</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              Utilizatorii nu pot publica pe Platformă conținut care:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>Este ofensator, discriminatoriu, pornografic sau violent</li>
              <li>Promovează consumul de substanțe ilegale sau activități periculoase</li>
              <li>Conține rețete cu ingrediente periculoase sau cu efecte nocive cunoscute asupra sănătății</li>
              <li>Încalcă drepturile de proprietate intelectuală ale terților</li>
              <li>Reprezintă spam sau conținut publicitar neautorizat</li>
              <li>Conține informații false sau înșelătoare cu privire la valoarea nutrițională sau efectele alimentelor</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Operatorul își rezervă dreptul de a elimina orice conținut care încalcă aceste prevederi,
              fără notificare prealabilă.
            </p>
          </section>

          <div className="border-t border-border" />

          {/* Drepturi de autor */}
          <section>
            <h2 className="text-xl font-bold mb-3">5. Drepturi de Autor și Proprietate Intelectuală</h2>

            <h3 className="font-semibold text-foreground mb-2">5.1. Conținutul Platformei</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Funcționalitățile, designul și codul Platformei sunt proprietatea exclusivă a
              Operatorului MareChef.ro. Rețetele tradiționale nu sunt protejate prin drept de
              autor în forma lor esențială; cu toate acestea, compilarea, traducerea, adaptarea și
              prezentarea lor pe MareChef.ro sunt protejate.
            </p>

            <h3 className="font-semibold text-foreground mb-2">5.2. Fotografii</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Fotografiile utilizate pe Platformă provin din surse cu licențe libere (Pexels, Unsplash)
              sau sunt furnizate de utilizatori. Drepturile de autor asupra fotografiilor aparțin
              autorilor lor respectivi. MareChef.ro le utilizează conform licențelor aplicabile.
            </p>

            <h3 className="font-semibold text-foreground mb-2">5.3. Conținut publicat de utilizatori</h3>
            <p className="text-muted-foreground leading-relaxed">
              Conținutul (rețete, fotografii, comentarii) publicat de utilizatori rămâne proprietatea
              acestora. Prin publicarea pe Platformă, utilizatorul acordă MareChef.ro o{' '}
              <strong className="text-foreground">licență neexclusivă, fără redevență, pentru afișarea
              și distribuirea</strong> respectivului conținut în cadrul serviciului. Această licență
              se revocă la ștergerea contului sau a conținutului respectiv.
            </p>
          </section>

          <div className="border-t border-border" />

          {/* Limitarea răspunderii */}
          <section>
            <h2 className="text-xl font-bold mb-3">6. Limitarea Răspunderii</h2>

            <h3 className="font-semibold text-foreground mb-2">6.1. Informații nutriționale</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Informațiile nutriționale, calorice sau de altă natură medicală prezente pe Platformă
              sunt <strong className="text-foreground">orientative</strong> și nu înlocuiesc sfatul
              unui medic, nutriționist sau alt specialist în sănătate. MareChef.ro nu este o
              platformă medicală și nu oferă consultanță medicală.
            </p>

            <h3 className="font-semibold text-foreground mb-2">6.2. Alergii și condiții medicale</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Utilizatorul este singurul responsabil pentru verificarea ingredientelor în raport cu
              alergiile sale alimentare, intoleranțele sau orice condiție medicală. MareChef.ro nu
              garantează că informațiile despre alergeni sunt complete sau actualizate.
            </p>

            <h3 className="font-semibold text-foreground mb-2">6.3. Disponibilitatea serviciului</h3>
            <p className="text-muted-foreground leading-relaxed">
              Operatorul depune eforturi rezonabile pentru menținerea Platformei online, dar nu
              garantează disponibilitatea neîntreruptă a serviciului. Nu suntem răspunzători pentru
              pierderi directe sau indirecte cauzate de indisponibilitatea temporară a Platformei.
            </p>
          </section>

          <div className="border-t border-border" />

          {/* Confidențialitate */}
          <section>
            <h2 className="text-xl font-bold mb-3">7. Confidențialitate și Date Personale</h2>
            <p className="text-muted-foreground leading-relaxed">
              Prelucrarea datelor personale este guvernată de{' '}
              <Link href="/privacy" className="text-primary underline underline-offset-2 hover:text-primary/80">
                Politica de Confidențialitate
              </Link>{' '}
              a MareChef.ro, care face parte integrantă din acești Termeni. Prin utilizarea
              Platformei, ești de acord cu prelucrarea datelor tale conform politicii menționate,
              în conformitate cu Regulamentul General privind Protecția Datelor (GDPR —
              Regulamentul UE 2016/679).
            </p>
          </section>

          <div className="border-t border-border" />

          {/* Legea aplicabilă */}
          <section>
            <h2 className="text-xl font-bold mb-3">8. Legea Aplicabilă și Litigii</h2>
            <p className="text-muted-foreground leading-relaxed">
              Acești Termeni sunt guvernați de legea română. Orice litigiu izvorât din sau în
              legătură cu utilizarea Platformei va fi supus jurisdicției exclusive a instanțelor
              judecătorești competente din România. Anterior oricărei acțiuni judiciare, părțile
              se angajează să încerce soluționarea amiabilă a disputei.
            </p>
          </section>

          <div className="border-t border-border" />

          {/* Modificări */}
          <section>
            <h2 className="text-xl font-bold mb-3">9. Modificarea Termenilor</h2>
            <p className="text-muted-foreground leading-relaxed">
              Ne rezervăm dreptul de a modifica acești Termeni în orice moment, fără notificare
              prealabilă individuală. Versiunea actualizată va fi publicată pe această pagină cu
              data revizuirii. Continuarea utilizării Platformei după publicarea modificărilor
              constituie acceptarea noilor Termeni.
            </p>
          </section>

          <div className="border-t border-border" />

          {/* Contact */}
          <section>
            <h2 className="text-xl font-bold mb-3">10. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              Pentru orice întrebări legate de acești Termeni, ne poți contacta:
            </p>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li>
                <strong className="text-foreground">Email:</strong>{' '}
                <a href="mailto:contact@marechef.ro" className="text-primary underline underline-offset-2 hover:text-primary/80">
                  contact@marechef.ro
                </a>
              </li>
              <li>
                <strong className="text-foreground">Mesagerie internă:</strong>{' '}
                <Link href="/me/messages" className="text-primary underline underline-offset-2 hover:text-primary/80">
                  /me/messages
                </Link>
              </li>
              <li>
                <strong className="text-foreground">Pagina de contact:</strong>{' '}
                <Link href="/contact" className="text-primary underline underline-offset-2 hover:text-primary/80">
                  marechef.ro/contact
                </Link>
              </li>
            </ul>
          </section>

        </div>

        {/* Footer note */}
        <div className="mt-12 pt-6 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Ultima actualizare: Martie 2026 &mdash; Versiunea 1.0
            {' '}|{' '}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              Politica de Confidențialitate
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
