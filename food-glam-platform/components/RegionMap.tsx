'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { Globe } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { REGION_META } from '@/lib/recipe-taxonomy'

// Curated subset of regions with display colours
const REGION_PILLS = [
  { id: 'east-asia',       color: 'bg-red-100 hover:bg-red-200',       textColor: 'text-red-800'    },
  { id: 'southeast-asia',  color: 'bg-orange-100 hover:bg-orange-200', textColor: 'text-orange-800' },
  { id: 'south-asia',      color: 'bg-yellow-100 hover:bg-yellow-200', textColor: 'text-yellow-800' },
  { id: 'middle-east',     color: 'bg-purple-100 hover:bg-purple-200', textColor: 'text-purple-800' },
  { id: 'north-africa',    color: 'bg-amber-100 hover:bg-amber-200',   textColor: 'text-amber-800'  },
  { id: 'western-europe',  color: 'bg-blue-100 hover:bg-blue-200',     textColor: 'text-blue-800'   },
  { id: 'eastern-europe',  color: 'bg-indigo-100 hover:bg-indigo-200', textColor: 'text-indigo-800' },
  { id: 'north-america',   color: 'bg-green-100 hover:bg-green-200',   textColor: 'text-green-800'  },
  { id: 'south-america',   color: 'bg-teal-100 hover:bg-teal-200',     textColor: 'text-teal-800'   },
  { id: 'central-asia',    color: 'bg-rose-100 hover:bg-rose-200',     textColor: 'text-rose-800'   },
] as const

function RegionMapContent() {
  const searchParams = useSearchParams()
  const selectedRegion = searchParams.get('region')

  return (
    <div className="w-full h-48 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-4 left-4 w-20 h-20 rounded-full bg-blue-500"></div>
        <div className="absolute top-12 right-8 w-16 h-16 rounded-full bg-purple-500"></div>
        <div className="absolute bottom-8 left-1/4 w-24 h-24 rounded-full bg-green-500"></div>
        <div className="absolute bottom-4 right-1/4 w-12 h-12 rounded-full bg-yellow-500"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center h-full">
        <Globe className="w-12 h-12 text-blue-600 mb-3" />
        <h3 className="text-lg font-semibold mb-2">Explore by Region</h3>
        <div className="flex gap-2 flex-wrap justify-center">
          {REGION_PILLS.map(({ id, color, textColor }) => {
            const meta = REGION_META[id]
            if (!meta) return null
            return (
              <Link
                key={id}
                href={`/cookbooks/region/${id}`}
                className={`${color} ${textColor} ${selectedRegion === id ? 'ring-2 ring-offset-2 ring-blue-500' : ''} px-3 py-1 rounded-full text-sm font-medium transition-all`}
              >
                {meta.emoji} {meta.label}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function RegionMap() {
  return (
    <Suspense fallback={
      <div className="w-full h-48 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-6 flex items-center justify-center">
        <div className="text-muted-foreground">Se încarcă...</div>
      </div>
    }>
      <RegionMapContent />
    </Suspense>
  )
}
