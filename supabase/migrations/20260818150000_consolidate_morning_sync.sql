-- Consolidate all scheduled syncing onto the Vercel cron at /api/cron/generate-pre-reads,
-- which syncs the calendar and then generates pre-reads in a single daily pass.
--
-- Five overlapping pg_cron jobs are retired here:
--   sync-calendars-hourly     0 * * * *   select sync_all_calendars()
--   sync-calendars-hourly-v3  0 * * * *   select sync_all_calendars()   (identical to the above)
--   hourly-sync-v4            0 * * * *   http_post to sync-google-calendar, hardcoded user_id
--   daily-sync                0 13 * * *  select trigger_daily_sync()
--   daily-pre-reads           15 13 * * * select trigger_pre_reads_generation()
--
-- The three hourly jobs all did the same calendar sync, so the calendar was being synced
-- three times an hour. None of them refreshed Google tokens or populated sessions, so
-- nothing is lost by removing them: sync-google-calendar refreshes its own token before
-- syncing, which is why a once-daily call still works after the access token has expired.
--
-- daily-sync also called sync-actions, which no longer exists. The Defacto integration is
-- deprecated and Granola actions have been surfaced in pre-reads only since
-- 20260710150000, so client_actions is now written exclusively from the app
-- (source 'session' and 'manual').
--
-- Existing source='defacto' rows in client_actions are intentionally left untouched so
-- historical actions keep rendering; they are simply no longer refreshed.
--
-- sync_all_calendars() is left in place. It is no longer scheduled, but remains useful for
-- a manual multi-user backfill.

-- cron.unschedule() raises if the job is absent, so guard each one to keep this rerunnable.
do $$
declare
  v_job text;
  v_jobs text[] := array[
    'sync-calendars-hourly',
    'sync-calendars-hourly-v3',
    'hourly-sync-v4',
    'daily-sync',
    'daily-pre-reads'
  ];
begin
  foreach v_job in array v_jobs loop
    if exists (select 1 from cron.job where jobname = v_job) then
      perform cron.unschedule(v_job);
      raise notice 'Unscheduled %', v_job;
    else
      raise notice '% not scheduled, nothing to do', v_job;
    end if;
  end loop;
end $$;

-- Purpose-built for the retired jobs above; nothing else calls them.
drop function if exists trigger_daily_sync();
drop function if exists trigger_pre_reads_generation();
