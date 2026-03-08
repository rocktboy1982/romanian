import { NextResponse } from 'next/server'
import { MOCK_LATEST_CHEF_POSTS, MOCK_CHEF_PROFILES } from '@/lib/mock-chef-data'

/** GET /api/chefs/latest — returns the most recent chef blog posts with chef profile embedded */
export async function GET() {
  const posts = MOCK_LATEST_CHEF_POSTS.map(post => {
    const chef = MOCK_CHEF_PROFILES.find(p => p.handle === post.chef_handle)
    return { ...post, chef }
  })

  return NextResponse.json({ posts }, {
    headers: {
      'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
    },
  })
}
