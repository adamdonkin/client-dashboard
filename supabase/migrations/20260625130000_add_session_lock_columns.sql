-- Add server-side lock columns to session_notes for concurrent editing protection
ALTER TABLE session_notes
  ADD COLUMN IF NOT EXISTS locked_by text,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;

NOTIFY pgrst, 'reload schema';
