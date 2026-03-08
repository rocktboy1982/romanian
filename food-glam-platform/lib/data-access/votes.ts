/**
 * Data-access layer for votes queries.
 * Centralizes repeated Supabase vote aggregation patterns used across API routes.
 * All functions accept a Supabase client as the first argument (dependency injection).
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { VoteMap, VoteStats, VoteStatsMap, VoteRecord } from './types'

/**
 * Fetch vote aggregations for multiple posts
 * Returns a map of post_id → net votes (sum of all vote values)
 *
 * @param supabase - Supabase client instance
 * @param postIds - Array of post UUIDs
 * @returns Map of post_id → net votes
 */
export async function getVotesByPostIds(
  supabase: SupabaseClient,
  postIds: string[]
): Promise<VoteMap> {
  if (postIds.length === 0) {
    return {}
  }

  const { data: votes, error } = await supabase
    .from('votes')
    .select('post_id, value')
    .in('post_id', postIds)

  if (error) {
    console.error('getVotesByPostIds error:', error)
    return {}
  }

  const voteMap: VoteMap = {}

  votes?.forEach(vote => {
    const current = voteMap[vote.post_id] || 0
    voteMap[vote.post_id] = current + (vote.value || 0)
  })

  return voteMap
}

/**
 * Fetch recent votes for trending calculations
 * Returns a map of post_id → { net, trending } vote counts
 * Trending votes are those from the last N days
 *
 * @param supabase - Supabase client instance
 * @param postIds - Array of post UUIDs
 * @param days - Number of days to look back for trending (default 7)
 * @returns Map of post_id → { net, trending }
 */
export async function getRecentVotes(
  supabase: SupabaseClient,
  postIds: string[],
  days: number = 7
): Promise<VoteStatsMap> {
  if (postIds.length === 0) {
    return {}
  }

  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data: votes, error } = await supabase
    .from('votes')
    .select('post_id, value, created_at')
    .in('post_id', postIds)

  if (error) {
    console.error('getRecentVotes error:', error)
    return {}
  }

  const voteMap: VoteStatsMap = {}

  votes?.forEach(vote => {
    const current = voteMap[vote.post_id] || { net: 0, trending: 0 }
    const val = vote.value || 0

    current.net += val

    if (vote.created_at && vote.created_at >= cutoffDate) {
      current.trending += val
    }

    voteMap[vote.post_id] = current
  })

  return voteMap
}

/**
 * Upsert a vote (insert or update)
 * If the user has already voted on this post, update the vote value.
 * Otherwise, insert a new vote.
 *
 * @param supabase - Supabase client instance
 * @param postId - Post UUID
 * @param userId - User UUID
 * @param value - Vote value (1 or -1)
 * @returns true if successful, false otherwise
 */
export async function upsertVote(
  supabase: SupabaseClient,
  postId: string,
  userId: string,
  value: 1 | -1
): Promise<boolean> {
  // Check if vote already exists
  const { data: existingVote, error: selectError } = await supabase
    .from('votes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .single()

  if (selectError && selectError.code !== 'PGRST116') {
    // PGRST116 = no rows returned (expected for new votes)
    console.error('upsertVote select error:', selectError)
    return false
  }

  if (existingVote) {
    // Update existing vote
    const { error: updateError } = await supabase
      .from('votes')
      .update({ value })
      .eq('post_id', postId)
      .eq('user_id', userId)

    if (updateError) {
      console.error('upsertVote update error:', updateError)
      return false
    }
  } else {
    // Insert new vote
    const { error: insertError } = await supabase
      .from('votes')
      .insert({
        post_id: postId,
        user_id: userId,
        value,
      })

    if (insertError) {
      console.error('upsertVote insert error:', insertError)
      return false
    }
  }

  return true
}

/**
 * Get a user's vote on a specific post
 *
 * @param supabase - Supabase client instance
 * @param postId - Post UUID
 * @param userId - User UUID
 * @returns Vote value (1, -1) or null if user hasn't voted
 */
export async function getUserVote(
  supabase: SupabaseClient,
  postId: string,
  userId: string
): Promise<1 | -1 | null> {
  const { data: vote, error } = await supabase
    .from('votes')
    .select('value')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .single()

  if (error) {
    // No vote found is not an error
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('getUserVote error:', error)
    return null
  }

  return vote?.value || null
}

/**
 * Get the net vote count for a single post
 *
 * @param supabase - Supabase client instance
 * @param postId - Post UUID
 * @returns Net vote count (sum of all votes)
 */
export async function getNetVotes(
  supabase: SupabaseClient,
  postId: string
): Promise<number> {
  const { data: votes, error } = await supabase
    .from('votes')
    .select('value')
    .eq('post_id', postId)

  if (error) {
    console.error('getNetVotes error:', error)
    return 0
  }

  return votes?.reduce((sum, vote) => sum + (vote.value || 0), 0) || 0
}

/**
 * Delete a user's vote on a post
 *
 * @param supabase - Supabase client instance
 * @param postId - Post UUID
 * @param userId - User UUID
 * @returns true if successful, false otherwise
 */
export async function deleteVote(
  supabase: SupabaseClient,
  postId: string,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('votes')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId)

  if (error) {
    console.error('deleteVote error:', error)
    return false
  }

  return true
}
