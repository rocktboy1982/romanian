// /middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Country prefixes that were stripped from recipe slugs (SEO cleanup March 2026)
const COUNTRY_PREFIX_RE = /^\/recipes\/(afghanistan|albania|algeria|argentina|armenia|australia|austria|azerbaijan|bahrain|bangladesh|barbados|belarus|belgium|benin|bhutan|bolivia|bosnia|botswana|brazil|brunei|bulgaria|burkina|burundi|cambodia|cameroon|canada|chile|china|colombia|congo|costa|croatia|cuba|cyprus|czech|denmark|djibouti|dominican|east|ecuador|egypt|el|eritrea|estonia|ethiopia|fiji|finland|france|gambia|georgia|germany|ghana|greece|guatemala|guinea|guyana|haiti|hawaii|honduras|hong|hungary|iceland|india|indonesia|iran|iraq|ireland|israel|italy|ivory)-(.+)$/

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 301 redirect old country-prefixed recipe slugs to clean slugs
  const prefixMatch = pathname.match(COUNTRY_PREFIX_RE)
  if (prefixMatch) {
    const cleanSlug = prefixMatch[2]
    const url = request.nextUrl.clone()
    url.pathname = `/recipes/${cleanSlug}`
    return NextResponse.redirect(url, 301)
  }

  // Create a response that we can modify (to set refreshed cookies)
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: DO NOT remove this getUser() call.
  // It refreshes the auth token and sets updated cookies.
  const { data: { user } } = await supabase.auth.getUser()

  // Protect /me/* routes — redirect to signin if not authenticated
  if (pathname.startsWith('/me') && !user) {
    const signinUrl = request.nextUrl.clone()
    signinUrl.pathname = '/auth/signin'
    return NextResponse.redirect(signinUrl)
  }

  // Protect /api/admin/* routes
  if (pathname.startsWith('/api/admin') && !user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)',
  ],
}
