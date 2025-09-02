-- Fix timezone issues in client functions by removing AT TIME ZONE from subqueries
-- Drop existing functions first
DROP FUNCTION IF EXISTS get_clients_needs_scheduling();
DROP FUNCTION IF EXISTS get_clients_this_week();
DROP FUNCTION IF EXISTS get_clients_upcoming();

-- Add ea_name and ea_email to get_clients_needs_scheduling function
CREATE FUNCTION get_clients_needs_scheduling()
RETURNS TABLE(
  client_id UUID,
  client_name TEXT,
  client_email TEXT,
  company_name TEXT,
  slack TEXT,
  last_session_date TIMESTAMPTZ,
  days_since_last_session INTEGER,
  priority_level TEXT,
  granola_notes_folder TEXT,
  ea_name TEXT,
  ea_email TEXT
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
      EXTRACT(DAYS FROM (NOW() - MAX(ce.start_time)))::INTEGER,
      999
    ) as days_since_last_session,
    CASE 
      WHEN COALESCE(EXTRACT(DAYS FROM (NOW() - MAX(ce.start_time)))::INTEGER, 999) >= 30 THEN 'high'
      WHEN COALESCE(EXTRACT(DAYS FROM (NOW() - MAX(ce.start_time)))::INTEGER, 999) >= 14 THEN 'medium'
      ELSE 'low'
    END as priority_level,
    c.granola_notes_folder,
    c.ea_name,
    c.ea_email
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
  GROUP BY c.id, c.name, c.email, c.company_name, c.slack, c.granola_notes_folder, c.ea_name, c.ea_email
  ORDER BY days_since_last_session DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add ea_name and ea_email to get_clients_this_week function
CREATE FUNCTION get_clients_this_week()
RETURNS TABLE(
  client_id UUID,
  client_name TEXT,
  client_email TEXT,
  company_name TEXT,
  slack TEXT,
  last_session_date TIMESTAMPTZ,
  days_since_last_session INTEGER,
  priority_level TEXT,
  next_session_date TIMESTAMPTZ,
  next_session_relative TEXT,
  granola_notes_folder TEXT,
  ea_name TEXT,
  ea_email TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as client_id,
    c.name as client_name,
    c.email as client_email,
    c.company_name,
    c.slack,
    last_sessions.session_date as last_session_date,
    CASE 
      WHEN last_sessions.session_date IS NULL THEN NULL
      ELSE EXTRACT(DAYS FROM (NOW() - last_sessions.session_date))::INTEGER
    END as days_since_last_session,
    'scheduled' as priority_level,
    next_sessions.session_date as next_session_date,
    CASE 
      WHEN DATE(next_sessions.session_date AT TIME ZONE 'America/Los_Angeles') = DATE(NOW() AT TIME ZONE 'America/Los_Angeles') THEN 'Today'
      WHEN DATE(next_sessions.session_date AT TIME ZONE 'America/Los_Angeles') = DATE(NOW() AT TIME ZONE 'America/Los_Angeles' + INTERVAL '1 day') THEN 'Tomorrow'
      WHEN DATE(next_sessions.session_date AT TIME ZONE 'America/Los_Angeles') = DATE(NOW() AT TIME ZONE 'America/Los_Angeles' - INTERVAL '1 day') THEN 'Yesterday'
      ELSE TO_CHAR(next_sessions.session_date AT TIME ZONE 'America/Los_Angeles', 'Day, Mon DD')
    END as next_session_relative,
    c.granola_notes_folder,
    c.ea_name,
    c.ea_email
  FROM clients c
  LEFT JOIN (
    SELECT 
      ce.client_id,
      MAX(ce.start_time) as session_date
    FROM calendar_events ce
    WHERE ce.user_id = auth.uid() 
      AND ce.start_time < NOW()
    GROUP BY ce.client_id
  ) last_sessions ON c.id = last_sessions.client_id
  LEFT JOIN (
    SELECT 
      ce.client_id,
      MIN(ce.start_time) as session_date
    FROM calendar_events ce
    WHERE ce.user_id = auth.uid() 
      AND ce.start_time BETWEEN 
        DATE_TRUNC('week', NOW() AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles' AND
        (DATE_TRUNC('week', NOW() AT TIME ZONE 'America/Los_Angeles') + INTERVAL '6 days 23:59:59') AT TIME ZONE 'America/Los_Angeles'
    GROUP BY ce.client_id
  ) next_sessions ON c.id = next_sessions.client_id
  WHERE c.user_id = auth.uid()
    AND (c.is_active IS NULL OR c.is_active = true)
    AND next_sessions.client_id IS NOT NULL
  ORDER BY next_sessions.session_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add ea_name and ea_email to get_clients_upcoming function  
CREATE FUNCTION get_clients_upcoming()
RETURNS TABLE(
  client_id UUID,
  client_name TEXT,
  client_email TEXT,
  company_name TEXT,
  slack TEXT,
  last_session_date TIMESTAMPTZ,
  days_since_last_session INTEGER,
  priority_level TEXT,
  next_session_date TIMESTAMPTZ,
  next_session_relative TEXT,
  granola_notes_folder TEXT,
  ea_name TEXT,
  ea_email TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as client_id,
    c.name as client_name,
    c.email as client_email,
    c.company_name,
    c.slack,
    last_sessions.session_date as last_session_date,
    CASE 
      WHEN last_sessions.session_date IS NULL THEN NULL
      ELSE EXTRACT(DAYS FROM (NOW() - last_sessions.session_date))::INTEGER
    END as days_since_last_session,
    'upcoming' as priority_level,
    next_sessions.session_date as next_session_date,
    CASE 
      WHEN DATE(next_sessions.session_date AT TIME ZONE 'America/Los_Angeles') = DATE(NOW() AT TIME ZONE 'America/Los_Angeles') THEN 'Today'
      WHEN DATE(next_sessions.session_date AT TIME ZONE 'America/Los_Angeles') = DATE(NOW() AT TIME ZONE 'America/Los_Angeles' + INTERVAL '1 day') THEN 'Tomorrow'
      WHEN DATE(next_sessions.session_date AT TIME ZONE 'America/Los_Angeles') = DATE(NOW() AT TIME ZONE 'America/Los_Angeles' - INTERVAL '1 day') THEN 'Yesterday'
      ELSE TO_CHAR(next_sessions.session_date AT TIME ZONE 'America/Los_Angeles', 'Day, Mon DD')
    END as next_session_relative,
    c.granola_notes_folder,
    c.ea_name,
    c.ea_email
  FROM clients c
  LEFT JOIN (
    SELECT 
      ce.client_id,
      MAX(ce.start_time) as session_date
    FROM calendar_events ce
    WHERE ce.user_id = auth.uid() 
      AND ce.start_time < NOW()
    GROUP BY ce.client_id
  ) last_sessions ON c.id = last_sessions.client_id
  LEFT JOIN (
    SELECT 
      ce.client_id,
      MIN(ce.start_time) as session_date
    FROM calendar_events ce
    WHERE ce.user_id = auth.uid() 
      AND ce.start_time > NOW()
    GROUP BY ce.client_id
  ) next_sessions ON c.id = next_sessions.client_id
  WHERE c.user_id = auth.uid()
    AND (c.is_active IS NULL OR c.is_active = true)
    AND next_sessions.client_id IS NOT NULL
  ORDER BY next_sessions.session_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;