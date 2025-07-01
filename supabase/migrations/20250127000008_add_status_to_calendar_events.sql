-- Add status column to calendar_events table
ALTER TABLE calendar_events 
ADD COLUMN status TEXT DEFAULT 'confirmed';

-- Add index on status for better query performance
CREATE INDEX idx_calendar_events_status ON calendar_events(status);

-- Add comment to document the status values
COMMENT ON COLUMN calendar_events.status IS 'Status of the calendar event: active, cancelled, deleted, or rescheduled'; 