-- Stop counting pending clients inside the Mochary revenue total.
--
-- 20260804140000 repurposed this function from a referral_source filter to a
-- name exclusion, and in the rewrite replaced the per-status FILTER clauses with
-- a single WHERE that admits every status except 'inactive' and 'staff'. That
-- folded pending (and waiting) fees into total_monthly_revenue and dropped the
-- pending_monthly_revenue/pending_clients columns, so the dashboard showed
-- "+$X pending" alongside a total that already contained it.
--
-- Restores the FILTER clauses used by get_revenue_stats(): revenue and fee
-- averages count signed clients only, pending is reported separately, and
-- capacity_count keeps its own subquery so clients held without a fee still
-- occupy a slot.

DROP FUNCTION IF EXISTS get_revenue_stats_mochary_method();
CREATE OR REPLACE FUNCTION get_revenue_stats_mochary_method()
RETURNS TABLE (
  total_monthly_revenue numeric,
  annual_projection numeric,
  active_paying_clients bigint,
  average_client_fee numeric,
  pending_monthly_revenue numeric,
  pending_clients bigint,
  capacity_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(c.monthly_fee) FILTER (
      WHERE c.status = 'active' OR c.status IS NULL
    ), 0) as total_monthly_revenue,
    COALESCE(SUM(c.monthly_fee * 12) FILTER (
      WHERE c.status = 'active' OR c.status IS NULL
    ), 0) as annual_projection,
    COUNT(*) FILTER (
      WHERE c.status = 'active' OR c.status IS NULL
    )::bigint as active_paying_clients,
    COALESCE(AVG(c.monthly_fee) FILTER (
      WHERE c.status = 'active' OR c.status IS NULL
    ), 0) as average_client_fee,
    COALESCE(SUM(c.monthly_fee) FILTER (WHERE c.status = 'pending'), 0) as pending_monthly_revenue,
    COUNT(*) FILTER (WHERE c.status = 'pending')::bigint as pending_clients,
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
