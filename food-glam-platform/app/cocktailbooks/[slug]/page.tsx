import Link from 'next/link'
import Image from 'next/image'
import FallbackImage from '@/components/FallbackImage'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export default async function CocktailBookDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createServerSupabaseClient()

  const { data: cookbook } = await supabase
    .from('cookbooks')
    .select(`
      id, title, slug, description, cover_image_url, is_public, created_at,
      owner:profiles(id, display_name, handle, avatar_url),
      cuisines(id, name, slug),
      food_styles(id, name, slug)
    `)
    .eq('slug', slug)
    .single()

  if (!cookbook) notFound()

  const { data: chapters } = await supabase
    .from('chapters')
    .select('id, name, slug, description, position')
    .eq('cookbook_id', cookbook.id)
    .order('position')

  const owner = cookbook.owner as unknown as { display_name: string; handle: string; avatar_url: string | null } | null

  return (
    <main
      className="min-h-screen"
      style={{ background: 'hsl(var(--background))', color: 'hsl(var(--foreground))', fontFamily: "'Inter', sans-serif" }}
    >
      <div className="container mx-auto px-4 py-8">
        <nav className="text-sm mb-6" style={{ color: '#555' }}>
          <Link href="/cocktailbooks" className="hover:text-purple-400 transition-colors">Cocktail Books</Link>
          <span className="mx-2">›</span>
          <span style={{ color: '#ccc' }}>{cookbook.title}</span>
        </nav>

         {cookbook.cover_image_url && (
           <FallbackImage
             src={cookbook.cover_image_url}
             alt={cookbook.title}
             className="w-full h-48 object-cover rounded-xl mb-6"
             fallbackEmoji="📖"
           />
         )}

        <h1 className="text-3xl font-bold mb-1" style={{ color: '#111' }}>{cookbook.title}</h1>
        {cookbook.description && (
          <p className="mb-4" style={{ color: '#555' }}>{cookbook.description}</p>
        )}

        {owner && (
          <div className="flex items-center gap-2 mb-8">
             <div className="w-8 h-8 rounded-full overflow-hidden" style={{ background: '#c8cfe0' }}>
               {owner.avatar_url ? (
                 <FallbackImage src={owner.avatar_url} alt={owner.display_name} className="w-full h-full object-cover" fallbackEmoji="👨‍🍳" />
               ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-bold" style={{ color: '#8B1A2B' }}>
                    {owner.display_name[0]}
                  </div>
               )}
            </div>
            <span className="text-sm" style={{ color: '#555' }}>By {owner.display_name}</span>
          </div>
        )}

        <h2 className="text-xl font-semibold mb-4" style={{ color: '#111' }}>Chapters</h2>
        {chapters && chapters.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {chapters.map((chapter) => (
              <div
                key={chapter.id}
                className="rounded-xl p-4 border transition-all cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.5)', borderColor: 'rgba(0,0,0,0.1)' }}
              >
                <h3 className="font-semibold text-sm mb-1" style={{ color: '#111' }}>{chapter.name}</h3>
                {chapter.description && (
                  <p className="text-xs" style={{ color: '#555' }}>{chapter.description}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#555' }}>No chapters yet.</p>
        )}
      </div>
    </main>
  )
}
