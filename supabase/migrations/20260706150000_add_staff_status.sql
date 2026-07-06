-- Add 'staff' to client_status enum and exclude staff from dashboard/metrics RPCs

BEGIN;

-- ============================================================
-- 1. Add 'staff' to client_status enum
-- ============================================================
ALTER TYPE client_status ADD VALUE IF NOT EXISTS 'staff';

COMMIT;

-- Enum changes require their own transaction before use, so start a new one
BEGIN;

-- ============================================================
-- 2. Dashboard RPCs — exclude staff
-- ============================================================

-- ----- get_clients_this_week_fixed -----
DROP FUNCTION IF EXISTS get_clients_this_week_fixed();
CREATE OR REPLACE FUNCTION get_clients_this_week_fixed()
RETURNS TABLE(
  client_id uuid,
  user_id uuid,
  client_name text,
  client_email text,
  phone text,
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
  last_session_event_id uuid,
  next_session_date timestamp with time zone,
  next_session_event_id uuid,
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
       AND past_ce.user_id = c.user_id
       AND past_ce.start_time <= NOW()
       AND (past_ce.status IS NULL OR past_ce.status != 'cancelled')) as last_session_date,
    (SELECT past_ce.id
     FROM calendar_events past_ce
     WHERE past_ce.client_id = c.id
       AND past_ce.user_id = c.user_id
       AND past_ce.start_time <= NOW()
       AND (past_ce.status IS NULL OR past_ce.status != 'cancelled')
     ORDER BY past_ce.start_time DESC
     LIMIT 1) as last_session_event_id,
    MIN(ce.start_time) as next_session_date,
    (SELECT next_ce.id
     FROM calendar_events next_ce
     WHERE next_ce.client_id = c.id
       AND next_ce.user_id = c.user_id
       AND next_ce.start_time > NOW()
       AND next_ce.start_time <= (DATE_TRUNC('week', NOW() AT TIME ZONE 'America/Los_Angeles') + INTERVAL '6 days 23:59:59')::TIMESTAMPTZ
       AND (next_ce.status IS NULL OR next_ce.status != 'cancelled')
     ORDER BY next_ce.start_time ASC
     LIMIT 1) as next_session_event_id,
    MIN(ce.title) as session_title
  FROM clients c
  INNER JOIN calendar_events ce ON c.id = ce.client_id
  WHERE c.user_id IN (SELECT accessible_user_ids())
    AND ce.user_id = c.user_id
    AND (c.status IS NULL OR c.status != 'staff')
    AND ce.start_time > NOW()
    AND ce.start_time <= (DATE_TRUNC('week', NOW() AT TIME ZONE 'America/Los_Angeles') + INTERVAL '6 days 23:59:59')::TIMESTAMPTZ
    AND (ce.status IS NULL OR ce.status != 'cancelled')
  GROUP BY c.id, c.user_id, c.name, c.email, c.phone, c.notes, c.created_at, c.updated_at, c.company_name, c.role, c.slack, c.is_active, c.monthly_fee, c.granola_notes_folder, c.defacto_meeting
  ORDER BY next_session_date;
END;
$function$;

-- ----- get_clients_future -----
DROP FUNCTION IF EXISTS get_clients_future();
CREATE OR REPLACE FUNCTION get_clients_future()
RETURNS TABLE(
  client_id uuid,
  user_id uuid,
  client_name text,
  client_email text,
  phone text,
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
  last_session_event_id uuid,
  next_session_date timestamp with time zone,
  next_session_event_id uuid,
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
       AND past_ce.user_id = c.user_id
       AND past_ce.start_time <= NOW()
       AND (past_ce.status IS NULL OR past_ce.status != 'cancelled')) as last_session_date,
    (SELECT past_ce.id
     FROM calendar_events past_ce
     WHERE past_ce.client_id = c.id
       AND past_ce.user_id = c.user_id
       AND past_ce.start_time <= NOW()
       AND (past_ce.status IS NULL OR past_ce.status != 'cancelled')
     ORDER BY past_ce.start_time DESC
     LIMIT 1) as last_session_event_id,
    MIN(ce.start_time) as next_session_date,
    (SELECT next_ce.id
     FROM calendar_events next_ce
     WHERE next_ce.client_id = c.id
       AND next_ce.user_id = c.user_id
       AND next_ce.start_time > (DATE_TRUNC('week', NOW() AT TIME ZONE 'America/Los_Angeles') + INTERVAL '6 days 23:59:59')::TIMESTAMPTZ
       AND (next_ce.status IS NULL OR next_ce.status != 'cancelled')
     ORDER BY next_ce.start_time ASC
     LIMIT 1) as next_session_event_id,
    MIN(ce.title) as session_title
  FROM clients c
  INNER JOIN calendar_events ce ON c.id = ce.client_id
  WHERE c.user_id IN (SELECT accessible_user_ids())
    AND ce.user_id = c.user_id
    AND (c.status IS NULL OR c.status != 'staff')
    AND ce.start_time > (DATE_TRUNC('week', NOW() AT TIME ZONE 'America/Los_Angeles') + INTERVAL '6 days 23:59:59')::TIMESTAMPTZ
    AND (ce.status IS NULL OR ce.status != 'cancelled')
  GROUP BY c.id, c.user_id, c.name, c.email, c.phone, c.notes, c.created_at, c.updated_at, c.company_name, c.role, c.slack, c.is_active, c.monthly_fee, c.granola_notes_folder, c.defacto_meeting
  ORDER BY next_session_date;
END;
$function$;

-- ----- get_clients_needs_scheduling (already excludes staff via status IN filter, but make explicit) -----
DROP FUNCTION IF EXISTS get_clients_needs_scheduling();
CREATE OR REPLACE FUNCTION get_clients_needs_scheduling()
RETURNS TABLE(
  client_id uuid,
  user_id uuid,
  client_name text,
  client_email text,
  phone text,
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
  last_session_event_id uuid,
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
    (SELECT past_ce.id
     FROM calendar_events past_ce
     WHERE past_ce.client_id = c.id
       AND past_ce.user_id = c.user_id
       AND past_ce.start_time <= NOW()
       AND (past_ce.status IS NULL OR past_ce.status != 'cancelled')
     ORDER BY past_ce.start_time DESC
     LIMIT 1) as last_session_event_id,
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
    AND ce.user_id = c.user_id
    AND ce.start_time <= NOW()
    AND (ce.status IS NULL OR ce.status != 'cancelled')
  WHERE c.user_id IN (SELECT accessible_user_ids())
    AND (c.status IS NULL OR c.status != 'staff')
    AND (
      c.status = 'active'
      OR (c.status IS NULL AND (c.is_active IS NULL OR c.is_active = true))
    )
    AND NOT EXISTS (
      SELECT 1 FROM calendar_events future_ce
      WHERE future_ce.client_id = c.id
        AND future_ce.user_id = c.user_id
        AND future_ce.start_time > NOW()
        AND (future_ce.status IS NULL OR future_ce.status != 'cancelled')
    )
  GROUP BY c.id, c.user_id, c.name, c.email, c.phone, c.notes, c.created_at, c.updated_at, c.company_name, c.role, c.slack, c.is_active, c.monthly_fee, c.granola_notes_folder, c.defacto_meeting
  ORDER BY days_since_last_session DESC;
END;
$function$;

-- ----- get_scheduling_dashboard -----
DROP FUNCTION IF EXISTS get_scheduling_dashboard();
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
    WHERE c.user_id IN (SELECT accessible_user_ids())
      AND (c.status IS NULL OR c.status != 'staff')
      AND (c.is_active IS NULL OR c.is_active = true)
  ),
  client_stats AS (
    SELECT
      ac.id,
      ac.name,
      ac.user_id,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM calendar_events ce
          WHERE ce.client_id = ac.id
            AND ce.user_id = ac.user_id
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
      AND ce.user_id = ac.user_id
      AND ce.start_time <= NOW()
    GROUP BY ac.id, ac.name, ac.user_id
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

-- ============================================================
-- 3. Metrics RPCs — exclude staff via client join
-- ============================================================

-- ----- get_sessions_this_week -----
CREATE OR REPLACE FUNCTION get_sessions_this_week()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
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
    JOIN clients c ON c.id = ce.client_id
    WHERE ce.user_id IN (SELECT accessible_user_ids())
        AND ce.start_time >= week_start
        AND ce.start_time <= week_end
        AND ce.start_time <= NOW()
        AND ce.client_id IS NOT NULL
        AND (ce.status IS NULL OR ce.status != 'cancelled')
        AND (c.status IS NULL OR c.status != 'staff');

    RETURN session_count;
END;
$$;

-- ----- get_scheduled_sessions_this_week -----
CREATE OR REPLACE FUNCTION get_scheduled_sessions_this_week()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
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
    JOIN clients c ON c.id = ce.client_id
    WHERE ce.user_id IN (SELECT accessible_user_ids())
        AND ce.start_time >= week_start
        AND ce.start_time <= week_end
        AND ce.client_id IS NOT NULL
        AND (ce.status IS NULL OR ce.status != 'cancelled')
        AND (c.status IS NULL OR c.status != 'staff');

    RETURN session_count;
END;
$$;

-- ----- get_sessions_this_month -----
CREATE OR REPLACE FUNCTION get_sessions_this_month()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    month_start TIMESTAMPTZ;
    session_count INTEGER;
BEGIN
    month_start := DATE_TRUNC('month', NOW() AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles';

    SELECT COUNT(*)
    INTO session_count
    FROM calendar_events ce
    JOIN clients c ON c.id = ce.client_id
    WHERE ce.user_id IN (SELECT accessible_user_ids())
        AND ce.client_id IS NOT NULL
        AND ce.start_time >= month_start
        AND ce.start_time <= NOW()
        AND (ce.status IS NULL OR ce.status != 'cancelled')
        AND (c.status IS NULL OR c.status != 'staff');

    RETURN session_count;
END;
$$;

-- ----- get_total_sessions_this_year -----
CREATE OR REPLACE FUNCTION get_total_sessions_this_year()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    year_start TIMESTAMPTZ;
    session_count INTEGER;
BEGIN
    year_start := DATE_TRUNC('year', NOW() AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles';

    SELECT COUNT(*)
    INTO session_count
    FROM calendar_events ce
    JOIN clients c ON c.id = ce.client_id
    WHERE ce.user_id IN (SELECT accessible_user_ids())
        AND ce.client_id IS NOT NULL
        AND ce.start_time >= year_start
        AND ce.start_time <= NOW()
        AND (ce.status IS NULL OR ce.status != 'cancelled')
        AND (c.status IS NULL OR c.status != 'staff');

    RETURN session_count;
END;
$$;

-- ----- get_avg_sessions_per_week -----
CREATE OR REPLACE FUNCTION get_avg_sessions_per_week()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
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
    JOIN clients c ON c.id = ce.client_id
    WHERE ce.user_id IN (SELECT accessible_user_ids())
        AND ce.start_time >= twelve_weeks_ago
        AND ce.start_time <= NOW()
        AND ce.client_id IS NOT NULL
        AND (ce.status IS NULL OR ce.status != 'cancelled')
        AND (c.status IS NULL OR c.status != 'staff');

    avg_per_week := total_sessions::NUMERIC / 12.0;

    RETURN ROUND(avg_per_week, 1);
END;
$$;

-- ----- get_avg_sessions_per_month -----
CREATE OR REPLACE FUNCTION get_avg_sessions_per_month()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
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
    JOIN clients c ON c.id = ce.client_id
    WHERE ce.user_id IN (SELECT accessible_user_ids())
        AND ce.start_time >= three_months_ago
        AND ce.start_time <= NOW()
        AND ce.client_id IS NOT NULL
        AND (ce.status IS NULL OR ce.status != 'cancelled')
        AND (c.status IS NULL OR c.status != 'staff');

    avg_per_month := total_sessions::NUMERIC / 3.0;

    RETURN ROUND(avg_per_month, 1);
END;
$$;

-- ----- get_avg_engagement_length -----
CREATE OR REPLACE FUNCTION get_avg_engagement_length()
RETURNS NUMERIC(4,1)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    avg_months NUMERIC(4,1);
BEGIN
    SELECT COALESCE(
        AVG(
            EXTRACT(EPOCH FROM (last_session - first_session)) / (30.44 * 24 * 60 * 60)
        ),
        0
    )
    INTO avg_months
    FROM (
        SELECT
            c.id as client_id,
            MIN(ce.start_time) as first_session,
            MAX(ce.start_time) as last_session
        FROM clients c
        JOIN calendar_events ce ON c.id = ce.client_id
        WHERE c.user_id IN (SELECT accessible_user_ids())
            AND ce.user_id = c.user_id
            AND (ce.status IS NULL OR ce.status != 'cancelled')
            AND (c.status IS NULL OR c.status != 'staff')
        GROUP BY c.id
        HAVING COUNT(ce.id) >= 2
    ) client_sessions;

    RETURN ROUND(avg_months, 1);
END;
$$;

-- ----- get_reschedule_cancel_rate -----
DROP FUNCTION IF EXISTS get_reschedule_cancel_rate();
CREATE OR REPLACE FUNCTION get_reschedule_cancel_rate()
RETURNS NUMERIC(4,1)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    twelve_weeks_ago TIMESTAMPTZ;
    total_sessions INTEGER;
    cancelled_count INTEGER;
    rate_percentage NUMERIC(4,1);
BEGIN
    twelve_weeks_ago := NOW() - INTERVAL '12 weeks';

    SELECT COUNT(*)
    INTO total_sessions
    FROM clients c
    JOIN calendar_events ce ON c.id = ce.client_id
    WHERE c.user_id IN (SELECT accessible_user_ids())
        AND ce.user_id = c.user_id
        AND ce.start_time >= twelve_weeks_ago
        AND ce.start_time <= NOW()
        AND (c.status IS NULL OR c.status != 'staff');

    SELECT COUNT(*)
    INTO cancelled_count
    FROM clients c
    JOIN calendar_events ce ON c.id = ce.client_id
    WHERE c.user_id IN (SELECT accessible_user_ids())
        AND ce.user_id = c.user_id
        AND ce.start_time >= twelve_weeks_ago
        AND ce.start_time <= NOW()
        AND (c.status IS NULL OR c.status != 'staff')
        AND (
            LOWER(ce.title) LIKE '%cancel%' OR
            LOWER(ce.title) LIKE '%reschedule%' OR
            LOWER(ce.title) LIKE '%postpone%' OR
            LOWER(ce.title) LIKE '%no show%' OR
            LOWER(ce.title) LIKE '%rescheduled%' OR
            EXTRACT(EPOCH FROM (ce.end_time - ce.start_time)) / 60 < 15
        );

    IF total_sessions > 0 THEN
        rate_percentage := (cancelled_count::NUMERIC / total_sessions::NUMERIC) * 100;
    ELSE
        rate_percentage := 0;
    END IF;

    RETURN ROUND(rate_percentage, 1);
END;
$$;

-- Revenue stats already exclude staff (they filter on status = 'active'/'pending')
-- No changes needed for get_revenue_stats or get_revenue_stats_mochary_method

NOTIFY pgrst, 'reload schema';

COMMIT;
