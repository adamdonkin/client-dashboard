-- Migration: Create function to populate sessions table from calendar_events
-- File: supabase/migrations/20250630040000_create_populate_sessions_function.sql

-- Function to populate sessions table from calendar_events with intelligent status detection
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
    session_title TEXT;
    session_description TEXT;
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
            ce.status as calendar_status,
            ce.description,
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
                -- Explicit cancelled status from calendar
                WHEN session_record.calendar_status = 'cancelled' THEN 'cancelled'
                
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
            
            -- Prepare session title (remove cancellation markers for cleaner display)
            session_title := CASE 
                WHEN detected_status = 'cancelled' AND LOWER(session_record.title) LIKE '%[cancelled]%' 
                THEN REPLACE(session_record.title, ' [CANCELLED]', '')
                ELSE session_record.title
            END;
            
            -- Prepare session description
            session_description := CASE 
                WHEN session_record.description IS NOT NULL THEN session_record.description
                WHEN detected_status = 'cancelled' THEN 'Session was cancelled'
                WHEN detected_status = 'rescheduled' THEN 'Session was rescheduled'
                WHEN detected_status = 'postponed' THEN 'Session was postponed'
                WHEN detected_status = 'no_show' THEN 'Client did not show up'
                ELSE 'Coaching session'
            END;
            
            -- Check if session already exists
            IF EXISTS (
                SELECT 1 FROM sessions 
                WHERE user_id = session_record.user_id 
                AND calendar_event_id = session_record.calendar_event_id
            ) THEN
                -- Update existing session
                UPDATE sessions SET
                    title = session_title,
                    start_time = session_record.start_time,
                    end_time = session_record.end_time,
                    status = detected_status,
                    description = session_description,
                    updated_at = NOW()
                WHERE user_id = session_record.user_id 
                AND calendar_event_id = session_record.calendar_event_id;
                
                update_count := update_count + 1;
                
            ELSE
                -- Insert new session
                INSERT INTO sessions (
                    user_id,
                    client_id,
                    calendar_event_id,
                    title,
                    start_time,
                    end_time,
                    status,
                    description,
                    created_at,
                    updated_at
                ) VALUES (
                    session_record.user_id,
                    session_record.client_id,
                    session_record.calendar_event_id,
                    session_title,
                    session_record.start_time,
                    session_record.end_time,
                    detected_status,
                    session_description,
                    session_record.created_at,
                    NOW()
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
'Populates sessions table from calendar_events with intelligent status detection based on event patterns, titles, and timing. Handles cancelled, rescheduled, postponed, no-show, completed, and scheduled sessions.';

-- Create a function to sync sessions for a specific time range
CREATE OR REPLACE FUNCTION sync_sessions_for_period(
    start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    end_date TIMESTAMPTZ DEFAULT NOW() + INTERVAL '60 days'
)
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
    session_title TEXT;
    session_description TEXT;
BEGIN
    -- Loop through calendar events in the specified time range
    FOR session_record IN 
        SELECT 
            ce.id as calendar_event_id,
            ce.user_id,
            ce.client_id,
            ce.title,
            ce.start_time,
            ce.end_time,
            ce.status as calendar_status,
            ce.description,
            ce.attendees,
            ce.created_at,
            ce.updated_at,
            c.client_name,
            c.client_email
        FROM calendar_events ce
        JOIN clients c ON ce.client_id = c.id
        WHERE ce.user_id = auth.uid()
        AND ce.start_time >= start_date
        AND ce.start_time <= end_date
        ORDER BY ce.start_time
    LOOP
        BEGIN
            -- Same status detection logic as above
            detected_status := CASE 
                WHEN session_record.calendar_status = 'cancelled' THEN 'cancelled'
                WHEN LOWER(session_record.title) LIKE '%cancel%' THEN 'cancelled'
                WHEN LOWER(session_record.title) LIKE '%reschedule%' THEN 'rescheduled'
                WHEN LOWER(session_record.title) LIKE '%postpone%' THEN 'postponed'
                WHEN LOWER(session_record.title) LIKE '%no show%' THEN 'no_show'
                WHEN LOWER(session_record.title) LIKE '%[cancelled]%' THEN 'cancelled'
                WHEN EXTRACT(EPOCH FROM (session_record.end_time - session_record.start_time)) / 60 < 15 THEN 'cancelled'
                WHEN session_record.start_time < NOW() THEN 'completed'
                ELSE 'scheduled'
            END;
            
            session_title := CASE 
                WHEN detected_status = 'cancelled' AND LOWER(session_record.title) LIKE '%[cancelled]%' 
                THEN REPLACE(session_record.title, ' [CANCELLED]', '')
                ELSE session_record.title
            END;
            
            session_description := CASE 
                WHEN session_record.description IS NOT NULL THEN session_record.description
                WHEN detected_status = 'cancelled' THEN 'Session was cancelled'
                WHEN detected_status = 'rescheduled' THEN 'Session was rescheduled'
                WHEN detected_status = 'postponed' THEN 'Session was postponed'
                WHEN detected_status = 'no_show' THEN 'Client did not show up'
                ELSE 'Coaching session'
            END;
            
            -- Check if session already exists
            IF EXISTS (
                SELECT 1 FROM sessions 
                WHERE user_id = session_record.user_id 
                AND calendar_event_id = session_record.calendar_event_id
            ) THEN
                -- Update existing session
                UPDATE sessions SET
                    title = session_title,
                    start_time = session_record.start_time,
                    end_time = session_record.end_time,
                    status = detected_status,
                    description = session_description,
                    updated_at = NOW()
                WHERE user_id = session_record.user_id 
                AND calendar_event_id = session_record.calendar_event_id;
                
                update_count := update_count + 1;
                
            ELSE
                -- Insert new session
                INSERT INTO sessions (
                    user_id,
                    client_id,
                    calendar_event_id,
                    title,
                    start_time,
                    end_time,
                    status,
                    description,
                    created_at,
                    updated_at
                ) VALUES (
                    session_record.user_id,
                    session_record.client_id,
                    session_record.calendar_event_id,
                    session_title,
                    session_record.start_time,
                    session_record.end_time,
                    detected_status,
                    session_description,
                    session_record.created_at,
                    NOW()
                );
                
                session_count := session_count + 1;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
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

-- Add comment for the period-specific function
COMMENT ON FUNCTION sync_sessions_for_period(TIMESTAMPTZ, TIMESTAMPTZ) IS 
'Syncs sessions from calendar_events for a specific time period. Useful for incremental updates or syncing specific date ranges.';

-- Test the functions (you can run these after deployment)
-- SELECT * FROM populate_sessions_from_calendar_events();
-- SELECT * FROM sync_sessions_for_period(NOW() - INTERVAL '7 days', NOW() + INTERVAL '7 days'); 