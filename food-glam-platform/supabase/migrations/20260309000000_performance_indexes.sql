-- ============================================================
-- Migration: Add performance indexes identified by audit
-- ============================================================
-- These indexes optimize common query patterns:
-- - Filtered recipe queries (homepage, search, trending)
-- - User's own posts lookup
-- - Vote lookups and aggregation
-- - Follow relationship lookups
-- - Meal plan queries by user

-- Composite index for filtered recipe queries (homepage, search, trending)
-- Supports: WHERE status = 'active' AND type = 'recipe' ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_posts_status_type_created ON posts(status, type, created_at DESC);

-- User's own posts lookup
-- Supports: WHERE created_by = ? AND status = 'active'
CREATE INDEX IF NOT EXISTS idx_posts_created_by_status ON posts(created_by, status);

-- Vote lookups (check if user voted on a post)
-- Supports: WHERE post_id = ? AND user_id = ?
CREATE INDEX IF NOT EXISTS idx_votes_post_id_user_id ON votes(post_id, user_id);

-- Vote aggregation (get all votes for a post ordered by creation)
-- Supports: WHERE post_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_votes_post_id_created ON votes(post_id, created_at DESC);

-- Follow relationship lookup
-- Supports: WHERE follower_id = ? AND following_id = ?
-- Note: follows table uses following_id (not followed_id)
CREATE INDEX IF NOT EXISTS idx_follows_follower_following ON follows(follower_id, following_id);

-- Meal plans by user with creation date
-- Supports: WHERE user_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_meal_plans_user_created ON meal_plans(user_id, created_at DESC);
