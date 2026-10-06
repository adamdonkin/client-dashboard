-- Clients the coach doesn't send weekly pre-write messages to. Existing clients
-- RLS covers reads and writes.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS exclude_from_pre_writes boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
