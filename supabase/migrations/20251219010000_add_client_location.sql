-- Add location column to clients table for timezone tracking
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS location TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.clients.location IS 'Client home city for timezone region mapping (e.g., "New York", "London")';

-- Create function to get client distribution by timezone region
CREATE OR REPLACE FUNCTION get_client_timezone_distribution()
RETURNS TABLE(
    region TEXT,
    client_count INTEGER,
    percentage NUMERIC(5,1)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_clients INTEGER;
BEGIN
    -- Get total active clients with location set
    SELECT COUNT(*)
    INTO total_clients
    FROM clients c
    WHERE c.user_id = auth.uid()
        AND (c.is_active IS NULL OR c.is_active = true)
        AND c.location IS NOT NULL
        AND c.location != '';

    RETURN QUERY
    WITH client_regions AS (
        SELECT 
            CASE LOWER(TRIM(c.location))
                -- West Coast (Pacific) - Your timezone
                WHEN 'san francisco' THEN 'West Coast'
                WHEN 'sf' THEN 'West Coast'
                WHEN 'los angeles' THEN 'West Coast'
                WHEN 'la' THEN 'West Coast'
                WHEN 'seattle' THEN 'West Coast'
                WHEN 'portland' THEN 'West Coast'
                WHEN 'san diego' THEN 'West Coast'
                WHEN 'oakland' THEN 'West Coast'
                WHEN 'san jose' THEN 'West Coast'
                WHEN 'palo alto' THEN 'West Coast'
                WHEN 'menlo park' THEN 'West Coast'
                WHEN 'mountain view' THEN 'West Coast'
                WHEN 'sunnyvale' THEN 'West Coast'
                WHEN 'cupertino' THEN 'West Coast'
                WHEN 'sacramento' THEN 'West Coast'
                WHEN 'vancouver' THEN 'West Coast'
                WHEN 'ross' THEN 'West Coast'
                WHEN 'ross, ca' THEN 'West Coast'
                
                -- Mountain
                WHEN 'denver' THEN 'Mountain'
                WHEN 'boulder' THEN 'Mountain'
                WHEN 'salt lake city' THEN 'Mountain'
                WHEN 'phoenix' THEN 'Mountain'
                WHEN 'albuquerque' THEN 'Mountain'
                WHEN 'colorado' THEN 'Mountain'
                
                -- Central
                WHEN 'chicago' THEN 'Central'
                WHEN 'austin' THEN 'Central'
                WHEN 'dallas' THEN 'Central'
                WHEN 'houston' THEN 'Central'
                WHEN 'minneapolis' THEN 'Central'
                WHEN 'nashville' THEN 'Central'
                WHEN 'new orleans' THEN 'Central'
                WHEN 'kansas city' THEN 'Central'
                WHEN 'st louis' THEN 'Central'
                WHEN 'milwaukee' THEN 'Central'
                
                -- East Coast (Eastern) - Morning pressure
                WHEN 'new york' THEN 'East Coast'
                WHEN 'nyc' THEN 'East Coast'
                WHEN 'boston' THEN 'East Coast'
                WHEN 'miami' THEN 'East Coast'
                WHEN 'washington dc' THEN 'East Coast'
                WHEN 'washington' THEN 'East Coast'
                WHEN 'dc' THEN 'East Coast'
                WHEN 'atlanta' THEN 'East Coast'
                WHEN 'philadelphia' THEN 'East Coast'
                WHEN 'charlotte' THEN 'East Coast'
                WHEN 'raleigh' THEN 'East Coast'
                WHEN 'baltimore' THEN 'East Coast'
                WHEN 'pittsburgh' THEN 'East Coast'
                WHEN 'detroit' THEN 'East Coast'
                WHEN 'toronto' THEN 'East Coast'
                WHEN 'montreal' THEN 'East Coast'
                
                -- Europe - High morning pressure (6-9 hours ahead)
                WHEN 'london' THEN 'Europe'
                WHEN 'paris' THEN 'Europe'
                WHEN 'berlin' THEN 'Europe'
                WHEN 'amsterdam' THEN 'Europe'
                WHEN 'dublin' THEN 'Europe'
                WHEN 'madrid' THEN 'Europe'
                WHEN 'barcelona' THEN 'Europe'
                WHEN 'munich' THEN 'Europe'
                WHEN 'zurich' THEN 'Europe'
                WHEN 'vienna' THEN 'Europe'
                WHEN 'stockholm' THEN 'Europe'
                WHEN 'copenhagen' THEN 'Europe'
                WHEN 'oslo' THEN 'Europe'
                WHEN 'milan' THEN 'Europe'
                WHEN 'rome' THEN 'Europe'
                WHEN 'lisbon' THEN 'Europe'
                WHEN 'brussels' THEN 'Europe'
                WHEN 'helsinki' THEN 'Europe'
                WHEN 'warsaw' THEN 'Europe'
                WHEN 'prague' THEN 'Europe'
                WHEN 'bratislava' THEN 'Europe'
                
                -- Asia Pacific - Afternoon/evening slots
                WHEN 'singapore' THEN 'Asia Pacific'
                WHEN 'hong kong' THEN 'Asia Pacific'
                WHEN 'tokyo' THEN 'Asia Pacific'
                WHEN 'sydney' THEN 'Asia Pacific'
                WHEN 'melbourne' THEN 'Asia Pacific'
                WHEN 'beijing' THEN 'Asia Pacific'
                WHEN 'shanghai' THEN 'Asia Pacific'
                WHEN 'seoul' THEN 'Asia Pacific'
                WHEN 'mumbai' THEN 'Asia Pacific'
                WHEN 'bangalore' THEN 'Asia Pacific'
                WHEN 'delhi' THEN 'Asia Pacific'
                WHEN 'dubai' THEN 'Asia Pacific'
                WHEN 'tel aviv' THEN 'Asia Pacific'
                
                ELSE 'Unknown'
            END as region
        FROM clients c
        WHERE c.user_id = auth.uid()
            AND (c.is_active IS NULL OR c.is_active = true)
            AND c.location IS NOT NULL
            AND c.location != ''
    )
    SELECT 
        cr.region,
        COUNT(*)::INTEGER as client_count,
        CASE 
            WHEN total_clients > 0 THEN ROUND((COUNT(*)::NUMERIC / total_clients) * 100, 1)
            ELSE 0
        END as percentage
    FROM client_regions cr
    GROUP BY cr.region
    ORDER BY 
        CASE cr.region
            WHEN 'West Coast' THEN 1
            WHEN 'Mountain' THEN 2
            WHEN 'Central' THEN 3
            WHEN 'East Coast' THEN 4
            WHEN 'Europe' THEN 5
            WHEN 'Asia Pacific' THEN 6
            ELSE 7
        END;
END;
$$;

-- Create function to get morning pressure stats
-- (percentage of clients in timezones that require morning PT slots)
CREATE OR REPLACE FUNCTION get_morning_pressure_stats()
RETURNS TABLE(
    morning_clients INTEGER,
    total_clients_with_location INTEGER,
    morning_pressure_pct NUMERIC(5,1)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH client_regions AS (
        SELECT 
            CASE LOWER(TRIM(c.location))
                -- East Coast + Europe = Morning pressure
                WHEN 'new york' THEN true
                WHEN 'nyc' THEN true
                WHEN 'boston' THEN true
                WHEN 'miami' THEN true
                WHEN 'washington dc' THEN true
                WHEN 'washington' THEN true
                WHEN 'dc' THEN true
                WHEN 'atlanta' THEN true
                WHEN 'philadelphia' THEN true
                WHEN 'charlotte' THEN true
                WHEN 'raleigh' THEN true
                WHEN 'baltimore' THEN true
                WHEN 'pittsburgh' THEN true
                WHEN 'detroit' THEN true
                WHEN 'toronto' THEN true
                WHEN 'montreal' THEN true
                WHEN 'london' THEN true
                WHEN 'paris' THEN true
                WHEN 'berlin' THEN true
                WHEN 'amsterdam' THEN true
                WHEN 'dublin' THEN true
                WHEN 'madrid' THEN true
                WHEN 'barcelona' THEN true
                WHEN 'munich' THEN true
                WHEN 'zurich' THEN true
                WHEN 'vienna' THEN true
                WHEN 'stockholm' THEN true
                WHEN 'copenhagen' THEN true
                WHEN 'oslo' THEN true
                WHEN 'milan' THEN true
                WHEN 'rome' THEN true
                WHEN 'lisbon' THEN true
                WHEN 'brussels' THEN true
                WHEN 'helsinki' THEN true
                WHEN 'warsaw' THEN true
                WHEN 'prague' THEN true
                WHEN 'bratislava' THEN true
                ELSE false
            END as is_morning_pressure
        FROM clients c
        WHERE c.user_id = auth.uid()
            AND (c.is_active IS NULL OR c.is_active = true)
            AND c.location IS NOT NULL
            AND c.location != ''
    )
    SELECT 
        COUNT(*) FILTER (WHERE is_morning_pressure)::INTEGER as morning_clients,
        COUNT(*)::INTEGER as total_clients_with_location,
        CASE 
            WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE is_morning_pressure)::NUMERIC / COUNT(*)) * 100, 1)
            ELSE 0
        END as morning_pressure_pct
    FROM client_regions;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_client_timezone_distribution() TO authenticated;
GRANT EXECUTE ON FUNCTION get_client_timezone_distribution() TO anon;
GRANT EXECUTE ON FUNCTION get_client_timezone_distribution() TO service_role;

GRANT EXECUTE ON FUNCTION get_morning_pressure_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_morning_pressure_stats() TO anon;
GRANT EXECUTE ON FUNCTION get_morning_pressure_stats() TO service_role;

