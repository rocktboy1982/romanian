import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Allow reputable search engines and social crawlers
      { userAgent: 'Googlebot',           allow: '/' },
      { userAgent: 'Bingbot',             allow: '/' },
      { userAgent: 'Yandex',              allow: '/' },
      { userAgent: 'DuckDuckBot',         allow: '/' },
      { userAgent: 'facebookexternalhit', allow: '/' },
      { userAgent: 'Twitterbot',          allow: '/' },
      { userAgent: 'LinkedInBot',         allow: '/' },

      // Block SEO/analytics scrapers
      { userAgent: 'AhrefsBot',    disallow: '/' },
      { userAgent: 'SemrushBot',   disallow: '/' },
      { userAgent: 'MJ12bot',      disallow: '/' },
      { userAgent: 'DotBot',       disallow: '/' },
      { userAgent: 'BLEXBot',      disallow: '/' },
      { userAgent: 'PetalBot',     disallow: '/' },
      { userAgent: 'DataForSeoBot',disallow: '/' },

      // Block AI training crawlers
      { userAgent: 'GPTBot',       disallow: '/' },
      { userAgent: 'CCBot',        disallow: '/' },
      { userAgent: 'anthropic-ai', disallow: '/' },
      { userAgent: 'ClaudeBot',    disallow: '/' },

      // Default: allow public pages, block internal/private paths
      {
        userAgent: '*',
        disallow: ['/api/', '/me/', '/admin/', '/moderation/'],
      },
    ],
    sitemap: 'https://marechef.ro/sitemap.xml',
  }
}
