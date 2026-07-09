-- Pre-reads: AI-generated session prep documents

CREATE TABLE pre_reads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  calendar_event_id uuid REFERENCES calendar_events(id) ON DELETE SET NULL,
  session_date date NOT NULL,
  content text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  generated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, calendar_event_id)
);

CREATE INDEX idx_pre_reads_user_date ON pre_reads(user_id, session_date);
CREATE INDEX idx_pre_reads_status ON pre_reads(status);

ALTER TABLE pre_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own pre-reads"
  ON pre_reads FOR ALL
  USING (user_id IN (SELECT accessible_user_ids()))
  WITH CHECK (user_id IN (SELECT accessible_user_ids()));

GRANT SELECT, INSERT, UPDATE, DELETE ON pre_reads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON pre_reads TO service_role;

NOTIFY pgrst, 'reload schema';
