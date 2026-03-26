'use client'

import { useState } from 'react'
import Image from 'next/image'
import FallbackImage from '@/components/FallbackImage'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Heart, MessageSquare, Share2, Bookmark } from 'lucide-react'

interface RecipeCardProps {
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
  created_by: {
    id: string
    display_name: string
    handle: string
    avatar_url: string | null
  }
  is_saved: boolean
  cookbook?: {
    id: string
    title: string
    slug: string
  } | null
  chapter?: {
    id: string
    name: string
    slug: string
  } | null
  // Nutrition & timing (optional — not all call sites pass these yet)
  nutrition_per_serving?: { calories: number; protein: number; carbs: number; fat: number } | null
  cook_time_minutes?: number | null
  servings?: number | null
}

export default function RecipeCard({
  id,
  slug,
  title,
  summary,
  hero_image_url,
  region,
  votes,
  comments,
  tag,
  badges,
  dietTags,
  foodTags,
  is_tested,
  quality_score,
  created_by,
  is_saved: initialIsSaved,
  cookbook,
  chapter,
  nutrition_per_serving,
  cook_time_minutes,
}: RecipeCardProps) {

  const router = useRouter()
  const [isSaved, setIsSaved] = useState(initialIsSaved)
  const [voteCount, setVoteCount] = useState(votes)
  const [userVote, setUserVote] = useState<number | null>(null)

  const handleVote = async (value: 1 | -1) => {
    try {
      const res = await fetch(`/api/posts/${id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      })
      if (!res.ok) {
        if (res.status === 401) return
        throw new Error('Vote failed')
      }
      const data = await res.json()
      setVoteCount(data.netVotes)
      setUserVote(data.userVote)
    } catch (err) {
      console.error('Failed to vote:', err)
    }
  }

  const handleSave = async () => {
    try {
      const res = await fetch('/api/collection-items', {
        method: isSaved ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: id })
      })
      if (!res.ok) {
        if (res.status === 401) return
        throw new Error('Save failed')
      }
      setIsSaved(!isSaved)
    } catch (err) {
      console.error('Failed to save:', err)
    }
  }

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text: summary || `Descoperă această rețetă ${region}!`,
          url: `${window.location.origin}/recipes/${slug}`
        })
      } else {
        await navigator.clipboard.writeText(`${window.location.origin}/recipes/${slug}`)
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Failed to share:', err)
      }
    }
  }


  const calories = nutrition_per_serving?.calories

  // Determine calorie density color
  const getCalorieDensityColor = (calorieCount: number) => {
    if (calorieCount < 300) return 'bg-green-400'
    if (calorieCount <= 600) return 'bg-yellow-400'
    return 'bg-orange-400'
  }

  return (
    <div className="border rounded-xl overflow-hidden flex flex-col bg-card shadow-sm hover:shadow-md transition-shadow h-full">
       {/* Image */}
       <div className="relative">
         <FallbackImage
           src={hero_image_url}
           alt={title}
           width={400}
           height={176}
           className="w-full h-44 object-cover"
           onClick={() => router.push(`/recipes/${slug}`)}
           style={{ cursor: 'pointer' }}
           sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
           fallbackEmoji="🍽️"
         />
         {/* Tag badge top-left */}
         {tag && (
           <span className="absolute top-2 left-2 bg-amber-500 text-white px-2 py-0.5 rounded-full text-xs font-bold shadow">
             {tag}
           </span>
         )}
         {/* Tested badge top-right */}
          {is_tested && (
            <span className="absolute top-2 right-2 bg-green-500 text-white px-2 py-0.5 rounded-full text-xs font-bold shadow">
              Testat ✓
            </span>
          )}
         {/* Calorie badge bottom-right with Noom-style color dot */}
         {calories && (
           <span className="absolute bottom-2 right-2 bg-black/60 text-white px-2 py-0.5 rounded-full text-xs font-medium backdrop-blur-sm flex items-center gap-1.5">
             <div className={`w-2.5 h-2.5 rounded-full ${getCalorieDensityColor(calories)}`} />
             {calories} kcal
           </span>
         )}
        {/* Cook time badge bottom-left */}
        {cook_time_minutes && (
          <span className="absolute bottom-2 left-2 bg-black/60 text-white px-2 py-0.5 rounded-full text-xs font-medium backdrop-blur-sm flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {cook_time_minutes}m
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        {/* Cookbook breadcrumb */}
        {cookbook && (
          <div className="text-xs text-muted-foreground mb-2">
            <span
              onClick={() => router.push(`/cookbooks/${cookbook.slug}`)}
              className="hover:text-primary cursor-pointer"
            >
              📚 {cookbook.title}
            </span>
            {chapter && (
              <>
                <span className="mx-1">›</span>
                <span>{chapter.name}</span>
              </>
            )}
          </div>
        )}

        {/* Title */}
        <h3
          className="font-semibold text-base mb-1 line-clamp-2 cursor-pointer hover:text-amber-700 transition-colors"
          onClick={() => router.push(`/recipes/${slug}`)}
        >
          {title}
        </h3>

        {/* Summary */}
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2 flex-1">
          {summary || `${region} • ${voteCount} aprecieri`}
        </p>

        {/* Quality score + tags row */}
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          {quality_score && (
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-amber-600 mr-1">
              ★ {quality_score.toFixed(1)}
            </span>
          )}
          {dietTags.slice(0, 2).map((t) => (
            <Link
              key={t}
              href={`/search?diet_tags=${encodeURIComponent(t)}`}
              onClick={(e) => e.stopPropagation()}
               className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-[10px] font-medium capitalize hover:bg-blue-200 transition-colors dark:bg-blue-900/20 dark:text-blue-400"
            >
              {t}
            </Link>
          ))}
           {foodTags.slice(0, 2).map((t) => (
             <Link
               key={t}
               href={`/search?food_tags=${encodeURIComponent(t)}`}
               onClick={(e) => e.stopPropagation()}
               className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-medium capitalize hover:bg-amber-200 transition-colors dark:bg-amber-900/20 dark:text-amber-400"
             >
               {t}
             </Link>
           ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
           <button
             onClick={() => router.push(`/recipes/${slug}`)}
             className="bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-amber-600 transition-colors"
           >
             Vezi rețeta
           </button>
          <button
            onClick={handleSave}
            className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 font-medium transition-colors ${
              isSaved ? 'bg-amber-100 text-amber-800' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <Bookmark size={12} className={isSaved ? 'fill-current' : ''} />
             {isSaved ? 'Salvat' : 'Salvează'}
           </button>
           <button
             onClick={() => handleVote(1)}
              className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 font-medium transition-colors ${
                userVote === 1 ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
           >
             <Heart size={12} className={userVote === 1 ? 'fill-current' : ''} />
             {voteCount}
           </button>
           <button
             onClick={handleShare}
             className="bg-muted text-muted-foreground px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 hover:bg-muted/80 transition-colors"
           >
             <Share2 size={12} />
             Distribuie
           </button>
          <button
            onClick={() => router.push(`/recipes/${slug}#comments`)}
            className="bg-muted text-muted-foreground px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 hover:bg-muted/80 transition-colors"
          >
            <MessageSquare size={12} />
            {comments}
          </button>
        </div>

         {/* Creator */}
         <div className="border-t pt-2 mt-auto flex items-center gap-2">
             <div className="w-7 h-7 rounded-full bg-stone-200 dark:bg-white/10 overflow-hidden flex-shrink-0">
              <FallbackImage src={created_by.avatar_url || ''} alt={created_by.display_name} width={28} height={28} className="w-full h-full object-cover" fallbackEmoji="👨‍🍳" />
           </div>
          <span className="text-xs text-muted-foreground truncate flex-1">
            {created_by.display_name}
          </span>
        </div>
      </div>
    </div>
  )
}
