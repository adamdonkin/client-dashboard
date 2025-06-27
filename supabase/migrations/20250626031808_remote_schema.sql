create extension if not exists "http" with schema "public" version '1.6';

create table "public"."calendar_events" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "client_id" uuid,
    "calendar_event_id" text not null,
    "title" text,
    "start_time" timestamp with time zone not null,
    "end_time" timestamp with time zone not null,
    "calendar_name" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "attendees" jsonb
);


create table "public"."client_sync_status" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "client_email" text not null,
    "last_synced_at" timestamp with time zone default now()
);


create table "public"."clients" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "name" text not null,
    "email" text not null,
    "phone" text,
    "session_count" integer default 0,
    "notes" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "company_name" text,
    "role" text,
    "slack" text
);


alter table "public"."clients" enable row level security;

create table "public"."sessions" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "date" date,
    "notes" text,
    "client_id" uuid,
    "calendar_event_id" text,
    "status" text not null default 'completed'::text
);


alter table "public"."sessions" enable row level security;

create table "public"."user_tokens" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "access_token" text not null,
    "refresh_token" text not null,
    "token_type" text,
    "scope" text,
    "expires_at" timestamp with time zone not null,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


CREATE UNIQUE INDEX calendar_events_pkey ON public.calendar_events USING btree (id);

CREATE UNIQUE INDEX client_sync_status_pkey ON public.client_sync_status USING btree (id);

CREATE UNIQUE INDEX client_sync_status_user_id_client_email_key ON public.client_sync_status USING btree (user_id, client_email);

CREATE UNIQUE INDEX clients_pkey ON public.clients USING btree (id);

CREATE INDEX idx_clients_email ON public.clients USING btree (email);

CREATE INDEX idx_clients_user_id ON public.clients USING btree (user_id);

CREATE UNIQUE INDEX sessions_calendar_event_id_key ON public.sessions USING btree (calendar_event_id);

CREATE UNIQUE INDEX sessions_pkey ON public.sessions USING btree (id);

CREATE UNIQUE INDEX unique_event_per_user ON public.calendar_events USING btree (user_id, calendar_event_id);

CREATE UNIQUE INDEX user_tokens_pkey ON public.user_tokens USING btree (id);

alter table "public"."calendar_events" add constraint "calendar_events_pkey" PRIMARY KEY using index "calendar_events_pkey";

alter table "public"."client_sync_status" add constraint "client_sync_status_pkey" PRIMARY KEY using index "client_sync_status_pkey";

alter table "public"."clients" add constraint "clients_pkey" PRIMARY KEY using index "clients_pkey";

alter table "public"."sessions" add constraint "sessions_pkey" PRIMARY KEY using index "sessions_pkey";

alter table "public"."user_tokens" add constraint "user_tokens_pkey" PRIMARY KEY using index "user_tokens_pkey";

alter table "public"."calendar_events" add constraint "calendar_events_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE not valid;

alter table "public"."calendar_events" validate constraint "calendar_events_client_id_fkey";

alter table "public"."calendar_events" add constraint "calendar_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."calendar_events" validate constraint "calendar_events_user_id_fkey";

alter table "public"."calendar_events" add constraint "unique_event_per_user" UNIQUE using index "unique_event_per_user";

alter table "public"."client_sync_status" add constraint "client_sync_status_user_id_client_email_key" UNIQUE using index "client_sync_status_user_id_client_email_key";

alter table "public"."clients" add constraint "clients_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."clients" validate constraint "clients_user_id_fkey";

alter table "public"."sessions" add constraint "sessions_calendar_event_id_key" UNIQUE using index "sessions_calendar_event_id_key";

alter table "public"."sessions" add constraint "sessions_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE not valid;

alter table "public"."sessions" validate constraint "sessions_client_id_fkey";

alter table "public"."user_tokens" add constraint "user_tokens_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_tokens" validate constraint "user_tokens_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.check_client_scheduling_status(p_client_email text)
 RETURNS TABLE(client_name text, last_session text, next_session text, status text)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    c.name as client_name,
    COALESCE(TO_CHAR(MAX(ce.end_time) FILTER (WHERE ce.end_time < NOW()) AT TIME ZONE 'America/Los_Angeles', 'Mon DD, YYYY'), 'Never') as last_session,
    COALESCE(TO_CHAR(MIN(ce.start_time) FILTER (WHERE ce.start_time > NOW()) AT TIME ZONE 'America/Los_Angeles', 'Mon DD @ HH12:MI AM'), 'None scheduled') as next_session,
    CASE 
      WHEN MIN(ce.start_time) FILTER (WHERE ce.start_time > NOW()) IS NOT NULL THEN '✅ Scheduled'
      WHEN MAX(ce.end_time) FILTER (WHERE ce.end_time < NOW()) IS NULL THEN '🔴 New client - needs first session'
      WHEN NOW() - MAX(ce.end_time) FILTER (WHERE ce.end_time < NOW()) > INTERVAL '30 days' THEN '🔴 Needs scheduling - overdue'
      ELSE '🟡 Needs scheduling'
    END as status
  FROM clients c
  LEFT JOIN calendar_events ce ON ce.client_id = c.id
  WHERE LOWER(c.email) = LOWER(p_client_email)
  GROUP BY c.id, c.name;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_fresh_google_token(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_expires_at TIMESTAMPTZ;
  v_response http_response;
  v_url TEXT;
  v_payload TEXT;
  v_headers http_header[];
BEGIN
  -- Get current token expiration
  SELECT expires_at INTO v_expires_at
  FROM user_tokens
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No token found for user %', p_user_id;
  END IF;
  
  -- Check if token expires within 10 minutes
  IF v_expires_at < NOW() + INTERVAL '10 minutes' THEN
    -- Prepare the request
    v_url := 'https://bhiwuvjltwvdkhcnwkkt.supabase.co/functions/v1/refresh-google-token';
    v_payload := json_build_object('user_id', p_user_id)::text;
    v_headers := ARRAY[
      http_header('Content-Type', 'application/json'),
      http_header('Authorization', 'Bearer ' || current_setting('request.jwt.claims')::json->>'sub')
    ]::http_header[];
    
    -- Call the Edge Function to refresh
    v_response := http_post(v_url, v_payload, 'application/json');
    
    -- Check if refresh was successful (2xx status code)
    IF v_response.status < 200 OR v_response.status >= 300 THEN
      RAISE EXCEPTION 'Failed to refresh token. Status: %, Response: %', 
        v_response.status, v_response.content;
    END IF;
    
    RAISE NOTICE 'Token refreshed successfully for user %', p_user_id;
  ELSE
    RAISE NOTICE 'Token still valid until %', v_expires_at;
  END IF;
  
  RETURN TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_client_emails(p_user_id uuid)
 RETURNS text[]
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  client_emails TEXT[];
BEGIN
  SELECT ARRAY_AGG(LOWER(email))
  INTO client_emails
  FROM clients
  WHERE user_id = p_user_id
    AND email IS NOT NULL
    AND email != '';
  
  RETURN COALESCE(client_emails, ARRAY[]::TEXT[]);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_clients_needing_scheduling(p_user_id uuid)
 RETURNS TABLE(client_id uuid, client_name text, client_email text, company text, last_session_date timestamp with time zone, last_session_formatted text, days_since_last_session integer, total_sessions_count integer, scheduling_priority text, notes text)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  RETURN QUERY
  WITH client_sessions AS (
    SELECT 
      c.id as client_id,
      c.name as client_name,
      c.email as client_email,
      c.company_name,
      c.notes,
      MAX(ce.end_time) FILTER (WHERE ce.end_time < NOW()) as last_session,
      COUNT(ce.id) as total_sessions,
      MIN(ce.start_time) FILTER (WHERE ce.start_time > NOW()) as next_session
    FROM clients c
    LEFT JOIN calendar_events ce ON ce.client_id = c.id
    WHERE c.user_id = p_user_id
    GROUP BY c.id, c.name, c.email, c.company_name, c.notes
  )
  SELECT 
    cs.client_id,
    cs.client_name,
    cs.client_email,
    cs.company_name as company,
    cs.last_session as last_session_date,
    CASE 
      WHEN cs.last_session IS NULL THEN 'Never had session'
      ELSE TO_CHAR(cs.last_session AT TIME ZONE 'America/Los_Angeles', 'Mon DD, YYYY')
    END as last_session_formatted,
    COALESCE(EXTRACT(DAY FROM NOW() - cs.last_session)::INTEGER, 999) as days_since_last_session,
    cs.total_sessions::INTEGER as total_sessions_count,
    CASE 
      WHEN cs.last_session IS NULL THEN '🔴 New client - schedule first session'
      WHEN EXTRACT(DAY FROM NOW() - cs.last_session) > 30 THEN '🔴 High priority - ' || EXTRACT(DAY FROM NOW() - cs.last_session)::INTEGER || ' days'
      WHEN EXTRACT(DAY FROM NOW() - cs.last_session) > 14 THEN '🟡 Medium priority - ' || EXTRACT(DAY FROM NOW() - cs.last_session)::INTEGER || ' days'
      ELSE '🟢 Recent - ' || EXTRACT(DAY FROM NOW() - cs.last_session)::INTEGER || ' days ago'
    END as scheduling_priority,
    cs.notes
  FROM client_sessions cs
  WHERE cs.next_session IS NULL  -- No future sessions scheduled
  ORDER BY 
    CASE 
      WHEN cs.last_session IS NULL THEN 0  -- New clients first
      ELSE EXTRACT(DAY FROM NOW() - cs.last_session)
    END DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_new_client_emails(p_user_id uuid)
 RETURNS text[]
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  new_emails TEXT[];
BEGIN
  -- Get emails that are in clients table but not in sync status
  SELECT ARRAY_AGG(LOWER(c.email))
  INTO new_emails
  FROM clients c
  LEFT JOIN client_sync_status css 
    ON css.user_id = c.user_id 
    AND LOWER(css.client_email) = LOWER(c.email)
  WHERE c.user_id = p_user_id
    AND c.email IS NOT NULL
    AND c.email != ''
    AND css.id IS NULL;
  
  RETURN COALESCE(new_emails, ARRAY[]::TEXT[]);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_scheduling_dashboard(p_user_id uuid)
 RETURNS TABLE(total_clients integer, clients_with_upcoming_sessions integer, clients_needing_scheduling integer, new_clients_never_scheduled integer, high_priority_count integer, medium_priority_count integer)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  RETURN QUERY
  WITH client_status AS (
    SELECT 
      c.id,
      MAX(ce.end_time) FILTER (WHERE ce.end_time < NOW()) as last_session,
      MIN(ce.start_time) FILTER (WHERE ce.start_time > NOW()) as next_session
    FROM clients c
    LEFT JOIN calendar_events ce ON ce.client_id = c.id
    WHERE c.user_id = p_user_id
    GROUP BY c.id
  )
  SELECT 
    COUNT(*)::INTEGER as total_clients,
    COUNT(*) FILTER (WHERE next_session IS NOT NULL)::INTEGER as clients_with_upcoming_sessions,
    COUNT(*) FILTER (WHERE next_session IS NULL)::INTEGER as clients_needing_scheduling,
    COUNT(*) FILTER (WHERE next_session IS NULL AND last_session IS NULL)::INTEGER as new_clients_never_scheduled,
    COUNT(*) FILTER (WHERE next_session IS NULL AND last_session IS NOT NULL AND NOW() - last_session > INTERVAL '30 days')::INTEGER as high_priority_count,
    COUNT(*) FILTER (WHERE next_session IS NULL AND last_session IS NOT NULL AND NOW() - last_session BETWEEN INTERVAL '14 days' AND INTERVAL '30 days')::INTEGER as medium_priority_count
  FROM client_status;
END;
$function$
;

-- create type "public"."http_header" as ("field" character varying, "value" character varying);

-- create type "public"."http_request" as ("method" http_method, "uri" character varying, "headers" http_header[], "content_type" character varying, "content" character varying);

-- create type "public"."http_response" as ("status" integer, "content_type" character varying, "headers" http_header[], "content" character varying);

CREATE OR REPLACE FUNCTION public.sync_all_calendars()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  user_record RECORD;
  sync_result JSONB;
BEGIN
  -- Loop through all users who have tokens
  FOR user_record IN 
    SELECT DISTINCT user_id 
    FROM user_tokens 
    WHERE expires_at > NOW()
  LOOP
    BEGIN
      -- Call the Edge Function for each user
      SELECT content::jsonb INTO sync_result
      FROM http_post(
        'https://bhiwuvjltwvdkhcnwkkt.supabase.co/functions/v1/sync-google-calendar',
        json_build_object('user_id', user_record.user_id)::text,
        'application/json'
      );
      
      -- Log the result
      RAISE NOTICE 'Synced calendar for user %: %', 
        user_record.user_id, 
        sync_result->>'message';
        
    EXCEPTION WHEN OTHERS THEN
      -- Log errors but continue with other users
      RAISE WARNING 'Failed to sync calendar for user %: %', 
        user_record.user_id, 
        SQLERRM;
    END;
  END LOOP;
END;
$function$
;

grant delete on table "public"."calendar_events" to "anon";

grant insert on table "public"."calendar_events" to "anon";

grant references on table "public"."calendar_events" to "anon";

grant select on table "public"."calendar_events" to "anon";

grant trigger on table "public"."calendar_events" to "anon";

grant truncate on table "public"."calendar_events" to "anon";

grant update on table "public"."calendar_events" to "anon";

grant delete on table "public"."calendar_events" to "authenticated";

grant insert on table "public"."calendar_events" to "authenticated";

grant references on table "public"."calendar_events" to "authenticated";

grant select on table "public"."calendar_events" to "authenticated";

grant trigger on table "public"."calendar_events" to "authenticated";

grant truncate on table "public"."calendar_events" to "authenticated";

grant update on table "public"."calendar_events" to "authenticated";

grant delete on table "public"."calendar_events" to "service_role";

grant insert on table "public"."calendar_events" to "service_role";

grant references on table "public"."calendar_events" to "service_role";

grant select on table "public"."calendar_events" to "service_role";

grant trigger on table "public"."calendar_events" to "service_role";

grant truncate on table "public"."calendar_events" to "service_role";

grant update on table "public"."calendar_events" to "service_role";

grant delete on table "public"."client_sync_status" to "anon";

grant insert on table "public"."client_sync_status" to "anon";

grant references on table "public"."client_sync_status" to "anon";

grant select on table "public"."client_sync_status" to "anon";

grant trigger on table "public"."client_sync_status" to "anon";

grant truncate on table "public"."client_sync_status" to "anon";

grant update on table "public"."client_sync_status" to "anon";

grant delete on table "public"."client_sync_status" to "authenticated";

grant insert on table "public"."client_sync_status" to "authenticated";

grant references on table "public"."client_sync_status" to "authenticated";

grant select on table "public"."client_sync_status" to "authenticated";

grant trigger on table "public"."client_sync_status" to "authenticated";

grant truncate on table "public"."client_sync_status" to "authenticated";

grant update on table "public"."client_sync_status" to "authenticated";

grant delete on table "public"."client_sync_status" to "service_role";

grant insert on table "public"."client_sync_status" to "service_role";

grant references on table "public"."client_sync_status" to "service_role";

grant select on table "public"."client_sync_status" to "service_role";

grant trigger on table "public"."client_sync_status" to "service_role";

grant truncate on table "public"."client_sync_status" to "service_role";

grant update on table "public"."client_sync_status" to "service_role";

grant delete on table "public"."clients" to "anon";

grant insert on table "public"."clients" to "anon";

grant references on table "public"."clients" to "anon";

grant select on table "public"."clients" to "anon";

grant trigger on table "public"."clients" to "anon";

grant truncate on table "public"."clients" to "anon";

grant update on table "public"."clients" to "anon";

grant delete on table "public"."clients" to "authenticated";

grant insert on table "public"."clients" to "authenticated";

grant references on table "public"."clients" to "authenticated";

grant select on table "public"."clients" to "authenticated";

grant trigger on table "public"."clients" to "authenticated";

grant truncate on table "public"."clients" to "authenticated";

grant update on table "public"."clients" to "authenticated";

grant delete on table "public"."clients" to "service_role";

grant insert on table "public"."clients" to "service_role";

grant references on table "public"."clients" to "service_role";

grant select on table "public"."clients" to "service_role";

grant trigger on table "public"."clients" to "service_role";

grant truncate on table "public"."clients" to "service_role";

grant update on table "public"."clients" to "service_role";

grant delete on table "public"."sessions" to "anon";

grant insert on table "public"."sessions" to "anon";

grant references on table "public"."sessions" to "anon";

grant select on table "public"."sessions" to "anon";

grant trigger on table "public"."sessions" to "anon";

grant truncate on table "public"."sessions" to "anon";

grant update on table "public"."sessions" to "anon";

grant delete on table "public"."sessions" to "authenticated";

grant insert on table "public"."sessions" to "authenticated";

grant references on table "public"."sessions" to "authenticated";

grant select on table "public"."sessions" to "authenticated";

grant trigger on table "public"."sessions" to "authenticated";

grant truncate on table "public"."sessions" to "authenticated";

grant update on table "public"."sessions" to "authenticated";

grant delete on table "public"."sessions" to "service_role";

grant insert on table "public"."sessions" to "service_role";

grant references on table "public"."sessions" to "service_role";

grant select on table "public"."sessions" to "service_role";

grant trigger on table "public"."sessions" to "service_role";

grant truncate on table "public"."sessions" to "service_role";

grant update on table "public"."sessions" to "service_role";

grant delete on table "public"."user_tokens" to "anon";

grant insert on table "public"."user_tokens" to "anon";

grant references on table "public"."user_tokens" to "anon";

grant select on table "public"."user_tokens" to "anon";

grant trigger on table "public"."user_tokens" to "anon";

grant truncate on table "public"."user_tokens" to "anon";

grant update on table "public"."user_tokens" to "anon";

grant delete on table "public"."user_tokens" to "authenticated";

grant insert on table "public"."user_tokens" to "authenticated";

grant references on table "public"."user_tokens" to "authenticated";

grant select on table "public"."user_tokens" to "authenticated";

grant trigger on table "public"."user_tokens" to "authenticated";

grant truncate on table "public"."user_tokens" to "authenticated";

grant update on table "public"."user_tokens" to "authenticated";

grant delete on table "public"."user_tokens" to "service_role";

grant insert on table "public"."user_tokens" to "service_role";

grant references on table "public"."user_tokens" to "service_role";

grant select on table "public"."user_tokens" to "service_role";

grant trigger on table "public"."user_tokens" to "service_role";

grant truncate on table "public"."user_tokens" to "service_role";

grant update on table "public"."user_tokens" to "service_role";

create policy "Enable read access for all users"
on "public"."clients"
as permissive
for select
to public
using (true);


create policy "Users can create their own clients"
on "public"."clients"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "Users can delete their own clients"
on "public"."clients"
as permissive
for delete
to public
using ((auth.uid() = user_id));


create policy "Users can update their own clients"
on "public"."clients"
as permissive
for update
to public
using ((auth.uid() = user_id));


create policy "Users can view their own clients"
on "public"."clients"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "Allow read access to authenticated users"
on "public"."sessions"
as permissive
for select
to authenticated
using (true);



