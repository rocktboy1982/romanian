'use client'

import { useEffect, useState } from 'react'
import FallbackImage from '@/components/FallbackImage'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase-client'

interface Profile {
  id: string
  email: string
  display_name: string
  handle: string
  bio: string | null
  avatar_url: string | null
  banner_url: string | null
}

export default function EditProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const [displayName, setDisplayName] = useState('')
  const [handle, setHandle] = useState('')
  const [bio, setBio] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [gdriveInput, setGdriveInput] = useState('')

  useEffect(() => {
    let mounted = true

    const initAuth = async () => {
      try {
        // Check if user is authenticated
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          if (mounted) setHydrated(true)
          return
        }

        // Fetch profile from API
        const res = await fetch('/api/profiles/me')
        if (!res.ok) {
          console.error('Failed to fetch profile')
          if (mounted) setHydrated(true)
          return
        }

        const data = await res.json()
        if (mounted && data.profile) {
          setProfile(data.profile)
          setDisplayName(data.profile.display_name)
          setHandle(data.profile.handle)
          setBio(data.profile.bio || '')
          setAvatarUrl(data.profile.avatar_url)
        }
      } catch (err) {
        console.error('Error loading profile:', err)
      } finally {
        if (mounted) setHydrated(true)
      }
    }

    initAuth()

    return () => {
      mounted = false
    }
  }, [])

  if (!hydrated) return null

  if (!profile) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}
      >
        <p className="text-lg font-semibold">Autentificare necesară</p>
        <Link
          href="/auth/signin?redirect=/me/profile/edit"
          className="px-6 py-2 rounded-full text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)' }}
        >
          Conectează-te
        </Link>
      </div>
    )
  }

  function parseGoogleDriveUrl(url: string): string | null {
    // https://drive.google.com/file/d/FILE_ID/view?usp=sharing
    const fileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/)
    if (fileMatch) return `https://lh3.googleusercontent.com/d/${fileMatch[1]}`

    // https://drive.google.com/open?id=FILE_ID
    const openMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/)
    if (openMatch) return `https://lh3.googleusercontent.com/d/${openMatch[1]}`

    // Already a direct googleusercontent link
    if (url.includes('lh3.googleusercontent.com/d/')) return url.trim()

    return null
  }

  function handleGdriveLink(input: string) {
    setGdriveInput(input)
    setAvatarError(null)

    if (!input.trim()) {
      // Clear avatar if input emptied
      setAvatarUrl(profile?.avatar_url ?? null)
      return
    }

    const directUrl = parseGoogleDriveUrl(input.trim())
    if (directUrl) {
      setAvatarUrl(directUrl)
    } else {
      setAvatarError('Link invalid. Folosește un link Google Drive de partajare.')
      setAvatarUrl(profile?.avatar_url ?? null)
    }
  }

  async function handleSave() {
    if (!profile) return

    setErrors({})
    setLoading(true)

    try {
       const res = await fetch('/api/profiles/me', {
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           display_name: displayName.trim(),
           handle: handle.trim(),
           bio: bio.trim(),
           ...(avatarUrl !== profile.avatar_url ? { avatar_url: avatarUrl } : {}),
         }),
       })

      const data = await res.json()

      if (!res.ok) {
        if (data.errors) {
          setErrors(data.errors)
        } else {
          setErrors({ general: data.error || 'Eroare la salvare' })
        }
        setLoading(false)
        return
      }

      // Update local state
      if (data.profile) {
        setProfile(data.profile)
        setSaved(true)
        setTimeout(() => {
          router.push('/me')
        }, 1000)
      }
    } catch (err) {
      console.error('Save error:', err)
      setErrors({ general: 'Eroare la salvare' })
      setLoading(false)
    }
  }

  const inputStyle = (field: string) => ({
    width: '100%',
    padding: '10px 14px',
    borderRadius: 10,
    border: errors[field] ? '1.5px solid #ff4d6d' : '1.5px solid rgba(0,0,0,0.14)',
    background: 'hsl(var(--background))',
    color: 'hsl(var(--foreground))',
    fontSize: 14,
    outline: 'none',
  } as React.CSSProperties)

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'hsl(var(--background))',
        color: 'hsl(var(--foreground))',
        fontFamily: "'Inter',sans-serif",
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@400;500;600&display=swap');.ff{font-family:'Syne',sans-serif;}@keyframes spin{to{transform:rotate(360deg);}}`}</style>

      {/* Banner preview */}
      <div className="relative w-full" style={{ height: 160 }}>
        {profile.banner_url ? (
          <FallbackImage
            src={profile.banner_url}
            alt=""
            className="w-full h-full object-cover"
            fallbackEmoji="🍽️"
          />
        ) : (
          <div className="w-full h-full" style={{ background: 'linear-gradient(135deg,#ff4d6d22,#ff950022)' }} />
        )}
        <div className="absolute inset-0" style={{ background: 'rgba(245,245,245,0.55)' }} />
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 px-3 py-1.5 rounded-full text-sm font-semibold backdrop-blur"
          style={{ background: 'rgba(255,255,255,0.75)', color: '#111', border: '1px solid rgba(0,0,0,0.12)' }}
        >
          ← Înapoi
        </button>
      </div>

      {/* Avatar via Google Drive link */}
      <div className="px-5 max-w-xl mx-auto" style={{ marginTop: -40 }}>
        <div className="mb-5">
          {/* Avatar preview */}
          <div className="mb-3">
            {avatarUrl ? (
              <FallbackImage
                src={avatarUrl}
                alt=""
                className="w-20 h-20 rounded-full object-cover border-4"
                style={{ borderColor: '#dde3ee' }}
                fallbackEmoji="👨‍🍳"
              />
            ) : (
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold border-4"
                style={{
                  background: 'linear-gradient(135deg,#ff4d6d,#ff9500)',
                  color: '#fff',
                  borderColor: '#dde3ee',
                }}
              >
                {displayName.charAt(0).toUpperCase() || '?'}
              </div>
            )}
          </div>

          {/* Google Drive link input */}
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#555' }}>
            Fotografie de profil
          </label>
          <input
            type="url"
            value={gdriveInput}
            onChange={(e) => handleGdriveLink(e.target.value)}
            placeholder="Lipește link Google Drive (ex. https://drive.google.com/file/d/...)"
            style={inputStyle('avatar_url')}
          />
          <p className="text-xs mt-1.5" style={{ color: '#888' }}>
            Partajează o imagine din Google Drive → Copiază linkul → Lipește-l aici
          </p>
          {avatarError && (
            <p className="text-xs mt-1" style={{ color: '#ff4d6d' }}>
              {avatarError}
            </p>
          )}
        </div>

        <h1 className="ff text-2xl font-extrabold mb-1">Editează profilul</h1>
        <p className="text-sm mb-6" style={{ color: '#888' }}>
          @{profile.handle} · modificările apar pe pagina ta publică
        </p>

        <div className="space-y-5">
          {/* Display name */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#555' }}>
              Nume afișat <span style={{ color: '#ff4d6d' }}>*</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value)
                setErrors((p) => ({ ...p, display_name: '' }))
              }}
              maxLength={60}
              placeholder="ex. Chef Mario"
              style={inputStyle('display_name')}
            />
            <div className="flex justify-between mt-1">
              {errors.display_name ? (
                <p className="text-xs" style={{ color: '#ff4d6d' }}>
                  {errors.display_name}
                </p>
              ) : (
                <span />
              )}
              <p className="text-xs" style={{ color: '#aaa' }}>
                {displayName.length}/60
              </p>
            </div>
          </div>

          {/* Handle */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#555' }}>
              Nume de utilizator <span style={{ color: '#ff4d6d' }}>*</span>
            </label>
            <div className="flex items-center" style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: 14,
                  color: '#888',
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                @
              </span>
              <input
                type="text"
                value={handle}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^a-zA-Z0-9_]/g, '')
                  setHandle(val)
                  setErrors((p) => ({ ...p, handle: '' }))
                }}
                maxLength={30}
                placeholder="ex. chef_mario"
                style={{
                  ...inputStyle('handle'),
                  paddingLeft: 28,
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              {errors.handle ? (
                <p className="text-xs" style={{ color: '#ff4d6d' }}>
                  {errors.handle}
                </p>
              ) : (
                <span />
              )}
              <p className="text-xs" style={{ color: '#aaa' }}>
                {handle.length}/30
              </p>
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#555' }}>
              Biografie
            </label>
            <textarea
              value={bio}
              onChange={(e) => {
                setBio(e.target.value)
                setErrors((p) => ({ ...p, bio: '' }))
              }}
              rows={4}
              maxLength={280}
              placeholder="Spune lumii despre stilul tău culinar…"
              style={{ ...inputStyle('bio'), resize: 'vertical' }}
            />
            <div className="flex justify-between mt-1">
              {errors.bio ? (
                <p className="text-xs" style={{ color: '#ff4d6d' }}>
                  {errors.bio}
                </p>
              ) : (
                <span />
              )}
              <p className="text-xs" style={{ color: bio.length > 260 ? '#ff4d6d' : '#aaa' }}>
                {bio.length}/280
              </p>
            </div>
          </div>

          {/* General error */}
          {errors.general && (
            <div className="p-3 rounded-lg" style={{ background: '#ff4d6d22', color: '#ff4d6d' }}>
              <p className="text-sm">{errors.general}</p>
            </div>
          )}

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={loading || saved}
            className="w-full py-3 rounded-full font-bold text-sm text-white transition-all disabled:opacity-50"
            style={{
              background: saved ? '#22c55e' : 'linear-gradient(135deg,#ff4d6d,#ff9500)',
              opacity: saved ? 0.9 : 1,
            }}
          >
            {saved ? '✓ Salvat! Redirecționare…' : loading ? 'Se salvează…' : 'Salvează modificările'}
          </button>
        </div>
      </div>
    </div>
  )
}
