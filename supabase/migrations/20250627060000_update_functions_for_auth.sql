-- Update all database functions to use auth.uid() instead of passed user_id
-- This ensures functions automatically use the authenticated user

-- Update get_clients_needs_scheduling
DROP FUNCTION IF EXISTS get_clients_needs_scheduling(uuid);

CREATE OR REPLACE FUNCTION get_clients_needs_scheduling()
RETURNS TABLE(
  client_id UUID,
  client_name TEXT,
  client_email TEXT,
  company_name TEXT,
  slack TEXT,
  last_session_date TIMESTAMPTZ,
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
    c.slack,
    MAX(ce.start_time) as last_session_date,
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
    AND ce.user_id = auth.uid()
    AND ce.start_time <= NOW()
  WHERE c.user_id = auth.uid()
    AND (c.is_active IS NULL OR c.is_active = true)
    AND NOT EXISTS (
      SELECT 1 FROM calendar_events future_ce 
      WHERE future_ce.client_id = c.id 
        AND future_ce.user_id = auth.uid()
        AND future_ce.start_time > NOW()
    )
  GROUP BY c.id, c.name, c.email, c.company_name, c.slack
  ORDER BY days_since_last_session DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_clients_this_week
DROP FUNCTION IF EXISTS get_clients_this_week(uuid);

CREATE OR REPLACE FUNCTION get_clients_this_week()
RETURNS TABLE(
  client_id UUID,
  client_name TEXT,
  client_email TEXT,
  company_name TEXT,
  slack TEXT,
  last_session_date TIMESTAMPTZ,
  next_session_date TIMESTAMPTZ,
  session_title TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    c.id,
    c.name,
    c.email,
    c.company_name,
    c.slack,
    (SELECT MAX(past_ce.start_time) 
     FROM calendar_events past_ce 
     WHERE past_ce.client_id = c.id 
       AND past_ce.user_id = auth.uid()
       AND past_ce.start_time <= NOW()) as last_session_date,
    MIN(ce.start_time) as next_session_date,
    MIN(ce.title) as session_title
  FROM clients c
  INNER JOIN calendar_events ce ON c.id = ce.client_id
  WHERE c.user_id = auth.uid()
    AND ce.user_id = auth.uid()
    AND ce.start_time > NOW()
    AND ce.start_time <= (DATE_TRUNC('week', NOW() AT TIME ZONE 'America/Los_Angeles') + INTERVAL '6 days 23:59:59')::TIMESTAMPTZ
  GROUP BY c.id, c.name, c.email, c.company_name, c.slack
  ORDER BY next_session_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_clients_future
DROP FUNCTION IF EXISTS get_clients_future(uuid);

CREATE OR REPLACE FUNCTION get_clients_future()
RETURNS TABLE(
  client_id UUID,
  client_name TEXT,
  client_email TEXT,
  company_name TEXT,
  slack TEXT,
  last_session_date TIMESTAMPTZ,
  next_session_date TIMESTAMPTZ,
  session_title TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    c.id,
    c.name,
    c.email,
    c.company_name,
    c.slack,
    (SELECT MAX(past_ce.start_time) 
     FROM calendar_events past_ce 
     WHERE past_ce.client_id = c.id 
       AND past_ce.user_id = auth.uid()
       AND past_ce.start_time <= NOW()) as last_session_date,
    MIN(ce.start_time) as next_session_date,
    MIN(ce.title) as session_title
  FROM clients c
  INNER JOIN calendar_events ce ON c.id = ce.client_id
  WHERE c.user_id = auth.uid()
    AND ce.user_id = auth.uid()
    AND ce.start_time > (DATE_TRUNC('week', NOW() AT TIME ZONE 'America/Los_Angeles') + INTERVAL '6 days 23:59:59')::TIMESTAMPTZ
  GROUP BY c.id, c.name, c.email, c.company_name, c.slack
  ORDER BY next_session_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_scheduling_dashboard
DROP FUNCTION IF EXISTS get_scheduling_dashboard(uuid);

CREATE OR REPLACE FUNCTION get_scheduling_dashboard()
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
    WHERE c.user_id = auth.uid()
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
            AND ce.user_id = auth.uid()
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
      AND ce.user_id = auth.uid()
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
$$ LANGUAGE plpgsql SECURITY DEFINER; 