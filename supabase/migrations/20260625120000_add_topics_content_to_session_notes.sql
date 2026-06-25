-- Add topics_content jsonb column for the single-editor topics section
ALTER TABLE session_notes ADD COLUMN IF NOT EXISTS topics_content jsonb;

NOTIFY pgrst, 'reload schema';
