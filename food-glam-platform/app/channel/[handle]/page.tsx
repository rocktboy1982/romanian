'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Users, Grid3X3, Play, Image as ImageIcon, BookOpen, Info, UserPlus, UserCheck, UserMinus, Loader2 } from 'lucide-react'
import RecipeCard from '@/components/RecipeCard'
import DeleteContentButton from '@/components/DeleteContentButton'
import { useToast } from '@/components/ui/use-toast'

// ─── Types ───────────────────────────────────────────────────────────

interface Profile {
  id: string
  handle: string
  display_name: string
  bio: string | null
  avatar_url: string | null
  banner_url: string | null
  created_at: string
  follower_count: number
  following_count: number
  post_count: number
  is_following: boolean
  is_own_profile: boolean
}

interface Post {
  id: string
  slug: string
  title: string
  summary: string | null
  hero_image_url: string
  region: string
  votes: number
  comments: number
  tag: string
  badges: string[] | undefined
  dietTags: string[]
  foodTags: string[]
  is_tested: boolean
  quality_score: number | null
  type: string
  created_at: string
  created_by: {
    id: string
    display_name: string
    handle: string
    avatar_url: string | null
  }
  is_saved: boolean
}

type TabKey = 'recipe' | 'short' | 'image' | 'collection' | 'about'

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'recipe', label: 'Recipes', icon: <Grid3X3 size={16} /> },
  { key: 'short', label: 'Shorts', icon: <Play size={16} /> },
  { key: 'image', label: 'Images', icon: <ImageIcon size={16} /> },
  { key: 'collection', label: 'Collections', icon: <BookOpen size={16} /> },
  { key: 'about', label: 'About', icon: <Info size={16} /> },
]

// ─── Component ───────────────────────────────────────────────────────

export default function ChannelPage() {
  const params = useParams<{ handle: string }>()
  const handle = params.handle
  const { toast } = useToast()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<TabKey>('recipe')
  const [posts, setPosts] = useState<Post[]>([])
  const [postsLoading, setPostsLoading] = useState(false)
  const [totalPosts, setTotalPosts] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const [followLoading, setFollowLoading] = useState(false)
  const [followHover, setFollowHover] = useState(false)

  // ─── Fetch Profile ──────────────────────────────────────────────

  useEffect(() => {
    if (!handle) return
    setLoading(true)
    setError(null)

    fetch(`/api/profiles/${encodeURIComponent(handle)}`)
      .then(res => {
        if (!res.ok) throw new Error(res.status === 404 ? 'Creator not found' : 'Failed to load profile')
        return res.json()
      })
      .then(data => {
        setProfile(data.profile)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [handle])

  // ─── Fetch Posts ────────────────────────────────────────────────

  const fetchPosts = useCallback((tab: TabKey, offset = 0) => {
    if (!handle || tab === 'about') return
    setPostsLoading(true)

    fetch(`/api/profiles/${encodeURIComponent(handle)}/posts?type=${tab}&limit=20&offset=${offset}`)
      .then(res => res.json())
      .then(data => {
        if (offset === 0) {
          setPosts(data.posts || [])
        } else {
          setPosts(prev => [...prev, ...(data.posts || [])])
        }
        setTotalPosts(data.total || 0)
        setHasMore(data.has_more || false)
        setPostsLoading(false)
      })
      .catch(() => {
        setPostsLoading(false)
      })
  }, [handle])

  useEffect(() => {
    if (profile) {
      setPosts([])
      fetchPosts(activeTab)
    }
  }, [activeTab, profile, fetchPosts])

  // ─── Follow / Unfollow ─────────────────────────────────────────

  const handleFollow = async () => {
    if (!profile) return
    setFollowLoading(true)

    try {
      const method = profile.is_following ? 'DELETE' : 'POST'
      const res = await fetch('/api/follows', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followed_id: profile.id }),
      })

      if (!res.ok) {
        if (res.status === 401) {
          toast({ title: 'Please login to follow creators' })
          setFollowLoading(false)
          return
        }
        throw new Error('Failed')
      }

      const data = await res.json()
      setProfile(prev => prev ? {
        ...prev,
        is_following: !prev.is_following,
        follower_count: data.follower_count ?? prev.follower_count,
      } : null)

      toast({
        title: profile.is_following
          ? `Unfollowed @${profile.handle}`
          : `Following @${profile.handle}`,
      })
    } catch {
      toast({ title: 'Something went wrong', variant: 'destructive' })
    }

    setFollowLoading(false)
  }

  // ─── Loading State ─────────────────────────────────────────────

  if (loading) {
    return (
      <main className="min-h-screen">
        {/* Banner skeleton */}
        <div className="h-48 md:h-64 bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse" />
        <div className="container mx-auto px-4 -mt-16">
          <div className="flex flex-col items-center">
            <div className="w-28 h-28 rounded-full bg-gray-300 border-4 border-white animate-pulse" />
            <div className="mt-4 h-6 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="mt-2 h-4 w-32 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </main>
    )
  }

  // ─── Error State ───────────────────────────────────────────────

  if (error || !profile) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🍳</div>
          <h1 className="text-2xl font-bold mb-2">Creator Not Found</h1>
          <p className="text-muted-foreground">
            {error || `No creator with handle @${handle} exists.`}
          </p>
        </div>
      </main>
    )
  }

  // ─── Render ────────────────────────────────────────────────────

  const initials = profile.display_name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const joinDate = new Date(profile.created_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <main className="min-h-screen pb-24">
      {/* ── Banner ────────────────────────────────────────── */}
      <div className="relative h-48 md:h-64 overflow-hidden">
        {profile.banner_url ? (
          <img
            src={profile.banner_url}
            alt={`${profile.display_name}'s banner`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-amber-400 via-orange-500 to-red-500" />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
      </div>

      {/* ── Profile Header ────────────────────────────────── */}
      <div className="container mx-auto px-4 -mt-16 relative z-10">
        <div className="flex flex-col items-center">
          {/* Avatar */}
          <div className="w-28 h-28 md:w-32 md:h-32 rounded-full border-4 border-white shadow-lg overflow-hidden bg-white">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.display_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-400 to-orange-500 text-white text-3xl font-bold">
                {initials}
              </div>
            )}
          </div>

          {/* Name & Handle */}
          <h1 className="mt-3 text-2xl md:text-3xl font-bold tracking-tight">
            {profile.display_name}
          </h1>
          <p className="text-muted-foreground text-sm">@{profile.handle}</p>

          {/* Bio */}
          {profile.bio && (
            <p className="mt-2 text-center max-w-lg text-sm text-muted-foreground leading-relaxed">
              {profile.bio}
            </p>
          )}

          {/* Stats Row */}
          <div className="flex items-center gap-6 mt-4 text-sm">
            <div className="text-center">
              <span className="font-bold text-foreground">{profile.post_count}</span>
              <span className="text-muted-foreground ml-1">posts</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="text-center">
              <span className="font-bold text-foreground">{profile.follower_count}</span>
              <span className="text-muted-foreground ml-1">followers</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="text-center">
              <span className="font-bold text-foreground">{profile.following_count}</span>
              <span className="text-muted-foreground ml-1">following</span>
            </div>
          </div>

          {/* Follow Button */}
          {!profile.is_own_profile && (
            <button
              onClick={handleFollow}
              onMouseEnter={() => setFollowHover(true)}
              onMouseLeave={() => setFollowHover(false)}
              disabled={followLoading}
              className={`
                mt-4 px-6 py-2 rounded-full text-sm font-medium
                transition-all duration-200 flex items-center gap-2
                ${profile.is_following
                  ? followHover
                    ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                    : 'bg-secondary text-secondary-foreground border border-border'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {followLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : profile.is_following ? (
                followHover ? (
                  <><UserMinus size={16} /> Unfollow</>
                ) : (
                  <><UserCheck size={16} /> Following</>
                )
              ) : (
                <><UserPlus size={16} /> Follow</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Tab Navigation ────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b mt-6">
        <div className="container mx-auto px-4">
          <div className="flex overflow-x-auto scrollbar-hide -mb-px">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium
                  border-b-2 transition-colors whitespace-nowrap
                  ${activeTab === tab.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }
                `}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

       {/* ── Tab Content ───────────────────────────────────── */}
       <div className="container mx-auto px-4 mt-6">
         {activeTab === 'about' ? (
           <AboutTab profile={profile} joinDate={joinDate} />
         ) : (
           <ContentGrid
             posts={posts}
             loading={postsLoading}
             total={totalPosts}
             hasMore={hasMore}
             activeTab={activeTab}
             onLoadMore={() => fetchPosts(activeTab, posts.length)}
             isOwnProfile={profile.is_own_profile}
             onPostDeleted={(postId) => setPosts(prev => prev.filter(p => p.id !== postId))}
           />
         )}
       </div>
    </main>
  )
}

// ─── About Tab ─────────────────────────────────────────────────────

function AboutTab({ profile, joinDate }: { profile: Profile; joinDate: string }) {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-card border rounded-lg p-6">
        <h3 className="font-semibold text-lg mb-3">About {profile.display_name}</h3>
        <p className="text-muted-foreground leading-relaxed">
          {profile.bio || 'This creator hasn\'t added a bio yet.'}
        </p>
      </div>

      <div className="bg-card border rounded-lg p-6">
        <h3 className="font-semibold text-lg mb-3">Stats</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Posts" value={profile.post_count} />
          <StatCard label="Followers" value={profile.follower_count} />
          <StatCard label="Following" value={profile.following_count} />
          <StatCard label="Joined" value={joinDate} />
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="text-center p-3 bg-muted/50 rounded-lg">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  )
}

// ─── Content Grid ──────────────────────────────────────────────────

function ContentGrid({
  posts,
  loading,
  total,
  hasMore,
  activeTab,
  onLoadMore,
  isOwnProfile = false,
  onPostDeleted,
}: {
  posts: Post[]
  loading: boolean
  total: number
  hasMore: boolean
  activeTab: TabKey
  onLoadMore: () => void
  isOwnProfile?: boolean
  onPostDeleted?: (postId: string) => void
}) {
  const tabLabel = TABS.find(t => t.key === activeTab)?.label ?? activeTab

  // Loading skeleton
  if (loading && posts.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-4 animate-pulse">
            <div className="w-full h-40 bg-gray-200 rounded-md mb-3" />
            <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  // Empty state
  if (!loading && posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <EmptyIcon tab={activeTab} />
        </div>
        <h3 className="font-semibold text-lg mb-1">No {tabLabel} Yet</h3>
        <p className="text-muted-foreground text-sm max-w-xs">
          This creator hasn&apos;t published any {tabLabel.toLowerCase()} yet. Check back later!
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Post count */}
      <p className="text-sm text-muted-foreground mb-4">
        {total} {tabLabel.toLowerCase()} total
      </p>

      {/* Grid of recipe cards (reuse RecipeCard) */}
       {activeTab === 'recipe' ? (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {posts.map(post => (
             <div key={post.id} className="relative group">
               <RecipeCard
                 id={post.id}
                 slug={post.slug}
                 title={post.title}
                 summary={post.summary}
                 hero_image_url={post.hero_image_url}
                 region={post.region}
                 votes={post.votes}
                 comments={post.comments}
                 tag={post.tag}
                 badges={post.badges}
                 dietTags={post.dietTags}
                 foodTags={post.foodTags}
                 is_tested={post.is_tested}
                 quality_score={post.quality_score}
                 created_by={post.created_by}
                 is_saved={post.is_saved}
               />
               {isOwnProfile && (
                 <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <DeleteContentButton
                     postId={post.id}
                     postTitle={post.title}
                     onDeleted={() => onPostDeleted?.(post.id)}
                     variant="icon"
                     size="sm"
                   />
                 </div>
               )}
             </div>
           ))}
         </div>
       ) : (
         /* Generic content grid for shorts/images/collections */
         <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
           {posts.map(post => (
             <div
               key={post.id}
               className="group relative border rounded-lg overflow-hidden bg-card shadow-sm hover:shadow-md transition-shadow cursor-pointer"
             >
               <div className="aspect-square overflow-hidden relative">
                 <img
                   src={post.hero_image_url}
                   alt={post.title}
                   className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                 />
                 {isOwnProfile && (
                   <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                     <DeleteContentButton
                       postId={post.id}
                       postTitle={post.title}
                       onDeleted={() => onPostDeleted?.(post.id)}
                       variant="icon"
                       size="sm"
                     />
                   </div>
                 )}
               </div>
               <div className="p-3">
                 <h4 className="font-medium text-sm line-clamp-2">{post.title}</h4>
                 <p className="text-xs text-muted-foreground mt-1">
                   {post.votes} votes
                 </p>
               </div>
             </div>
           ))}
         </div>
       )}

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center mt-8">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="px-6 py-2 bg-secondary text-secondary-foreground rounded-full text-sm font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Load More
          </button>
        </div>
      )}
    </>
  )
}

function EmptyIcon({ tab }: { tab: TabKey }) {
  switch (tab) {
    case 'recipe':
      return <Grid3X3 size={24} className="text-muted-foreground" />
    case 'short':
      return <Play size={24} className="text-muted-foreground" />
    case 'image':
      return <ImageIcon size={24} className="text-muted-foreground" />
    case 'collection':
      return <BookOpen size={24} className="text-muted-foreground" />
    default:
      return <Users size={24} className="text-muted-foreground" />
  }
}
