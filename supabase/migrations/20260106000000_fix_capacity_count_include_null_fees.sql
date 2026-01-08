-- Fix capacity count to include clients without monthly fees
-- (e.g., holding slots for clients who haven't signed yet)

CREATE OR REPLACE FUNCTION get_revenue_stats()
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
    COUNT(*) as active_paying_clients,  -- Count all active clients, not just those with fees
    COALESCE(AVG(c.monthly_fee), 0) as average_client_fee
  FROM clients c
  WHERE c.user_id = auth.uid() 
  AND (c.is_active IS NULL OR c.is_active = true);  -- Match standard active client filter
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also update the Mochary Method filtered version
CREATE OR REPLACE FUNCTION get_revenue_stats_mochary_method()
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
  AND (c.is_active IS NULL OR c.is_active = true)
  AND c.referral_source::text = 'Mochary Method';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


