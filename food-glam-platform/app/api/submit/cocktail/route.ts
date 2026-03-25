import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase-server'
import { getRequestUser } from '@/lib/get-user'
import { rateLimit } from '@/lib/rate-limit'
import { slugify } from '@/lib/slug'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Auth first
    const authClient = createServerSupabaseClient()
    const supabase = createServiceSupabaseClient()
    const user = await getRequestUser(req, authClient)
    if (!user) return NextResponse.json({ error: 'Trebuie să fii autentificat' }, { status: 401 })
    const createdBy = user.id

    // Rate limit: 5 submissions per hour (admins bypass)
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    const { success } = rateLimit(`submit:cocktail:${ip}`, 5, 60 * 60 * 1000, user.email)
    if (!success) {
      return NextResponse.json(
        { error: 'Prea multe cereri. Încearcă mai târziu.' },
        { status: 429 }
      )
    }

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
      glassware,
      garnish,
    } = body

    // Basic validation
    if (!title?.trim()) return NextResponse.json({ error: 'Titlul e obligatoriu' }, { status: 400 })
    if (!summary?.trim()) return NextResponse.json({ error: 'Descrierea e obligatorie' }, { status: 400 })
    if (!hero_image_url?.trim()) return NextResponse.json({ error: 'Imaginea e obligatorie' }, { status: 400 })
    if (!category) return NextResponse.json({ error: 'Categoria e obligatorie' }, { status: 400 })

    const slug = slugify(title)

    // Build recipe_json with cocktail-specific fields
    const recipeJson = {
      category: category as 'alcoholic' | 'non-alcoholic',
      spirit: spirit || 'none',
      spiritLabel: spiritLabel || 'Mocktail',
      abv: category === 'non-alcoholic' ? 0 : (Number(abv) || null),
      difficulty: (difficulty as 'easy' | 'medium' | 'hard') || 'easy',
      serves: Number(serves) || 1,
      ingredients: Array.isArray(ingredients) ? ingredients : [],
      steps: Array.isArray(steps) ? steps : [],
      glassware: glassware || null,
      garnish: garnish || null,
    }

    // Insert into posts table
    const { data, error } = await supabase
      .from('posts')
      .insert({
        type: 'cocktail',
        status: 'active',
        slug,
        title: title.trim(),
        summary: summary.trim(),
        hero_image_url: hero_image_url.trim(),
        recipe_json: recipeJson,
        food_tags: Array.isArray(tags) ? tags : [],
        quality_score: 0,
        is_tested: false,
        created_by: createdBy,
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json(
        { error: 'Failed to submit cocktail' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      id: data.id,
      slug: data.slug,
      message: 'Cocktail submitted successfully',
      cocktail: {
        id: data.id,
        slug: data.slug,
        title: data.title,
        summary: data.summary,
        hero_image_url: data.hero_image_url,
        category: recipeJson.category,
        spirit: recipeJson.spirit,
        spiritLabel: recipeJson.spiritLabel,
        abv: recipeJson.abv,
        difficulty: recipeJson.difficulty,
        serves: recipeJson.serves,
        tags: data.food_tags || [],
        votes: 0,
        quality_score: data.quality_score,
        is_tested: data.is_tested,
        created_by: {
          id: createdBy,
          display_name: createdBy === 'anonymous' ? 'Anonymous' : createdBy,
          handle: '@user',
          avatar_url: null,
        },
        ingredients: recipeJson.ingredients,
        steps: recipeJson.steps,
        glassware: recipeJson.glassware,
        garnish: recipeJson.garnish,
      },
    })
  } catch (err) {
    console.error('Cocktail submit error:', err)
    return NextResponse.json({ error: 'Submission failed' }, { status: 500 })
  }
}
