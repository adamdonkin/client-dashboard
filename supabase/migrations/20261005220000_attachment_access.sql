-- Image attachments are served through /api/attachments/<path>, which asks
-- can_view_attachment before handing out a short-lived signed URL.
-- Additive only: the bucket stays public until 20261005220100 locks it down.

-- Team members upload into their own folder. Clients (signed in to read shared
-- notes) are not in team_access and cannot upload.
CREATE POLICY "Team members can upload attachments to own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'action-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.team_access
      WHERE owner_id = auth.uid() OR member_id = auth.uid()
    )
  );

-- Paths are <uploader user id>/<file>. Viewable by the uploader, anyone on the
-- uploader's team, or a client whose shared note embeds the image.
CREATE OR REPLACE FUNCTION public.can_view_attachment(p_path text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH uploader AS (
    SELECT split_part(p_path, '/', 1) AS id_text
  ),
  my_teams AS (
    SELECT owner_id FROM team_access
    WHERE owner_id = auth.uid() OR member_id = auth.uid()
  ),
  uploader_teams AS (
    SELECT owner_id FROM team_access, uploader
    WHERE owner_id::text = uploader.id_text OR member_id::text = uploader.id_text
  )
  SELECT
    auth.uid() IS NOT NULL
    AND p_path NOT LIKE '%..%'
    AND (
      (SELECT id_text FROM uploader) = auth.uid()::text
      OR EXISTS (SELECT 1 FROM my_teams JOIN uploader_teams USING (owner_id))
      OR EXISTS (
        SELECT 1 FROM session_notes sn
        WHERE sn.shared_with_client
          AND sn.client_id = get_portal_client_id()
          AND strpos(
            concat_ws(' ', sn.connection_notes::text, sn.topics_content::text, sn.feedback_content::text),
            '/api/attachments/' || p_path || '"'
          ) > 0
      )
    )
$$;

REVOKE ALL ON FUNCTION public.can_view_attachment(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_attachment(text) TO authenticated;
