import Link from 'next/link'
import Image from 'next/image'
import FallbackImage from '@/components/FallbackImage'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export default async function CookbookDetailPage({ params }: { params: Promise<{ slug: string }> }) {
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
  const cuisine = cookbook.cuisines as unknown as { name: string; slug: string } | null
  const foodStyle = cookbook.food_styles as unknown as { name: string; slug: string } | null

  return (
    <main className="container mx-auto px-4 py-8">
      <nav className="text-sm text-muted-foreground mb-4">
        <Link href="/cookbooks" className="hover:text-primary">Cookbooks</Link>
        {cuisine && (
          <>
            <span className="mx-2">›</span>
            <Link href={`/cookbooks/cuisines/${cuisine.slug}`} className="hover:text-primary">
              {cuisine.name}
            </Link>
          </>
        )}
        {foodStyle && (
          <>
            <span className="mx-2">›</span>
            <Link href={`/cookbooks/styles/${foodStyle.slug}`} className="hover:text-primary">
              {foodStyle.name}
            </Link>
          </>
        )}
        <span className="mx-2">›</span>
        <span>{cookbook.title}</span>
      </nav>

      {cookbook.cover_image_url && (
        <FallbackImage
          src={cookbook.cover_image_url}
          alt={cookbook.title}
          className="w-full h-48 object-cover rounded-lg mb-6"
          fallbackEmoji="📖"
        />
      )}

      <h1 className="text-3xl font-bold mb-1">{cookbook.title}</h1>
      {cookbook.description && (
        <p className="text-muted-foreground mb-4">{cookbook.description}</p>
      )}

      {owner && (
        <div className="flex items-center gap-2 mb-8">
           <div className="w-8 h-8 rounded-full bg-muted overflow-hidden">
             {owner.avatar_url ? (
               <FallbackImage src={owner.avatar_url} alt={owner.display_name} className="w-full h-full object-cover" fallbackEmoji="👨‍🍳" />
             ) : (
              <div className="w-full h-full flex items-center justify-center text-xs font-bold">
                {owner.display_name[0]}
              </div>
            )}
          </div>
          <span className="text-sm text-muted-foreground">By {owner.display_name}</span>
        </div>
      )}

      <h2 className="text-xl font-semibold mb-4">Chapters</h2>
      {chapters && chapters.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {chapters.map((chapter) => (
            <div
              key={chapter.id}
              className="border rounded-lg p-4 bg-card hover:border-primary hover:shadow-sm transition-all cursor-pointer"
            >
              <h3 className="font-semibold text-sm mb-1">{chapter.name}</h3>
              {chapter.description && (
                <p className="text-xs text-muted-foreground">{chapter.description}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No chapters yet.</p>
      )}
    </main>
  )
}
