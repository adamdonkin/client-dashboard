-- Expand daily sync to include calendar + actions
-- Runs calendar sync first, then actions sync

create or replace function trigger_daily_sync()
returns void
language plpgsql security definer
as $$
declare
  v_user_id uuid;
  v_supabase_url text;
  v_service_key text;
begin
  select id into v_user_id from auth.users limit 1;
  if v_user_id is null then return; end if;

  v_supabase_url := 'https://bhiwuvjltwvdkhcnwkkt.supabase.co';
  v_service_key := current_setting('app.settings.service_role_key', true);

  if v_service_key is null or v_service_key = '' then
    raise notice 'Service role key not configured, skipping daily sync';
    return;
  end if;

  -- Sync calendar first
  perform extensions.http((
    'POST',
    v_supabase_url || '/functions/v1/sync-google-calendar',
    array[
      extensions.http_header('Content-Type', 'application/json'),
      extensions.http_header('Authorization', 'Bearer ' || v_service_key)
    ],
    'application/json',
    json_build_object('user_id', v_user_id)::text
  )::extensions.http_request);

  -- Then sync actions
  perform extensions.http((
    'POST',
    v_supabase_url || '/functions/v1/sync-actions',
    array[
      extensions.http_header('Content-Type', 'application/json'),
      extensions.http_header('Authorization', 'Bearer ' || v_service_key)
    ],
    'application/json',
    json_build_object('user_id', v_user_id)::text
  )::extensions.http_request);
end;
$$;

-- Remove old actions-only cron job and replace with combined sync
select cron.unschedule('daily-actions-sync');

select cron.schedule(
  'daily-sync',
  '0 13 * * *',  -- 1pm UTC = 6am PT
  $$select trigger_daily_sync()$$
);

-- Drop the old single-purpose function
drop function if exists trigger_actions_sync();
