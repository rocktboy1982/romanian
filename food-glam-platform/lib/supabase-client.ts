import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/supabase'

export const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key',
  {
    cookieOptions: {
      // Keep session cookie for 2 weeks
      maxAge: 60 * 60 * 24 * 14, // 14 days
      sameSite: 'lax',
      secure: true,
    },
  }
)
