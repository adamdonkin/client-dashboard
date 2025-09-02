-- Create new functions with EA fields (keep existing ones unchanged)
CREATE FUNCTION get_clients_this_week_with_ea()
RETURNS TABLE(
  client_id UUID,
  client_name TEXT,
  client_email TEXT,
  company_name TEXT,
  slack TEXT,
  last_session_date TIMESTAMPTZ,
  days_since_last_session INTEGER,
  priority_level TEXT,
  next_session_date TIMESTAMPTZ,
  next_session_relative TEXT,
  granola_notes_folder TEXT,
  ea_name TEXT,
  ea_email TEXT
) AS $$
-- [function body here]
$$;

-- Also create the other two functions with EA fields
CREATE FUNCTION get_clients_needs_scheduling_with_ea() ...
CREATE FUNCTION get_clients_upcoming_with_ea() ...