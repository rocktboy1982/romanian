import { MetadataRoute } from 'next'
import { createServiceSupabaseClient } from '@/lib/supabase-server'
import { MOCK_RECIPES } from '@/lib/mock-data'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://marechef.ro'
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl,                           lastModified: new Date(), changeFrequency: 'daily',   priority: 1.0 },
    { url: `${baseUrl}/search`,               lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${baseUrl}/cookbooks`,            lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${baseUrl}/cocktailbooks`,        lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${baseUrl}/rankings`,             lastModified: new Date(), changeFrequency: 'daily',   priority: 0.8 },
    { url: `${baseUrl}/chefs`,                lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.75 },
    { url: `${baseUrl}/plan`,                        lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/party`,                       lastModified: new Date(), changeFrequency: 'monthly', priority: 0.65 },
    // Pillar pages — niche SEO landing pages
    { url: `${baseUrl}/retete/rapide`,               lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${baseUrl}/retete/traditionale`,         lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.9 },
  ]

  // Fetch all recipe + cocktail slugs from Supabase
  let recipeUrls: MetadataRoute.Sitemap = []
  let cocktailUrls: MetadataRoute.Sitemap = []

  try {
    const supabase = createServiceSupabaseClient()

    const [{ data: recipes }, { data: cocktails }] = await Promise.all([
      supabase
        .from('posts')
        .select('slug, updated_at')
        .eq('type', 'recipe')
        .order('updated_at', { ascending: false }),
      supabase
        .from('posts')
        .select('slug, updated_at')
        .eq('type', 'cocktail')
        .order('updated_at', { ascending: false }),
    ])

    if (recipes && recipes.length > 0) {
      recipeUrls = recipes.map((r: { slug: string; updated_at: string | null }) => ({
        url: `${baseUrl}/recipes/${r.slug}`,
        lastModified: r.updated_at ? new Date(r.updated_at) : new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.8,
      }))
    }

    if (cocktails && cocktails.length > 0) {
      cocktailUrls = cocktails.map((c: { slug: string; updated_at: string | null }) => ({
        url: `${baseUrl}/cocktails/${c.slug}`,
        lastModified: c.updated_at ? new Date(c.updated_at) : new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.75,
      }))
    }
  } catch (err) {
    console.warn('Failed to fetch posts from Supabase for sitemap, using mock data')
    recipeUrls = MOCK_RECIPES.map((recipe) => ({
      url: `${baseUrl}/recipes/${recipe.slug}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    }))
  }

  return [...staticPages, ...recipeUrls, ...cocktailUrls]
}
