-- Update get_clients_upcoming function to include sessions after current week ends
CREATE OR REPLACE FUNCTION get_clients_upcoming(p_user_id UUID)
RETURNS TABLE (
  client_id UUID,
  client_name TEXT,
  client_email TEXT,
  company TEXT,
  last_session_date TEXT,
  days_since_last_session INTEGER,
  priority_level TEXT,
  next_session_date TEXT,
  next_session_relative TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as client_id,
    c.name as client_name,
    c.email as client_email,
    c.company,
    CASE 
      WHEN ls.last_session_date IS NOT NULL THEN 
        ls.last_session_date || ', ' || ls.days_since_last_session || ' days ago'
      ELSE NULL
    END as last_session_date,
    ls.days_since_last_session,
    'upcoming' as priority_level,
    ns.next_session_date,
    ns.next_session_relative
  FROM clients c
  LEFT JOIN LATERAL (
    SELECT 
      ce.start_time::date as last_session_date,
      EXTRACT(DAY FROM NOW() - ce.start_time)::integer as days_since_last_session
    FROM calendar_events ce
    WHERE ce.client_id = c.id 
      AND ce.start_time < NOW()
      AND ce.user_id = p_user_id
    ORDER BY ce.start_time DESC
    LIMIT 1
  ) ls ON true
  LEFT JOIN LATERAL (
    SELECT 
      ce.start_time::date as next_session_date,
      CASE 
        WHEN ce.start_time::date = (NOW() AT TIME ZONE 'America/Los_Angeles')::date THEN 'Today'
        WHEN ce.start_time::date = (NOW() AT TIME ZONE 'America/Los_Angeles')::date + 1 THEN 'Tomorrow'
        WHEN ce.start_time::date BETWEEN (NOW() AT TIME ZONE 'America/Los_Angeles')::date + 2 
          AND (NOW() AT TIME ZONE 'America/Los_Angeles')::date + 6 THEN 
          TO_CHAR(ce.start_time, 'Day')
        ELSE TO_CHAR(ce.start_time, 'Day, Mon DD')
      END as next_session_relative
    FROM calendar_events ce
    WHERE ce.client_id = c.id 
      AND ce.start_time > NOW()
      AND ce.user_id = p_user_id
    ORDER BY ce.start_time ASC
    LIMIT 1
  ) ns ON true
  WHERE c.user_id = p_user_id
    AND ns.next_session_date IS NOT NULL
    AND ce.start_time > (DATE_TRUNC('week', NOW() AT TIME ZONE 'America/Los_Angeles') + INTERVAL '6 days 23:59:59')::TIMESTAMPTZ
  ORDER BY ns.next_session_date ASC;
END;
$$ LANGUAGE plpgsql; 