import Link from 'next/link'
import Image from 'next/image'
import FallbackImage from '@/components/FallbackImage'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export default async function FoodStylePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createServerSupabaseClient()

  const { data: style } = await supabase
    .from('food_styles')
    .select('id, name, slug, description, cuisine_id, cuisines(id, name, slug)')
    .eq('slug', slug)
    .single()

  if (!style) notFound()

  const cuisine = style.cuisines as unknown as { id: string; name: string; slug: string } | null

  const { data: cookbooks } = await supabase
    .from('cookbooks')
    .select(`
      id, title, slug, description, cover_image_url, created_at,
      owner:profiles(id, display_name, handle, avatar_url)
    `)
    .eq('food_style_id', style.id)
    .eq('is_public', true)
    .order('created_at', { ascending: false })

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
        <span className="mx-2">›</span>
        <span>{style.name}</span>
      </nav>

      <h1 className="text-3xl font-bold mb-1">{style.name}</h1>
      {style.description && (
        <p className="text-muted-foreground mb-8">{style.description}</p>
      )}

      <h2 className="text-xl font-semibold mb-4">Cookbooks</h2>
      {cookbooks && cookbooks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {cookbooks.map((cb) => {
            const owner = cb.owner as unknown as { display_name: string; handle: string; avatar_url: string | null } | null
            return (
              <Link
                key={cb.id}
                href={`/cookbooks/${cb.slug}`}
                className="border rounded-lg overflow-hidden hover:border-primary hover:shadow-md transition-all bg-card"
               >
                 {cb.cover_image_url && (
                   <FallbackImage src={cb.cover_image_url} alt={cb.title} className="w-full h-32 object-cover" fallbackEmoji="📖" />
                 )}
                <div className="p-4">
                  <h3 className="font-semibold mb-1">{cb.title}</h3>
                  {cb.description && (
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{cb.description}</p>
                  )}
                  {owner && (
                    <p className="text-xs text-muted-foreground">By {owner.display_name}</p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <p className="text-muted-foreground">No public cookbooks for this food style yet.</p>
      )}
    </main>
  )
}
