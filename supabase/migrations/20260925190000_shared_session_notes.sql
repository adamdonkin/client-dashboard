-- Shared session notes: clients can only read notes their coach has explicitly
-- shared with them. No client writes, no client record/actions/session history.

BEGIN;

-- ============================================================
-- 1. Share flag on session notes
-- ============================================================

ALTER TABLE public.session_notes
  ADD COLUMN IF NOT EXISTS shared_with_client boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.session_notes.shared_with_client IS 'When true, the linked client (clients.auth_user_id) can read this note';

-- ============================================================
-- 2. Clients are read-only
-- ============================================================

DROP POLICY IF EXISTS "Clients can update own session notes" ON session_notes;
DROP POLICY IF EXISTS "Clients can update own actions" ON client_actions;

-- ============================================================
-- 3. Clients see only shared notes and the events behind them
-- ============================================================

DROP POLICY IF EXISTS "Clients can view own session notes" ON session_notes;
CREATE POLICY "Clients can view shared session notes" ON session_notes
  FOR SELECT USING (
    shared_with_client
    AND client_id = (SELECT get_portal_client_id())
  );

DROP POLICY IF EXISTS "Clients can view own events" ON calendar_events;
CREATE POLICY "Clients can view events for shared notes" ON calendar_events
  FOR SELECT USING (
    client_id = (SELECT get_portal_client_id())
    AND EXISTS (
      SELECT 1 FROM session_notes sn
      WHERE sn.calendar_event_id::uuid = calendar_events.id
        AND sn.client_id = calendar_events.client_id
        AND sn.shared_with_client
    )
  );

-- Actions and the full client record (private notes, fee, personal details)
-- are coach-only.
DROP POLICY IF EXISTS "Clients can view own actions" ON client_actions;
DROP POLICY IF EXISTS "Clients can view own record" ON clients;

-- ============================================================
-- 4. Minimal client info for the shared note header
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_shared_note_client(p_note_id uuid)
RETURNS TABLE(id uuid, name text, company_name text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name::text, c.company_name::text
  FROM clients c
  JOIN session_notes sn ON sn.client_id = c.id
  WHERE sn.id = p_note_id
    AND sn.shared_with_client
    AND c.auth_user_id = auth.uid()
$$;

REVOKE EXECUTE ON FUNCTION public.get_shared_note_client(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_shared_note_client(uuid) TO authenticated;

-- ============================================================
-- 5. Session history is coach/team-only again
-- ============================================================

CREATE OR REPLACE FUNCTION get_sessions_by_client_id(p_client_id UUID)
RETURNS TABLE(
  session_id TEXT,
  session_date TIMESTAMPTZ,
  session_notes TEXT,
  session_status TEXT,
  session_type TEXT,
  session_duration INTEGER,
  calendar_title TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sn.id::TEXT as session_id,
    COALESCE(ce.start_time, sn.session_date) as session_date,
    ''::TEXT as session_notes,
    CASE
      WHEN COALESCE(ce.start_time, sn.session_date) > NOW() THEN 'scheduled'
      ELSE 'completed'
    END as session_status,
    CASE
      WHEN sn.calendar_event_id IS NULL THEN 'Ad-hoc Session'
      ELSE 'Coaching Session'
    END as session_type,
    CASE
      WHEN ce.id IS NOT NULL THEN EXTRACT(EPOCH FROM (ce.end_time - ce.start_time))::INTEGER / 60
      ELSE 60
    END as session_duration,
    CASE
      WHEN ce.id IS NOT NULL THEN COALESCE(ce.title, 'Coaching Session')
      ELSE 'Ad-hoc Session'
    END as calendar_title
  FROM session_notes sn
  LEFT JOIN calendar_events ce ON ce.id = sn.calendar_event_id::uuid
  WHERE sn.client_id = p_client_id
    AND sn.user_id IN (SELECT accessible_user_ids())
    AND COALESCE(ce.start_time, sn.session_date) <= NOW()
    AND (ce.id IS NULL OR ce.status IS NULL OR ce.status != 'cancelled')
  ORDER BY COALESCE(ce.start_time, sn.session_date) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

NOTIFY pgrst, 'reload schema';
