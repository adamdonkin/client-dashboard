-- Exclude cancelled sessions from session history
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
    ce.id::TEXT as session_id,
    ce.start_time as session_date,
    ''::TEXT as session_notes,
    CASE 
      WHEN ce.start_time > NOW() THEN 'scheduled'
      ELSE 'completed'
    END as session_status,
    'Coaching Session' as session_type,
    EXTRACT(EPOCH FROM (ce.end_time - ce.start_time))::INTEGER / 60 as session_duration,
    COALESCE(ce.title, 'Coaching Session') as calendar_title
  FROM calendar_events ce
  WHERE ce.client_id = p_client_id
    AND ce.start_time <= NOW()  -- Only show past sessions
    AND (ce.status IS NULL OR ce.status != 'cancelled')  -- Exclude cancelled sessions
  ORDER BY ce.start_time DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_sessions_by_client_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sessions_by_client_id(uuid) TO anon;
GRANT EXECUTE ON FUNCTION get_sessions_by_client_id(uuid) TO service_role;


