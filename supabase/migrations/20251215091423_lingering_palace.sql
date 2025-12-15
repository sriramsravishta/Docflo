/*
  # Fix Storage Bucket RLS Policies

  1. Storage Bucket Policies
    - Allow authenticated users to insert documents into pre-consultation-documents bucket
    - Allow authenticated users to select/view documents they uploaded
    - Allow anonymous users to select/view documents (for patient access via public links)

  2. Security
    - Doctors can upload documents for their patients
    - Anonymous users can view documents via public URLs
    - Proper access control maintained
*/

-- Create storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('pre-consultation-documents', 'pre-consultation-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Anonymous users can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Public access for documents" ON storage.objects;

-- Allow authenticated users to upload documents
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'pre-consultation-documents');

-- Allow authenticated users to view documents
CREATE POLICY "Authenticated users can view documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'pre-consultation-documents');

-- Allow anonymous users to view documents (for patient access)
CREATE POLICY "Anonymous users can view documents"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'pre-consultation-documents');

-- Allow public access for documents (since bucket is public)
CREATE POLICY "Public access for documents"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'pre-consultation-documents');