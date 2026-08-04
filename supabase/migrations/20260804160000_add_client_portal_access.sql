-- Client portal: allow clients to log in and view their own sessions/actions

-- Add auth_user_id to link a client record to a Supabase auth account
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_auth_user_id
  ON public.clients(auth_user_id) WHERE auth_user_id IS NOT NULL;

COMMENT ON COLUMN public.clients.auth_user_id IS 'Links a client record to their Supabase auth account for portal access';

-- Helper: returns the client_id for the current auth user (NULL if not a client)
CREATE OR REPLACE FUNCTION public.get_portal_client_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT id FROM public.clients WHERE auth_user_id = auth.uid() LIMIT 1
$$;

-- RLS: clients can view their own client record
CREATE POLICY "Clients can view own record" ON clients
  FOR SELECT USING (auth_user_id = auth.uid());

-- RLS: clients can view their own calendar events
CREATE POLICY "Clients can view own events" ON calendar_events
  FOR SELECT USING (client_id = (SELECT get_portal_client_id()));

-- RLS: clients can view session notes for their own events
CREATE POLICY "Clients can view own session notes" ON session_notes
  FOR SELECT USING (
    calendar_event_id::uuid IN (
      SELECT id FROM calendar_events WHERE client_id = (SELECT get_portal_client_id())
    )
  );

-- RLS: clients can view their own actions
CREATE POLICY "Clients can view own actions" ON client_actions
  FOR SELECT USING (client_id = (SELECT get_portal_client_id()));

NOTIFY pgrst, 'reload schema';
