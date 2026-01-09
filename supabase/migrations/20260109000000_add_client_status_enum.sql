-- Add client status enum for tracking client lifecycle
-- Status values:
--   'active'   - Signed client, count in revenue and capacity
--   'pending'  - Holding slot, count in capacity but NOT revenue
--   'waiting'  - On waitlist, no slot held
--   'inactive' - No longer coaching

-- Create the enum type
DO $$ BEGIN
    CREATE TYPE client_status AS ENUM ('active', 'pending', 'waiting', 'inactive');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add the status column to clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS status client_status;

-- Migrate existing data based on is_active
UPDATE clients 
SET status = CASE 
    WHEN is_active = false THEN 'inactive'::client_status
    ELSE 'active'::client_status  -- NULL or true becomes active
END
WHERE status IS NULL;

-- Set default for new clients
ALTER TABLE clients ALTER COLUMN status SET DEFAULT 'active'::client_status;

-- Update get_revenue_stats to only count 'active' clients for revenue
-- but count 'active' + 'pending' for capacity
DROP FUNCTION IF EXISTS get_revenue_stats();
CREATE OR REPLACE FUNCTION get_revenue_stats()
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
    -- Revenue only from active clients
    COALESCE(SUM(c.monthly_fee) FILTER (
      WHERE c.status = 'active' OR (c.status IS NULL AND (c.is_active IS NULL OR c.is_active = true))
    ), 0) as total_monthly_revenue,
    
    COALESCE(SUM(c.monthly_fee * 12) FILTER (
      WHERE c.status = 'active' OR (c.status IS NULL AND (c.is_active IS NULL OR c.is_active = true))
    ), 0) as annual_projection,
    
    -- Count of active clients (for revenue display)
    COUNT(*) FILTER (
      WHERE c.status = 'active' OR (c.status IS NULL AND (c.is_active IS NULL OR c.is_active = true))
    ) as active_paying_clients,
    
    COALESCE(AVG(c.monthly_fee) FILTER (
      WHERE c.status = 'active' OR (c.status IS NULL AND (c.is_active IS NULL OR c.is_active = true))
    ), 0) as average_client_fee,
    
    -- Pending revenue (potential)
    COALESCE(SUM(c.monthly_fee) FILTER (WHERE c.status = 'pending'), 0) as pending_monthly_revenue,
    
    -- Pending client count
    COUNT(*) FILTER (WHERE c.status = 'pending') as pending_clients,
    
    -- Capacity = active + pending
    COUNT(*) FILTER (
      WHERE c.status IN ('active', 'pending') 
      OR (c.status IS NULL AND (c.is_active IS NULL OR c.is_active = true))
    ) as capacity_count
    
  FROM clients c
  WHERE c.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update Mochary Method filtered version
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
    
    COALESCE(SUM(c.monthly_fee) FILTER (WHERE c.status = 'pending'), 0) as pending_monthly_revenue,
    
    COUNT(*) FILTER (WHERE c.status = 'pending') as pending_clients,
    
    COUNT(*) FILTER (
      WHERE c.status IN ('active', 'pending') 
      OR (c.status IS NULL AND (c.is_active IS NULL OR c.is_active = true))
    ) as capacity_count
    
  FROM clients c
  WHERE c.user_id = auth.uid()
  AND c.referral_source::text = 'Mochary Method';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_clients_needs_scheduling to only include active and pending clients
CREATE OR REPLACE FUNCTION get_clients_needs_scheduling()
RETURNS TABLE(
  client_id uuid,
  user_id uuid,
  client_name text,
  client_email text,
  phone text,
  session_count integer,
  notes text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  company_name text,
  role text,
  slack text,
  is_active boolean,
  monthly_fee numeric,
  granola_notes_folder text,
  defacto_meeting text,
  last_session_date timestamp with time zone, 
  days_since_last_session integer, 
  priority_level text
)
LANGUAGE plpgsql SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.user_id,
    c.name,
    c.email,
    c.phone,
    c.session_count,
    c.notes,
    c.created_at,
    c.updated_at,
    c.company_name,
    c.role,
    c.slack,
    c.is_active,
    c.monthly_fee,
    c.granola_notes_folder,
    c.defacto_meeting,
    MAX(ce.start_time) as last_session_date,
    COALESCE(
      EXTRACT(DAYS FROM (NOW() AT TIME ZONE 'America/Los_Angeles' - MAX(ce.start_time AT TIME ZONE 'America/Los_Angeles')))::INTEGER,
      999
    ) as days_since_last_session,
    CASE 
      WHEN COALESCE(EXTRACT(DAYS FROM (NOW() AT TIME ZONE 'America/Los_Angeles' - MAX(ce.start_time AT TIME ZONE 'America/Los_Angeles')))::INTEGER, 999) >= 30 THEN 'high'
      WHEN COALESCE(EXTRACT(DAYS FROM (NOW() AT TIME ZONE 'America/Los_Angeles' - MAX(ce.start_time AT TIME ZONE 'America/Los_Angeles')))::INTEGER, 999) >= 14 THEN 'medium'
      ELSE 'low'
    END as priority_level
  FROM clients c
  LEFT JOIN calendar_events ce ON c.id = ce.client_id 
    AND ce.user_id = auth.uid()
    AND ce.start_time <= NOW()
    AND (ce.status IS NULL OR ce.status != 'cancelled')
  WHERE c.user_id = auth.uid()
    -- Include active and pending clients (they need scheduling)
    AND (
      c.status IN ('active', 'pending')
      OR (c.status IS NULL AND (c.is_active IS NULL OR c.is_active = true))
    )
    AND NOT EXISTS (
      SELECT 1 FROM calendar_events future_ce 
      WHERE future_ce.client_id = c.id 
        AND future_ce.user_id = auth.uid()
        AND future_ce.start_time > NOW()
        AND (future_ce.status IS NULL OR future_ce.status != 'cancelled')
    )
  GROUP BY c.id, c.user_id, c.name, c.email, c.phone, c.session_count, c.notes, c.created_at, c.updated_at, c.company_name, c.role, c.slack, c.is_active, c.monthly_fee, c.granola_notes_folder, c.defacto_meeting
  ORDER BY days_since_last_session DESC;
END;
$function$;

-- Get waitlist clients function
CREATE OR REPLACE FUNCTION get_waitlist_clients()
RETURNS TABLE(
  id uuid,
  name text,
  email text,
  company_name text,
  role text,
  notes text,
  monthly_fee numeric,
  created_at timestamp with time zone
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.email,
    c.company_name,
    c.role,
    c.notes,
    c.monthly_fee,
    c.created_at
  FROM clients c
  WHERE c.user_id = auth.uid()
    AND c.status = 'waiting'
  ORDER BY c.created_at ASC;
END;
$$;

