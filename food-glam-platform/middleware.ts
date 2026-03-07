// /middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

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
  matcher: ['/me/:path*', '/api/admin/:path*'],
}
