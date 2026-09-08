-- Widen the Asia Pacific arm of the region mapping.
--
-- clients.location is free text, and the mapping only recognised a short list of cities.
-- Anything unrecognised falls through to 'Unknown', which drops the client out of the
-- Timezones page entirely and out of the morning-pressure percentage, silently — a client
-- in Manila simply did not appear. Countries are added alongside cities because that is
-- how the field actually gets filled in.
--
-- Redefines get_clients_by_region from 20260706140000_add_team_access.sql; everything
-- other than the added WHEN branches is carried over unchanged.

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

            WHEN 'denver' THEN 'Mountain'
            WHEN 'boulder' THEN 'Mountain'
            WHEN 'salt lake city' THEN 'Mountain'
            WHEN 'phoenix' THEN 'Mountain'
            WHEN 'albuquerque' THEN 'Mountain'
            WHEN 'colorado' THEN 'Mountain'

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

            WHEN 'singapore' THEN 'Asia Pacific'
            WHEN 'hong kong' THEN 'Asia Pacific'
            WHEN 'hongkong' THEN 'Asia Pacific'
            WHEN 'tokyo' THEN 'Asia Pacific'
            WHEN 'osaka' THEN 'Asia Pacific'
            WHEN 'kyoto' THEN 'Asia Pacific'
            WHEN 'japan' THEN 'Asia Pacific'
            WHEN 'sydney' THEN 'Asia Pacific'
            WHEN 'melbourne' THEN 'Asia Pacific'
            WHEN 'brisbane' THEN 'Asia Pacific'
            WHEN 'perth' THEN 'Asia Pacific'
            WHEN 'australia' THEN 'Asia Pacific'
            WHEN 'auckland' THEN 'Asia Pacific'
            WHEN 'wellington' THEN 'Asia Pacific'
            WHEN 'new zealand' THEN 'Asia Pacific'
            WHEN 'beijing' THEN 'Asia Pacific'
            WHEN 'shanghai' THEN 'Asia Pacific'
            WHEN 'shenzhen' THEN 'Asia Pacific'
            WHEN 'china' THEN 'Asia Pacific'
            WHEN 'taipei' THEN 'Asia Pacific'
            WHEN 'taiwan' THEN 'Asia Pacific'
            WHEN 'seoul' THEN 'Asia Pacific'
            WHEN 'south korea' THEN 'Asia Pacific'
            WHEN 'korea' THEN 'Asia Pacific'
            WHEN 'manila' THEN 'Asia Pacific'
            WHEN 'cebu' THEN 'Asia Pacific'
            WHEN 'philippines' THEN 'Asia Pacific'
            WHEN 'the philippines' THEN 'Asia Pacific'
            WHEN 'bangkok' THEN 'Asia Pacific'
            WHEN 'thailand' THEN 'Asia Pacific'
            WHEN 'jakarta' THEN 'Asia Pacific'
            WHEN 'indonesia' THEN 'Asia Pacific'
            WHEN 'bali' THEN 'Asia Pacific'
            WHEN 'kuala lumpur' THEN 'Asia Pacific'
            WHEN 'malaysia' THEN 'Asia Pacific'
            WHEN 'ho chi minh city' THEN 'Asia Pacific'
            WHEN 'hanoi' THEN 'Asia Pacific'
            WHEN 'vietnam' THEN 'Asia Pacific'
            WHEN 'mumbai' THEN 'Asia Pacific'
            WHEN 'bangalore' THEN 'Asia Pacific'
            WHEN 'bengaluru' THEN 'Asia Pacific'
            WHEN 'delhi' THEN 'Asia Pacific'
            WHEN 'new delhi' THEN 'Asia Pacific'
            WHEN 'chennai' THEN 'Asia Pacific'
            WHEN 'hyderabad' THEN 'Asia Pacific'
            WHEN 'pune' THEN 'Asia Pacific'
            WHEN 'india' THEN 'Asia Pacific'
            WHEN 'dubai' THEN 'Asia Pacific'
            WHEN 'abu dhabi' THEN 'Asia Pacific'
            WHEN 'tel aviv' THEN 'Asia Pacific'
            WHEN 'israel' THEN 'Asia Pacific'

            ELSE 'Unknown'
        END as region
    FROM clients c
    WHERE c.user_id IN (SELECT accessible_user_ids())
        AND (c.is_active IS NULL OR c.is_active = true)
        AND c.location IS NOT NULL
        AND c.location != ''
    ORDER BY region, c.name;
END;
$$;

GRANT EXECUTE ON FUNCTION get_clients_by_region() TO authenticated;
GRANT EXECUTE ON FUNCTION get_clients_by_region() TO anon;
GRANT EXECUTE ON FUNCTION get_clients_by_region() TO service_role;

NOTIFY pgrst, 'reload schema';
