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
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)
  const [bannerGdriveInput, setBannerGdriveInput] = useState('')
  const [bannerError, setBannerError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const initAuth = async () => {
      try {
        // Check if user is authenticated — prefer marechef-session
        let user = null
        try {
          const backup = localStorage.getItem('marechef-session')
          if (backup) {
            const parsed = JSON.parse(backup)
            if (parsed?.user) user = parsed.user
          }
        } catch {}
        if (!user) {
          const { data: { session } } = await supabase.auth.getSession()
          user = session?.user ?? null
        }

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
           setBannerUrl(data.profile.banner_url)
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

   function handleBannerGdriveLink(input: string) {
     setBannerGdriveInput(input)
     setBannerError(null)

     if (!input.trim()) {
       // Clear banner if input emptied
       setBannerUrl(profile?.banner_url ?? null)
       return
     }

     const directUrl = parseGoogleDriveUrl(input.trim())
     if (directUrl) {
       setBannerUrl(directUrl)
     } else {
       setBannerError('Link invalid. Folosește un link Google Drive de partajare.')
       setBannerUrl(profile?.banner_url ?? null)
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
            ...(bannerUrl !== profile.banner_url ? { banner_url: bannerUrl } : {}),
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
     border: errors[field] ? '1.5px solid #ff4d6d' : '1.5px solid hsl(var(--border))',
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
         {bannerUrl ? (
           <FallbackImage
             src={bannerUrl}
             alt=""
             className="w-full h-full object-cover"
             fallbackEmoji="🍽️"
           />
         ) : (
           <div className="w-full h-full" style={{ background: 'linear-gradient(135deg,#ff4d6d22,#ff950022)' }} />
         )}
         <div className="absolute inset-0" style={{ background: 'hsl(var(--background)/0.55)' }} />
         <button
           onClick={() => router.back()}
           className="absolute top-4 left-4 px-3 py-1.5 rounded-full text-sm font-semibold backdrop-blur"
           style={{ background: 'hsl(var(--background)/0.75)', color: 'hsl(var(--foreground))', border: '1px solid rgba(0,0,0,0.12)' }}
         >
           ← Înapoi
         </button>
       </div>

      {/* Avatar section */}
      <div className="px-5 max-w-xl mx-auto" style={{ marginTop: -40 }}>
        <div className="mb-5">
          {/* Avatar preview */}
          <div className="mb-3">
             {avatarUrl ? (
               <FallbackImage
                 src={avatarUrl}
                 alt=""
                 className="w-20 h-20 rounded-full object-cover border-4"
                 style={{ borderColor: 'hsl(var(--border))' }}
                 fallbackEmoji="👨‍🍳"
               />
             ) : (
               <div
                 className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold border-4"
                 style={{
                   background: 'linear-gradient(135deg,#ff4d6d,#ff9500)',
                   color: '#fff',
                   borderColor: 'hsl(var(--border))',
                 }}
               >
                {displayName.charAt(0).toUpperCase() || '?'}
              </div>
            )}
          </div>

           <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>
             Fotografie de profil
           </label>

          {/* Google avatar indicator */}
          {avatarUrl && avatarUrl.includes('googleusercontent.com') && !gdriveInput && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg mb-2 text-sm"
              style={{ background: 'rgba(66,133,244,0.08)', border: '1px solid rgba(66,133,244,0.2)', color: '#4285f4' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Poza ta de la Google
            </div>
          )}

          {/* Optional: override with Google Drive link */}
          <input
            type="url"
            value={gdriveInput}
            onChange={(e) => handleGdriveLink(e.target.value)}
            placeholder="Opțional: link Google Drive pentru altă poză"
            style={inputStyle('avatar_url')}
          />
           <p className="text-xs mt-1.5" style={{ color: 'hsl(var(--muted-foreground))' }}>
             Implicit se folosește poza de la Google. Poți schimba cu un link Google Drive.
           </p>
          {avatarError && (
            <p className="text-xs mt-1" style={{ color: '#ff4d6d' }}>
              {avatarError}
            </p>
           )}
         </div>

         {/* Banner section */}
         <div className="mb-5">
           <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>
             Banner
           </label>
           <input
             type="url"
             value={bannerGdriveInput}
             onChange={(e) => handleBannerGdriveLink(e.target.value)}
             placeholder="Opțional: link Google Drive pentru banner"
             style={inputStyle('banner_url')}
           />
           <p className="text-xs mt-1.5" style={{ color: 'hsl(var(--muted-foreground))' }}>
             Opțional: link Google Drive pentru banner
           </p>
           {bannerError && (
             <p className="text-xs mt-1" style={{ color: '#ff4d6d' }}>
               {bannerError}
             </p>
           )}
         </div>

         <h1 className="ff text-2xl font-extrabold mb-1">Editează profilul</h1>
         <p className="text-sm mb-6" style={{ color: 'hsl(var(--muted-foreground))' }}>
           @{profile.handle} · modificările apar pe pagina ta publică
         </p>

        <div className="space-y-5">
           {/* Display name */}
           <div>
             <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>
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
               <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground)/0.6)' }}>
                 {displayName.length}/60
               </p>
             </div>
          </div>

           {/* Handle */}
           <div>
             <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>
               Nume de utilizator <span style={{ color: '#ff4d6d' }}>*</span>
             </label>
            <div className="flex items-center" style={{ position: 'relative' }}>
               <span
                 style={{
                   position: 'absolute',
                   left: 14,
                   color: 'hsl(var(--muted-foreground))',
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
               <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground)/0.6)' }}>
                 {handle.length}/30
               </p>
             </div>
           </div>

           {/* Bio */}
           <div>
             <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>
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
               <p className="text-xs" style={{ color: bio.length > 260 ? '#ff4d6d' : 'hsl(var(--muted-foreground)/0.6)' }}>
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
