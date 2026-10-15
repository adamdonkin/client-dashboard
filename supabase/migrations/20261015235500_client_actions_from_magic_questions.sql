-- Actions written under a Magic Questions section in session notes. The round
-- itself lives in the note (session_note_id), so this is all that's needed to
-- open it from the action.

ALTER TABLE public.client_actions
  ADD COLUMN from_magic_questions boolean NOT NULL DEFAULT false;
