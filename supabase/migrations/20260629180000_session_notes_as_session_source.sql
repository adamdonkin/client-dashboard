-- Refactor: session_notes is the source of truth for sessions.
-- Session history now queries session_notes with optional calendar_events join.

DROP FUNCTION IF EXISTS get_sessions_by_client_id(uuid);

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
  LEFT JOIN calendar_events ce ON sn.calendar_event_id::uuid = ce.id
  WHERE sn.client_id = p_client_id
    AND sn.user_id = auth.uid()
    AND COALESCE(ce.start_time, sn.session_date) <= NOW()
    AND (ce.id IS NULL OR ce.status IS NULL OR ce.status != 'cancelled')
  ORDER BY COALESCE(ce.start_time, sn.session_date) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_sessions_by_client_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sessions_by_client_id(uuid) TO service_role;
