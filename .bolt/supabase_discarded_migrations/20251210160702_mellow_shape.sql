/*
  # Create pre-consultation-documents storage bucket

  1. Storage Bucket
    - Create `pre-consultation-documents` bucket for document uploads
    - Set as public bucket for easy access
    - Configure file size and type restrictions

  2. Security
    - Allow anonymous users to upload documents (for patient forms)
    - Allow public read access for document viewing
    - Allow authenticated users to manage documents
*/

-- Create the pre-consultation-documents bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pre-consultation-documents',
  'pre-consultation-documents',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
);

-- Allow anonymous users to upload documents (for patient pre-consult forms)
CREATE POLICY "Allow anonymous uploads for pre-consult documents"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'pre-consultation-documents');

-- Allow public read access to pre-consult documents
CREATE POLICY "Allow public read access to pre-consult documents"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'pre-consultation-documents');

-- Allow authenticated users to manage pre-consult documents
CREATE POLICY "Allow authenticated users to manage pre-consult documents"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'pre-consultation-documents');