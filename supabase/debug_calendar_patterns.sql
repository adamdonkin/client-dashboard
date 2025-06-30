-- Debug queries to analyze cancellation patterns in your calendar data
-- Run these in Supabase SQL Editor to understand your data better

-- 1. See all calendar event titles from last 12 weeks to identify patterns
SELECT 
    ce.title,
    ce.start_time AT TIME ZONE 'America/Los_Angeles' as session_time,
    EXTRACT(EPOCH FROM (ce.end_time - ce.start_time)) / 60 as duration_minutes,
    c.client_name
FROM clients c
JOIN calendar_events ce ON c.id = ce.client_id
WHERE c.user_id = auth.uid()
    AND ce.user_id = auth.uid()
    AND ce.start_time >= (NOW() - INTERVAL '12 weeks')
    AND ce.start_time <= NOW()
ORDER BY ce.start_time DESC
LIMIT 50;

-- 2. Look for potential cancellation patterns in titles
SELECT 
    ce.title,
    COUNT(*) as count,
    CASE 
        WHEN LOWER(ce.title) LIKE '%cancel%' THEN 'Cancelled'
        WHEN LOWER(ce.title) LIKE '%reschedule%' THEN 'Rescheduled'
        WHEN LOWER(ce.title) LIKE '%postpone%' THEN 'Postponed'
        WHEN LOWER(ce.title) LIKE '%no show%' THEN 'No Show'
        WHEN EXTRACT(EPOCH FROM (ce.end_time - ce.start_time)) / 60 < 15 THEN 'Short Session'
        ELSE 'Regular'
    END as pattern_type
FROM clients c
JOIN calendar_events ce ON c.id = ce.client_id
WHERE c.user_id = auth.uid()
    AND ce.user_id = auth.uid()
    AND ce.start_time >= (NOW() - INTERVAL '12 weeks')
GROUP BY ce.title
ORDER BY count DESC;

-- 3. Check session durations to identify unusually short sessions
SELECT 
    EXTRACT(EPOCH FROM (ce.end_time - ce.start_time)) / 60 as duration_minutes,
    COUNT(*) as count,
    CASE 
        WHEN EXTRACT(EPOCH FROM (ce.end_time - ce.start_time)) / 60 < 15 THEN 'Very Short (< 15 min)'
        WHEN EXTRACT(EPOCH FROM (ce.end_time - ce.start_time)) / 60 < 30 THEN 'Short (15-30 min)'
        WHEN EXTRACT(EPOCH FROM (ce.end_time - ce.start_time)) / 60 < 60 THEN 'Medium (30-60 min)'
        ELSE 'Full Session (60+ min)'
    END as duration_category
FROM clients c
JOIN calendar_events ce ON c.id = ce.client_id
WHERE c.user_id = auth.uid()
    AND ce.user_id = auth.uid()
    AND ce.start_time >= (NOW() - INTERVAL '12 weeks')
GROUP BY duration_minutes
ORDER BY duration_minutes;

-- 4. Summary of potential cancellations detected
SELECT 
    COUNT(CASE WHEN LOWER(ce.title) LIKE '%cancel%' THEN 1 END) as title_cancelled,
    COUNT(CASE WHEN LOWER(ce.title) LIKE '%reschedule%' THEN 1 END) as title_rescheduled,
    COUNT(CASE WHEN LOWER(ce.title) LIKE '%postpone%' THEN 1 END) as title_postponed,
    COUNT(CASE WHEN LOWER(ce.title) LIKE '%no show%' THEN 1 END) as title_no_show,
    COUNT(CASE WHEN EXTRACT(EPOCH FROM (ce.end_time - ce.start_time)) / 60 < 15 THEN 1 END) as short_sessions,
    COUNT(*) as total_sessions
FROM clients c
JOIN calendar_events ce ON c.id = ce.client_id
WHERE c.user_id = auth.uid()
    AND ce.user_id = auth.uid()
    AND ce.start_time >= (NOW() - INTERVAL '12 weeks');

-- 5. Test the new reschedule rate function
SELECT get_reschedule_cancel_rate() as reschedule_cancel_rate_12_weeks;

-- 6. Compare with old function if it still exists
-- SELECT get_reschedule_cancel_rate_old() as reschedule_cancel_rate_old;

-- 7. Detailed breakdown of what the function is detecting
SELECT 
    ce.title,
    ce.start_time AT TIME ZONE 'America/Los_Angeles' as session_time,
    EXTRACT(EPOCH FROM (ce.end_time - ce.start_time)) / 60 as duration_minutes,
    c.client_name,
    CASE 
        WHEN LOWER(ce.title) LIKE '%cancel%' THEN 'Cancelled by title'
        WHEN LOWER(ce.title) LIKE '%reschedule%' THEN 'Rescheduled by title'
        WHEN LOWER(ce.title) LIKE '%postpone%' THEN 'Postponed by title'
        WHEN LOWER(ce.title) LIKE '%no show%' THEN 'No show by title'
        WHEN EXTRACT(EPOCH FROM (ce.end_time - ce.start_time)) / 60 < 15 THEN 'Short session (< 15 min)'
        ELSE 'Regular session'
    END as cancellation_reason
FROM clients c
JOIN calendar_events ce ON c.id = ce.client_id
WHERE c.user_id = auth.uid()
    AND ce.user_id = auth.uid()
    AND ce.start_time >= (NOW() - INTERVAL '12 weeks')
    AND ce.start_time <= NOW()
    AND (
        LOWER(ce.title) LIKE '%cancel%' OR
        LOWER(ce.title) LIKE '%reschedule%' OR
        LOWER(ce.title) LIKE '%postpone%' OR
        LOWER(ce.title) LIKE '%no show%' OR
        LOWER(ce.title) LIKE '%rescheduled%' OR
        EXTRACT(EPOCH FROM (ce.end_time - ce.start_time)) / 60 < 15
    )
ORDER BY ce.start_time DESC; 