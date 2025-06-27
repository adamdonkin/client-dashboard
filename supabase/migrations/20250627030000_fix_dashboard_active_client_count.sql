-- Fix get_scheduling_dashboard to only count active clients

DROP FUNCTION IF EXISTS get_scheduling_dashboard(uuid);

CREATE OR REPLACE FUNCTION get_scheduling_dashboard(p_user_id UUID)
RETURNS TABLE(
  total_clients INTEGER,
  clients_with_upcoming_sessions INTEGER,
  clients_needing_scheduling INTEGER,
  new_clients_never_scheduled INTEGER,
  high_priority_count INTEGER,
  medium_priority_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH active_clients AS (
    SELECT c.* 
    FROM clients c 
    WHERE c.user_id = p_user_id 
      AND (c.is_active IS NULL OR c.is_active = true)
  ),
  client_stats AS (
    SELECT 
      ac.id,
      ac.name,
      CASE 
        WHEN EXISTS (
          SELECT 1 FROM calendar_events ce 
          WHERE ce.client_id = ac.id 
            AND ce.user_id = p_user_id 
            AND ce.start_time > NOW()
        ) THEN 'has_upcoming'
        ELSE 'needs_scheduling'
      END as status,
      COALESCE(
        EXTRACT(DAYS FROM (NOW() AT TIME ZONE 'America/Los_Angeles' - MAX(ce.start_time AT TIME ZONE 'America/Los_Angeles')))::INTEGER,
        999
      ) as days_since_last_session
    FROM active_clients ac
    LEFT JOIN calendar_events ce ON ac.id = ce.client_id 
      AND ce.user_id = p_user_id
      AND ce.start_time <= NOW()
    GROUP BY ac.id, ac.name
  )
  SELECT 
    (SELECT COUNT(*)::INTEGER FROM active_clients) as total_clients,
    (SELECT COUNT(*)::INTEGER FROM client_stats WHERE status = 'has_upcoming') as clients_with_upcoming_sessions,
    (SELECT COUNT(*)::INTEGER FROM client_stats WHERE status = 'needs_scheduling') as clients_needing_scheduling,
    (SELECT COUNT(*)::INTEGER FROM client_stats WHERE status = 'needs_scheduling' AND days_since_last_session = 999) as new_clients_never_scheduled,
    (SELECT COUNT(*)::INTEGER FROM client_stats WHERE status = 'needs_scheduling' AND days_since_last_session >= 30) as high_priority_count,
    (SELECT COUNT(*)::INTEGER FROM client_stats WHERE status = 'needs_scheduling' AND days_since_last_session >= 14 AND days_since_last_session < 30) as medium_priority_count;
END;
$$ LANGUAGE plpgsql; 