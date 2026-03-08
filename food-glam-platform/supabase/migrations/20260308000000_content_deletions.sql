-- ============================================================
-- CONTENT DELETIONS AUDIT TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS content_deletions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('post', 'recipe', 'cocktail', 'thread', 'reply', 'collection', 'meal_plan', 'shopping_list')),
  entity_id uuid NOT NULL,
  entity_title text,
  entity_slug text,
  deleted_by uuid NOT NULL REFERENCES profiles(id),
  deletion_type text NOT NULL CHECK (deletion_type IN ('soft', 'hard')) DEFAULT 'soft',
  reason text,
  ip_address text,
  user_agent text,
  snapshot jsonb,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_content_deletions_entity ON content_deletions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_content_deletions_user ON content_deletions(deleted_by);
CREATE INDEX IF NOT EXISTS idx_content_deletions_date ON content_deletions(created_at DESC);

ALTER TABLE content_deletions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own deletions" ON content_deletions 
  FOR SELECT 
  USING (auth.uid() = deleted_by);

CREATE POLICY "Users can create deletion records" ON content_deletions 
  FOR INSERT 
  WITH CHECK (auth.uid() = deleted_by);

CREATE POLICY "Admins can view all deletions" ON content_deletions 
  FOR SELECT 
  USING (
    EXISTS (SELECT 1 FROM app_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator'))
  );
