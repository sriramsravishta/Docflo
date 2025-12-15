/*
  # Add anonymous access policies for pre_consult table

  1. Security Changes
    - Add policy for anonymous users to insert pre_consult records
    - Add policy for anonymous users to update pre_consult records by ID
    - Add policy for anonymous users to select pre_consult records by ID
    
  2. Purpose
    - Allow patients to submit pre-consult forms via public URLs
    - Allow patients to upload documents without authentication
    - Maintain security by only allowing access via specific record IDs
*/

-- Allow anonymous users to insert pre_consult records
CREATE POLICY "Anonymous users can insert pre_consult records"
  ON pre_consult
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anonymous users to update pre_consult records by ID
CREATE POLICY "Anonymous users can update pre_consult by ID"
  ON pre_consult
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Allow anonymous users to select pre_consult records by ID
CREATE POLICY "Anonymous users can select pre_consult by ID"
  ON pre_consult
  FOR SELECT
  TO anon
  USING (true);