-- Update get_sessions_this_week to only count COMPLETED sessions (start_time <= NOW())
-- Create get_scheduled_sessions_this_week to count ALL scheduled (for the denominator)

-- First: Update get_sessions_this_week to only count completed sessions
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
    -- Get current week boundaries (Monday to Sunday) in Los Angeles timezone
    week_start := DATE_TRUNC('week', NOW() AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles';
    week_end := week_start + INTERVAL '6 days 23:59:59';
    
    SELECT COUNT(*)
    INTO session_count
    FROM calendar_events ce
    WHERE ce.user_id = auth.uid()
        AND ce.start_time >= week_start
        AND ce.start_time <= week_end
        AND ce.start_time <= NOW()  -- Only completed sessions
        AND ce.client_id IS NOT NULL
        AND (ce.status IS NULL OR ce.status != 'cancelled');
        
    RETURN session_count;
END;
$$;

-- Second: Create function for scheduled sessions this week (includes future)
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
    -- Get current week boundaries (Monday to Sunday) in Los Angeles timezone
    week_start := DATE_TRUNC('week', NOW() AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles';
    week_end := week_start + INTERVAL '6 days 23:59:59';
    
    SELECT COUNT(*)
    INTO session_count
    FROM calendar_events ce
    WHERE ce.user_id = auth.uid()
        AND ce.start_time >= week_start
        AND ce.start_time <= week_end
        AND ce.client_id IS NOT NULL
        AND (ce.status IS NULL OR ce.status != 'cancelled');
        
    RETURN session_count;
END;
$$;





