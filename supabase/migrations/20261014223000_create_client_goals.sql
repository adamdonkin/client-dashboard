-- Client goals: added from the Goal template in session notes, reviewed in
-- later sessions from the Goals section, and listed on the client page.

BEGIN;

CREATE TYPE goal_health AS ENUM ('off_track', 'at_risk', 'on_track');
CREATE TYPE goal_status AS ENUM ('open', 'achieved', 'dropped');

CREATE TABLE public.client_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  -- The note the goal was written in. That note keeps feeding the goal until
  -- the goal is first updated from its panel (last_reviewed_at).
  session_note_id uuid REFERENCES session_notes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  priority integer,
  title text NOT NULL,
  owner text,
  due_date date,
  health goal_health,
  status goal_status NOT NULL DEFAULT 'open',

  -- Tiptap documents for the three template questions
  whats_good jsonb,
  whats_not_good jsonb,
  fix_plan jsonb,

  last_reviewed_at timestamptz,
  -- One snapshot per session the goal was reviewed in
  review_history jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX idx_client_goals_user_id ON client_goals(user_id);
CREATE INDEX idx_client_goals_client_id ON client_goals(client_id, status);

ALTER TABLE client_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view goals" ON client_goals
  FOR SELECT USING (user_id IN (SELECT accessible_user_ids()));
CREATE POLICY "Writers can insert goals" ON client_goals
  FOR INSERT WITH CHECK (can_write_user_data(user_id));
CREATE POLICY "Writers can update goals" ON client_goals
  FOR UPDATE USING (can_write_user_data(user_id));
CREATE POLICY "Writers can delete goals" ON client_goals
  FOR DELETE USING (can_write_user_data(user_id));

-- Clients see their own goals on shared notes, read-only
CREATE POLICY "Clients can view own goals" ON client_goals
  FOR SELECT USING (client_id = (SELECT get_portal_client_id()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_goals TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
