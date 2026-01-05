-- Create function to get total coaching hours in the current year
CREATE OR REPLACE FUNCTION get_total_hours_this_year()
RETURNS NUMERIC(6,1)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    year_start TIMESTAMPTZ;
    total_hours NUMERIC(6,1);
BEGIN
    -- Get the start of the current year in LA timezone
    year_start := DATE_TRUNC('year', NOW() AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles';
    
    SELECT COALESCE(
        SUM(EXTRACT(EPOCH FROM (ce.end_time - ce.start_time)) / 3600),
        0
    )
    INTO total_hours
    FROM calendar_events ce
    WHERE ce.client_id IS NOT NULL
        AND ce.start_time >= year_start
        AND ce.start_time <= NOW();
        
    RETURN ROUND(total_hours, 1);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_total_hours_this_year() TO authenticated;
GRANT EXECUTE ON FUNCTION get_total_hours_this_year() TO anon;
GRANT EXECUTE ON FUNCTION get_total_hours_this_year() TO service_role;





