-- Sessions where Magic Questions were run for a client, newest first, with the
-- note sections so the app can pull out the Magic Questions part. Runs as the
-- caller, so session_notes RLS decides what's visible.

CREATE OR REPLACE FUNCTION public.get_magic_questions_by_client(p_client_id uuid)
RETURNS TABLE(
  session_note_id uuid,
  session_date timestamptz,
  connection_notes jsonb,
  topics_content jsonb,
  feedback_content jsonb
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    sn.id,
    COALESCE(ce.start_time, sn.session_date),
    sn.connection_notes,
    sn.topics_content,
    sn.feedback_content
  FROM session_notes sn
  LEFT JOIN calendar_events ce ON ce.id = sn.calendar_event_id::uuid
  WHERE sn.client_id = p_client_id
    AND concat_ws(' ', sn.connection_notes::text, sn.topics_content::text, sn.feedback_content::text)
        ILIKE '%"Magic Questions"%'
  ORDER BY COALESCE(ce.start_time, sn.session_date) DESC
$$;

REVOKE EXECUTE ON FUNCTION public.get_magic_questions_by_client(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_magic_questions_by_client(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
