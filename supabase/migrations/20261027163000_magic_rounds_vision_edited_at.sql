-- When the vision was last edited from the client page, outside a session
ALTER TABLE public.magic_question_rounds
  ADD COLUMN IF NOT EXISTS vision_edited_at timestamptz;
