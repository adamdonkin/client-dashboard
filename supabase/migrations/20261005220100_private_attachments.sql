-- Lock down image attachments: private bucket, no direct reads or uploads
-- outside the rules in 20261005220000. Existing content pointing at public
-- storage URLs is rewritten to the /api/attachments route.

UPDATE storage.buckets SET public = false WHERE id = 'action-attachments';

DROP POLICY IF EXISTS "Authenticated users can upload action attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view action attachments" ON storage.objects;

UPDATE client_actions
SET description_content = regexp_replace(
  description_content::text,
  'https?://[^"]*/storage/v1/object/public/action-attachments/',
  '/api/attachments/',
  'g'
)::jsonb
WHERE description_content::text LIKE '%/storage/v1/object/public/action-attachments/%';

UPDATE session_notes
SET
  connection_notes = regexp_replace(connection_notes::text, 'https?://[^"]*/storage/v1/object/public/action-attachments/', '/api/attachments/', 'g')::jsonb,
  topics_content = regexp_replace(topics_content::text, 'https?://[^"]*/storage/v1/object/public/action-attachments/', '/api/attachments/', 'g')::jsonb,
  feedback_content = regexp_replace(feedback_content::text, 'https?://[^"]*/storage/v1/object/public/action-attachments/', '/api/attachments/', 'g')::jsonb
WHERE concat_ws(' ', connection_notes::text, topics_content::text, feedback_content::text)
  LIKE '%/storage/v1/object/public/action-attachments/%';
