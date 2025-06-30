-- Migration: Final fix for populate_sessions_from_calendar_events function
-- File: supabase/migrations/20250630060000_fix_populate_sessions_function_final.sql

-- Drop the existing function
DROP FUNCTION IF EXISTS populate_sessions_from_calendar_events();

-- Recreate the function using only existing columns
CREATE OR REPLACE FUNCTION populate_sessions_from_calendar_events()
RETURNS TABLE(
    sessions_created INTEGER,
    sessions_updated INTEGER,
    sessions_skipped INTEGER,
    errors INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    session_record RECORD;
    session_count INTEGER := 0;
    update_count INTEGER := 0;
    skip_count INTEGER := 0;
    error_count INTEGER := 0;
    detected_status TEXT;
    session_notes TEXT;
BEGIN
    -- Loop through all calendar events for the current user
    FOR session_record IN 
        SELECT 
            ce.id as calendar_event_id,
            ce.user_id,
            ce.client_id,
            ce.title,
            ce.start_time,
            ce.end_time,
            ce.attendees,
            ce.created_at,
            ce.updated_at,
            c.client_name,
            c.client_email
        FROM calendar_events ce
        JOIN clients c ON ce.client_id = c.id
        WHERE ce.user_id = auth.uid()
        ORDER BY ce.start_time
    LOOP
        BEGIN
            -- Detect session status based on calendar event patterns
            detected_status := CASE 
                -- Title-based cancellation detection
                WHEN LOWER(session_record.title) LIKE '%cancel%' THEN 'cancelled'
                WHEN LOWER(session_record.title) LIKE '%reschedule%' THEN 'rescheduled'
                WHEN LOWER(session_record.title) LIKE '%postpone%' THEN 'postponed'
                WHEN LOWER(session_record.title) LIKE '%no show%' THEN 'no_show'
                WHEN LOWER(session_record.title) LIKE '%[cancelled]%' THEN 'cancelled'
                
                -- Duration-based detection (very short sessions might be cancellations)
                WHEN EXTRACT(EPOCH FROM (session_record.end_time - session_record.start_time)) / 60 < 15 THEN 'cancelled'
                
                -- Past events without cancellation indicators are completed
                WHEN session_record.start_time < NOW() THEN 'completed'
                
                -- Future events are scheduled
                ELSE 'scheduled'
            END;
            
            -- Prepare session notes based on status and title
            session_notes := CASE 
                WHEN detected_status = 'cancelled' THEN 'Session was cancelled: ' || session_record.title
                WHEN detected_status = 'rescheduled' THEN 'Session was rescheduled: ' || session_record.title
                WHEN detected_status = 'postponed' THEN 'Session was postponed: ' || session_record.title
                WHEN detected_status = 'no_show' THEN 'Client did not show up: ' || session_record.title
                ELSE 'Coaching session: ' || session_record.title
            END;
            
            -- Check if session already exists
            IF EXISTS (
                SELECT 1 FROM sessions 
                WHERE calendar_event_id = session_record.calendar_event_id
            ) THEN
                -- Update existing session
                UPDATE sessions SET
                    date = session_record.start_time::date,
                    status = detected_status,
                    notes = session_notes
                WHERE calendar_event_id = session_record.calendar_event_id;
                
                update_count := update_count + 1;
                
            ELSE
                -- Insert new session
                INSERT INTO sessions (
                    client_id,
                    calendar_event_id,
                    date,
                    status,
                    notes,
                    created_at
                ) VALUES (
                    session_record.client_id,
                    session_record.calendar_event_id,
                    session_record.start_time::date,
                    detected_status,
                    session_notes,
                    session_record.created_at
                );
                
                session_count := session_count + 1;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            -- Log error and continue with next record
            error_count := error_count + 1;
            RAISE NOTICE 'Error processing session for client % (calendar_event_id: %): %', 
                session_record.client_name, 
                session_record.calendar_event_id, 
                SQLERRM;
        END;
    END LOOP;
    
    -- Return summary
    RETURN QUERY SELECT 
        session_count,
        update_count,
        skip_count,
        error_count;
        
END;
$$;

-- Add comment explaining the function
COMMENT ON FUNCTION populate_sessions_from_calendar_events() IS 
'Populates sessions table from calendar_events with intelligent status detection based on event patterns, titles, and timing.'; 