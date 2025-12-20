-- Create function to get clients grouped by their timezone region
CREATE OR REPLACE FUNCTION get_clients_by_region()
RETURNS TABLE(
    client_id UUID,
    client_name TEXT,
    location TEXT,
    region TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as client_id,
        c.name as client_name,
        c.location,
        CASE LOWER(TRIM(c.location))
            -- West Coast (Pacific)
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
            
            -- East Coast (Eastern)
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
            
            -- Europe
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
            
            -- Asia Pacific
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
    ORDER BY region, c.name;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_clients_by_region() TO authenticated;
GRANT EXECUTE ON FUNCTION get_clients_by_region() TO anon;
GRANT EXECUTE ON FUNCTION get_clients_by_region() TO service_role;

