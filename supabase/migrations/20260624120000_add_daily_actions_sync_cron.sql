-- Daily actions sync via pg_cron + pg_net
-- Calls the sync-actions Edge Function at 6am PT (1pm UTC) every day

create extension if not exists pg_net with schema extensions;

create or replace function trigger_actions_sync()
returns void
language plpgsql security definer
as $$
declare
  v_user_id uuid;
  v_supabase_url text;
  v_service_key text;
begin
  -- Get the single coaching user (this is a single-user app)
  select id into v_user_id from auth.users limit 1;
  if v_user_id is null then return; end if;

  -- Read project config from vault or use hardcoded project ref
  v_supabase_url := 'https://bhiwuvjltwvdkhcnwkkt.supabase.co';
  v_service_key := current_setting('app.settings.service_role_key', true);

  -- If service key not available via app settings, skip
  if v_service_key is null or v_service_key = '' then
    raise notice 'Service role key not configured, skipping actions sync';
    return;
  end if;

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

select cron.schedule(
  'daily-actions-sync',
  '0 13 * * *',  -- 1pm UTC = 6am PT
  $$select trigger_actions_sync()$$
);
