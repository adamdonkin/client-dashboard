-- Add feedback_content jsonb column for the session feedback section
ALTER TABLE session_notes ADD COLUMN IF NOT EXISTS feedback_content jsonb;

NOTIFY pgrst, 'reload schema';
