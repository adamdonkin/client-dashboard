-- Meeting notes from Granola (coaching session transcripts, summaries, private notes)
-- Separate from the Zoom-specific `transcripts` table
-- Linked to clients table for pre-read queries before coaching sessions

create table meeting_notes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Granola metadata
  granola_meeting_id text unique not null,
  title text,
  meeting_date timestamptz not null,

  -- Participants (JSONB array: [{name, company, email}, ...])
  participants jsonb,

  -- Client matching
  client_id uuid references clients(id) on delete set null,
  client_email text,
  match_method text,

  -- Content
  transcript_text text,
  summary text,
  private_notes text,

  -- Metadata
  source text default 'granola',
  word_count integer
);

-- Indexes for common queries
create index idx_meeting_notes_user_id on meeting_notes(user_id);
create index idx_meeting_notes_client_id on meeting_notes(client_id);
create index idx_meeting_notes_meeting_date on meeting_notes(meeting_date desc);
create index idx_meeting_notes_granola_id on meeting_notes(granola_meeting_id);
create index idx_meeting_notes_client_date on meeting_notes(client_id, meeting_date desc);

-- Enable RLS
alter table meeting_notes enable row level security;

-- RLS policy: users can only access their own meeting notes
create policy "Users can only access their own meeting notes" on meeting_notes
  for all using (auth.uid() = user_id);

-- Grants
grant select, insert, update, delete on meeting_notes to anon;
grant select, insert, update, delete on meeting_notes to authenticated;
grant select, insert, update, delete on meeting_notes to service_role;

-- Pre-read helper: get recent meeting notes for a client
create or replace function get_client_meeting_notes(
  p_client_id uuid,
  p_limit integer default 3
)
returns table (
  id uuid,
  title text,
  meeting_date timestamptz,
  summary text,
  private_notes text,
  word_count integer
)
language plpgsql security definer
as $$
begin
  return query
  select
    mn.id,
    mn.title,
    mn.meeting_date,
    mn.summary,
    mn.private_notes,
    mn.word_count
  from meeting_notes mn
  where mn.client_id = p_client_id
    and mn.user_id = auth.uid()
  order by mn.meeting_date desc
  limit p_limit;
end;
$$;

grant execute on function get_client_meeting_notes(uuid, integer) to authenticated;
grant execute on function get_client_meeting_notes(uuid, integer) to service_role;
