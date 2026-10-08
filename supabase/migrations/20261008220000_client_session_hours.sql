-- Completed coaching hours per client over a recent window, for the hourly
-- rate column on the Clients page.
--
-- first_session is the client's earliest completed session ever, so the page
-- can shorten the window for clients who started partway through it.

CREATE OR REPLACE FUNCTION get_client_session_hours(p_months INTEGER DEFAULT 3)
RETURNS TABLE (
    client_id UUID,
    hours NUMERIC,
    sessions INTEGER,
    first_session TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        ce.client_id,
        COALESCE(SUM(EXTRACT(EPOCH FROM (ce.end_time - ce.start_time)) / 3600.0)
            FILTER (WHERE ce.start_time >= NOW() - make_interval(months => p_months)), 0)::numeric,
        COUNT(*) FILTER (WHERE ce.start_time >= NOW() - make_interval(months => p_months))::int,
        MIN(ce.start_time)
    FROM calendar_events ce
    WHERE ce.user_id IN (SELECT accessible_user_ids())
        AND ce.client_id IS NOT NULL
        AND ce.start_time <= NOW()
        AND ce.end_time > ce.start_time
        AND (ce.status IS NULL OR ce.status != 'cancelled')
    GROUP BY ce.client_id;
$$;

REVOKE ALL ON FUNCTION get_client_session_hours(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_client_session_hours(INTEGER) TO authenticated;
