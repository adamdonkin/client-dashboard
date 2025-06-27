-- Fix get_clients_needs_scheduling to only show active clients
CREATE OR REPLACE FUNCTION get_clients_needs_scheduling(p_user_id UUID)
RETURNS TABLE(
  client_id UUID,
  client_name TEXT,
  client_email TEXT,
  company_name TEXT,
  last_session_date DATE,
  days_since_last_session INTEGER,
  priority_level TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.email,
    c.company_name,
    MAX(ce.start_time::DATE) as last_session_date,
    COALESCE(
      EXTRACT(DAYS FROM (NOW() AT TIME ZONE 'America/Los_Angeles' - MAX(ce.start_time AT TIME ZONE 'America/Los_Angeles')))::INTEGER,
      999
    ) as days_since_last_session,
    CASE 
      WHEN COALESCE(EXTRACT(DAYS FROM (NOW() AT TIME ZONE 'America/Los_Angeles' - MAX(ce.start_time AT TIME ZONE 'America/Los_Angeles')))::INTEGER, 999) >= 30 THEN 'high'
      WHEN COALESCE(EXTRACT(DAYS FROM (NOW() AT TIME ZONE 'America/Los_Angeles' - MAX(ce.start_time AT TIME ZONE 'America/Los_Angeles')))::INTEGER, 999) >= 14 THEN 'medium'
      ELSE 'low'
    END as priority_level
  FROM clients c
  LEFT JOIN calendar_events ce ON c.id = ce.client_id 
    AND ce.user_id = p_user_id
    AND ce.start_time <= NOW()
  WHERE c.user_id = p_user_id
    AND (c.is_active IS NULL OR c.is_active = true)  -- Only show active clients
    AND NOT EXISTS (
      SELECT 1 FROM calendar_events future_ce 
      WHERE future_ce.client_id = c.id 
        AND future_ce.user_id = p_user_id
        AND future_ce.start_time > NOW()
    )
  GROUP BY c.id, c.name, c.email, c.company_name
  ORDER BY days_since_last_session DESC;
END;
$$ LANGUAGE plpgsql; 