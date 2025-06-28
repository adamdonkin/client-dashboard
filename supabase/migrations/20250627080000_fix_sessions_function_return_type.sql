-- Fix get_sessions_by_client_id to return TIMESTAMPTZ instead of DATE
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
    s.date::TIMESTAMPTZ as session_date,  -- Cast DATE to TIMESTAMPTZ
    COALESCE(s.notes, '') as session_notes,
    COALESCE(s.status, 'completed') as session_status,
    'Regular Session' as session_type, -- Placeholder as session type is not in the sessions table
    60 as session_duration, -- Default duration since it's not in sessions table
    '' as calendar_title -- Empty since we're using sessions table
  FROM sessions s
  WHERE s.client_id = p_client_id
    AND EXISTS (
      SELECT 1 FROM clients c 
      WHERE c.id = s.client_id 
      AND c.user_id = auth.uid()
    )
  ORDER BY s.date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 