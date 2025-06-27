-- Fix function return types from DATE to TIMESTAMPTZ
-- This addresses the "structure of query does not match function result type" error

-- get_clients_needs_scheduling is already fixed, so we'll skip it

-- Drop and recreate get_clients_this_week with correct return type
DROP FUNCTION IF EXISTS get_clients_this_week(uuid);

CREATE OR REPLACE FUNCTION get_clients_this_week(p_user_id UUID)
RETURNS TABLE(
  client_id UUID,
  client_name TEXT,
  client_email TEXT,
  company_name TEXT,
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
    MIN(ce.start_time) as next_session_date,
    MIN(ce.title) as session_title
  FROM clients c
  INNER JOIN calendar_events ce ON c.id = ce.client_id
  WHERE c.user_id = p_user_id
    AND ce.user_id = p_user_id
    AND ce.start_time > NOW()
    AND ce.start_time <= (DATE_TRUNC('week', NOW() AT TIME ZONE 'America/Los_Angeles') + INTERVAL '6 days 23:59:59')::TIMESTAMPTZ
  GROUP BY c.id, c.name, c.email, c.company_name
  ORDER BY next_session_date;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate get_clients_upcoming with correct return type
DROP FUNCTION IF EXISTS get_clients_upcoming(uuid);

CREATE OR REPLACE FUNCTION get_clients_upcoming(p_user_id UUID)
RETURNS TABLE(
  client_id UUID,
  client_name TEXT,
  client_email TEXT,
  company_name TEXT,
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
    MIN(ce.start_time) as next_session_date,
    MIN(ce.title) as session_title
  FROM clients c
  INNER JOIN calendar_events ce ON c.id = ce.client_id
  WHERE c.user_id = p_user_id
    AND ce.user_id = p_user_id
    AND ce.start_time > (DATE_TRUNC('week', NOW() AT TIME ZONE 'America/Los_Angeles') + INTERVAL '6 days 23:59:59')::TIMESTAMPTZ
  GROUP BY c.id, c.name, c.email, c.company_name
  ORDER BY next_session_date;
END;
$$ LANGUAGE plpgsql; 