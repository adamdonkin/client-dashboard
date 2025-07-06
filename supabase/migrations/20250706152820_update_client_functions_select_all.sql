-- Migration: Update client functions to use SELECT * for automatic column inclusion
-- File: supabase/migrations/YYYYMMDDHHMMSS_update_client_functions_select_all.sql
-- This prevents the need to update RPC functions every time we add columns to clients table

-- Update get_clients_needs_scheduling function to use SELECT *
DROP FUNCTION IF EXISTS get_clients_needs_scheduling();

CREATE OR REPLACE FUNCTION get_clients_needs_scheduling()
RETURNS TABLE(
  client_id uuid, 
  client_name text, 
  client_email text, 
  company_name text, 
  slack text, 
  granola_notes_folder text,
  defacto_meeting text,
  phone text,
  role text,
  notes text,
  session_count integer,
  is_active boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  user_id uuid,
  last_session_date timestamp with time zone, 
  days_since_last_session integer, 
  priority_level text
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.*,  -- Gets ALL columns from clients table automatically
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
  GROUP BY c.id, c.name, c.email, c.company_name, c.slack, c.granola_notes_folder, c.defacto_meeting, c.phone, c.role, c.notes, c.session_count, c.is_active, c.created_at, c.updated_at, c.user_id
  ORDER BY days_since_last_session DESC;
END;
$$;

-- Update get_clients_this_week function to use SELECT *
DROP FUNCTION IF EXISTS get_clients_this_week();

CREATE OR REPLACE FUNCTION get_clients_this_week()
RETURNS TABLE(
  client_id uuid, 
  client_name text, 
  client_email text, 
  company_name text, 
  slack text, 
  granola_notes_folder text,
  defacto_meeting text,
  phone text,
  role text,
  notes text,
  session_count integer,
  is_active boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  user_id uuid,
  last_session_date timestamp with time zone, 
  next_session_date timestamp with time zone, 
  session_title text
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    c.*,  -- Gets ALL columns from clients table automatically
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
  GROUP BY c.id, c.name, c.email, c.company_name, c.slack, c.granola_notes_folder, c.defacto_meeting, c.phone, c.role, c.notes, c.session_count, c.is_active, c.created_at, c.updated_at, c.user_id
  ORDER BY next_session_date;
END;
$$;

-- Update get_clients_future function to use SELECT *
DROP FUNCTION IF EXISTS get_clients_future();

CREATE OR REPLACE FUNCTION get_clients_future()
RETURNS TABLE(
  client_id uuid, 
  client_name text, 
  client_email text, 
  company_name text, 
  slack text, 
  granola_notes_folder text,
  defacto_meeting text,
  phone text,
  role text,
  notes text,
  session_count integer,
  is_active boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  user_id uuid,
  last_session_date timestamp with time zone, 
  next_session_date timestamp with time zone, 
  session_title text
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    c.*,  -- Gets ALL columns from clients table automatically
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
  GROUP BY c.id, c.name, c.email, c.company_name, c.slack, c.granola_notes_folder, c.defacto_meeting, c.phone, c.role, c.notes, c.session_count, c.is_active, c.created_at, c.updated_at, c.user_id
  ORDER BY next_session_date;
END;
$$;

-- Verify the functions were updated successfully
-- You can test with: SELECT * FROM get_clients_needs_scheduling() LIMIT 1;