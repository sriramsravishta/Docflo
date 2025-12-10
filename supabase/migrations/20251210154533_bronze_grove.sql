-- Create pre-consultation-documents storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pre-consultation-documents',
  'pre-consultation-documents',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
);

-- Create RLS policies for pre-consultation-documents bucket
CREATE POLICY "Allow anonymous uploads to pre-consultation-documents"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'pre-consultation-documents');

CREATE POLICY "Allow public read access to pre-consultation-documents"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'pre-consultation-documents');

CREATE POLICY "Allow authenticated read access to pre-consultation-documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'pre-consultation-documents');