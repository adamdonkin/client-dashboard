-- Debug query: Show all sessions from last week (June 23-29, 2025) with status values
-- Run this in Supabase SQL Editor to see how cancellations are actually recorded

-- 1. Check sessions table for last week
SELECT 
    s.id,
    s.client_id,
    c.client_name,
    s.title,
    s.start_time AT TIME ZONE 'America/Los_Angeles' as session_time_pst,
    s.end_time AT TIME ZONE 'America/Los_Angeles' as end_time_pst,
    EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 60 as duration_minutes,
    s.status,
    s.description,
    s.created_at,
    s.updated_at
FROM sessions s
JOIN clients c ON s.client_id = c.id
WHERE c.user_id = auth.uid()
    AND s.user_id = auth.uid()
    AND s.start_time >= '2025-06-23 00:00:00+00'
    AND s.start_time < '2025-06-30 00:00:00+00'
ORDER BY s.start_time;

-- 2. Check calendar_events table for last week (for comparison)
SELECT 
    ce.id,
    ce.client_id,
    c.client_name,
    ce.title,
    ce.start_time AT TIME ZONE 'America/Los_Angeles' as session_time_pst,
    ce.end_time AT TIME ZONE 'America/Los_Angeles' as end_time_pst,
    EXTRACT(EPOCH FROM (ce.end_time - ce.start_time)) / 60 as duration_minutes,
    ce.status,
    ce.description,
    ce.created_at,
    ce.updated_at
FROM calendar_events ce
JOIN clients c ON ce.client_id = c.id
WHERE c.user_id = auth.uid()
    AND ce.user_id = auth.uid()
    AND ce.start_time >= '2025-06-23 00:00:00+00'
    AND ce.start_time < '2025-06-30 00:00:00+00'
ORDER BY ce.start_time;

-- 3. Summary of session statuses from last week
SELECT 
    'sessions' as table_name,
    s.status,
    COUNT(*) as count
FROM sessions s
JOIN clients c ON s.client_id = c.id
WHERE c.user_id = auth.uid()
    AND s.user_id = auth.uid()
    AND s.start_time >= '2025-06-23 00:00:00+00'
    AND s.start_time < '2025-06-30 00:00:00+00'
GROUP BY s.status

UNION ALL

SELECT 
    'calendar_events' as table_name,
    ce.status,
    COUNT(*) as count
FROM calendar_events ce
JOIN clients c ON ce.client_id = c.id
WHERE c.user_id = auth.uid()
    AND ce.user_id = auth.uid()
    AND ce.start_time >= '2025-06-23 00:00:00+00'
    AND ce.start_time < '2025-06-30 00:00:00+00'
GROUP BY ce.status
ORDER BY table_name, status;

-- 4. Look for potential cancellation patterns in titles from last week
SELECT 
    'sessions' as source,
    s.title,
    s.status,
    COUNT(*) as count
FROM sessions s
JOIN clients c ON s.client_id = c.id
WHERE c.user_id = auth.uid()
    AND s.user_id = auth.uid()
    AND s.start_time >= '2025-06-23 00:00:00+00'
    AND s.start_time < '2025-06-30 00:00:00+00'
GROUP BY s.title, s.status

UNION ALL

SELECT 
    'calendar_events' as source,
    ce.title,
    ce.status,
    COUNT(*) as count
FROM calendar_events ce
JOIN clients c ON ce.client_id = c.id
WHERE c.user_id = auth.uid()
    AND ce.user_id = auth.uid()
    AND ce.start_time >= '2025-06-23 00:00:00+00'
    AND ce.start_time < '2025-06-30 00:00:00+00'
GROUP BY ce.title, ce.status
ORDER BY source, count DESC; 