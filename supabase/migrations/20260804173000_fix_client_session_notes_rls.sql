-- Fix RLS: allow client users to view session notes by client_id directly
-- (not just through calendar_event_id, which is null for ad-hoc sessions)

DROP POLICY IF EXISTS "Clients can view own session notes" ON session_notes;

CREATE POLICY "Clients can view own session notes" ON session_notes
  FOR SELECT USING (
    client_id = (SELECT get_portal_client_id())
  );

NOTIFY pgrst, 'reload schema';
