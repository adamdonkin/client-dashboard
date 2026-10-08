-- Per-week session counts for the dashboard's "Sessions by week" panel and the
-- Avg Sessions per-week figure, so both read the same numbers.
--
-- Same rules as get_sessions_this_week: Pacific-time weeks starting Monday,
-- events linked to a client, staff clients excluded, cancelled events counted
-- separately. Weeks with no events are returned with zeros.

CREATE OR REPLACE FUNCTION get_sessions_by_week(p_start DATE)
RETURNS TABLE (
    week_start DATE,
    completed INTEGER,
    scheduled INTEGER,
    cancelled INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH weeks AS (
        SELECT generate_series(
            DATE_TRUNC('week', p_start::timestamp)::date,
            DATE_TRUNC('week', NOW() AT TIME ZONE 'America/Los_Angeles')::date,
            INTERVAL '1 week'
        )::date AS week_start
    ),
    events AS (
        SELECT
            DATE_TRUNC('week', ce.start_time AT TIME ZONE 'America/Los_Angeles')::date AS week_start,
            ce.start_time,
            ce.status
        FROM calendar_events ce
        JOIN clients c ON c.id = ce.client_id
        WHERE ce.user_id IN (SELECT accessible_user_ids())
            AND ce.client_id IS NOT NULL
            AND (c.status IS NULL OR c.status != 'staff')
            AND ce.start_time >= (DATE_TRUNC('week', p_start::timestamp) AT TIME ZONE 'America/Los_Angeles')
    )
    SELECT
        w.week_start,
        COUNT(e.*) FILTER (WHERE (e.status IS NULL OR e.status != 'cancelled') AND e.start_time <= NOW())::int,
        COUNT(e.*) FILTER (WHERE (e.status IS NULL OR e.status != 'cancelled') AND e.start_time > NOW())::int,
        COUNT(e.*) FILTER (WHERE e.status = 'cancelled')::int
    FROM weeks w
    LEFT JOIN events e ON e.week_start = w.week_start
    GROUP BY w.week_start
    ORDER BY w.week_start;
$$;

REVOKE ALL ON FUNCTION get_sessions_by_week(DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_sessions_by_week(DATE) TO authenticated;
