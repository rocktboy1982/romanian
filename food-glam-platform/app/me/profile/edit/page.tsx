'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import FallbackImage from '@/components/FallbackImage'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MOCK_CHEF_PROFILES } from '@/lib/mock-chef-data'

interface MockUser {
  id: string
  display_name: string
  handle: string
  avatar_url: string | null
}

interface ProfileOverride {
  display_name: string
  bio: string
  avatar_url: string
  banner_url: string
}

const STORAGE_KEY = (handle: string) => `chef_profile_override_${handle}`

export default function EditProfilePage() {
  const router = useRouter()
  const [mockUser, setMockUser] = useState<MockUser | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [saved, setSaved] = useState(false)

  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [bannerUrl, setBannerUrl] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    try {
      const raw = localStorage.getItem('mock_user')
      if (raw) {
        const user: MockUser = JSON.parse(raw)
        setMockUser(user)

        /* seed from override → then mock data → then user fields */
        const overrideRaw = localStorage.getItem(STORAGE_KEY(user.handle))
        const override: Partial<ProfileOverride> = overrideRaw ? JSON.parse(overrideRaw) : {}
        const mock = MOCK_CHEF_PROFILES.find(p => p.handle === user.handle)

        setDisplayName(override.display_name ?? mock?.display_name ?? user.display_name)
        setBio(override.bio ?? mock?.bio ?? '')
        setAvatarUrl(override.avatar_url ?? mock?.avatar_url ?? user.avatar_url ?? '')
        setBannerUrl(override.banner_url ?? mock?.banner_url ?? '')
      }
    } catch { /* ignore */ }
    setHydrated(true)
  }, [])

  if (!hydrated) return null

  if (!mockUser) {
    return (
       <div className="min-h-screen flex flex-col items-center justify-center gap-4"
         style={{ background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
        <p className="text-lg font-semibold">Sign in to edit your profile</p>
        <Link href="/auth/signin?redirect=/me/profile/edit"
          className="px-6 py-2 rounded-full text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)' }}>
          Sign In
        </Link>
      </div>
    )
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!displayName.trim()) errs.displayName = 'Display name is required.'
    if (displayName.trim().length > 60) errs.displayName = 'Max 60 characters.'
    if (bio.length > 280) errs.bio = 'Bio must be 280 characters or fewer.'
    if (avatarUrl && !/^https?:\/\/.+/.test(avatarUrl.trim())) errs.avatarUrl = 'Must be a valid URL (https://…).'
    if (bannerUrl && !/^https?:\/\/.+/.test(bannerUrl.trim())) errs.bannerUrl = 'Must be a valid URL (https://…).'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSave() {
    if (!validate()) return

    const override: ProfileOverride = {
      display_name: displayName.trim(),
      bio: bio.trim(),
      avatar_url: avatarUrl.trim(),
      banner_url: bannerUrl.trim(),
    }

    if (!mockUser) return
    localStorage.setItem(STORAGE_KEY(mockUser.handle), JSON.stringify(override))

    /* also update the mock_user display_name so nav reflects change */
    const updated: MockUser = { ...mockUser, display_name: override.display_name }
    localStorage.setItem('mock_user', JSON.stringify(updated))
    setMockUser(updated)

    setSaved(true)
    const handle = mockUser.handle
    setTimeout(() => {
      router.push(`/chefs/${handle}`)
    }, 900)
  }

  const inputStyle = (field: string) => ({
    width: '100%',
    padding: '10px 14px',
    borderRadius: 10,
    border: errors[field] ? '1.5px solid #ff4d6d' : '1.5px solid rgba(0,0,0,0.14)',
    background: '#fff',
    color: '#111',
    fontSize: 14,
    outline: 'none',
  } as React.CSSProperties)

  return (
    <div className="min-h-screen" style={{ background: 'hsl(var(--background))', color: 'hsl(var(--foreground))', fontFamily: "'Inter',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@400;500;600&display=swap');.ff{font-family:'Syne',sans-serif;}`}</style>

       {/* Banner preview */}
       <div className="relative w-full" style={{ height: 160 }}>
         {bannerUrl ? (
           <FallbackImage src={bannerUrl} alt="" className="w-full h-full object-cover" fallbackEmoji="🍽️" />
         ) : (
           <div className="w-full h-full" style={{ background: 'linear-gradient(135deg,#ff4d6d22,#ff950022)' }} />
         )}
         <div className="absolute inset-0" style={{ background: 'rgba(245,245,245,0.55)' }} />
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 px-3 py-1.5 rounded-full text-sm font-semibold backdrop-blur"
          style={{ background: 'rgba(255,255,255,0.75)', color: '#111', border: '1px solid rgba(0,0,0,0.12)' }}
        >
          ← Back
        </button>
      </div>

      {/* Avatar preview */}
      <div className="px-5 max-w-xl mx-auto" style={{ marginTop: -40 }}>
        <div className="mb-5">
           {avatarUrl ? (
             <FallbackImage src={avatarUrl} alt="" className="w-20 h-20 rounded-full object-cover border-4"
               style={{ borderColor: '#dde3ee' }} fallbackEmoji="👨‍🍳" />
           ) : (
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold border-4"
              style={{ background: 'linear-gradient(135deg,#ff4d6d,#ff9500)', color: '#fff', borderColor: '#dde3ee' }}>
              {displayName.charAt(0).toUpperCase() || '?'}
            </div>
          )}
        </div>

        <h1 className="ff text-2xl font-extrabold mb-1">Edit Profile</h1>
        <p className="text-sm mb-6" style={{ color: '#888' }}>@{mockUser.handle} · changes appear on your public page</p>

        <div className="space-y-5">

          {/* Display name */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#555' }}>
              Display Name <span style={{ color: '#ff4d6d' }}>*</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => { setDisplayName(e.target.value); setErrors(p => ({ ...p, displayName: '' })) }}
              maxLength={60}
              placeholder="e.g. Chef Mario"
              style={inputStyle('displayName')}
            />
            <div className="flex justify-between mt-1">
              {errors.displayName
                ? <p className="text-xs" style={{ color: '#ff4d6d' }}>{errors.displayName}</p>
                : <span />}
              <p className="text-xs" style={{ color: '#aaa' }}>{displayName.length}/60</p>
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#555' }}>
              Bio
            </label>
            <textarea
              value={bio}
              onChange={e => { setBio(e.target.value); setErrors(p => ({ ...p, bio: '' })) }}
              rows={4}
              maxLength={280}
              placeholder="Tell the world about your cooking style…"
              style={{ ...inputStyle('bio'), resize: 'vertical' }}
            />
            <div className="flex justify-between mt-1">
              {errors.bio
                ? <p className="text-xs" style={{ color: '#ff4d6d' }}>{errors.bio}</p>
                : <span />}
              <p className="text-xs" style={{ color: bio.length > 260 ? '#ff4d6d' : '#aaa' }}>{bio.length}/280</p>
            </div>
          </div>

          {/* Avatar URL */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#555' }}>
              Avatar Image URL
            </label>
            <input
              type="url"
              value={avatarUrl}
              onChange={e => { setAvatarUrl(e.target.value); setErrors(p => ({ ...p, avatarUrl: '' })) }}
              placeholder="https://images.unsplash.com/…"
              style={inputStyle('avatarUrl')}
            />
            {errors.avatarUrl && <p className="text-xs mt-1" style={{ color: '#ff4d6d' }}>{errors.avatarUrl}</p>}
            <p className="text-xs mt-1" style={{ color: '#aaa' }}>Paste any public image URL. Unsplash, Gravatar, etc.</p>
          </div>

          {/* Banner URL */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#555' }}>
              Banner Image URL
            </label>
            <input
              type="url"
              value={bannerUrl}
              onChange={e => { setBannerUrl(e.target.value); setErrors(p => ({ ...p, bannerUrl: '' })) }}
              placeholder="https://images.unsplash.com/…"
              style={inputStyle('bannerUrl')}
            />
            {errors.bannerUrl && <p className="text-xs mt-1" style={{ color: '#ff4d6d' }}>{errors.bannerUrl}</p>}
            <p className="text-xs mt-1" style={{ color: '#aaa' }}>Wide landscape photo works best (1200×300px).</p>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            className="w-full py-3 rounded-full font-bold text-sm text-white transition-all"
            style={{ background: saved ? '#22c55e' : 'linear-gradient(135deg,#ff4d6d,#ff9500)', opacity: saved ? 0.9 : 1 }}
          >
            {saved ? '✓ Saved! Redirecting…' : 'Save Changes'}
          </button>

          <p className="text-center text-xs pb-8" style={{ color: '#bbb' }}>
            Changes are stored locally until real auth is wired.
          </p>
        </div>
      </div>
    </div>
  )
}
