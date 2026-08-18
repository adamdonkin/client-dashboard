-- Records each completed sync so the dashboard can show when data last refreshed,
-- whether the run was triggered manually or by the daily cron. Both paths go through
-- the sync-google-calendar edge function, so recording it there covers both.
--
-- Only successful runs are written. "Last synced" should mean the last time data
-- actually landed: if a sync fails, the timestamp stays stale so the failure is visible
-- rather than masked by a fresh-looking timestamp.
--
-- Replaces nothing. client_sync_status has a last_synced_at column but is keyed per
-- client email and was never written to by any sync path.

create table sync_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,

  sync_type text not null default 'calendar',
  status text not null default 'success',
  synced_at timestamptz not null default now(),

  -- Counts as reported by the sync function
  events_synced integer,
  events_cancelled integer,
  events_reconciled integer,
  errors integer,
  message text,

  created_at timestamptz default now()
);

-- Serves the dashboard's "most recent sync of this type" lookup.
create index idx_sync_log_user_type_time on sync_log(user_id, sync_type, synced_at desc);

alter table sync_log enable row level security;

create policy "Users can read their own sync log"
  on sync_log for select
  using (user_id in (select accessible_user_ids()));

create policy "Writers can insert their own sync log"
  on sync_log for insert
  with check (can_write_user_data(user_id));

grant select, insert on sync_log to authenticated;
grant select, insert, update, delete on sync_log to service_role;

notify pgrst, 'reload schema';
