ALTER TABLE public.client_actions
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id);

COMMENT ON COLUMN public.client_actions.assigned_to IS 'When set to user_id, the action is assigned to the coach (Adam) rather than the client';

CREATE INDEX IF NOT EXISTS idx_client_actions_assigned_to ON client_actions(assigned_to);

NOTIFY pgrst, 'reload schema';
