-- Function to get clients needing scheduling (high priority/overdue)
CREATE OR REPLACE FUNCTION get_clients_needs_scheduling(p_user_id UUID)
RETURNS TABLE (
    client_id UUID,
    client_name TEXT,
    client_email TEXT,
    company TEXT,
    last_session_date TIMESTAMPTZ,
    days_since_last_session INTEGER,
    priority_level TEXT,
    next_session_date TIMESTAMPTZ
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as client_id,
        c.name as client_name,
        c.email as client_email,
        c.company_name as company,
        last_sessions.session_date as last_session_date,
        CASE 
            WHEN last_sessions.session_date IS NULL THEN NULL
            ELSE EXTRACT(DAYS FROM (NOW() AT TIME ZONE 'America/Los_Angeles' - last_sessions.session_date))::INTEGER
        END as days_since_last_session,
        CASE 
            WHEN last_sessions.session_date IS NULL THEN 'new'
            WHEN EXTRACT(DAYS FROM (NOW() AT TIME ZONE 'America/Los_Angeles' - last_sessions.session_date)) >= 30 THEN 'high'
            WHEN EXTRACT(DAYS FROM (NOW() AT TIME ZONE 'America/Los_Angeles' - last_sessions.session_date)) >= 14 THEN 'medium'
            ELSE 'low'
        END as priority_level,
        next_sessions.session_date as next_session_date
    FROM clients c
    LEFT JOIN (
        SELECT 
            ce.client_id,
            MAX(ce.start_time AT TIME ZONE 'America/Los_Angeles') as session_date
        FROM calendar_events ce
        WHERE ce.user_id = p_user_id 
        AND ce.start_time < NOW()
        GROUP BY ce.client_id
    ) last_sessions ON c.id = last_sessions.client_id
    LEFT JOIN (
        SELECT 
            ce.client_id,
            MIN(ce.start_time AT TIME ZONE 'America/Los_Angeles') as session_date
        FROM calendar_events ce
        WHERE ce.user_id = p_user_id 
        AND ce.start_time > NOW()
        GROUP BY ce.client_id
    ) next_sessions ON c.id = next_sessions.client_id
    WHERE c.user_id = p_user_id
    AND (
        last_sessions.session_date IS NULL -- New clients
        OR EXTRACT(DAYS FROM (NOW() AT TIME ZONE 'America/Los_Angeles' - last_sessions.session_date)) >= 14 -- Haven't had session in 14+ days
        OR next_sessions.session_date IS NULL -- No upcoming sessions scheduled
    )
    ORDER BY 
        CASE 
            WHEN last_sessions.session_date IS NULL THEN 0 -- New clients first
            ELSE EXTRACT(DAYS FROM (NOW() AT TIME ZONE 'America/Los_Angeles' - last_sessions.session_date))
        END DESC;
END;
$$;

-- Function to get clients with sessions this week
CREATE OR REPLACE FUNCTION get_clients_this_week(p_user_id UUID)
RETURNS TABLE (
    client_id UUID,
    client_name TEXT,
    client_email TEXT,
    company TEXT,
    last_session_date TIMESTAMPTZ,
    days_since_last_session INTEGER,
    priority_level TEXT,
    next_session_date TIMESTAMPTZ,
    next_session_relative TEXT
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as client_id,
        c.name as client_name,
        c.email as client_email,
        c.company_name as company,
        last_sessions.session_date as last_session_date,
        CASE 
            WHEN last_sessions.session_date IS NULL THEN NULL
            ELSE EXTRACT(DAYS FROM (NOW() AT TIME ZONE 'America/Los_Angeles' - last_sessions.session_date))::INTEGER
        END as days_since_last_session,
        'scheduled' as priority_level,
        next_sessions.session_date as next_session_date,
        CASE 
            WHEN DATE(next_sessions.session_date) = DATE(NOW() AT TIME ZONE 'America/Los_Angeles') THEN 'Today'
            WHEN DATE(next_sessions.session_date) = DATE(NOW() AT TIME ZONE 'America/Los_Angeles' + INTERVAL '1 day') THEN 'Tomorrow'
            WHEN DATE(next_sessions.session_date) = DATE(NOW() AT TIME ZONE 'America/Los_Angeles' - INTERVAL '1 day') THEN 'Yesterday'
            ELSE TO_CHAR(next_sessions.session_date, 'Day, Mon DD')
        END as next_session_relative
    FROM clients c
    LEFT JOIN (
        SELECT 
            ce.client_id,
            MAX(ce.start_time AT TIME ZONE 'America/Los_Angeles') as session_date
        FROM calendar_events ce
        WHERE ce.user_id = p_user_id 
        AND ce.start_time < NOW()
        GROUP BY ce.client_id
    ) last_sessions ON c.id = last_sessions.client_id
    INNER JOIN (
        SELECT 
            ce.client_id,
            MIN(ce.start_time AT TIME ZONE 'America/Los_Angeles') as session_date
        FROM calendar_events ce
        WHERE ce.user_id = p_user_id 
        AND ce.start_time BETWEEN NOW() AND (NOW() + INTERVAL '7 days')
        GROUP BY ce.client_id
    ) next_sessions ON c.id = next_sessions.client_id
    WHERE c.user_id = p_user_id
    ORDER BY next_sessions.session_date ASC;
END;
$$;

-- Function to get clients with upcoming sessions (beyond this week)
CREATE OR REPLACE FUNCTION get_clients_upcoming(p_user_id UUID)
RETURNS TABLE (
    client_id UUID,
    client_name TEXT,
    client_email TEXT,
    company TEXT,
    last_session_date TIMESTAMPTZ,
    days_since_last_session INTEGER,
    priority_level TEXT,
    next_session_date TIMESTAMPTZ,
    next_session_relative TEXT
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as client_id,
        c.name as client_name,
        c.email as client_email,
        c.company_name as company,
        last_sessions.session_date as last_session_date,
        CASE 
            WHEN last_sessions.session_date IS NULL THEN NULL
            ELSE EXTRACT(DAYS FROM (NOW() AT TIME ZONE 'America/Los_Angeles' - last_sessions.session_date))::INTEGER
        END as days_since_last_session,
        'upcoming' as priority_level,
        next_sessions.session_date as next_session_date,
        TO_CHAR(next_sessions.session_date, 'Day, Mon DD') as next_session_relative
    FROM clients c
    LEFT JOIN (
        SELECT 
            ce.client_id,
            MAX(ce.start_time AT TIME ZONE 'America/Los_Angeles') as session_date
        FROM calendar_events ce
        WHERE ce.user_id = p_user_id 
        AND ce.start_time < NOW()
        GROUP BY ce.client_id
    ) last_sessions ON c.id = last_sessions.client_id
    INNER JOIN (
        SELECT 
            ce.client_id,
            MIN(ce.start_time AT TIME ZONE 'America/Los_Angeles') as session_date
        FROM calendar_events ce
        WHERE ce.user_id = p_user_id 
        AND ce.start_time > (NOW() + INTERVAL '7 days')
        GROUP BY ce.client_id
    ) next_sessions ON c.id = next_sessions.client_id
    WHERE c.user_id = p_user_id
    ORDER BY next_sessions.session_date ASC;
END;
$$;
