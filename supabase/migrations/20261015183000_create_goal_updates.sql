-- Goal updates: each review of a goal is its own dated update with a status and
-- the three template answers. A goal's current status is its latest update's.

BEGIN;

ALTER TYPE goal_status RENAME VALUE 'achieved' TO 'completed';

CREATE TABLE public.goal_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES client_goals(id) ON DELETE CASCADE,
  -- The session the update was given in; null for updates added from the client page
  session_note_id uuid REFERENCES session_notes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  health goal_health,
  whats_good jsonb,
  whats_not_good jsonb,
  fix_plan jsonb,

  -- Written in the Goal template in session notes rather than in the goal panel
  from_notes boolean NOT NULL DEFAULT false,

  -- One update per goal per session
  CONSTRAINT uq_goal_updates_session UNIQUE (goal_id, session_note_id)
);

CREATE INDEX idx_goal_updates_goal_id ON goal_updates(goal_id, created_at DESC);
CREATE INDEX idx_goal_updates_user_id ON goal_updates(user_id);

ALTER TABLE goal_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view goal updates" ON goal_updates
  FOR SELECT USING (user_id IN (SELECT accessible_user_ids()));
CREATE POLICY "Writers can insert goal updates" ON goal_updates
  FOR INSERT WITH CHECK (can_write_user_data(user_id));
CREATE POLICY "Writers can update goal updates" ON goal_updates
  FOR UPDATE USING (can_write_user_data(user_id));
CREATE POLICY "Writers can delete goal updates" ON goal_updates
  FOR DELETE USING (can_write_user_data(user_id));

CREATE POLICY "Clients can view own goal updates" ON goal_updates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM client_goals g
      WHERE g.id = goal_updates.goal_id
        AND g.client_id = (SELECT get_portal_client_id())
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_updates TO authenticated;

-- Each existing goal's answers become its first update
INSERT INTO goal_updates (user_id, goal_id, session_note_id, created_at, health, whats_good, whats_not_good, fix_plan, from_notes)
SELECT
  g.user_id,
  g.id,
  COALESCE(
    NULLIF(g.review_history -> -1 ->> 'session_note_id', '')::uuid,
    g.session_note_id
  ),
  COALESCE((g.review_history -> -1 ->> 'date')::timestamptz, g.created_at),
  g.health,
  g.whats_good,
  g.whats_not_good,
  g.fix_plan,
  g.last_reviewed_at IS NULL
FROM client_goals g
WHERE g.health IS NOT NULL
   OR g.whats_good IS NOT NULL
   OR g.whats_not_good IS NOT NULL
   OR g.fix_plan IS NOT NULL;

ALTER TABLE client_goals
  DROP COLUMN health,
  DROP COLUMN whats_good,
  DROP COLUMN whats_not_good,
  DROP COLUMN fix_plan,
  DROP COLUMN review_history;

COMMENT ON COLUMN client_goals.last_reviewed_at IS 'Set once the goal is worked on from its panel; after that the note it was written in stops updating it';

COMMIT;

NOTIFY pgrst, 'reload schema';
