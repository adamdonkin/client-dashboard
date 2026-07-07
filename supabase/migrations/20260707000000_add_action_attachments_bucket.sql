-- Storage bucket for action description images (screenshots, etc.)

INSERT INTO storage.buckets (id, name, public)
VALUES ('action-attachments', 'action-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload action attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'action-attachments');

-- Allow team members to view attachments
CREATE POLICY "Authenticated users can view action attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'action-attachments');

-- Allow owners/editors to delete their uploads
CREATE POLICY "Users can delete own action attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'action-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
