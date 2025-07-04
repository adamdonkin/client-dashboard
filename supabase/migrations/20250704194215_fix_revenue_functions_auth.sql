-- Update revenue functions to use auth.uid() like the working session functions
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
    COUNT(*) as active_paying_clients,
    COALESCE(AVG(c.monthly_fee), 0) as average_client_fee
  FROM clients c
  WHERE c.user_id = auth.uid() 
  AND c.is_active = true
  AND c.monthly_fee IS NOT NULL
  AND c.monthly_fee > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;