import { MetadataRoute } from 'next'
import { createServiceSupabaseClient } from '@/lib/supabase-server'
import { MOCK_RECIPES } from '@/lib/mock-data'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://marechef.ro'
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/search`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/cookbooks`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/cocktails`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ]

  // Fetch all recipe slugs from Supabase
  let recipeUrls: MetadataRoute.Sitemap = []
  try {
    const supabase = createServiceSupabaseClient()
    const { data: recipes, error } = await supabase
      .from('posts')
      .select('slug, updated_at')
      .eq('type', 'recipe')
      .order('updated_at', { ascending: false })

    if (!error && recipes && recipes.length > 0) {
      recipeUrls = recipes.map((recipe: any) => ({
        url: `${baseUrl}/recipes/${recipe.slug}`,
        lastModified: recipe.updated_at ? new Date(recipe.updated_at) : new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.8,
      }))
    }
  } catch (err) {
    // Fallback to mock data if Supabase fails
    console.warn('Failed to fetch recipes from Supabase, using mock data for sitemap')
    recipeUrls = MOCK_RECIPES.map((recipe) => ({
      url: `${baseUrl}/recipes/${recipe.slug}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    }))
  }

  return [...staticPages, ...recipeUrls]
}
