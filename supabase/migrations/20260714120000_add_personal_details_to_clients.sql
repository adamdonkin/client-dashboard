ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS personal_details jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.clients.personal_details IS 'Structured personal details extracted from session notes (partner, children, hobbies, etc.)';

NOTIFY pgrst, 'reload schema';
