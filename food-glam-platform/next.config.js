/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Disable Vercel Image Optimization to stay within free tier (5000 transformations/month)
    // Images served directly from source (Pexels, Unsplash, food blogs)
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  async headers() {
    // Build the Content-Security-Policy value.
    // unsafe-inline and unsafe-eval are required for Next.js (inline scripts/styles and HMR).
    const cspDirectives = [
      "default-src 'self'",
      // Scripts: self + inline/eval (Next.js) + Google services
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://pagead2.googlesyndication.com https://adservice.google.com https://googleads.g.doubleclick.net",
      // Styles: self + inline (Tailwind/Next.js) + Google Fonts
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Fonts
      "font-src 'self' https://fonts.gstatic.com",
      // Images: self + https + data URIs (inline previews)
      "img-src 'self' data: https:",
      // Connections: self + Supabase + Gemini API + Google Analytics + AdSense
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com https://www.google-analytics.com https://region1.google-analytics.com https://accounts.google.com https://pagead2.googlesyndication.com",
      // Frames: Google OAuth popup + AdSense
      "frame-src https://accounts.google.com https://googleads.g.doubleclick.net https://pagead2.googlesyndication.com",
      // Workers: self only
      "worker-src 'self' blob:",
      // Object/media: none
      "object-src 'none'",
      // Base URI: self only
      "base-uri 'self'",
      // Form actions: self + Supabase OAuth + Google OAuth
      "form-action 'self' https://*.supabase.co https://accounts.google.com",
    ]
    const csp = cspDirectives.join('; ')

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
