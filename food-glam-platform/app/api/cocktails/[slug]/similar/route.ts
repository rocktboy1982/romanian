import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase-server'

interface CocktailRecipeJson {
  abv?: number
  category?: string
  difficulty?: string
  garnish?: string
  glassware?: string
  ingredients?: string[]
  serves?: number
  spirit?: string
  spiritLabel?: string
  steps?: string[]
}

interface SimilarCocktail {
  id: string
  slug: string
  title: string
  hero_image_url: string | null
  recipe_json: CocktailRecipeJson | null
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = createServiceSupabaseClient()

  // Get the cocktail's spirit first
  const { data: current } = await supabase
    .from('posts')
    .select('recipe_json')
    .eq('slug', slug)
    .eq('type', 'cocktail')
    .single()

  const spirit = (current?.recipe_json as Record<string, unknown>)?.spirit as string || 'none'

  // Fetch similar cocktails by same spirit
  const { data } = await supabase
    .from('posts')
    .select('id, slug, title, hero_image_url, recipe_json')
    .eq('type', 'cocktail')
    .eq('status', 'active')
    .neq('slug', slug)
    .eq('recipe_json->>spirit', spirit)
    .order('quality_score', { ascending: false })
    .limit(6)

  const results = (data || []) as SimilarCocktail[]

  return NextResponse.json({ results })
}
