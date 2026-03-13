import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { checkProfanity } from '@/lib/profanity-filter'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 })
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, email, display_name, handle, bio, avatar_url, banner_url, created_at')
      .eq('id', user.id)
      .single()

    if (error || !profile) {
      return NextResponse.json({ error: 'Profil nu a fost găsit' }, { status: 404 })
    }

    return NextResponse.json({ profile })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Profile GET error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 })
    }

    const body = await req.json()
    const { display_name, handle, bio, avatar_url } = body

    const errors: Record<string, string> = {}

    // Validate display_name
    if (display_name !== undefined) {
      const trimmed = display_name.trim()
      if (trimmed.length < 2 || trimmed.length > 60) {
        errors.display_name = 'Numele afișat trebuie să aibă între 2 și 60 de caractere.'
      } else {
        const profanityCheck = checkProfanity(trimmed)
        if (profanityCheck.isProfane) {
          errors.display_name = 'Numele conține limbaj nepotrivit. Vă rugăm alegeți altul.'
        }
      }
    }

    // Validate handle
    if (handle !== undefined) {
      const trimmed = handle.trim()
      if (trimmed.length < 3 || trimmed.length > 30) {
        errors.handle = 'Numele de utilizator trebuie să conțină 3-30 caractere (litere, cifre, underscore).'
      } else if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
        errors.handle = 'Numele de utilizator trebuie să conțină 3-30 caractere (litere, cifre, underscore).'
      } else {
        const profanityCheck = checkProfanity(trimmed)
        if (profanityCheck.isProfane) {
          errors.handle = 'Numele de utilizator conține limbaj nepotrivit. Vă rugăm alegeți altul.'
        } else {
          // Check uniqueness (exclude current user)
          const { data: existing } = await supabase
            .from('profiles')
            .select('id')
            .eq('handle', trimmed)
            .neq('id', user.id)
            .maybeSingle()

          if (existing) {
            errors.handle = 'Acest nume de utilizator este deja folosit.'
          }
        }
      }
    }

    // Validate bio
    if (bio !== undefined) {
      const trimmed = bio.trim()
      if (trimmed.length > 280) {
        errors.bio = 'Biografia trebuie să aibă maximum 280 de caractere.'
      } else if (trimmed.length > 0) {
        const profanityCheck = checkProfanity(trimmed)
        if (profanityCheck.isProfane) {
          errors.bio = 'Biografia conține limbaj nepotrivit. Vă rugăm reformulați.'
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ errors }, { status: 400 })
    }

     // Build update object with only provided fields
     const updateData: Record<string, string> = {}
     if (display_name !== undefined) updateData.display_name = display_name.trim()
     if (handle !== undefined) updateData.handle = handle.trim()
     if (bio !== undefined) updateData.bio = bio.trim()
     if (avatar_url !== undefined) updateData.avatar_url = avatar_url

    // Use service client to bypass RLS
    const serviceSupabase = createServiceSupabaseClient()
    const { data: updated, error: updateError } = await serviceSupabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)
      .select('id, email, display_name, handle, bio, avatar_url, banner_url, created_at')
      .single()

    if (updateError || !updated) {
      console.error('Update error:', updateError)
      return NextResponse.json({ error: 'Eroare la actualizare' }, { status: 500 })
    }

    return NextResponse.json({ profile: updated })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Profile PATCH error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
