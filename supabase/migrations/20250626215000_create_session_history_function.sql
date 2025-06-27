CREATE OR REPLACE FUNCTION get_sessions_by_client_id(p_client_id UUID)
RETURNS TABLE (
  session_id UUID,
  session_date TIMESTAMPTZ,
  session_notes TEXT,
  session_status TEXT,
  session_type TEXT -- Added session_type based on schema review
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id as session_id,
    s.date as session_date,
    s.notes as session_notes,
    s.status as session_status,
    'Regular Session' as session_type -- Placeholder as session type is not in the sessions table
  FROM
    public.sessions s
  WHERE
    s.client_id = p_client_id
  ORDER BY
    s.date DESC;
END;
$$ LANGUAGE plpgsql;