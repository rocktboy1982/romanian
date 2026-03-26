'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase-client'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Shield,
  Download,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  User,
  BookOpen,
  ShoppingCart,
  Calendar,
  Archive,
  MessageSquare,
  Heart,
  Activity,
} from 'lucide-react'

/* ─── auth helper ─────────────────────────────────────────────────────────── */

async function getAuthHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  try {
    const backup = localStorage.getItem('marechef-session')
    if (backup) {
      const parsed = JSON.parse(backup)
      if (parsed?.access_token) {
        h['Authorization'] = `Bearer ${parsed.access_token}`
        return h
      }
    }
  } catch { /* ignore */ }
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) h['Authorization'] = `Bearer ${session.access_token}`
  return h
}

async function getCurrentUser() {
  try {
    const backup = localStorage.getItem('marechef-session')
    if (backup) {
      const parsed = JSON.parse(backup)
      if (parsed?.user) return parsed.user as { id: string; email?: string }
    }
  } catch { /* ignore */ }
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user ?? null
}

/* ─── data inventory items ────────────────────────────────────────────────── */

const DATA_CATEGORIES = [
  {
    icon: User,
    label: 'Profil',
    description: 'Nume, handle, bio, avatar, data înregistrării',
  },
  {
    icon: BookOpen,
    label: 'Rețete și cocktailuri',
    description: 'Toate postările tale publice și în așteptare',
  },
  {
    icon: Heart,
    label: 'Colecții și favorite',
    description: 'Cookbook, watchlist, serii de rețete salvate',
  },
  {
    icon: Calendar,
    label: 'Planuri de masă',
    description: 'Planificatorul tău săptămânal de mese',
  },
  {
    icon: ShoppingCart,
    label: 'Liste de cumpărături',
    description: 'Toate listele și articolele din ele',
  },
  {
    icon: Archive,
    label: 'Cămară și bar',
    description: 'Inventarul tău de ingrediente și băuturi',
  },
  {
    icon: MessageSquare,
    label: 'Mesaje și discuții',
    description: 'Mesaje cu adminul, thread-uri, răspunsuri',
  },
  {
    icon: Activity,
    label: 'Date de sănătate',
    description: 'Profil de sănătate, jurnal de hidratare, mese, greutate, post',
  },
]

const REQUIRED_TEXT = 'ȘTERG CONTUL'

/* ─── main component ──────────────────────────────────────────────────────── */

export default function PrivacyClient() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // Export state
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportDone, setExportDone] = useState(false)

  // Deactivation state
  const [deactivating, setDeactivating] = useState(false)
  const [deactivateError, setDeactivateError] = useState<string | null>(null)
  const [deactivateDone, setDeactivateDone] = useState(false)
  const [scheduledDeletion, setScheduledDeletion] = useState<string | null>(null)
  const [confirmChecked, setConfirmChecked] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const canDeactivate =
    confirmChecked && confirmText === REQUIRED_TEXT && !deactivateDone

  const exportLinkRef = useRef<HTMLAnchorElement>(null)

  /* ─── load user ─────────────────────────────────────────────────── */

  useEffect(() => {
    let mounted = true
    getCurrentUser().then((u) => {
      if (mounted) {
        setUser(u)
        setAuthLoading(false)
      }
    })
    return () => { mounted = false }
  }, [])

  /* ─── export handler ────────────────────────────────────────────── */

  const handleExport = useCallback(async () => {
    setExporting(true)
    setExportError(null)
    setExportDone(false)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/privacy/export', { headers })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Eroare ${res.status}`)
      }
      const blob = await res.blob()
      const contentDisposition = res.headers.get('Content-Disposition') || ''
      const fileNameMatch = contentDisposition.match(/filename="([^"]+)"/)
      const fileName = fileNameMatch ? fileNameMatch[1] : 'marechef-export.json'
      const url = URL.createObjectURL(blob)
      const a = exportLinkRef.current
      if (a) {
        a.href = url
        a.download = fileName
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 5000)
      }
      setExportDone(true)
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : String(err))
    } finally {
      setExporting(false)
    }
  }, [])

  /* ─── deactivate handler ────────────────────────────────────────── */

  const handleDeactivate = useCallback(async () => {
    if (!canDeactivate) return
    setDeactivating(true)
    setDeactivateError(null)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/privacy/deactivate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ confirmation: confirmText }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Eroare ${res.status}`)
      setDeactivateDone(true)
      setScheduledDeletion(data.scheduled_deletion_at ?? null)
    } catch (err: unknown) {
      setDeactivateError(err instanceof Error ? err.message : String(err))
    } finally {
      setDeactivating(false)
    }
  }, [canDeactivate, confirmText])

  /* ─── states ────────────────────────────────────────────────────── */

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span>Se încarcă...</span>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-8 text-center">
        <Shield className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
        <p className="text-base font-medium mb-1">Autentificare necesară</p>
        <p className="text-sm text-muted-foreground mb-4">
          Trebuie să fii autentificat pentru a accesa setările de confidențialitate.
        </p>
        <Button
          onClick={() =>
            supabase.auth.signInWithOAuth({
              provider: 'google',
              options: { redirectTo: window.location.href },
            })
          }
        >
          Conectează-te cu Google
        </Button>
      </div>
    )
  }

  if (deactivateDone) {
    const deletionDate = scheduledDeletion
      ? new Date(scheduledDeletion).toLocaleDateString('ro-RO', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null

    return (
      <div className="rounded-xl border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30 p-8 text-center">
        <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-orange-500" />
        <p className="text-base font-semibold mb-2">Contul a fost dezactivat</p>
        <p className="text-sm text-muted-foreground mb-1">
          Datele tale sunt în siguranță deocamdată.
        </p>
        {deletionDate && (
          <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">
            Ștergere permanentă programată pentru: {deletionDate}
          </p>
        )}
        <p className="text-sm text-muted-foreground mt-3">
          Te poți răzgândi logându-te din nou înainte de această dată.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {/* Hidden download anchor */}
      {/* eslint-disable-next-line jsx-a11y/anchor-has-content */}
      <a ref={exportLinkRef} style={{ display: 'none' }} aria-hidden="true" />

      {/* ── Section A: Datele mele ─────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Datele mele</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Conform GDPR (Art. 15 și 20), ai dreptul să accesezi și să descarci toate datele
          pe care le stocăm despre tine.
        </p>

        {/* Data inventory */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {DATA_CATEGORIES.map(({ icon: Icon, label, description }) => (
            <div
              key={label}
              className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
            >
              <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium leading-none mb-0.5">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Export button */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <Button
            onClick={handleExport}
            disabled={exporting}
            className="gap-2"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exporting ? 'Se exportă...' : 'Exportă datele mele'}
          </Button>

          {exportDone && (
            <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              Fișierul a fost descărcat cu succes
            </span>
          )}
          {exportError && (
            <span className="text-sm text-destructive">{exportError}</span>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          Datele sunt exportate ca fișier JSON cu toate informațiile asociate contului tău.
        </p>
      </section>

      {/* Separator */}
      <hr className="border-border" />

      {/* ── Section B: Dezactivare cont ───────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h2 className="text-lg font-semibold text-destructive">Dezactivare cont</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Poți solicita dezactivarea contului tău. Această acțiune are consecințe importante.
        </p>

        {/* Warning box */}
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 dark:bg-destructive/10 p-5 mb-6 space-y-2">
          <p className="text-sm font-semibold text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Citește cu atenție înainte de a continua
          </p>
          <ul className="space-y-1.5 mt-2">
            {[
              'Contul va fi dezactivat imediat după confirmare.',
              'Ai la dispoziție 30 de zile să te răzgândești — te poți autentifica din nou pentru a reactiva contul.',
              'După 30 de zile, contul și TOATE datele tale vor fi șterse PERMANENT și IRECUPERABIL.',
              'Rețetele, cocktailurile, colecțiile, planurile de masă, listele de cumpărături, mesajele, datele de sănătate — TOTUL va fi șters.',
              'Această acțiune NU poate fi anulată după expirarea celor 30 de zile.',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Confirmation checkbox */}
        <div className="flex items-start gap-3 mb-4">
          <Checkbox
            id="confirm-checkbox"
            checked={confirmChecked}
            onCheckedChange={(v) => setConfirmChecked(!!v)}
            className="mt-0.5 border-destructive data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
          />
          <label
            htmlFor="confirm-checkbox"
            className="text-sm leading-snug cursor-pointer select-none"
          >
            Înțeleg că după 30 de zile{' '}
            <strong>toate datele vor fi șterse permanent și irecuperabil</strong>, și că
            această acțiune nu poate fi anulată.
          </label>
        </div>

        {/* Confirmation text input */}
        <div className="mb-4">
          <label
            htmlFor="confirm-input"
            className="block text-sm font-medium mb-1.5"
          >
            Pentru confirmare, tastează{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-destructive font-bold tracking-wide">
              {REQUIRED_TEXT}
            </code>{' '}
            mai jos:
          </label>
          <Input
            id="confirm-input"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={REQUIRED_TEXT}
            className={`max-w-xs font-mono tracking-wide ${
              confirmText && confirmText !== REQUIRED_TEXT
                ? 'border-destructive focus-visible:ring-destructive'
                : ''
            }`}
            autoComplete="off"
            spellCheck={false}
          />
          {confirmText && confirmText !== REQUIRED_TEXT && (
            <p className="text-xs text-destructive mt-1">
              Textul nu coincide. Copiază exact:{' '}
              <strong>{REQUIRED_TEXT}</strong>
            </p>
          )}
        </div>

        {/* Error feedback */}
        {deactivateError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 mb-4">
            <p className="text-sm text-destructive">{deactivateError}</p>
          </div>
        )}

        {/* Deactivate button */}
        <Button
          variant="destructive"
          disabled={!canDeactivate || deactivating}
          onClick={handleDeactivate}
          className="gap-2"
        >
          {deactivating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          {deactivating ? 'Se procesează...' : 'Dezactivează contul'}
        </Button>

        <p className="text-xs text-muted-foreground mt-3">
          Aceasta nu este o ștergere imediată. Contul va fi marcat pentru ștergere și vei
          avea 30 de zile să te răzgândești.
        </p>
      </section>
    </div>
  )
}
