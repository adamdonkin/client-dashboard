-- First, drop the old functions to avoid conflicts
DROP FUNCTION IF EXISTS get_clients_needing_scheduling(uuid);
DROP FUNCTION IF EXISTS get_clients_this_week(uuid);
DROP FUNCTION IF EXISTS get_clients_upcoming(uuid);

-- Fix get_clients_needing_scheduling function with correct column name
CREATE OR REPLACE FUNCTION get_clients_needing_scheduling(p_user_id UUID)
RETURNS TABLE (
client_id UUID,
client_name TEXT,
client_email TEXT,
company TEXT,
last_session_date TIMESTAMPTZ,
last_session_formatted TEXT,
days_since_last_session INTEGER,
total_sessions_count INTEGER,
scheduling_priority TEXT,
notes TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
RETURN QUERY
WITH client_sessions AS (
SELECT
c.id as client_id,
c.name as client_name,
c.email as client_email,
c.company_name,
c.notes,
MAX(ce.end_time) FILTER (WHERE ce.end_time < NOW()) as last_session,
COUNT(ce.id) as total_sessions,
MIN(ce.start_time) FILTER (WHERE ce.start_time > NOW()) as next_session
FROM clients c
LEFT JOIN calendar_events ce ON ce.client_id = c.id
WHERE c.user_id = p_user_id
AND c.is_active = true -- Fixed column name
GROUP BY c.id, c.name, c.email, c.company_name, c.notes
)
SELECT
cs.client_id,
cs.client_name,
cs.client_email,
cs.company_name as company,
cs.last_session as last_session_date,
CASE
WHEN cs.last_session IS NULL THEN 'Never had session'
ELSE TO_CHAR(cs.last_session AT TIME ZONE 'America/Los_Angeles', 'Mon DD, YYYY')
END as last_session_formatted,
COALESCE(EXTRACT(DAY FROM NOW() - cs.last_session)::INTEGER, 999) as days_since_last_session,
cs.total_sessions::INTEGER as total_sessions_count,
CASE
WHEN cs.last_session IS NULL THEN '🔴 New client - schedule first session'
WHEN EXTRACT(DAY FROM NOW() - cs.last_session) > 30 THEN '🔴 High priority - ' || EXTRACT(DAY FROM NOW() - cs.last_session)::INTEGER || ' days'
WHEN EXTRACT(DAY FROM NOW() - cs.last_session) > 14 THEN '🟡 Medium priority - ' || EXTRACT(DAY FROM NOW() - cs.last_session)::INTEGER || ' days'
ELSE '🟢 Recent - ' || EXTRACT(DAY FROM NOW() - cs.last_session)::INTEGER || ' days ago'
END as scheduling_priority,
cs.notes
FROM client_sessions cs
WHERE cs.next_session IS NULL  -- No future sessions scheduled
ORDER BY
CASE
WHEN cs.last_session IS NULL THEN 0  -- New clients first
ELSE EXTRACT(DAY FROM NOW() - cs.last_session)
END DESC;
END;
$$;

-- Fix get_clients_this_week function with correct column name
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
    AND c.is_active = true -- Fixed column name
    ORDER BY next_sessions.session_date ASC;
END;
$$;

-- Fix get_clients_upcoming function with correct column name
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
    AND c.is_active = true -- Fixed column name
    ORDER BY next_sessions.session_date ASC;
END;
$$; 