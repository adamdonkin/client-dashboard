-- Client actions synced from Defacto and Granola
-- Actions are commitments/next steps from coaching sessions

create type action_status as enum ('to_do', 'completed', 'cancelled');
create type action_source as enum ('defacto', 'granola');

create table client_actions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  source action_source not null,
  source_id text not null,

  title text not null,
  status action_status not null default 'to_do',
  due_date timestamptz,
  created_date timestamptz,

  -- Granola-specific: which note the action was extracted from
  note_title text,

  -- Defacto-specific: workspace name for matching context
  workspace_name text,

  synced_at timestamptz default now(),

  constraint uq_client_actions_source unique (user_id, source, source_id)
);

create index idx_client_actions_user_id on client_actions(user_id);
create index idx_client_actions_client_id on client_actions(client_id);
create index idx_client_actions_status on client_actions(user_id, status);
create index idx_client_actions_source on client_actions(user_id, source);

alter table client_actions enable row level security;

create policy "Users can only access their own actions" on client_actions
  for all using (auth.uid() = user_id);

grant select, insert, update, delete on client_actions to anon;
grant select, insert, update, delete on client_actions to authenticated;
grant select, insert, update, delete on client_actions to service_role;
