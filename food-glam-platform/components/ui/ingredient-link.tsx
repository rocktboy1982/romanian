'use client'

import React from 'react'
import { emagSearchUrl, ingredientSearchTerm } from '@/lib/affiliate'

interface IngredientLinkProps {
  /** Raw ingredient string, e.g. "500g pizza dough" or "fresh mozzarella, torn" */
  ingredient: string
  /** Visual style context — adapts link colour to background */
  variant?: 'default' | 'light' | 'pill-green' | 'pill-yellow'
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
}

const VARIANT_STYLES: Record<string, React.CSSProperties> = {
  default: { color: 'inherit', textDecorationColor: 'rgba(0,0,0,0.25)' },
  light: { color: '#111', textDecorationColor: 'rgba(0,0,0,0.2)' },
  'pill-green': { color: '#1b5e20', textDecorationColor: 'rgba(27,94,32,0.35)' },
  'pill-yellow': { color: '#5d4037', textDecorationColor: 'rgba(93,64,55,0.35)' },
}

/**
 * Wraps an ingredient string in an eMAG affiliate search link.
 * Strips quantity/unit prefix and preparation notes before building the search URL,
 * so "500g pizza dough, sifted" opens eMAG search for "pizza dough".
 *
 * Opens in a new tab so users don't lose their place.
 */
export default function IngredientLink({
  ingredient,
  variant = 'default',
  className,
  style,
  children,
}: IngredientLinkProps) {
  const searchTerm = ingredientSearchTerm(ingredient)
  const href = emagSearchUrl(searchTerm)

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer sponsored"
      title={`Cumpără „${searchTerm}" de pe eMAG`}
      onClick={(e) => e.stopPropagation()}
      className={className}
      style={{
        textDecoration: 'underline',
        textDecorationStyle: 'dotted',
        textUnderlineOffset: 2,
        cursor: 'pointer',
        ...VARIANT_STYLES[variant],
        ...style,
      }}
    >
      {children ?? ingredient}
    </a>
  )
}
