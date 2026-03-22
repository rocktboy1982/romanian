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

  // Recipe pages: no auth needed, just return (only matched for redirect above)
  if (pathname.startsWith('/recipes/')) {
    return NextResponse.next()
  }

  // Skip auth check for public routes and static assets
  if (
    pathname.startsWith('/api/recipes') ||
    pathname.startsWith('/api/search') ||
    pathname.startsWith('/api/tonight') ||
    pathname.startsWith('/api/trending') ||
    pathname.startsWith('/api/homepage') ||
    pathname.startsWith('/api/cuisines') ||
    pathname.startsWith('/api/cookbooks') ||
    pathname.startsWith('/api/chefs/latest') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  // For protected routes, check Supabase session
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          res.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          res.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Allow mock user in development
  const hasMockUser = process.env.NODE_ENV === 'development' &&
    request.headers.get('x-mock-user-id')

  // Protect /me/* routes — redirect to signin if not authenticated
  if (pathname.startsWith('/me') && !user && !hasMockUser) {
    const signinUrl = request.nextUrl.clone()
    signinUrl.pathname = '/auth/signin'
    return NextResponse.redirect(signinUrl)
  }

  // Protect /api/admin/* routes — return 401 if not authenticated
  if (pathname.startsWith('/api/admin') && !user && !hasMockUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  return res
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)',
  ],
}
