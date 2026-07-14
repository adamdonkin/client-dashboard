BEGIN;

CREATE TABLE IF NOT EXISTS public.pre_write_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_event_id uuid NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  sent_by uuid NOT NULL REFERENCES auth.users(id),
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(calendar_event_id)
);

CREATE INDEX IF NOT EXISTS idx_pre_write_sent_event ON public.pre_write_sent(calendar_event_id);

ALTER TABLE public.pre_write_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view pre_write_sent" ON pre_write_sent
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM calendar_events ce WHERE ce.id = pre_write_sent.calendar_event_id
            AND ce.user_id IN (SELECT accessible_user_ids()))
  );

CREATE POLICY "Writers can insert pre_write_sent" ON pre_write_sent
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM calendar_events ce WHERE ce.id = pre_write_sent.calendar_event_id
            AND can_write_user_data(ce.user_id))
  );

CREATE POLICY "Writers can delete pre_write_sent" ON pre_write_sent
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM calendar_events ce WHERE ce.id = pre_write_sent.calendar_event_id
            AND can_write_user_data(ce.user_id))
  );

GRANT SELECT, INSERT, DELETE ON public.pre_write_sent TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
