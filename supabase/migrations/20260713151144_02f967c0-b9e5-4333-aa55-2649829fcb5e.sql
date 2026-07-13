
CREATE POLICY "Public read event AI images"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-images-ai');
