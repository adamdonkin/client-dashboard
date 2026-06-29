-- Backfill session_notes for calendar events that don't have one yet.
-- The new get_sessions_by_client_id RPC queries session_notes as the primary
-- source, so historical sessions only in calendar_events would be invisible.

INSERT INTO session_notes (user_id, client_id, calendar_event_id, session_date)
SELECT ce.user_id, ce.client_id, ce.id::text, ce.start_time
FROM calendar_events ce
WHERE NOT EXISTS (
  SELECT 1 FROM session_notes sn
  WHERE sn.calendar_event_id = ce.id::text
    AND sn.user_id = ce.user_id
)
AND ce.client_id IS NOT NULL
AND ce.start_time <= NOW()
AND (ce.status IS NULL OR ce.status != 'cancelled');
