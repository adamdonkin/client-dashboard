-- One row per Magic Questions round, saved from the section in a session note
-- as it's written, so scores and the five-year vision can be compared over time.

BEGIN;

CREATE TABLE public.magic_question_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  session_note_id uuid NOT NULL UNIQUE REFERENCES session_notes(id) ON DELETE CASCADE,
  session_date timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- The bullets under the five-year career vision question (Tiptap bulletList)
  vision jsonb,

  -- 1-5 answers to the five rating questions
  score_vision numeric(2,1) CHECK (score_vision BETWEEN 1 AND 5),
  score_work numeric(2,1) CHECK (score_work BETWEEN 1 AND 5),
  score_personal numeric(2,1) CHECK (score_personal BETWEEN 1 AND 5),
  score_company numeric(2,1) CHECK (score_company BETWEEN 1 AND 5),
  score_peers numeric(2,1) CHECK (score_peers BETWEEN 1 AND 5),

  -- Which rating was picked as the lowest: vision, work, personal, company or peers
  lowest text
);

CREATE INDEX idx_magic_question_rounds_user_id ON magic_question_rounds(user_id);
CREATE INDEX idx_magic_question_rounds_client_id ON magic_question_rounds(client_id, session_date DESC);

ALTER TABLE magic_question_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view magic question rounds" ON magic_question_rounds
  FOR SELECT USING (user_id IN (SELECT accessible_user_ids()));
CREATE POLICY "Writers can insert magic question rounds" ON magic_question_rounds
  FOR INSERT WITH CHECK (can_write_user_data(user_id));
CREATE POLICY "Writers can update magic question rounds" ON magic_question_rounds
  FOR UPDATE USING (can_write_user_data(user_id));
CREATE POLICY "Writers can delete magic question rounds" ON magic_question_rounds
  FOR DELETE USING (can_write_user_data(user_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.magic_question_rounds TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
