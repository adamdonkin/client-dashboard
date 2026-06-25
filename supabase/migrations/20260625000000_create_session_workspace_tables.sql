-- Session workspace tables for coaching session note-taking

-- Session notes: one row per session workspace
create table session_notes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  client_id uuid references clients(id) on delete cascade not null,
  calendar_event_id text,
  session_date timestamptz,
  connection_notes jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, calendar_event_id)
);

alter table session_notes enable row level security;

create policy "Users can manage their own session notes"
  on session_notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Session topics: individual topics within a session
create table session_topics (
  id uuid default gen_random_uuid() primary key,
  session_note_id uuid references session_notes(id) on delete cascade not null,
  title text not null default '',
  content jsonb,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table session_topics enable row level security;

create policy "Users can manage session topics via session notes"
  on session_topics for all
  using (
    exists (
      select 1 from session_notes sn
      where sn.id = session_topics.session_note_id
      and sn.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from session_notes sn
      where sn.id = session_topics.session_note_id
      and sn.user_id = auth.uid()
    )
  );

-- Add 'session' to the action_source enum
alter type action_source add value if not exists 'session';

-- Add session linkage columns to client_actions
alter table client_actions add column if not exists session_note_id uuid references session_notes(id) on delete set null;
alter table client_actions add column if not exists session_topic_id uuid references session_topics(id) on delete set null;
