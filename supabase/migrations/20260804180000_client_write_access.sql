-- Allow client users to write to session_notes and client_actions
-- so the session page works naturally (locking, action toggling, etc.)

-- session_notes: clients can update notes for their own sessions
CREATE POLICY "Clients can update own session notes" ON session_notes
  FOR UPDATE USING (
    client_id = (SELECT get_portal_client_id())
  );

-- client_actions: clients can update their own actions
CREATE POLICY "Clients can update own actions" ON client_actions
  FOR UPDATE USING (
    client_id = (SELECT get_portal_client_id())
  );

NOTIFY pgrst, 'reload schema';
