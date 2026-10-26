-- Client notes as rich text (Tiptap JSON) so they can hold images like org charts.
-- clients.notes stays as the plain-text copy that pre-reads read.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS notes_content jsonb;
