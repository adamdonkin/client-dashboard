

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."check_client_scheduling_status"("p_client_email" "text") RETURNS TABLE("client_name" "text", "last_session" "text", "next_session" "text", "status" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.name as client_name,
    COALESCE(TO_CHAR(MAX(ce.end_time) FILTER (WHERE ce.end_time < NOW()) AT TIME ZONE 'America/Los_Angeles', 'Mon DD, YYYY'), 'Never') as last_session,
    COALESCE(TO_CHAR(MIN(ce.start_time) FILTER (WHERE ce.start_time > NOW()) AT TIME ZONE 'America/Los_Angeles', 'Mon DD @ HH12:MI AM'), 'None scheduled') as next_session,
    CASE 
      WHEN MIN(ce.start_time) FILTER (WHERE ce.start_time > NOW()) IS NOT NULL THEN '✅ Scheduled'
      WHEN MAX(ce.end_time) FILTER (WHERE ce.end_time < NOW()) IS NULL THEN '🔴 New client - needs first session'
      WHEN NOW() - MAX(ce.end_time) FILTER (WHERE ce.end_time < NOW()) > INTERVAL '30 days' THEN '🔴 Needs scheduling - overdue'
      ELSE '🟡 Needs scheduling'
    END as status
  FROM clients c
  LEFT JOIN calendar_events ce ON ce.client_id = c.id
  WHERE LOWER(c.email) = LOWER(p_client_email)
  GROUP BY c.id, c.name;
END;
$$;


ALTER FUNCTION "public"."check_client_scheduling_status"("p_client_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_fresh_google_token"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_expires_at TIMESTAMPTZ;
  v_response http_response;
  v_url TEXT;
  v_payload TEXT;
  v_headers http_header[];
BEGIN
  -- Get current token expiration
  SELECT expires_at INTO v_expires_at
  FROM user_tokens
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No token found for user %', p_user_id;
  END IF;
  
  -- Check if token expires within 10 minutes
  IF v_expires_at < NOW() + INTERVAL '10 minutes' THEN
    -- Prepare the request
    v_url := 'https://bhiwuvjltwvdkhcnwkkt.supabase.co/functions/v1/refresh-google-token';
    v_payload := json_build_object('user_id', p_user_id)::text;
    v_headers := ARRAY[
      http_header('Content-Type', 'application/json'),
      http_header('Authorization', 'Bearer ' || current_setting('request.jwt.claims')::json->>'sub')
    ]::http_header[];
    
    -- Call the Edge Function to refresh
    v_response := http_post(v_url, v_payload, 'application/json');
    
    -- Check if refresh was successful (2xx status code)
    IF v_response.status < 200 OR v_response.status >= 300 THEN
      RAISE EXCEPTION 'Failed to refresh token. Status: %, Response: %', 
        v_response.status, v_response.content;
    END IF;
    
    RAISE NOTICE 'Token refreshed successfully for user %', p_user_id;
  ELSE
    RAISE NOTICE 'Token still valid until %', v_expires_at;
  END IF;
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."ensure_fresh_google_token"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_active_client_count"("p_user_id" "uuid") RETURNS TABLE("count" integer)
    LANGUAGE "sql"
    AS $$
  select count(*)
  from clients
  where user_id = p_user_id
    and is_active = true;
$$;


ALTER FUNCTION "public"."get_active_client_count"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_avg_sessions_per_month"() RETURNS numeric
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    three_months_ago TIMESTAMPTZ;
    total_sessions INTEGER;
    avg_per_month NUMERIC(4,1);
BEGIN
    three_months_ago := NOW() - INTERVAL '3 months';
    
    SELECT COUNT(*)
    INTO total_sessions
    FROM calendar_events ce
    WHERE ce.user_id = auth.uid()
        AND ce.start_time >= three_months_ago
        AND ce.start_time <= NOW()
        AND ce.client_id IS NOT NULL;
        
    avg_per_month := total_sessions::NUMERIC / 3.0;
    
    RETURN ROUND(avg_per_month, 1);
END;
$$;


ALTER FUNCTION "public"."get_avg_sessions_per_month"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_avg_sessions_per_week"() RETURNS numeric
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    twelve_weeks_ago TIMESTAMPTZ;
    total_sessions INTEGER;
    avg_per_week NUMERIC(4,1);
BEGIN
    twelve_weeks_ago := NOW() - INTERVAL '12 weeks';
    
    SELECT COUNT(*)
    INTO total_sessions
    FROM calendar_events ce
    WHERE ce.user_id = auth.uid()
        AND ce.start_time >= twelve_weeks_ago
        AND ce.start_time <= NOW()
        AND ce.client_id IS NOT NULL;
        
    avg_per_week := total_sessions::NUMERIC / 12.0;
    
    RETURN ROUND(avg_per_week, 1);
END;
$$;


ALTER FUNCTION "public"."get_avg_sessions_per_week"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_business_metrics"("p_user_id" "uuid") RETURNS TABLE("active_clients" integer, "sessions_this_week" integer, "avg_sessions_per_week" numeric, "mrr" numeric)
    LANGUAGE "sql"
    AS $$
  with
  -- Active clients
  active_clients_cte as (
    select count(*) as count
    from clients
    where user_id = p_user_id
      and is_active = true
  ),

  -- Sessions this week (Sunday–Saturday)
  this_week_sessions as (
    select count(*) as count
    from sessions
    where status = 'completed'
      and date >= date_trunc('week', timezone('America/Los_Angeles', now()))
      and date <  date_trunc('week', timezone('America/Los_Angeles', now())) + interval '7 days'
      and client_id in (
        select id from clients where user_id = p_user_id
      )
  ),

  -- Rolling 12-week session average
  past_12_weeks_sessions as (
    select count(*) / 12.0 as avg_per_week
    from sessions
    where status = 'completed'
      and date >= timezone('America/Los_Angeles', now()) - interval '12 weeks'
      and client_id in (
        select id from clients where user_id = p_user_id
      )
  ),

  -- Monthly recurring revenue (sum of fees from active clients)
  mrr_cte as (
    select coalesce(sum(monthly_fee), 0) as total
    from clients
    where user_id = p_user_id
      and is_active = true
  )

  select
    ac.count as active_clients,
    sw.count as sessions_this_week,
    round(p12.avg_per_week, 2) as avg_sessions_per_week,
    mrr.total as mrr
  from active_clients_cte ac,
       this_week_sessions sw,
       past_12_weeks_sessions p12,
       mrr_cte mrr;
$$;


ALTER FUNCTION "public"."get_business_metrics"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_client_emails"("p_user_id" "uuid") RETURNS "text"[]
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  client_emails TEXT[];
BEGIN
  SELECT ARRAY_AGG(LOWER(email))
  INTO client_emails
  FROM clients
  WHERE user_id = p_user_id
    AND email IS NOT NULL
    AND email != '';
  
  RETURN COALESCE(client_emails, ARRAY[]::TEXT[]);
END;
$$;


ALTER FUNCTION "public"."get_client_emails"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_clients_future"() RETURNS TABLE("client_id" "uuid", "client_name" "text", "client_email" "text", "company_name" "text", "slack" "text", "last_session_date" timestamp with time zone, "next_session_date" timestamp with time zone, "session_title" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_clients_future"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_clients_needing_scheduling"("p_user_id" "uuid") RETURNS TABLE("client_id" "uuid", "client_name" "text", "client_email" "text", "company" "text", "last_session_date" timestamp with time zone, "last_session_formatted" "text", "days_since_last_session" integer, "total_sessions_count" integer, "scheduling_priority" "text", "notes" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
RETURN QUERY
SELECT
c.id AS client_id,
c.name AS client_name,
c.email AS client_email,
c.company_name AS company,
(SELECT MAX(s.date) FROM sessions s WHERE s.client_id = c.id) AS last_session_date,
CASE 
    WHEN (SELECT MAX(s.date) FROM sessions s WHERE s.client_id = c.id) IS NULL THEN 'Never had session'
    ELSE TO_CHAR((SELECT MAX(s.date) FROM sessions s WHERE s.client_id = c.id) AT TIME ZONE 'America/Los_Angeles', 'Mon DD, YYYY')
END AS last_session_formatted,
COALESCE((EXTRACT(epoch FROM (NOW() - (SELECT MAX(s.date) FROM sessions s WHERE s.client_id = c.id))) / 86400)::integer, 999) AS days_since_last_session,
(SELECT COUNT(*) FROM sessions s WHERE s.client_id = c.id)::INTEGER AS total_sessions_count,
CASE 
    WHEN (SELECT MAX(s.date) FROM sessions s WHERE s.client_id = c.id) IS NULL THEN '🔴 New client - schedule first session'
    WHEN (EXTRACT(epoch FROM (NOW() - (SELECT MAX(s.date) FROM sessions s WHERE s.client_id = c.id))) / 86400)::integer > 30 THEN '🔴 High priority - ' || (EXTRACT(epoch FROM (NOW() - (SELECT MAX(s.date) FROM sessions s WHERE s.client_id = c.id))) / 86400)::integer || ' days'
    WHEN (EXTRACT(epoch FROM (NOW() - (SELECT MAX(s.date) FROM sessions s WHERE s.client_id = c.id))) / 86400)::integer > 14 THEN '🟡 Medium priority - ' || (EXTRACT(epoch FROM (NOW() - (SELECT MAX(s.date) FROM sessions s WHERE s.client_id = c.id))) / 86400)::integer || ' days'
    ELSE '🟢 Recent - ' || (EXTRACT(epoch FROM (NOW() - (SELECT MAX(s.date) FROM sessions s WHERE s.client_id = c.id))) / 86400)::integer || ' days ago'
END AS scheduling_priority,
c.notes
FROM
clients c
WHERE
c.user_id = p_user_id
AND c.is_active = true  -- Use the correct column name 'is_active'
AND c.id NOT IN (
SELECT ce.client_id
FROM calendar_events ce
WHERE ce.user_id = p_user_id AND ce.start_time > NOW() AND ce.client_id IS NOT NULL
)
ORDER BY
CASE 
    WHEN (SELECT MAX(s.date) FROM sessions s WHERE s.client_id = c.id) IS NULL THEN 0  -- New clients first
    ELSE (EXTRACT(epoch FROM (NOW() - (SELECT MAX(s.date) FROM sessions s WHERE s.client_id = c.id))) / 86400)::integer
END DESC;
END;
$$;


ALTER FUNCTION "public"."get_clients_needing_scheduling"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_clients_needs_scheduling"() RETURNS TABLE("client_id" "uuid", "client_name" "text", "client_email" "text", "company_name" "text", "slack" "text", "last_session_date" timestamp with time zone, "days_since_last_session" integer, "priority_level" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_clients_needs_scheduling"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_clients_this_week"() RETURNS TABLE("client_id" "uuid", "client_name" "text", "client_email" "text", "company_name" "text", "slack" "text", "last_session_date" timestamp with time zone, "next_session_date" timestamp with time zone, "session_title" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_clients_this_week"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_coaching_stats"() RETURNS TABLE("sessions_this_week" integer, "avg_sessions_per_week" numeric, "avg_sessions_per_month" numeric, "reschedule_cancel_rate" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH time_boundaries AS (
    SELECT 
      DATE_TRUNC('week', NOW() AT TIME ZONE 'America/Los_Angeles')::DATE as week_start,
      (DATE_TRUNC('week', NOW() AT TIME ZONE 'America/Los_Angeles') + INTERVAL '6 days')::DATE as week_end,
      (NOW() AT TIME ZONE 'America/Los_Angeles' - INTERVAL '12 weeks')::DATE as twelve_weeks_ago,
      (NOW() AT TIME ZONE 'America/Los_Angeles' - INTERVAL '12 months')::DATE as twelve_months_ago
  ),
  
  -- Sessions this week (Sunday to Saturday)
  this_week_sessions AS (
    SELECT COUNT(*) as count
    FROM calendar_events ce, time_boundaries tb
    WHERE ce.user_id = auth.uid()
      AND ce.client_id IS NOT NULL
      AND DATE(ce.start_time AT TIME ZONE 'America/Los_Angeles') >= tb.week_start
      AND DATE(ce.start_time AT TIME ZONE 'America/Los_Angeles') <= tb.week_end
  ),
  
  -- Weekly sessions for last 12 weeks
  weekly_sessions AS (
    SELECT 
      DATE_TRUNC('week', ce.start_time AT TIME ZONE 'America/Los_Angeles') as week,
      COUNT(*) as sessions_in_week
    FROM calendar_events ce, time_boundaries tb
    WHERE ce.user_id = auth.uid()
      AND ce.client_id IS NOT NULL
      AND ce.start_time AT TIME ZONE 'America/Los_Angeles' >= tb.twelve_weeks_ago
    GROUP BY DATE_TRUNC('week', ce.start_time AT TIME ZONE 'America/Los_Angeles')
  ),
  
  -- Monthly sessions for last 12 months
  monthly_sessions AS (
    SELECT 
      DATE_TRUNC('month', ce.start_time AT TIME ZONE 'America/Los_Angeles') as month,
      COUNT(*) as sessions_in_month
    FROM calendar_events ce, time_boundaries tb
    WHERE ce.user_id = auth.uid()
      AND ce.client_id IS NOT NULL
      AND ce.start_time AT TIME ZONE 'America/Los_Angeles' >= tb.twelve_months_ago
    GROUP BY DATE_TRUNC('month', ce.start_time AT TIME ZONE 'America/Los_Angeles')
  ),
  
  -- Reschedule/Cancel rate calculation
  session_status_stats AS (
    SELECT 
      COUNT(*) as total_sessions,
      COUNT(*) FILTER (WHERE s.status IN ('cancelled', 'rescheduled', 'no-show')) as disrupted_sessions
    FROM sessions s
    INNER JOIN clients c ON s.client_id = c.id
    WHERE c.user_id = auth.uid()
      AND s.date >= (NOW() - INTERVAL '6 months')::DATE  -- Last 6 months for rate calculation
  )
  
  SELECT 
    (SELECT count FROM this_week_sessions)::INTEGER as sessions_this_week,
    COALESCE(ROUND((SELECT AVG(sessions_in_week) FROM weekly_sessions), 1), 0) as avg_sessions_per_week,
    COALESCE(ROUND((SELECT AVG(sessions_in_month) FROM monthly_sessions), 1), 0) as avg_sessions_per_month,
    COALESCE(
      CASE 
        WHEN (SELECT total_sessions FROM session_status_stats) > 0 
        THEN ROUND(
          (SELECT disrupted_sessions FROM session_status_stats)::NUMERIC / 
          (SELECT total_sessions FROM session_status_stats) * 100, 1
        )
        ELSE 0
      END, 
      0
    ) as reschedule_cancel_rate;
END;
$$;


ALTER FUNCTION "public"."get_coaching_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_dashboard_stats"("p_user_id" "uuid") RETURNS TABLE("active_clients" bigint, "sessions_this_week" bigint, "mrr" numeric, "arr" numeric)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        -- Active clients
        COUNT(DISTINCT c.id) FILTER (WHERE c.is_active = true),
        
        -- Sessions this week (Sunday to Saturday)
        COUNT(DISTINCT ce.id) FILTER (
            WHERE ce.start_time >= DATE_TRUNC('week', CURRENT_DATE) 
            AND ce.start_time < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '7 days'
        ),
        
        -- MRR
        COALESCE(SUM(c.monthly_fee) FILTER (WHERE c.is_active = true), 0),
        
        -- ARR  
        COALESCE(SUM(c.monthly_fee) FILTER (WHERE c.is_active = true) * 12, 0)
        
    FROM clients c
    LEFT JOIN calendar_events ce ON c.id = ce.client_id AND ce.user_id = p_user_id
    WHERE c.user_id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."get_dashboard_stats"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_new_client_emails"("p_user_id" "uuid") RETURNS "text"[]
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  new_emails TEXT[];
BEGIN
  -- Get emails that are in clients table but not in sync status
  SELECT ARRAY_AGG(LOWER(c.email))
  INTO new_emails
  FROM clients c
  LEFT JOIN client_sync_status css 
    ON css.user_id = c.user_id 
    AND LOWER(css.client_email) = LOWER(c.email)
  WHERE c.user_id = p_user_id
    AND c.email IS NOT NULL
    AND c.email != ''
    AND css.id IS NULL;
  
  RETURN COALESCE(new_emails, ARRAY[]::TEXT[]);
END;
$$;


ALTER FUNCTION "public"."get_new_client_emails"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_reschedule_cancel_rate"() RETURNS numeric
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    total_scheduled INTEGER;
    cancelled_count INTEGER;
    rate_percentage NUMERIC(4,1);
BEGIN
    -- Count total sessions that were scheduled (including cancelled ones)
    -- This requires looking at sessions table for status tracking
    SELECT COUNT(*)
    INTO total_scheduled
    FROM sessions s
    JOIN clients c ON s.client_id = c.id
    WHERE c.user_id = auth.uid();
    
    -- Count cancelled/rescheduled sessions
    SELECT COUNT(*)
    INTO cancelled_count
    FROM sessions s
    JOIN clients c ON s.client_id = c.id
    WHERE c.user_id = auth.uid()
        AND s.status IN ('cancelled', 'rescheduled', 'no-show');
    
    -- Calculate percentage
    IF total_scheduled > 0 THEN
        rate_percentage := (cancelled_count::NUMERIC / total_scheduled::NUMERIC) * 100;
    ELSE
        rate_percentage := 0;
    END IF;
    
    RETURN ROUND(rate_percentage, 1);
END;
$$;


ALTER FUNCTION "public"."get_reschedule_cancel_rate"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_scheduling_dashboard"() RETURNS TABLE("total_clients" integer, "clients_with_upcoming_sessions" integer, "clients_needing_scheduling" integer, "new_clients_never_scheduled" integer, "high_priority_count" integer, "medium_priority_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_scheduling_dashboard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_sessions_by_client_id"("p_client_id" "uuid") RETURNS TABLE("session_id" "text", "session_date" timestamp with time zone, "session_notes" "text", "session_status" "text", "session_type" "text", "session_duration" integer, "calendar_title" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id::TEXT as session_id,
    s.date::TIMESTAMPTZ as session_date,
    COALESCE(s.notes, '') as session_notes,
    COALESCE(s.status, 'completed') as session_status,
    'Regular Session' as session_type,
    60 as session_duration,
    CASE 
      WHEN ce.title IS NOT NULL AND ce.title != '' THEN ce.title
      ELSE 'Coaching Session'
    END as calendar_title
  FROM sessions s
  LEFT JOIN calendar_events ce ON s.calendar_event_id = ce.calendar_event_id
  WHERE s.client_id = p_client_id
    AND s.status IN ('completed', 'scheduled')  -- Only show completed and scheduled sessions
    AND s.date <= CURRENT_DATE  -- Only show past sessions (not future scheduled ones)
  ORDER BY s.date DESC;
END;
$$;


ALTER FUNCTION "public"."get_sessions_by_client_id"("p_client_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_sessions_this_week"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    week_start TIMESTAMPTZ;
    week_end TIMESTAMPTZ;
    session_count INTEGER;
BEGIN
    -- Get current week boundaries (Sunday to Saturday) in Los Angeles timezone
    week_start := DATE_TRUNC('week', NOW() AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles';
    week_end := week_start + INTERVAL '6 days 23:59:59';
    
    SELECT COUNT(*)
    INTO session_count
    FROM calendar_events ce
    WHERE ce.user_id = auth.uid()
        AND ce.start_time >= week_start
        AND ce.start_time <= week_end
        AND ce.client_id IS NOT NULL;
        
    RETURN session_count;
END;
$$;


ALTER FUNCTION "public"."get_sessions_this_week"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_sessions_this_week_test"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    week_start TIMESTAMPTZ;
    week_end TIMESTAMPTZ;
    session_count INTEGER;
BEGIN
    week_start := DATE_TRUNC('week', NOW() AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles';
    week_end := week_start + INTERVAL '6 days 23:59:59';
    
    SELECT COUNT(*)
    INTO session_count
    FROM calendar_events ce
    WHERE ce.start_time >= week_start
        AND ce.start_time <= week_end
        AND ce.client_id IS NOT NULL;
        
    RETURN session_count;
END;
$$;


ALTER FUNCTION "public"."get_sessions_this_week_test"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_all_calendars"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  user_record RECORD;
  sync_result JSONB;
BEGIN
  -- Loop through all users who have tokens
  FOR user_record IN 
    SELECT DISTINCT user_id 
    FROM user_tokens 
    WHERE expires_at > NOW()
  LOOP
    BEGIN
      -- Call the Edge Function for each user
      SELECT content::jsonb INTO sync_result
      FROM http_post(
        'https://bhiwuvjltwvdkhcnwkkt.supabase.co/functions/v1/sync-google-calendar',
        json_build_object('user_id', user_record.user_id)::text,
        'application/json'
      );
      
      -- Log the result
      RAISE NOTICE 'Synced calendar for user %: %', 
        user_record.user_id, 
        sync_result->>'message';
        
    EXCEPTION WHEN OTHERS THEN
      -- Log errors but continue with other users
      RAISE WARNING 'Failed to sync calendar for user %: %', 
        user_record.user_id, 
        SQLERRM;
    END;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."sync_all_calendars"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."test_get_sessions_by_client_id"("p_client_id" "uuid") RETURNS TABLE("session_id" "text", "session_date" timestamp with time zone, "session_notes" "text", "session_status" "text", "session_type" "text", "session_duration" integer, "calendar_title" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id::TEXT as session_id,
    s.date::TIMESTAMPTZ as session_date,
    COALESCE(s.notes, '') as session_notes,
    COALESCE(s.status, 'completed') as session_status,
    'Regular Session' as session_type,
    60 as session_duration,
    COALESCE(ce.title, 'Coaching Session') as calendar_title
  FROM sessions s
  LEFT JOIN calendar_events ce ON s.calendar_event_id = ce.calendar_event_id
  WHERE s.client_id = p_client_id
  ORDER BY s.date DESC;
END;
$$;


ALTER FUNCTION "public"."test_get_sessions_by_client_id"("p_client_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."calendar_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "calendar_event_id" "text" NOT NULL,
    "title" "text",
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "calendar_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "attendees" "jsonb"
);


ALTER TABLE "public"."calendar_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_sync_status" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_email" "text" NOT NULL,
    "last_synced_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."client_sync_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "session_count" integer DEFAULT 0,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_name" "text",
    "role" "text",
    "slack" "text",
    "is_active" boolean DEFAULT true,
    "monthly_fee" numeric(10,2) DEFAULT 0
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "date" "date",
    "notes" "text",
    "client_id" "uuid",
    "calendar_event_id" "text",
    "status" "text" DEFAULT 'completed'::"text" NOT NULL
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "access_token" "text" NOT NULL,
    "refresh_token" "text" NOT NULL,
    "token_type" "text",
    "scope" "text",
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_tokens" OWNER TO "postgres";


ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_sync_status"
    ADD CONSTRAINT "client_sync_status_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_sync_status"
    ADD CONSTRAINT "client_sync_status_user_id_client_email_key" UNIQUE ("user_id", "client_email");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_calendar_event_id_key" UNIQUE ("calendar_event_id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "unique_event_per_user" UNIQUE ("user_id", "calendar_event_id");



ALTER TABLE ONLY "public"."user_tokens"
    ADD CONSTRAINT "user_tokens_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_clients_email" ON "public"."clients" USING "btree" ("email");



CREATE INDEX "idx_clients_user_id" ON "public"."clients" USING "btree" ("user_id");



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_tokens"
    ADD CONSTRAINT "user_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Allow read access to authenticated users" ON "public"."sessions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."clients" FOR SELECT USING (true);



CREATE POLICY "Users can create their own clients" ON "public"."clients" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own clients" ON "public"."clients" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can only access their own calendar events" ON "public"."calendar_events" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can only access their own clients" ON "public"."clients" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can only access their own sessions" ON "public"."sessions" USING ((EXISTS ( SELECT 1
   FROM "public"."clients"
  WHERE (("clients"."id" = "sessions"."client_id") AND ("clients"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can only access their own sync status" ON "public"."client_sync_status" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can only access their own tokens" ON "public"."user_tokens" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own clients" ON "public"."clients" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own clients" ON "public"."clients" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."calendar_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_sync_status" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_tokens" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































GRANT ALL ON FUNCTION "public"."bytea_to_text"("data" "bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."bytea_to_text"("data" "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."bytea_to_text"("data" "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bytea_to_text"("data" "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_client_scheduling_status"("p_client_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_client_scheduling_status"("p_client_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_client_scheduling_status"("p_client_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_fresh_google_token"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_fresh_google_token"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_fresh_google_token"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_active_client_count"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_active_client_count"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_active_client_count"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_avg_sessions_per_month"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_avg_sessions_per_month"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_avg_sessions_per_month"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_avg_sessions_per_week"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_avg_sessions_per_week"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_avg_sessions_per_week"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_business_metrics"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_business_metrics"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_business_metrics"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_client_emails"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_client_emails"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_client_emails"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_clients_future"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_clients_future"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_clients_future"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_clients_needing_scheduling"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_clients_needing_scheduling"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_clients_needing_scheduling"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_clients_needs_scheduling"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_clients_needs_scheduling"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_clients_needs_scheduling"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_clients_this_week"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_clients_this_week"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_clients_this_week"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_coaching_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_coaching_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_coaching_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_dashboard_stats"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_dashboard_stats"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_dashboard_stats"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_new_client_emails"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_new_client_emails"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_new_client_emails"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_reschedule_cancel_rate"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_reschedule_cancel_rate"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_reschedule_cancel_rate"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_scheduling_dashboard"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_scheduling_dashboard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_scheduling_dashboard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_sessions_by_client_id"("p_client_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_sessions_by_client_id"("p_client_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_sessions_by_client_id"("p_client_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_sessions_this_week"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_sessions_this_week"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_sessions_this_week"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_sessions_this_week_test"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_sessions_this_week_test"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_sessions_this_week_test"() TO "service_role";



GRANT ALL ON FUNCTION "public"."http"("request" "public"."http_request") TO "postgres";
GRANT ALL ON FUNCTION "public"."http"("request" "public"."http_request") TO "anon";
GRANT ALL ON FUNCTION "public"."http"("request" "public"."http_request") TO "authenticated";
GRANT ALL ON FUNCTION "public"."http"("request" "public"."http_request") TO "service_role";



GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying, "content" character varying, "content_type" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying, "content" character varying, "content_type" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying, "content" character varying, "content_type" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying, "content" character varying, "content_type" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying, "data" "jsonb") TO "postgres";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying, "data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying, "data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying, "data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."http_head"("uri" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_head"("uri" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_head"("uri" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_head"("uri" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_header"("field" character varying, "value" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_header"("field" character varying, "value" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_header"("field" character varying, "value" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_header"("field" character varying, "value" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_list_curlopt"() TO "postgres";
GRANT ALL ON FUNCTION "public"."http_list_curlopt"() TO "anon";
GRANT ALL ON FUNCTION "public"."http_list_curlopt"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_list_curlopt"() TO "service_role";



GRANT ALL ON FUNCTION "public"."http_patch"("uri" character varying, "content" character varying, "content_type" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_patch"("uri" character varying, "content" character varying, "content_type" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_patch"("uri" character varying, "content" character varying, "content_type" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_patch"("uri" character varying, "content" character varying, "content_type" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "data" "jsonb") TO "postgres";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "content" character varying, "content_type" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "content" character varying, "content_type" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "content" character varying, "content_type" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "content" character varying, "content_type" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_put"("uri" character varying, "content" character varying, "content_type" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_put"("uri" character varying, "content" character varying, "content_type" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_put"("uri" character varying, "content" character varying, "content_type" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_put"("uri" character varying, "content" character varying, "content_type" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_reset_curlopt"() TO "postgres";
GRANT ALL ON FUNCTION "public"."http_reset_curlopt"() TO "anon";
GRANT ALL ON FUNCTION "public"."http_reset_curlopt"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_reset_curlopt"() TO "service_role";



GRANT ALL ON FUNCTION "public"."http_set_curlopt"("curlopt" character varying, "value" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_set_curlopt"("curlopt" character varying, "value" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_set_curlopt"("curlopt" character varying, "value" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_set_curlopt"("curlopt" character varying, "value" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_all_calendars"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_all_calendars"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_all_calendars"() TO "service_role";



GRANT ALL ON FUNCTION "public"."test_get_sessions_by_client_id"("p_client_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."test_get_sessions_by_client_id"("p_client_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."test_get_sessions_by_client_id"("p_client_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."text_to_bytea"("data" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."text_to_bytea"("data" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."text_to_bytea"("data" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."text_to_bytea"("data" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."urlencode"("string" "bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."urlencode"("string" "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."urlencode"("string" "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."urlencode"("string" "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."urlencode"("data" "jsonb") TO "postgres";
GRANT ALL ON FUNCTION "public"."urlencode"("data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."urlencode"("data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."urlencode"("data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."urlencode"("string" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."urlencode"("string" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."urlencode"("string" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."urlencode"("string" character varying) TO "service_role";
























GRANT ALL ON TABLE "public"."calendar_events" TO "anon";
GRANT ALL ON TABLE "public"."calendar_events" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_events" TO "service_role";



GRANT ALL ON TABLE "public"."client_sync_status" TO "anon";
GRANT ALL ON TABLE "public"."client_sync_status" TO "authenticated";
GRANT ALL ON TABLE "public"."client_sync_status" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";



GRANT ALL ON TABLE "public"."user_tokens" TO "anon";
GRANT ALL ON TABLE "public"."user_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."user_tokens" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
