-- Function to calculate total monthly recurring revenue
CREATE OR REPLACE FUNCTION get_monthly_revenue(user_uuid uuid)
RETURNS numeric AS $$
BEGIN
  RETURN (
    SELECT COALESCE(SUM(monthly_fee), 0)
    FROM clients 
    WHERE user_id = user_uuid 
    AND is_active = true
    AND monthly_fee IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get revenue breakdown by client
CREATE OR REPLACE FUNCTION get_revenue_breakdown(user_uuid uuid)
RETURNS TABLE (
  client_name text,
  client_email text,
  monthly_fee numeric,
  company_name text,
  is_active boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.name,
    c.email,
    c.monthly_fee,
    c.company_name,
    c.is_active
  FROM clients c
  WHERE c.user_id = user_uuid
  AND c.monthly_fee IS NOT NULL
  AND c.monthly_fee > 0
  ORDER BY c.monthly_fee DESC, c.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate annual revenue projection
CREATE OR REPLACE FUNCTION get_annual_revenue_projection(user_uuid uuid)
RETURNS numeric AS $$
BEGIN
  RETURN (
    SELECT COALESCE(SUM(monthly_fee * 12), 0)
    FROM clients 
    WHERE user_id = user_uuid 
    AND is_active = true
    AND monthly_fee IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get revenue statistics summary
CREATE OR REPLACE FUNCTION get_revenue_stats(user_uuid uuid)
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
  WHERE c.user_id = user_uuid 
  AND c.is_active = true
  AND c.monthly_fee IS NOT NULL
  AND c.monthly_fee > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;