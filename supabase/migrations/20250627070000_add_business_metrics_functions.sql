-- Function to get sessions this week count
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
        AND ce.start_time >= week_start
        AND ce.start_time <= week_end
        AND ce.client_id IS NOT NULL;
        
    RETURN session_count;
END;
$$;

-- Function to get average sessions per week (rolling 12 weeks)
CREATE OR REPLACE FUNCTION get_avg_sessions_per_week()
RETURNS NUMERIC(4,1)
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
    WHERE ce.user_id = auth.uid()
        AND ce.start_time >= twelve_weeks_ago
        AND ce.start_time <= NOW()
        AND ce.client_id IS NOT NULL;
        
    avg_per_week := total_sessions::NUMERIC / 12.0;
    
    RETURN ROUND(avg_per_week, 1);
END;
$$;

-- Function to get average sessions per month (last 3 months)
CREATE OR REPLACE FUNCTION get_avg_sessions_per_month()
RETURNS NUMERIC(4,1)
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
    WHERE ce.user_id = auth.uid()
        AND ce.start_time >= three_months_ago
        AND ce.start_time <= NOW()
        AND ce.client_id IS NOT NULL;
        
    avg_per_month := total_sessions::NUMERIC / 3.0;
    
    RETURN ROUND(avg_per_month, 1);
END;
$$;

-- Function to get reschedule/cancel rate
CREATE OR REPLACE FUNCTION get_reschedule_cancel_rate()
RETURNS NUMERIC(4,1)
LANGUAGE plpgsql
SECURITY DEFINER
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