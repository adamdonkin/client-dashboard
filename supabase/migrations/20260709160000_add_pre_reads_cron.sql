-- Daily pre-read generation via pg_cron + pg_net
-- Runs at 6:15am PT (1:15pm UTC), after the daily calendar+actions sync at 6am

create or replace function trigger_pre_reads_generation()
returns void
language plpgsql security definer
as $$
declare
  v_user_id uuid;
  v_supabase_url text;
  v_service_key text;
  v_event record;
  v_today_start timestamptz;
  v_today_end timestamptz;
  v_today_date text;
  v_pacific_now text;
begin
  select id into v_user_id from auth.users limit 1;
  if v_user_id is null then return; end if;

  v_supabase_url := 'https://bhiwuvjltwvdkhcnwkkt.supabase.co';
  v_service_key := current_setting('app.settings.service_role_key', true);

  if v_service_key is null or v_service_key = '' then
    raise notice 'Service role key not configured, skipping pre-reads generation';
    return;
  end if;

  -- Calculate today in Pacific Time
  v_pacific_now := (now() at time zone 'America/Los_Angeles')::date::text;
  v_today_date := v_pacific_now;
  v_today_start := (v_pacific_now || ' 00:00:00')::timestamp at time zone 'America/Los_Angeles';
  v_today_end := (v_pacific_now || ' 23:59:59')::timestamp at time zone 'America/Los_Angeles';

  -- Loop through today's events that have a client and no existing ready pre-read
  for v_event in
    select ce.id as event_id
    from calendar_events ce
    where ce.user_id = v_user_id
      and ce.client_id is not null
      and ce.start_time >= v_today_start
      and ce.start_time <= v_today_end
      and not exists (
        select 1 from pre_reads pr
        where pr.calendar_event_id = ce.id
          and pr.status = 'ready'
      )
    order by ce.start_time
  loop
    perform extensions.http((
      'POST',
      v_supabase_url || '/functions/v1/generate-pre-reads',
      array[
        extensions.http_header('Content-Type', 'application/json'),
        extensions.http_header('Authorization', 'Bearer ' || v_service_key)
      ],
      'application/json',
      json_build_object(
        'user_id', v_user_id,
        'date', v_today_date,
        'calendar_event_id', v_event.event_id
      )::text
    )::extensions.http_request);
  end loop;
end;
$$;

select cron.schedule(
  'daily-pre-reads',
  '15 13 * * *',  -- 1:15pm UTC = 6:15am PT
  $$select trigger_pre_reads_generation()$$
);
