-- Change Mochary filter to exclude Jessie Barry by name instead of filtering by referral_source

DROP FUNCTION IF EXISTS get_revenue_stats_mochary_method();
CREATE OR REPLACE FUNCTION get_revenue_stats_mochary_method()
RETURNS TABLE (
  total_monthly_revenue numeric,
  annual_projection numeric,
  active_paying_clients bigint,
  average_client_fee numeric,
  capacity_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(c.monthly_fee), 0) as total_monthly_revenue,
    COALESCE(SUM(c.monthly_fee * 12), 0) as annual_projection,
    COUNT(*)::bigint as active_paying_clients,
    COALESCE(AVG(c.monthly_fee), 0) as average_client_fee,
    (SELECT COUNT(*)
     FROM clients c2
     WHERE c2.user_id IN (SELECT accessible_user_ids())
       AND (c2.status IS NULL OR c2.status NOT IN ('inactive', 'staff'))
       AND (c2.is_active IS NULL OR c2.is_active = true)
       AND c2.name != 'Jessie Barry'
    ) as capacity_count
  FROM clients c
  WHERE c.user_id IN (SELECT accessible_user_ids())
  AND (c.status IS NULL OR c.status NOT IN ('inactive', 'staff'))
  AND (c.is_active IS NULL OR c.is_active = true)
  AND c.monthly_fee IS NOT NULL
  AND c.monthly_fee > 0
  AND c.name != 'Jessie Barry';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
