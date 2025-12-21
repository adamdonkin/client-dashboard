-- Update get_total_sessions_this_year to exclude cancelled events
CREATE OR REPLACE FUNCTION get_total_sessions_this_year()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    year_start TIMESTAMPTZ;
    session_count INTEGER;
BEGIN
    -- Get the start of the current year in LA timezone
    year_start := DATE_TRUNC('year', NOW() AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles';
    
    SELECT COUNT(*)
    INTO session_count
    FROM calendar_events ce
    WHERE ce.user_id = auth.uid()
        AND ce.client_id IS NOT NULL
        AND ce.start_time >= year_start
        AND ce.start_time <= NOW()
        AND (ce.status IS NULL OR ce.status != 'cancelled');  -- Exclude cancelled events
        
    RETURN session_count;
END;
$$;

