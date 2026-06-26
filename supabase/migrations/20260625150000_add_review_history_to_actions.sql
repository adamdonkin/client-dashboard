-- Track action extension history for review workflow
ALTER TABLE client_actions
  ADD COLUMN IF NOT EXISTS review_history jsonb DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
