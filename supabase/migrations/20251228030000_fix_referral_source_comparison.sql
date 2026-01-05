-- Fix the referral source comparison by casting properly

-- Drop and recreate the filtered revenue function with proper type casting
DROP FUNCTION IF EXISTS get_revenue_stats_filtered(TEXT);
DROP FUNCTION IF EXISTS get_revenue_stats_mochary_method();

-- Function to get revenue stats filtered by referral source
CREATE OR REPLACE FUNCTION get_revenue_stats_filtered(filter_source TEXT DEFAULT NULL)
RETURNS TABLE (
  total_monthly_revenue numeric,
  annual_projection numeric,
  active_paying_clients bigint,
  average_client_fee numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(c.monthly_fee), 0) as total_monthly_revenue,
    COALESCE(SUM(c.monthly_fee * 12), 0) as annual_projection,
    COUNT(*) as active_paying_clients,
    COALESCE(AVG(c.monthly_fee), 0) as average_client_fee
  FROM clients c
  WHERE c.user_id = auth.uid() 
  AND c.is_active = true
  AND c.monthly_fee IS NOT NULL
  AND c.monthly_fee > 0
  AND (filter_source IS NULL OR c.referral_source::text = filter_source);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function specifically for Mochary Method clients (convenience function)
CREATE OR REPLACE FUNCTION get_revenue_stats_mochary_method()
RETURNS TABLE (
  total_monthly_revenue numeric,
  annual_projection numeric,
  active_paying_clients bigint,
  average_client_fee numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM get_revenue_stats_filtered('Mochary Method');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

