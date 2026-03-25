'use client'

import React, { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import FallbackImage from '@/components/FallbackImage'

interface RelatedRecipesProps {
  slug: string
  diet_tags?: string[]
  food_tags?: string[]
  meal_type?: string | null
  created_by?: string | null
}

interface RecipeHit {
  id: string
  slug: string
  title: string
  summary?: string
  hero_image_url?: string
}

/**
 * Related recipes section that fetches 6 recipes from /api/search/recipes
 * using matching tags, meal_type, and diet_tags.
 * Lazy-loads: only fetches when the component mounts.
 */
export default function RelatedRecipes({
  slug,
  diet_tags = [],
  food_tags = [],
  meal_type,
}: RelatedRecipesProps) {
  const [recipes, setRecipes] = useState<RecipeHit[]>([])
  const [loading, setLoading] = useState(true)
  const hasFetched = useRef(false)

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true

    let mounted = true

    async function fetchRelated() {
      setLoading(true)
      try {
        // Build query params for tag-based matching
        const params = new URLSearchParams()
        params.set('per_page', '7') // fetch 7 to allow filtering out current recipe
        params.set('sort', 'relevance')

        // Prefer food_tags for more specific matching
        if (food_tags.length > 0) {
          params.set('food_tags', food_tags.join(','))
        }
        if (diet_tags.length > 0) {
          params.set('diet_tags', diet_tags.join(','))
        }
        if (meal_type) {
          params.set('meal_type', meal_type)
        }

        const res = await fetch(`/api/search/recipes?${params.toString()}`)
        if (!res.ok) throw new Error('fetch failed')
        const json = await res.json()
        if (!mounted) return

        // Filter out the current recipe and take up to 6
        const hits: RecipeHit[] = (json.recipes || [])
          .filter((r: RecipeHit) => r.slug !== slug)
          .slice(0, 6)

        setRecipes(hits)
      } catch (err) {
        console.error('RelatedRecipes fetch error:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchRelated()
    return () => { mounted = false }
  }, [slug, diet_tags, food_tags, meal_type])

  // Loading skeleton
  if (loading) {
    return (
      <section className="mt-10 mb-8">
        <h2 className="text-xl font-bold mb-5 tracking-tight">
          Retete similare
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="animate-pulse rounded-xl overflow-hidden bg-muted/30">
              <div className="aspect-[4/3] bg-muted/50" />
              <div className="p-3 space-y-2">
                <div className="h-3.5 rounded-full w-3/4 bg-muted/40" />
                <div className="h-3 rounded-full w-1/2 bg-muted/30" />
              </div>
            </div>
          ))}
        </div>
      </section>
    )
  }

  // No results
  if (recipes.length === 0) return null

  return (
    <section className="mt-10 mb-8">
      <h2 className="text-xl font-bold mb-5 tracking-tight">
        Retete similare
      </h2>

      {/* 2x3 grid on desktop, horizontal scroll on mobile */}
      <div className="hidden sm:grid sm:grid-cols-3 gap-4">
        {recipes.map(recipe => (
          <RecipeCard key={recipe.id} recipe={recipe} />
        ))}
      </div>

      {/* Mobile: horizontal scroll */}
      <div className="flex sm:hidden gap-3 overflow-x-auto pb-3 snap-x snap-mandatory -mx-1 px-1">
        {recipes.map(recipe => (
          <div key={recipe.id} className="flex-shrink-0 w-[200px] snap-start">
            <RecipeCard recipe={recipe} />
          </div>
        ))}
      </div>
    </section>
  )
}

function RecipeCard({ recipe }: { recipe: RecipeHit }) {
  const href = `/recipes/${recipe.slug}`

  return (
    <Link
      href={href}
      className="group block rounded-xl overflow-hidden border border-border/50 bg-card/80 hover:bg-card transition-colors shadow-sm hover:shadow-md"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted/20">
        {recipe.hero_image_url ? (
          <FallbackImage
            src={recipe.hero_image_url}
            alt={recipe.title}
            fill
            sizes="(max-width: 640px) 200px, (max-width: 1024px) 33vw, 280px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            fallbackEmoji="🍽️"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl opacity-50">
            {'🍽️'}
          </div>
        )}
      </div>

      {/* Text */}
      <div className="p-3">
        <p className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {recipe.title}
        </p>
      </div>
    </Link>
  )
}
