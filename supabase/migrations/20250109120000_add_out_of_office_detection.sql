-- Create table to store detected out-of-office periods
CREATE TABLE IF NOT EXISTS "public"."out_of_office_periods" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "start_date" date NOT NULL,
    "end_date" date NOT NULL,
    "title" text,
    "source" text DEFAULT 'calendar_event',
    "calendar_event_id" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add constraints
ALTER TABLE ONLY "public"."out_of_office_periods"
    ADD CONSTRAINT "out_of_office_periods_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."out_of_office_periods"
    ADD CONSTRAINT "out_of_office_periods_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."out_of_office_periods"
    ADD CONSTRAINT "out_of_office_periods_date_check" 
    CHECK ("end_date" >= "start_date");

-- Enable RLS
ALTER TABLE "public"."out_of_office_periods" ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own OOO periods" ON "public"."out_of_office_periods"
    FOR SELECT USING ("user_id" = "auth"."uid"());

CREATE POLICY "Users can manage their own OOO periods" ON "public"."out_of_office_periods"
    FOR ALL USING ("user_id" = "auth"."uid"());

-- Grant permissions
ALTER TABLE "public"."out_of_office_periods" OWNER TO "postgres";
GRANT ALL ON TABLE "public"."out_of_office_periods" TO "anon";
GRANT ALL ON TABLE "public"."out_of_office_periods" TO "authenticated";
GRANT ALL ON TABLE "public"."out_of_office_periods" TO "service_role";

-- Function to analyze out-of-office weeks
CREATE OR REPLACE FUNCTION get_out_of_office_analysis()
RETURNS TABLE(
    week_start date,
    week_end date,
    session_count integer,
    avg_weekly_sessions numeric,
    is_likely_ooo boolean,
    ooo_events text[]
) AS $$
BEGIN
    RETURN QUERY
    WITH weekly_sessions AS (
        SELECT 
            DATE_TRUNC('week', ce.start_time AT TIME ZONE 'America/Los_Angeles')::DATE as week,
            COUNT(*) as sessions
        FROM calendar_events ce
        WHERE ce.user_id = auth.uid()
            AND ce.client_id IS NOT NULL
            AND ce.start_time >= NOW() - INTERVAL '16 weeks'
            AND ce.start_time < NOW() + INTERVAL '4 weeks'
        GROUP BY DATE_TRUNC('week', ce.start_time AT TIME ZONE 'America/Los_Angeles')::DATE
    ),
    all_weeks AS (
        SELECT generate_series(
            DATE_TRUNC('week', NOW() - INTERVAL '16 weeks')::DATE,
            DATE_TRUNC('week', NOW() + INTERVAL '4 weeks')::DATE,
            '1 week'::INTERVAL
        )::DATE as week
    ),
    weekly_data AS (
        SELECT 
            aw.week,
            COALESCE(ws.sessions, 0) as session_count
        FROM all_weeks aw
        LEFT JOIN weekly_sessions ws ON aw.week = ws.week
    ),
    avg_calculation AS (
        SELECT AVG(session_count) as avg_sessions
        FROM weekly_data
        WHERE session_count > 0
    ),
    ooo_events_by_week AS (
        SELECT 
            DATE_TRUNC('week', ooo.start_date)::DATE as week,
            array_agg(DISTINCT ooo.title) as event_titles
        FROM out_of_office_periods ooo
        WHERE ooo.user_id = auth.uid()
        GROUP BY DATE_TRUNC('week', ooo.start_date)::DATE
    )
    SELECT 
        wd.week as week_start,
        (wd.week + INTERVAL '6 days')::DATE as week_end,
        wd.session_count::INTEGER,
        ROUND(ac.avg_sessions, 1) as avg_weekly_sessions,
        (wd.session_count = 0 OR wd.session_count < (ac.avg_sessions * 0.3)) as is_likely_ooo,
        COALESCE(oew.event_titles, ARRAY[]::text[]) as ooo_events
    FROM weekly_data wd, avg_calculation ac
    LEFT JOIN ooo_events_by_week oew ON wd.week = oew.week
    ORDER BY wd.week DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;