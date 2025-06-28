-- Update stats functions to join through clients table like working functions
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
    FROM clients c
    JOIN calendar_events ce ON c.id = ce.client_id
    WHERE c.user_id = auth.uid()
        AND ce.user_id = auth.uid()
        AND ce.start_time >= week_start
        AND ce.start_time <= week_end;
        
    RETURN session_count;
END;
$$;

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
    FROM clients c
    JOIN calendar_events ce ON c.id = ce.client_id
    WHERE c.user_id = auth.uid()
        AND ce.user_id = auth.uid()
        AND ce.start_time >= twelve_weeks_ago
        AND ce.start_time <= NOW();
        
    avg_per_week := total_sessions::NUMERIC / 12.0;
    
    RETURN ROUND(avg_per_week, 1);
END;
$$;

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
    FROM clients c
    JOIN calendar_events ce ON c.id = ce.client_id
    WHERE c.user_id = auth.uid()
        AND ce.user_id = auth.uid()
        AND ce.start_time >= three_months_ago
        AND ce.start_time <= NOW();
        
    avg_per_month := total_sessions::NUMERIC / 3.0;
    
    RETURN ROUND(avg_per_month, 1);
END;
$$; 