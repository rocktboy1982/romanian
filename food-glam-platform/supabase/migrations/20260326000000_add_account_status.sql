-- Migration: Add account status columns to profiles for GDPR-compliant deactivation
-- Created: 2026-03-26

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_status text DEFAULT 'active';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS scheduled_deletion_at timestamptz;

-- Index for scheduled deletion cron job
CREATE INDEX IF NOT EXISTS idx_profiles_scheduled_deletion
  ON profiles (scheduled_deletion_at)
  WHERE scheduled_deletion_at IS NOT NULL;

-- Comment documenting the cron job requirement:
-- A daily Supabase Edge Function or pg_cron job should run:
--
-- DELETE FROM posts WHERE created_by IN (
--   SELECT id FROM profiles WHERE scheduled_deletion_at < NOW()
-- );
-- DELETE FROM collections WHERE user_id IN (
--   SELECT id FROM profiles WHERE scheduled_deletion_at < NOW()
-- );
-- DELETE FROM pantry WHERE user_id IN (
--   SELECT id FROM profiles WHERE scheduled_deletion_at < NOW()
-- );
-- DELETE FROM meal_plans WHERE user_id IN (
--   SELECT id FROM profiles WHERE scheduled_deletion_at < NOW()
-- );
-- DELETE FROM shopping_lists WHERE user_id IN (
--   SELECT id FROM profiles WHERE scheduled_deletion_at < NOW()
-- );
-- DELETE FROM votes WHERE user_id IN (
--   SELECT id FROM profiles WHERE scheduled_deletion_at < NOW()
-- );
-- DELETE FROM follows WHERE follower_id IN (
--   SELECT id FROM profiles WHERE scheduled_deletion_at < NOW()
-- );
-- DELETE FROM threads WHERE author_id IN (
--   SELECT id FROM profiles WHERE scheduled_deletion_at < NOW()
-- );
-- DELETE FROM replies WHERE author_id IN (
--   SELECT id FROM profiles WHERE scheduled_deletion_at < NOW()
-- );
-- DELETE FROM user_health_profiles WHERE user_id IN (
--   SELECT id FROM profiles WHERE scheduled_deletion_at < NOW()
-- );
-- DELETE FROM user_hydration_logs WHERE user_id IN (
--   SELECT id FROM profiles WHERE scheduled_deletion_at < NOW()
-- );
-- DELETE FROM user_meal_logs WHERE user_id IN (
--   SELECT id FROM profiles WHERE scheduled_deletion_at < NOW()
-- );
-- DELETE FROM user_fasting_logs WHERE user_id IN (
--   SELECT id FROM profiles WHERE scheduled_deletion_at < NOW()
-- );
-- DELETE FROM user_weight_logs WHERE user_id IN (
--   SELECT id FROM profiles WHERE scheduled_deletion_at < NOW()
-- );
-- DELETE FROM profiles WHERE scheduled_deletion_at < NOW();
