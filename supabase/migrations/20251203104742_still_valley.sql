/*
  # Create consultation-recordings storage bucket

  1. Storage Bucket
    - Create `consultation-recordings` bucket for storing consultation audio files
    - Set as private bucket (not publicly accessible by default)
    - Configure proper access policies for authenticated doctors

  2. Security Policies
    - Allow authenticated doctors to upload consultation recordings
    - Allow authenticated doctors to read their own consultation recordings
    - Restrict access to only authorized users
*/

-- Create the consultation-recordings bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'consultation-recordings',
  'consultation-recordings', 
  false,
  52428800, -- 50MB limit
  ARRAY['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg']
);

-- Policy: Allow authenticated users to upload consultation recordings
CREATE POLICY "Authenticated users can upload consultation recordings"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'consultation-recordings');

-- Policy: Allow authenticated users to read consultation recordings
CREATE POLICY "Authenticated users can read consultation recordings"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'consultation-recordings');

-- Policy: Allow authenticated users to delete their consultation recordings
CREATE POLICY "Authenticated users can delete consultation recordings"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'consultation-recordings');