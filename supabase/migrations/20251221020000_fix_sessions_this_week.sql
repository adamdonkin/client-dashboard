-- Fix get_sessions_this_week to exclude cancelled sessions
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
    -- Get current week boundaries (Sunday to Saturday) in Los Angeles timezone
    week_start := DATE_TRUNC('week', NOW() AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles';
    week_end := week_start + INTERVAL '6 days 23:59:59';
    
    SELECT COUNT(*)
    INTO session_count
    FROM calendar_events ce
    WHERE ce.user_id = auth.uid()
        AND ce.client_id IS NOT NULL
        AND ce.start_time >= week_start
        AND ce.start_time <= week_end
        AND (ce.status IS NULL OR ce.status != 'cancelled');  -- Exclude cancelled sessions
        
    RETURN session_count;
END;
$$;

GRANT EXECUTE ON FUNCTION get_sessions_this_week() TO authenticated;
GRANT EXECUTE ON FUNCTION get_sessions_this_week() TO anon;
GRANT EXECUTE ON FUNCTION get_sessions_this_week() TO service_role;

