import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase-server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing user sessions.
            }
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Get the authenticated user
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Check if profile already exists
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single()

        const serviceClient = createServiceSupabaseClient()

        // Upgrade Google avatar to higher resolution (s96-c → s400-c)
        const rawAvatar: string | null = user.user_metadata?.avatar_url || null
        const googleAvatar = rawAvatar
          ? rawAvatar.replace(/=s\d+-c$/, '=s400-c')
          : null

        if (!existingProfile) {
          // Generate a unique handle from email
          const baseHandle = user.email?.split('@')[0] || 'user'
          let handle = baseHandle
          let collision = true
          let attempts = 0

          while (collision && attempts < 5) {
            const { data: existingHandle } = await serviceClient
              .from('profiles')
              .select('id')
              .eq('handle', handle)
              .single()

            if (!existingHandle) {
              collision = false
            } else {
              const randomSuffix = Math.random().toString(36).substring(2, 6)
              handle = `${baseHandle}_${randomSuffix}`
              attempts++
            }
          }

          await serviceClient
            .from('profiles')
            .insert({
              id: user.id,
              email: user.email || '',
              display_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
              handle: handle,
              avatar_url: googleAvatar,
            })
        } else if (googleAvatar) {
          const { data: currentProfile } = await serviceClient
            .from('profiles')
            .select('avatar_url')
            .eq('id', user.id)
            .single()

          const currentAvatar = currentProfile?.avatar_url || ''
          const isGoogleAvatar = !currentAvatar || currentAvatar.includes('googleusercontent.com')

          if (isGoogleAvatar) {
            await serviceClient
              .from('profiles')
              .update({ avatar_url: googleAvatar })
              .eq('id', user.id)
          }
        }
      }

      const response = NextResponse.redirect(`${origin}/`)
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
      return response
    }
  }

  // Auth failed, redirect to sign in
  return NextResponse.redirect(`${origin}/auth/signin`)
}
