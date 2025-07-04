-- Add status column to calendar_events table (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calendar_events' 
        AND column_name = 'status'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE calendar_events ADD COLUMN status TEXT DEFAULT 'confirmed';
    END IF;
END $$;

-- Add index on status for better query performance (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON calendar_events(status);

-- Add comment to document the status values
COMMENT ON COLUMN calendar_events.status IS 'Status of the calendar event: active, cancelled, deleted, or rescheduled';