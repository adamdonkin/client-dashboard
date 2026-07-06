-- Team access: multi-user support for coaching dashboard
-- Allows an owner (Adam) to grant team members (EA, etc.) read or read/write access

BEGIN;

-- ============================================================
-- 1. team_access table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.team_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  member_id uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(owner_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_team_access_member ON public.team_access(member_id);
CREATE INDEX IF NOT EXISTS idx_team_access_owner ON public.team_access(owner_id);

ALTER TABLE public.team_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their team"
  ON public.team_access FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Members can view their own access"
  ON public.team_access FOR SELECT
  USING (member_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_access TO authenticated;

-- ============================================================
-- 2. Helper functions
-- ============================================================

-- Returns all user_ids whose data the current user can access
CREATE OR REPLACE FUNCTION public.accessible_user_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT auth.uid()
  UNION
  SELECT owner_id FROM public.team_access WHERE member_id = auth.uid()
$$;

-- Returns true if the current user can write data owned by data_owner_id
CREATE OR REPLACE FUNCTION public.can_write_user_data(data_owner_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT data_owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.team_access
      WHERE owner_id = data_owner_id
        AND member_id = auth.uid()
        AND role = 'editor'
    )
$$;

-- ============================================================
-- 3. Updated RLS policies
-- ============================================================

-- ----- clients -----
DROP POLICY IF EXISTS "Users can only access their own clients" ON clients;
DROP POLICY IF EXISTS "Users can view their own clients" ON clients;
DROP POLICY IF EXISTS "Users can create their own clients" ON clients;
DROP POLICY IF EXISTS "Users can update their own clients" ON clients;
DROP POLICY IF EXISTS "Users can delete their own clients" ON clients;

CREATE POLICY "Team can view clients" ON clients
  FOR SELECT USING (user_id IN (SELECT accessible_user_ids()));
CREATE POLICY "Writers can insert clients" ON clients
  FOR INSERT WITH CHECK (can_write_user_data(user_id));
CREATE POLICY "Writers can update clients" ON clients
  FOR UPDATE USING (can_write_user_data(user_id));
CREATE POLICY "Writers can delete clients" ON clients
  FOR DELETE USING (can_write_user_data(user_id));

-- ----- sessions -----
DROP POLICY IF EXISTS "Users can only access their own sessions" ON sessions;

CREATE POLICY "Team can view sessions" ON sessions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM clients WHERE clients.id = sessions.client_id
            AND clients.user_id IN (SELECT accessible_user_ids()))
  );
CREATE POLICY "Writers can insert sessions" ON sessions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM clients WHERE clients.id = sessions.client_id
            AND can_write_user_data(clients.user_id))
  );
CREATE POLICY "Writers can update sessions" ON sessions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM clients WHERE clients.id = sessions.client_id
            AND can_write_user_data(clients.user_id))
  );
CREATE POLICY "Writers can delete sessions" ON sessions
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM clients WHERE clients.id = sessions.client_id
            AND can_write_user_data(clients.user_id))
  );

-- ----- calendar_events -----
DROP POLICY IF EXISTS "Users can only access their own calendar events" ON calendar_events;

CREATE POLICY "Team can view calendar events" ON calendar_events
  FOR SELECT USING (user_id IN (SELECT accessible_user_ids()));
CREATE POLICY "Writers can insert calendar events" ON calendar_events
  FOR INSERT WITH CHECK (can_write_user_data(user_id));
CREATE POLICY "Writers can update calendar events" ON calendar_events
  FOR UPDATE USING (can_write_user_data(user_id));
CREATE POLICY "Writers can delete calendar events" ON calendar_events
  FOR DELETE USING (can_write_user_data(user_id));

-- ----- session_notes -----
DROP POLICY IF EXISTS "Users can manage their own session notes" ON session_notes;

CREATE POLICY "Team can view session notes" ON session_notes
  FOR SELECT USING (user_id IN (SELECT accessible_user_ids()));
CREATE POLICY "Writers can insert session notes" ON session_notes
  FOR INSERT WITH CHECK (can_write_user_data(user_id));
CREATE POLICY "Writers can update session notes" ON session_notes
  FOR UPDATE USING (can_write_user_data(user_id));
CREATE POLICY "Writers can delete session notes" ON session_notes
  FOR DELETE USING (can_write_user_data(user_id));

-- ----- session_topics -----
DROP POLICY IF EXISTS "Users can manage session topics via session notes" ON session_topics;

CREATE POLICY "Team can view session topics" ON session_topics
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM session_notes sn WHERE sn.id = session_topics.session_note_id
            AND sn.user_id IN (SELECT accessible_user_ids()))
  );
CREATE POLICY "Writers can insert session topics" ON session_topics
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM session_notes sn WHERE sn.id = session_topics.session_note_id
            AND can_write_user_data(sn.user_id))
  );
CREATE POLICY "Writers can update session topics" ON session_topics
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM session_notes sn WHERE sn.id = session_topics.session_note_id
            AND can_write_user_data(sn.user_id))
  );
CREATE POLICY "Writers can delete session topics" ON session_topics
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM session_notes sn WHERE sn.id = session_topics.session_note_id
            AND can_write_user_data(sn.user_id))
  );

-- ----- client_actions -----
DROP POLICY IF EXISTS "Users can only access their own actions" ON client_actions;

CREATE POLICY "Team can view actions" ON client_actions
  FOR SELECT USING (user_id IN (SELECT accessible_user_ids()));
CREATE POLICY "Writers can insert actions" ON client_actions
  FOR INSERT WITH CHECK (can_write_user_data(user_id));
CREATE POLICY "Writers can update actions" ON client_actions
  FOR UPDATE USING (can_write_user_data(user_id));
CREATE POLICY "Writers can delete actions" ON client_actions
  FOR DELETE USING (can_write_user_data(user_id));

-- ----- meeting_notes -----
DROP POLICY IF EXISTS "Users can only access their own meeting notes" ON meeting_notes;

CREATE POLICY "Team can view meeting notes" ON meeting_notes
  FOR SELECT USING (user_id IN (SELECT accessible_user_ids()));
CREATE POLICY "Writers can insert meeting notes" ON meeting_notes
  FOR INSERT WITH CHECK (can_write_user_data(user_id));
CREATE POLICY "Writers can update meeting notes" ON meeting_notes
  FOR UPDATE USING (can_write_user_data(user_id));
CREATE POLICY "Writers can delete meeting notes" ON meeting_notes
  FOR DELETE USING (can_write_user_data(user_id));

-- ----- transcripts -----
DROP POLICY IF EXISTS "Users can only access their own transcripts" ON transcripts;

CREATE POLICY "Team can view transcripts" ON transcripts
  FOR SELECT USING (user_id IN (SELECT accessible_user_ids()));
CREATE POLICY "Writers can insert transcripts" ON transcripts
  FOR INSERT WITH CHECK (can_write_user_data(user_id));
CREATE POLICY "Writers can update transcripts" ON transcripts
  FOR UPDATE USING (can_write_user_data(user_id));
CREATE POLICY "Writers can delete transcripts" ON transcripts
  FOR DELETE USING (can_write_user_data(user_id));

-- user_tokens, client_sync_status, zoom_sync_log, out_of_office_periods
-- remain owner-only (sensitive or internal)

-- ============================================================
-- 4. Updated RPC functions
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
    AND ce.start_time > (DATE_TRUNC('week', NOW() AT TIME ZONE 'America/Los_Angeles') + INTERVAL '6 days 23:59:59')::TIMESTAMPTZ
    AND (ce.status IS NULL OR ce.status != 'cancelled')
  GROUP BY c.id, c.user_id, c.name, c.email, c.phone, c.notes, c.created_at, c.updated_at, c.company_name, c.role, c.slack, c.is_active, c.monthly_fee, c.granola_notes_folder, c.defacto_meeting
  ORDER BY next_session_date;
END;
$function$;

-- ----- get_clients_needs_scheduling -----
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

-- ----- get_sessions_by_client_id -----
DROP FUNCTION IF EXISTS get_sessions_by_client_id(uuid);
CREATE OR REPLACE FUNCTION get_sessions_by_client_id(p_client_id UUID)
RETURNS TABLE(
  session_id TEXT,
  session_date TIMESTAMPTZ,
  session_notes TEXT,
  session_status TEXT,
  session_type TEXT,
  session_duration INTEGER,
  calendar_title TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sn.id::TEXT as session_id,
    COALESCE(ce.start_time, sn.session_date) as session_date,
    ''::TEXT as session_notes,
    CASE
      WHEN COALESCE(ce.start_time, sn.session_date) > NOW() THEN 'scheduled'
      ELSE 'completed'
    END as session_status,
    CASE
      WHEN sn.calendar_event_id IS NULL THEN 'Ad-hoc Session'
      ELSE 'Coaching Session'
    END as session_type,
    CASE
      WHEN ce.id IS NOT NULL THEN EXTRACT(EPOCH FROM (ce.end_time - ce.start_time))::INTEGER / 60
      ELSE 60
    END as session_duration,
    CASE
      WHEN ce.id IS NOT NULL THEN COALESCE(ce.title, 'Coaching Session')
      ELSE 'Ad-hoc Session'
    END as calendar_title
  FROM session_notes sn
  LEFT JOIN calendar_events ce ON ce.id = sn.calendar_event_id::uuid
  WHERE sn.client_id = p_client_id
    AND sn.user_id IN (SELECT accessible_user_ids())
    AND COALESCE(ce.start_time, sn.session_date) <= NOW()
    AND (ce.id IS NULL OR ce.status IS NULL OR ce.status != 'cancelled')
  ORDER BY COALESCE(ce.start_time, sn.session_date) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_sessions_by_client_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sessions_by_client_id(uuid) TO anon;
GRANT EXECUTE ON FUNCTION get_sessions_by_client_id(uuid) TO service_role;

-- ----- get_revenue_stats -----
DROP FUNCTION IF EXISTS get_revenue_stats();
CREATE OR REPLACE FUNCTION get_revenue_stats()
RETURNS TABLE (
  total_monthly_revenue numeric,
  annual_projection numeric,
  active_paying_clients bigint,
  average_client_fee numeric,
  pending_monthly_revenue numeric,
  pending_clients bigint,
  capacity_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(c.monthly_fee) FILTER (
      WHERE c.status = 'active' OR (c.status IS NULL AND (c.is_active IS NULL OR c.is_active = true))
    ), 0) as total_monthly_revenue,
    COALESCE(SUM(c.monthly_fee * 12) FILTER (
      WHERE c.status = 'active' OR (c.status IS NULL AND (c.is_active IS NULL OR c.is_active = true))
    ), 0) as annual_projection,
    COUNT(*) FILTER (
      WHERE c.status = 'active' OR (c.status IS NULL AND (c.is_active IS NULL OR c.is_active = true))
    ) as active_paying_clients,
    COALESCE(AVG(c.monthly_fee) FILTER (
      WHERE c.status = 'active' OR (c.status IS NULL AND (c.is_active IS NULL OR c.is_active = true))
    ), 0) as average_client_fee,
    COALESCE(SUM(c.monthly_fee) FILTER (WHERE c.status = 'pending'), 0) as pending_monthly_revenue,
    COUNT(*) FILTER (WHERE c.status = 'pending') as pending_clients,
    COUNT(*) FILTER (
      WHERE c.status IN ('active', 'pending')
      OR (c.status IS NULL AND (c.is_active IS NULL OR c.is_active = true))
    ) as capacity_count
  FROM clients c
  WHERE c.user_id IN (SELECT accessible_user_ids());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----- get_revenue_stats_mochary_method -----
DROP FUNCTION IF EXISTS get_revenue_stats_mochary_method();
CREATE OR REPLACE FUNCTION get_revenue_stats_mochary_method()
RETURNS TABLE (
  total_monthly_revenue numeric,
  annual_projection numeric,
  active_paying_clients bigint,
  average_client_fee numeric,
  pending_monthly_revenue numeric,
  pending_clients bigint,
  capacity_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(c.monthly_fee) FILTER (
      WHERE c.status = 'active' OR (c.status IS NULL AND (c.is_active IS NULL OR c.is_active = true))
    ), 0) as total_monthly_revenue,
    COALESCE(SUM(c.monthly_fee * 12) FILTER (
      WHERE c.status = 'active' OR (c.status IS NULL AND (c.is_active IS NULL OR c.is_active = true))
    ), 0) as annual_projection,
    COUNT(*) FILTER (
      WHERE c.status = 'active' OR (c.status IS NULL AND (c.is_active IS NULL OR c.is_active = true))
    ) as active_paying_clients,
    COALESCE(AVG(c.monthly_fee) FILTER (
      WHERE c.status = 'active' OR (c.status IS NULL AND (c.is_active IS NULL OR c.is_active = true))
    ), 0) as average_client_fee,
    COALESCE(SUM(c.monthly_fee) FILTER (WHERE c.status = 'pending'), 0) as pending_monthly_revenue,
    COUNT(*) FILTER (WHERE c.status = 'pending') as pending_clients,
    COUNT(*) FILTER (
      WHERE c.status IN ('active', 'pending')
      OR (c.status IS NULL AND (c.is_active IS NULL OR c.is_active = true))
    ) as capacity_count
  FROM clients c
  WHERE c.user_id IN (SELECT accessible_user_ids())
    AND c.referral_source::text = 'Mochary Method';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----- get_waitlist_clients -----
DROP FUNCTION IF EXISTS get_waitlist_clients();
CREATE OR REPLACE FUNCTION get_waitlist_clients()
RETURNS TABLE(
  id uuid,
  name text,
  email text,
  company_name text,
  role text,
  notes text,
  monthly_fee numeric,
  created_at timestamp with time zone
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.email,
    c.company_name,
    c.role,
    c.notes,
    c.monthly_fee,
    c.created_at
  FROM clients c
  WHERE c.user_id IN (SELECT accessible_user_ids())
    AND c.status = 'waiting'
  ORDER BY c.created_at ASC;
END;
$$;

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
    WHERE ce.user_id IN (SELECT accessible_user_ids())
        AND ce.start_time >= week_start
        AND ce.start_time <= week_end
        AND ce.start_time <= NOW()
        AND ce.client_id IS NOT NULL
        AND (ce.status IS NULL OR ce.status != 'cancelled');

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
    WHERE ce.user_id IN (SELECT accessible_user_ids())
        AND ce.start_time >= week_start
        AND ce.start_time <= week_end
        AND ce.client_id IS NOT NULL
        AND (ce.status IS NULL OR ce.status != 'cancelled');

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
    WHERE ce.user_id IN (SELECT accessible_user_ids())
        AND ce.client_id IS NOT NULL
        AND ce.start_time >= month_start
        AND ce.start_time <= NOW()
        AND (ce.status IS NULL OR ce.status != 'cancelled');

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
    WHERE ce.user_id IN (SELECT accessible_user_ids())
        AND ce.client_id IS NOT NULL
        AND ce.start_time >= year_start
        AND ce.start_time <= NOW()
        AND (ce.status IS NULL OR ce.status != 'cancelled');

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
    WHERE ce.user_id IN (SELECT accessible_user_ids())
        AND ce.start_time >= twelve_weeks_ago
        AND ce.start_time <= NOW()
        AND ce.client_id IS NOT NULL
        AND (ce.status IS NULL OR ce.status != 'cancelled');

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
    WHERE ce.user_id IN (SELECT accessible_user_ids())
        AND ce.start_time >= three_months_ago
        AND ce.start_time <= NOW()
        AND ce.client_id IS NOT NULL
        AND (ce.status IS NULL OR ce.status != 'cancelled');

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
        AND ce.start_time <= NOW();

    SELECT COUNT(*)
    INTO cancelled_count
    FROM clients c
    JOIN calendar_events ce ON c.id = ce.client_id
    WHERE c.user_id IN (SELECT accessible_user_ids())
        AND ce.user_id = c.user_id
        AND ce.start_time >= twelve_weeks_ago
        AND ce.start_time <= NOW()
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

-- ----- get_clients_by_region -----
DROP FUNCTION IF EXISTS get_clients_by_region();
CREATE OR REPLACE FUNCTION get_clients_by_region()
RETURNS TABLE(
    client_id UUID,
    client_name TEXT,
    location TEXT,
    region TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id as client_id,
        c.name as client_name,
        c.location,
        CASE LOWER(TRIM(c.location))
            WHEN 'san francisco' THEN 'West Coast'
            WHEN 'sf' THEN 'West Coast'
            WHEN 'los angeles' THEN 'West Coast'
            WHEN 'la' THEN 'West Coast'
            WHEN 'seattle' THEN 'West Coast'
            WHEN 'portland' THEN 'West Coast'
            WHEN 'san diego' THEN 'West Coast'
            WHEN 'oakland' THEN 'West Coast'
            WHEN 'san jose' THEN 'West Coast'
            WHEN 'palo alto' THEN 'West Coast'
            WHEN 'menlo park' THEN 'West Coast'
            WHEN 'mountain view' THEN 'West Coast'
            WHEN 'sunnyvale' THEN 'West Coast'
            WHEN 'cupertino' THEN 'West Coast'
            WHEN 'sacramento' THEN 'West Coast'
            WHEN 'vancouver' THEN 'West Coast'
            WHEN 'ross' THEN 'West Coast'
            WHEN 'ross, ca' THEN 'West Coast'
            WHEN 'denver' THEN 'Mountain'
            WHEN 'boulder' THEN 'Mountain'
            WHEN 'salt lake city' THEN 'Mountain'
            WHEN 'phoenix' THEN 'Mountain'
            WHEN 'albuquerque' THEN 'Mountain'
            WHEN 'colorado' THEN 'Mountain'
            WHEN 'chicago' THEN 'Central'
            WHEN 'austin' THEN 'Central'
            WHEN 'dallas' THEN 'Central'
            WHEN 'houston' THEN 'Central'
            WHEN 'minneapolis' THEN 'Central'
            WHEN 'nashville' THEN 'Central'
            WHEN 'new orleans' THEN 'Central'
            WHEN 'kansas city' THEN 'Central'
            WHEN 'st louis' THEN 'Central'
            WHEN 'milwaukee' THEN 'Central'
            WHEN 'new york' THEN 'East Coast'
            WHEN 'nyc' THEN 'East Coast'
            WHEN 'boston' THEN 'East Coast'
            WHEN 'miami' THEN 'East Coast'
            WHEN 'washington dc' THEN 'East Coast'
            WHEN 'washington' THEN 'East Coast'
            WHEN 'dc' THEN 'East Coast'
            WHEN 'atlanta' THEN 'East Coast'
            WHEN 'philadelphia' THEN 'East Coast'
            WHEN 'charlotte' THEN 'East Coast'
            WHEN 'raleigh' THEN 'East Coast'
            WHEN 'baltimore' THEN 'East Coast'
            WHEN 'pittsburgh' THEN 'East Coast'
            WHEN 'detroit' THEN 'East Coast'
            WHEN 'toronto' THEN 'East Coast'
            WHEN 'montreal' THEN 'East Coast'
            WHEN 'london' THEN 'Europe'
            WHEN 'paris' THEN 'Europe'
            WHEN 'berlin' THEN 'Europe'
            WHEN 'amsterdam' THEN 'Europe'
            WHEN 'dublin' THEN 'Europe'
            WHEN 'madrid' THEN 'Europe'
            WHEN 'barcelona' THEN 'Europe'
            WHEN 'munich' THEN 'Europe'
            WHEN 'zurich' THEN 'Europe'
            WHEN 'vienna' THEN 'Europe'
            WHEN 'stockholm' THEN 'Europe'
            WHEN 'copenhagen' THEN 'Europe'
            WHEN 'oslo' THEN 'Europe'
            WHEN 'milan' THEN 'Europe'
            WHEN 'rome' THEN 'Europe'
            WHEN 'lisbon' THEN 'Europe'
            WHEN 'brussels' THEN 'Europe'
            WHEN 'helsinki' THEN 'Europe'
            WHEN 'warsaw' THEN 'Europe'
            WHEN 'prague' THEN 'Europe'
            WHEN 'bratislava' THEN 'Europe'
            WHEN 'singapore' THEN 'Asia Pacific'
            WHEN 'hong kong' THEN 'Asia Pacific'
            WHEN 'tokyo' THEN 'Asia Pacific'
            WHEN 'sydney' THEN 'Asia Pacific'
            WHEN 'melbourne' THEN 'Asia Pacific'
            WHEN 'beijing' THEN 'Asia Pacific'
            WHEN 'shanghai' THEN 'Asia Pacific'
            WHEN 'seoul' THEN 'Asia Pacific'
            WHEN 'mumbai' THEN 'Asia Pacific'
            WHEN 'bangalore' THEN 'Asia Pacific'
            WHEN 'delhi' THEN 'Asia Pacific'
            WHEN 'dubai' THEN 'Asia Pacific'
            WHEN 'tel aviv' THEN 'Asia Pacific'
            ELSE 'Unknown'
        END as region
    FROM clients c
    WHERE c.user_id IN (SELECT accessible_user_ids())
        AND (c.is_active IS NULL OR c.is_active = true)
        AND c.location IS NOT NULL
        AND c.location != ''
    ORDER BY region, c.name;
END;
$$;

GRANT EXECUTE ON FUNCTION get_clients_by_region() TO authenticated;
GRANT EXECUTE ON FUNCTION get_clients_by_region() TO anon;
GRANT EXECUTE ON FUNCTION get_clients_by_region() TO service_role;

-- ============================================================
-- 5. Reload PostgREST schema cache
-- ============================================================
NOTIFY pgrst, 'reload schema';

COMMIT;
