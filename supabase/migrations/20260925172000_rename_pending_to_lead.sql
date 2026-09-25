-- Rename the 'pending' client status to 'lead', and stop leads counting toward
-- capacity or revenue.
--
-- 'pending' was defined in 20260109000000 as "holding slot, count in capacity but
-- NOT revenue" — someone who had committed but not started. In practice it became
-- the status for people booked in for an intro call, which is a different thing:
-- no fee has been agreed, and they may never sign. Carrying them produced a
-- "+$X pending" figure on the dashboard built from fees typed in before the first
-- conversation, and gave each of them one of the twenty capacity slots.
--
-- Leads are now counted, not valued. The revenue totals were already active-only
-- so they are untouched; what goes away is pending_monthly_revenue, replaced by a
-- lead_clients headcount.
--
-- RENAME VALUE rewrites every stored row, so existing pending clients become leads
-- automatically. It does not touch the 'pending' literals inside function bodies,
-- which is why both revenue functions are redefined below.

ALTER TYPE client_status RENAME VALUE 'pending' TO 'lead';

-- ----- get_revenue_stats -----
DROP FUNCTION IF EXISTS get_revenue_stats();
CREATE OR REPLACE FUNCTION get_revenue_stats()
RETURNS TABLE (
  total_monthly_revenue numeric,
  annual_projection numeric,
  active_paying_clients bigint,
  average_client_fee numeric,
  lead_clients bigint,
  capacity_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(c.monthly_fee) FILTER (
      WHERE c.status = 'active' OR (c.status IS NULL AND (c.is_active IS NULL OR c.is_active = true))
    ), 0) as total_monthly_revenue,
    COALESCE(SUM(c.monthly_fee * 12) FILTER (
      WHERE c.status = 'active' OR (c.status IS NULL AND (c.is_active IS NULL OR c.is_active = true))
    ), 0) as annual_projection,
    COUNT(*) FILTER (
      WHERE c.status = 'active' OR (c.status IS NULL AND (c.is_active IS NULL OR c.is_active = true))
    ) as active_paying_clients,
    COALESCE(AVG(c.monthly_fee) FILTER (
      WHERE c.status = 'active' OR (c.status IS NULL AND (c.is_active IS NULL OR c.is_active = true))
    ), 0) as average_client_fee,
    COUNT(*) FILTER (WHERE c.status = 'lead') as lead_clients,
    -- Equal to active_paying_clients today. Kept separate because it answers a
    -- different question — slots consumed — and is the one place to change if a
    -- committed-but-not-started state is ever reintroduced.
    COUNT(*) FILTER (
      WHERE c.status = 'active' OR (c.status IS NULL AND (c.is_active IS NULL OR c.is_active = true))
    ) as capacity_count
  FROM clients c
  WHERE c.user_id IN (SELECT accessible_user_ids());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----- get_revenue_stats_mochary_method -----
-- The outer WHERE restricts to clients with a fee, so leads and capacity are
-- counted by subquery instead: a lead usually has no fee yet and would otherwise
-- be invisible here while showing up in the unfiltered view.
DROP FUNCTION IF EXISTS get_revenue_stats_mochary_method();
CREATE OR REPLACE FUNCTION get_revenue_stats_mochary_method()
RETURNS TABLE (
  total_monthly_revenue numeric,
  annual_projection numeric,
  active_paying_clients bigint,
  average_client_fee numeric,
  lead_clients bigint,
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
    (SELECT COUNT(*)
     FROM clients c2
     WHERE c2.user_id IN (SELECT accessible_user_ids())
       AND c2.status = 'lead'
       AND c2.name != 'Jessie Barry'
    ) as lead_clients,
    (SELECT COUNT(*)
     FROM clients c2
     WHERE c2.user_id IN (SELECT accessible_user_ids())
       AND (c2.status IS NULL OR c2.status NOT IN ('inactive', 'staff', 'lead'))
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
