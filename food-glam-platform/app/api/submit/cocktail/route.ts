import { NextRequest, NextResponse } from 'next/server'
import { MOCK_COCKTAILS } from '@/lib/mock-data'
import { rateLimit } from '@/lib/rate-limit'
import type { MockCocktail } from '@/lib/mock-data'

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80)
}

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 submissions per hour per IP
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    const { success } = rateLimit(`submit:cocktail:${ip}`, 5, 60 * 60 * 1000)
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await req.json()

    const {
      title,
      summary,
      hero_image_url,
      category,
      spirit,
      spiritLabel,
      abv,
      difficulty,
      serves,
      tags,
      ingredients,
      steps,
      created_by,
    } = body

    // Basic validation
    if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    if (!summary?.trim()) return NextResponse.json({ error: 'Summary is required' }, { status: 400 })
    if (!hero_image_url?.trim()) return NextResponse.json({ error: 'Hero image is required' }, { status: 400 })
    if (!category) return NextResponse.json({ error: 'Category is required' }, { status: 400 })

    const slug = slugify(title)

    const cocktail: MockCocktail = {
      id: `cocktail-user-${Date.now()}`,
      slug,
      title: title.trim(),
      summary: summary.trim(),
      hero_image_url: hero_image_url.trim(),
      category: category as 'alcoholic' | 'non-alcoholic',
      spirit: spirit || 'none',
      spiritLabel: spiritLabel || 'Mocktail',
      abv: category === 'non-alcoholic' ? 0 : (Number(abv) || null),
      difficulty: (difficulty as 'easy' | 'medium' | 'hard') || 'easy',
      serves: Number(serves) || 1,
      tags: Array.isArray(tags) ? tags : [],
      votes: 0,
      quality_score: 0,
      is_tested: false,
      created_by: created_by ?? {
        id: 'anonymous',
        display_name: 'Anonymous',
        handle: '@anonymous',
        avatar_url: null,
      },
    }

    // In-memory push (persists for this server process session)
    MOCK_COCKTAILS.push(cocktail)

    return NextResponse.json({
      id: cocktail.id,
      slug: cocktail.slug,
      message: 'Cocktail submitted successfully',
      // Pass back the full cocktail so the client can render a detail view
      cocktail: {
        ...cocktail,
        ingredients: ingredients ?? [],
        steps: steps ?? [],
      },
    })
  } catch (err) {
    console.error('Cocktail submit error:', err)
    return NextResponse.json({ error: 'Submission failed' }, { status: 500 })
  }
}
