-- Migration: Fix client functions to match actual table column types
-- File: supabase/migrations/YYYYMMDDHHMMSS_fix_client_functions_types_v2.sql

-- Fix get_clients_needs_scheduling with correct column names and types
DROP FUNCTION IF EXISTS get_clients_needs_scheduling();

CREATE OR REPLACE FUNCTION get_clients_needs_scheduling()
RETURNS TABLE(
  client_id uuid,
  user_id uuid,
  client_name text,
  client_email text,
  phone text,
  session_count integer,
  notes text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  company_name text,
  role text,
  slack text,
  is_active boolean,
  monthly_fee numeric,
  granola_notes_folder text,
  defacto_meeting text,
  last_session_date timestamp with time zone, 
  days_since_last_session integer, 
  priority_level text
)
LANGUAGE plpgsql SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.user_id,
    c.name,
    c.email,
    c.phone,
    c.session_count,
    c.notes,
    c.created_at,
    c.updated_at,
    c.company_name,
    c.role,
    c.slack,
    c.is_active,
    c.monthly_fee,
    c.granola_notes_folder,
    c.defacto_meeting,
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
  GROUP BY c.id, c.user_id, c.name, c.email, c.phone, c.session_count, c.notes, c.created_at, c.updated_at, c.company_name, c.role, c.slack, c.is_active, c.monthly_fee, c.granola_notes_folder, c.defacto_meeting
  ORDER BY days_since_last_session DESC;
END;
$function$;

-- Fix get_clients_this_week
DROP FUNCTION IF EXISTS get_clients_this_week();

CREATE OR REPLACE FUNCTION get_clients_this_week()
RETURNS TABLE(
  client_id uuid,
  user_id uuid,
  client_name text,
  client_email text,
  phone text,
  session_count integer,
  notes text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  company_name text,
  role text,
  slack text,
  is_active boolean,
  monthly_fee numeric,
  granola_notes_folder text,
  defacto_meeting text,
  last_session_date timestamp with time zone, 
  next_session_date timestamp with time zone, 
  session_title text
)
LANGUAGE plpgsql SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    c.id,
    c.user_id,
    c.name,
    c.email,
    c.phone,
    c.session_count,
    c.notes,
    c.created_at,
    c.updated_at,
    c.company_name,
    c.role,
    c.slack,
    c.is_active,
    c.monthly_fee,
    c.granola_notes_folder,
    c.defacto_meeting,
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
  GROUP BY c.id, c.user_id, c.name, c.email, c.phone, c.session_count, c.notes, c.created_at, c.updated_at, c.company_name, c.role, c.slack, c.is_active, c.monthly_fee, c.granola_notes_folder, c.defacto_meeting
  ORDER BY next_session_date;
END;
$function$;

-- Fix get_clients_future
DROP FUNCTION IF EXISTS get_clients_future();

CREATE OR REPLACE FUNCTION get_clients_future()
RETURNS TABLE(
  client_id uuid,
  user_id uuid,
  client_name text,
  client_email text,
  phone text,
  session_count integer,
  notes text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  company_name text,
  role text,
  slack text,
  is_active boolean,
  monthly_fee numeric,
  granola_notes_folder text,
  defacto_meeting text,
  last_session_date timestamp with time zone, 
  next_session_date timestamp with time zone, 
  session_title text
)
LANGUAGE plpgsql SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    c.id,
    c.user_id,
    c.name,
    c.email,
    c.phone,
    c.session_count,
    c.notes,
    c.created_at,
    c.updated_at,
    c.company_name,
    c.role,
    c.slack,
    c.is_active,
    c.monthly_fee,
    c.granola_notes_folder,
    c.defacto_meeting,
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
  GROUP BY c.id, c.user_id, c.name, c.email, c.phone, c.session_count, c.notes, c.created_at, c.updated_at, c.company_name, c.role, c.slack, c.is_active, c.monthly_fee, c.granola_notes_folder, c.defacto_meeting
  ORDER BY next_session_date;
END;
$function$;