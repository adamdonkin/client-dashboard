-- Fix get_sessions_by_client_id to work with authenticated users
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
    s.id::TEXT as session_id,
    s.date::TIMESTAMPTZ as session_date,
    COALESCE(s.notes, '') as session_notes,
    COALESCE(s.status, 'completed') as session_status,
    'Regular Session' as session_type,
    60 as session_duration,
    COALESCE(ce.title, 'Coaching Session') as calendar_title
  FROM sessions s
  LEFT JOIN calendar_events ce ON s.calendar_event_id = ce.calendar_event_id
  WHERE s.client_id = p_client_id
    AND EXISTS (
      SELECT 1 FROM clients c 
      WHERE c.id = s.client_id 
      AND c.user_id = auth.uid()
    )
  ORDER BY s.date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 