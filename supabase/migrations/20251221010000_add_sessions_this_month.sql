-- Create function to get sessions for the current month only (excluding cancelled)
CREATE OR REPLACE FUNCTION get_sessions_this_month()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    month_start TIMESTAMPTZ;
    session_count INTEGER;
BEGIN
    -- Get the start of the current month in LA timezone
    month_start := DATE_TRUNC('month', NOW() AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles';
    
    SELECT COUNT(*)
    INTO session_count
    FROM calendar_events ce
    WHERE ce.user_id = auth.uid()
        AND ce.client_id IS NOT NULL
        AND ce.start_time >= month_start
        AND ce.start_time <= NOW()
        AND (ce.status IS NULL OR ce.status != 'cancelled');  -- Exclude cancelled
        
    RETURN session_count;
END;
$$;

GRANT EXECUTE ON FUNCTION get_sessions_this_month() TO authenticated;
GRANT EXECUTE ON FUNCTION get_sessions_this_month() TO anon;
GRANT EXECUTE ON FUNCTION get_sessions_this_month() TO service_role;

