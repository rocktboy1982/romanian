import Link from 'next/link'
import { AdBanner } from '@/components/ads/ad-placements'
import { MOCK_RECIPES, MOCK_TRENDING } from '@/lib/mock-data'

export default function FeedPage() {
  return (
    <main className="min-h-screen" style={{ background: '#dde3ee', color: '#111' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">Your Feed</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              Discover Mode
            </span>
          </div>
          <p className="text-muted-foreground">
            Recipes from chefs you follow · Follow more chefs to personalise this feed
          </p>
        </div>
        <Link
          href="/search"
          className="text-sm font-medium px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
        >
          Find recipes →
        </Link>
      </div>

      {/* Trending Today */}
      {MOCK_TRENDING && MOCK_TRENDING.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>🔥</span> Trending Today
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {MOCK_TRENDING.map((item) => (
              <Link
                key={item.id}
                href={`/recipes/${item.slug}`}
                className="shrink-0 w-44 rounded-xl overflow-hidden border border-border bg-card hover:shadow-md transition-shadow group"
              >
                <div className="h-28 bg-stone-100 overflow-hidden">
                  {item.hero_image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.hero_image_url}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium line-clamp-2 leading-snug">{item.title}</p>
                  {item.votes !== undefined && (
                    <p className="text-xs text-muted-foreground mt-1">▲ {item.votes}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* AD PLACEMENT */}
      <div className="mb-10">
        <AdBanner placement="feed-infeed" />
      </div>

      {/* Main feed — recipe grid */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Latest Recipes</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {MOCK_RECIPES.map((recipe) => (
            <Link
              key={recipe.id}
              href={`/recipes/${recipe.slug}`}
              className="group rounded-xl overflow-hidden border border-border bg-card hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
            >
              {/* Hero image */}
              <div className="aspect-[4/3] bg-stone-100 overflow-hidden relative">
                {recipe.hero_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={recipe.hero_image_url}
                    alt={recipe.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                )}
                {recipe.tag && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500 text-white">
                    {recipe.tag}
                  </span>
                )}
              </div>

              {/* Card body */}
              <div className="p-4">
                <h3 className="font-semibold text-base line-clamp-1 mb-1">{recipe.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{recipe.summary}</p>

                {/* Author row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {recipe.created_by?.avatar_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={recipe.created_by.avatar_url}
                        alt={recipe.created_by.display_name}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    )}
                    <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                      {recipe.created_by?.display_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>▲ {recipe.votes}</span>
                    <span>💬 {recipe.comments}</span>
                  </div>
                </div>

                {/* Tags */}
                {recipe.dietTags && recipe.dietTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {recipe.dietTags.slice(0, 2).map((tag: string) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 text-[10px] rounded bg-stone-100 text-stone-600 font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                    {recipe.region && (
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-50 text-amber-700 font-medium">
                        {recipe.region}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <div className="mt-12 text-center">
        <p className="text-muted-foreground text-sm mb-3">
          Looking for something specific?
        </p>
        <Link
          href="/search"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 text-white font-medium text-sm hover:bg-amber-600 transition-colors"
        >
          Search all recipes →
        </Link>
      </div>
    </main>
  )
}
