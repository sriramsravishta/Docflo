/*
  # Add Storage RLS Policies

  ## Overview
  Adds Row Level Security policies for Supabase Storage buckets to allow file uploads.

  ## Storage Policies
  - consultation-recordings: Allow authenticated doctors to upload consultation audio files
  - patient-documents: Allow anonymous users to upload documents for pre-consult forms
  - query-attachments: Allow both authenticated and anonymous users to upload query attachments

  ## Security
  - Doctors can only upload to consultation-recordings bucket
  - Anonymous users can upload to patient-documents and query-attachments buckets
  - All users can read from all buckets for file access
*/

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy for consultation-recordings bucket (authenticated doctors only)
CREATE POLICY "Doctors can upload consultation recordings"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'consultation-recordings');

CREATE POLICY "Doctors can read consultation recordings"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'consultation-recordings');

-- Policy for patient-documents bucket (anonymous users for pre-consult forms)
CREATE POLICY "Anonymous users can upload patient documents"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'patient-documents');

CREATE POLICY "Anyone can read patient documents"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'patient-documents');

-- Policy for query-attachments bucket (both authenticated and anonymous)
CREATE POLICY "Anyone can upload query attachments"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'query-attachments');

CREATE POLICY "Anyone can read query attachments"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'query-attachments');

-- Policy for authenticated users to read all buckets
CREATE POLICY "Authenticated users can read all storage objects"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (true);