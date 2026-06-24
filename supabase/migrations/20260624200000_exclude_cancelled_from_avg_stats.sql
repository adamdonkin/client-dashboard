-- Exclude cancelled events from avg sessions per week, avg sessions per month,
-- and avg engagement length calculations

CREATE OR REPLACE FUNCTION get_avg_sessions_per_week()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    twelve_weeks_ago TIMESTAMPTZ;
    total_sessions INTEGER;
    avg_per_week NUMERIC(4,1);
BEGIN
    twelve_weeks_ago := NOW() - INTERVAL '12 weeks';

    SELECT COUNT(*)
    INTO total_sessions
    FROM calendar_events ce
    WHERE ce.user_id = auth.uid()
        AND ce.start_time >= twelve_weeks_ago
        AND ce.start_time <= NOW()
        AND ce.client_id IS NOT NULL
        AND (ce.status IS NULL OR ce.status != 'cancelled');

    avg_per_week := total_sessions::NUMERIC / 12.0;

    RETURN ROUND(avg_per_week, 1);
END;
$$;

CREATE OR REPLACE FUNCTION get_avg_sessions_per_month()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    three_months_ago TIMESTAMPTZ;
    total_sessions INTEGER;
    avg_per_month NUMERIC(4,1);
BEGIN
    three_months_ago := NOW() - INTERVAL '3 months';

    SELECT COUNT(*)
    INTO total_sessions
    FROM calendar_events ce
    WHERE ce.user_id = auth.uid()
        AND ce.start_time >= three_months_ago
        AND ce.start_time <= NOW()
        AND ce.client_id IS NOT NULL
        AND (ce.status IS NULL OR ce.status != 'cancelled');

    avg_per_month := total_sessions::NUMERIC / 3.0;

    RETURN ROUND(avg_per_month, 1);
END;
$$;

CREATE OR REPLACE FUNCTION get_avg_engagement_length()
RETURNS NUMERIC(4,1)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    avg_months NUMERIC(4,1);
BEGIN
    SELECT COALESCE(
        AVG(
            EXTRACT(EPOCH FROM (last_session - first_session)) / (30.44 * 24 * 60 * 60)
        ),
        0
    )
    INTO avg_months
    FROM (
        SELECT
            c.id as client_id,
            MIN(ce.start_time) as first_session,
            MAX(ce.start_time) as last_session
        FROM clients c
        JOIN calendar_events ce ON c.id = ce.client_id
        WHERE c.user_id = auth.uid()
            AND ce.user_id = auth.uid()
            AND (ce.status IS NULL OR ce.status != 'cancelled')
        GROUP BY c.id
        HAVING COUNT(ce.id) >= 2
    ) client_sessions;

    RETURN ROUND(avg_months, 1);
END;
$$;
