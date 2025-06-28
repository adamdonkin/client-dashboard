-- Create function to get key coaching statistics
CREATE OR REPLACE FUNCTION get_coaching_stats()
RETURNS TABLE(
  sessions_this_week INTEGER,
  avg_sessions_per_week NUMERIC,
  avg_sessions_per_month NUMERIC,
  reschedule_cancel_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH time_boundaries AS (
    SELECT 
      DATE_TRUNC('week', NOW() AT TIME ZONE 'America/Los_Angeles')::DATE as week_start,
      (DATE_TRUNC('week', NOW() AT TIME ZONE 'America/Los_Angeles') + INTERVAL '6 days')::DATE as week_end,
      (NOW() AT TIME ZONE 'America/Los_Angeles' - INTERVAL '12 weeks')::DATE as twelve_weeks_ago,
      (NOW() AT TIME ZONE 'America/Los_Angeles' - INTERVAL '12 months')::DATE as twelve_months_ago
  ),
  
  -- Sessions this week (Sunday to Saturday)
  this_week_sessions AS (
    SELECT COUNT(*) as count
    FROM calendar_events ce, time_boundaries tb
    WHERE ce.user_id = auth.uid()
      AND ce.client_id IS NOT NULL
      AND DATE(ce.start_time AT TIME ZONE 'America/Los_Angeles') >= tb.week_start
      AND DATE(ce.start_time AT TIME ZONE 'America/Los_Angeles') <= tb.week_end
  ),
  
  -- Weekly sessions for last 12 weeks
  weekly_sessions AS (
    SELECT 
      DATE_TRUNC('week', ce.start_time AT TIME ZONE 'America/Los_Angeles') as week,
      COUNT(*) as sessions_in_week
    FROM calendar_events ce, time_boundaries tb
    WHERE ce.user_id = auth.uid()
      AND ce.client_id IS NOT NULL
      AND ce.start_time AT TIME ZONE 'America/Los_Angeles' >= tb.twelve_weeks_ago
    GROUP BY DATE_TRUNC('week', ce.start_time AT TIME ZONE 'America/Los_Angeles')
  ),
  
  -- Monthly sessions for last 12 months
  monthly_sessions AS (
    SELECT 
      DATE_TRUNC('month', ce.start_time AT TIME ZONE 'America/Los_Angeles') as month,
      COUNT(*) as sessions_in_month
    FROM calendar_events ce, time_boundaries tb
    WHERE ce.user_id = auth.uid()
      AND ce.client_id IS NOT NULL
      AND ce.start_time AT TIME ZONE 'America/Los_Angeles' >= tb.twelve_months_ago
    GROUP BY DATE_TRUNC('month', ce.start_time AT TIME ZONE 'America/Los_Angeles')
  ),
  
  -- Reschedule/Cancel rate calculation
  session_status_stats AS (
    SELECT 
      COUNT(*) as total_sessions,
      COUNT(*) FILTER (WHERE s.status IN ('cancelled', 'rescheduled', 'no-show')) as disrupted_sessions
    FROM sessions s
    INNER JOIN clients c ON s.client_id = c.id
    WHERE c.user_id = auth.uid()
      AND s.date >= (NOW() - INTERVAL '6 months')::DATE  -- Last 6 months for rate calculation
  )
  
  SELECT 
    (SELECT count FROM this_week_sessions)::INTEGER as sessions_this_week,
    COALESCE(ROUND((SELECT AVG(sessions_in_week) FROM weekly_sessions), 1), 0) as avg_sessions_per_week,
    COALESCE(ROUND((SELECT AVG(sessions_in_month) FROM monthly_sessions), 1), 0) as avg_sessions_per_month,
    COALESCE(
      CASE 
        WHEN (SELECT total_sessions FROM session_status_stats) > 0 
        THEN ROUND(
          (SELECT disrupted_sessions FROM session_status_stats)::NUMERIC / 
          (SELECT total_sessions FROM session_status_stats) * 100, 1
        )
        ELSE 0
      END, 
      0
    ) as reschedule_cancel_rate;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 