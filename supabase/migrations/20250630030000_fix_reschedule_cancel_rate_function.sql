-- Migration: Fix get_reschedule_cancel_rate function to use calendar_events with pattern detection
-- File: supabase/migrations/20250630030000_fix_reschedule_cancel_rate_function.sql

-- Drop the existing function
DROP FUNCTION IF EXISTS get_reschedule_cancel_rate();

-- Create the new function with calendar_events data source and pattern detection
CREATE OR REPLACE FUNCTION get_reschedule_cancel_rate()
RETURNS NUMERIC(4,1)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    twelve_weeks_ago TIMESTAMPTZ;
    total_sessions INTEGER;
    cancelled_count INTEGER;
    rate_percentage NUMERIC(4,1);
BEGIN
    twelve_weeks_ago := NOW() - INTERVAL '12 weeks';
    
    -- Count total client sessions in last 12 weeks
    SELECT COUNT(*)
    INTO total_sessions
    FROM clients c
    JOIN calendar_events ce ON c.id = ce.client_id
    WHERE c.user_id = auth.uid()
        AND ce.user_id = auth.uid()
        AND ce.start_time >= twelve_weeks_ago
        AND ce.start_time <= NOW();
    
    -- Count cancelled/rescheduled sessions using pattern detection
    SELECT COUNT(*)
    INTO cancelled_count
    FROM clients c
    JOIN calendar_events ce ON c.id = ce.client_id
    WHERE c.user_id = auth.uid()
        AND ce.user_id = auth.uid()
        AND ce.start_time >= twelve_weeks_ago
        AND ce.start_time <= NOW()
        AND (
            -- Pattern detection for cancellations/reschedules
            LOWER(ce.title) LIKE '%cancel%' OR
            LOWER(ce.title) LIKE '%reschedule%' OR
            LOWER(ce.title) LIKE '%postpone%' OR
            LOWER(ce.title) LIKE '%no show%' OR
            LOWER(ce.title) LIKE '%rescheduled%' OR
            LOWER(ce.title) LIKE '%cancelled%' OR
            LOWER(ce.title) LIKE '%postponed%' OR
            -- Very short sessions (likely cancellations)
            EXTRACT(EPOCH FROM (ce.end_time - ce.start_time)) / 60 < 15
        );
    
    -- Calculate percentage
    IF total_sessions > 0 THEN
        rate_percentage := (cancelled_count::NUMERIC / total_sessions::NUMERIC) * 100;
    ELSE
        rate_percentage := 0;
    END IF;
    
    RETURN ROUND(rate_percentage, 1);
END;
$$;

-- Add comment explaining the logic
COMMENT ON FUNCTION get_reschedule_cancel_rate() IS 'Returns percentage of cancelled/rescheduled sessions in last 12 weeks using calendar event pattern detection and short duration events';

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_reschedule_cancel_rate() TO authenticated;
GRANT EXECUTE ON FUNCTION get_reschedule_cancel_rate() TO service_role;

-- Test the function (you can run this after deployment)
-- SELECT get_reschedule_cancel_rate() as reschedule_cancel_rate_12_weeks; 