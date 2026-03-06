import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(req: Request) {
  // Check if local Supabase is running
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const isLocalSupabase = supabaseUrl?.includes('127.0.0.1') || supabaseUrl?.includes('localhost')
  
  if (isLocalSupabase) {
    try {
      const healthCheck = await fetch(`${supabaseUrl}/rest/v1/`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '' }, signal: AbortSignal.timeout(2000) })
      if (!healthCheck.ok) {
        console.log('Local Supabase not responding, using mock data')
        const { MOCK_COMMUNITY_THREADS } = await import('@/lib/mock-data')
        return NextResponse.json({
          threads: MOCK_COMMUNITY_THREADS,
          _note: 'Using mock data - Local Supabase not running'
        })
      }
    } catch (err) {
      console.log('Local Supabase health check failed, using mock data')
      const { MOCK_COMMUNITY_THREADS } = await import('@/lib/mock-data')
      return NextResponse.json({
        threads: MOCK_COMMUNITY_THREADS,
        _note: 'Using mock data - Local Supabase not running'
      })
    }
  }

  try {
    const supabase = await createServerSupabaseClient()

    const { data: threads, error: threadsError } = await supabase
      .from('threads')
      .select(`
        id,
        title,
        status,
        created_at
      `)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(20)

    if (threadsError) {
      console.error('Threads query error:', threadsError)
      return NextResponse.json({ error: threadsError.message }, { status: 500 })
    }

    const threadIds = threads?.map(t => t.id) || []

    const { data: replies, error: repliesError } = await supabase
      .from('replies')
      .select('thread_id')
      .in('thread_id', threadIds)
      .eq('status', 'published')

    if (repliesError) {
      console.error('Replies query error:', repliesError)
    }

    const replyCountMap = new Map<string, number>()
    replies?.forEach(reply => {
      const current = replyCountMap.get(reply.thread_id) || 0
      replyCountMap.set(reply.thread_id, current + 1)
    })

    const communityThreads = threads
      ?.map(thread => ({
        id: thread.id,
        title: thread.title,
        upvotes: 0,
        comments: replyCountMap.get(thread.id) || 0,
        tag: (replyCountMap.get(thread.id) || 0) > 10 ? 'Hot Discussion' : 'New'
      }))
      .sort((a, b) => b.comments - a.comments)
      .slice(0, 5) || []

    return NextResponse.json({ threads: communityThreads })
  } catch (err: any) {
    console.error('Community API error:', err)
    console.log('Falling back to mock data (Supabase not available)')
    
    // Fallback to mock data when Supabase is unavailable
    const { MOCK_COMMUNITY_THREADS } = await import('@/lib/mock-data')
    return NextResponse.json({
      threads: MOCK_COMMUNITY_THREADS,
      _note: 'Using mock data - Supabase not available'
    })
  }
}
