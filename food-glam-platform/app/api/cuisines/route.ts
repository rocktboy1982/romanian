import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const MOCK_CUISINES = [
  { id: 'c1', name: 'Italian', slug: 'italian', country_code: 'IT', description: 'Classic Italian cooking', featured_image_url: null },
  { id: 'c2', name: 'Thai', slug: 'thai', country_code: 'TH', description: 'Bold Thai flavors', featured_image_url: null },
  { id: 'c3', name: 'Indian', slug: 'indian', country_code: 'IN', description: 'Spiced Indian cuisine', featured_image_url: null },
  { id: 'c4', name: 'French', slug: 'french', country_code: 'FR', description: 'French culinary tradition', featured_image_url: null },
  { id: 'c5', name: 'Mexican', slug: 'mexican', country_code: 'MX', description: 'Vibrant Mexican food', featured_image_url: null },
  { id: 'c6', name: 'Japanese', slug: 'japanese', country_code: 'JP', description: 'Japanese cuisine', featured_image_url: null },
  { id: 'c7', name: 'Greek', slug: 'greek', country_code: 'GR', description: 'Mediterranean Greek cooking', featured_image_url: null },
  { id: 'c8', name: 'Korean', slug: 'korean', country_code: 'KR', description: 'Bold Korean flavors', featured_image_url: null },
  { id: 'c9', name: 'Spanish', slug: 'spanish', country_code: 'ES', description: 'Vibrant Spanish cuisine', featured_image_url: null },
  { id: 'c10', name: 'Moroccan', slug: 'moroccan', country_code: 'MA', description: 'Aromatic North African cooking', featured_image_url: null },
]

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: cuisines, error } = await supabase
      .from('cuisines')
      .select('id, name, slug, country_code, description, featured_image_url')
      .order('name')

    if (error || !cuisines || cuisines.length === 0) {
      return NextResponse.json({ data: MOCK_CUISINES, error: null }, {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        },
      })
    }

    return NextResponse.json({ data: cuisines, error: null }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    })
  } catch (err: unknown) {
    return NextResponse.json({ data: MOCK_CUISINES, error: null })
  }
}
