-- Add function to calculate average client engagement length in months
-- Engagement = time between first and last session per client

CREATE OR REPLACE FUNCTION get_avg_engagement_length()
RETURNS NUMERIC(4,1)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    avg_months NUMERIC(4,1);
BEGIN
    SELECT COALESCE(
        AVG(
            EXTRACT(EPOCH FROM (last_session - first_session)) / (30.44 * 24 * 60 * 60)
        ),
        0
    )
    INTO avg_months
    FROM (
        SELECT 
            c.id as client_id,
            MIN(ce.start_time) as first_session,
            MAX(ce.start_time) as last_session
        FROM clients c
        JOIN calendar_events ce ON c.id = ce.client_id
        WHERE c.user_id = auth.uid()
            AND ce.user_id = auth.uid()
        GROUP BY c.id
        HAVING COUNT(ce.id) >= 2  -- Only include clients with at least 2 sessions
    ) client_sessions;
    
    RETURN ROUND(avg_months, 1);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_avg_engagement_length() TO authenticated;
GRANT EXECUTE ON FUNCTION get_avg_engagement_length() TO anon;
GRANT EXECUTE ON FUNCTION get_avg_engagement_length() TO service_role;










