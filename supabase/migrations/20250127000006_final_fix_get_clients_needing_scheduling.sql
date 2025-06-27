-- First, drop the old function to be safe
DROP FUNCTION IF EXISTS get_clients_needing_scheduling(uuid);

-- Create the corrected version of the function
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
SELECT
c.id AS client_id,
c.name AS client_name,
c.email AS client_email,
c.company_name AS company,
(SELECT MAX(s.date) FROM sessions s WHERE s.client_id = c.id) AS last_session_date,
CASE 
    WHEN (SELECT MAX(s.date) FROM sessions s WHERE s.client_id = c.id) IS NULL THEN 'Never had session'
    ELSE TO_CHAR((SELECT MAX(s.date) FROM sessions s WHERE s.client_id = c.id) AT TIME ZONE 'America/Los_Angeles', 'Mon DD, YYYY')
END AS last_session_formatted,
COALESCE((EXTRACT(epoch FROM (NOW() - (SELECT MAX(s.date) FROM sessions s WHERE s.client_id = c.id))) / 86400)::integer, 999) AS days_since_last_session,
(SELECT COUNT(*) FROM sessions s WHERE s.client_id = c.id)::INTEGER AS total_sessions_count,
CASE 
    WHEN (SELECT MAX(s.date) FROM sessions s WHERE s.client_id = c.id) IS NULL THEN '🔴 New client - schedule first session'
    WHEN (EXTRACT(epoch FROM (NOW() - (SELECT MAX(s.date) FROM sessions s WHERE s.client_id = c.id))) / 86400)::integer > 30 THEN '🔴 High priority - ' || (EXTRACT(epoch FROM (NOW() - (SELECT MAX(s.date) FROM sessions s WHERE s.client_id = c.id))) / 86400)::integer || ' days'
    WHEN (EXTRACT(epoch FROM (NOW() - (SELECT MAX(s.date) FROM sessions s WHERE s.client_id = c.id))) / 86400)::integer > 14 THEN '🟡 Medium priority - ' || (EXTRACT(epoch FROM (NOW() - (SELECT MAX(s.date) FROM sessions s WHERE s.client_id = c.id))) / 86400)::integer || ' days'
    ELSE '🟢 Recent - ' || (EXTRACT(epoch FROM (NOW() - (SELECT MAX(s.date) FROM sessions s WHERE s.client_id = c.id))) / 86400)::integer || ' days ago'
END AS scheduling_priority,
c.notes
FROM
clients c
WHERE
c.user_id = p_user_id
AND c.is_active = true  -- Use the correct column name 'is_active'
AND c.id NOT IN (
-- Exclude clients who have an event scheduled in the future
SELECT ce.client_id
FROM calendar_events ce
WHERE ce.user_id = p_user_id AND ce.start_time > NOW() AND ce.client_id IS NOT NULL
)
ORDER BY
CASE 
    WHEN (SELECT MAX(s.date) FROM sessions s WHERE s.client_id = c.id) IS NULL THEN 0  -- New clients first
    ELSE (EXTRACT(epoch FROM (NOW() - (SELECT MAX(s.date) FROM sessions s WHERE s.client_id = c.id))) / 86400)::integer
END DESC;
END;
$$; 