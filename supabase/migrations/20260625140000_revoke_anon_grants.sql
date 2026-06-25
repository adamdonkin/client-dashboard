-- Revoke overly broad anon grants
-- The anon role should not have direct CRUD access to tables containing sensitive data.
-- RLS policies using auth.uid() return NULL for anon, which blocks access,
-- but defense-in-depth means we should not grant permissions we don't need.

REVOKE INSERT, UPDATE, DELETE ON client_actions FROM anon;
REVOKE INSERT, UPDATE, DELETE ON meeting_notes FROM anon;
REVOKE INSERT, UPDATE, DELETE ON transcripts FROM anon;
REVOKE INSERT, UPDATE, DELETE ON zoom_sync_log FROM anon;

REVOKE SELECT ON client_actions FROM anon;
REVOKE SELECT ON meeting_notes FROM anon;
REVOKE SELECT ON transcripts FROM anon;
REVOKE SELECT ON zoom_sync_log FROM anon;
