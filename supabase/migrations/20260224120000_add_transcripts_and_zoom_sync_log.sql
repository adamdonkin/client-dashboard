-- Zoom transcript archive pipeline
-- Tables for storing Zoom cloud recording transcripts and sync tracking

-- transcripts: stores Zoom meeting transcripts with client matching
create table transcripts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Zoom metadata
  zoom_meeting_id text not null,
  zoom_meeting_uuid text unique not null,
  topic text,
  start_time timestamptz not null,
  duration_minutes integer,
  host_email text,
  participants text[],

  -- Transcript content
  transcript_text text,
  transcript_vtt text,

  -- Client matching
  client_name text,
  client_id uuid references clients(id) on delete set null,
  match_method text,
  match_confidence text,

  -- Processing status
  status text default 'raw',
  ai_processed boolean default false,
  ai_processed_at timestamptz,

  -- Recording info
  recording_url text,
  recording_password text,
  file_size_mb numeric
);

-- zoom_sync_log: tracks sync runs for resume/retry
create table zoom_sync_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  sync_type text not null,
  date_range_start date,
  date_range_end date,
  meetings_found integer default 0,
  transcripts_downloaded integer default 0,
  errors text[],
  status text default 'running',
  completed_at timestamptz
);

-- Indexes for common queries
create index idx_transcripts_user_id on transcripts(user_id);
create index idx_transcripts_start_time on transcripts(start_time desc);
create index idx_transcripts_client_name on transcripts(client_name);
create index idx_transcripts_status on transcripts(status);
create index idx_transcripts_zoom_uuid on transcripts(zoom_meeting_uuid);
create index idx_transcripts_client_id on transcripts(client_id);

create index idx_zoom_sync_log_user_id on zoom_sync_log(user_id);
create index idx_zoom_sync_log_created_at on zoom_sync_log(created_at desc);

-- Enable RLS
alter table transcripts enable row level security;
alter table zoom_sync_log enable row level security;

-- RLS policies: users can only access their own data
create policy "Users can only access their own transcripts" on transcripts
  for all using (auth.uid() = user_id);

create policy "Users can only access their own zoom sync logs" on zoom_sync_log
  for all using (auth.uid() = user_id);

-- Grants
grant select, insert, update, delete on transcripts to anon;
grant select, insert, update, delete on transcripts to authenticated;
grant select, insert, update, delete on transcripts to service_role;

grant select, insert, update, delete on zoom_sync_log to anon;
grant select, insert, update, delete on zoom_sync_log to authenticated;
grant select, insert, update, delete on zoom_sync_log to service_role;
