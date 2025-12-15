/*
  # Fix pre_consult INSERT policy

  1. Security
    - Update INSERT policy for pre_consult table to allow authenticated doctors to create records
    - Ensure doc_id matches the authenticated user's ID
*/

-- Drop existing INSERT policy if it exists
DROP POLICY IF EXISTS "Doctors can insert pre-consult forms" ON pre_consult;

-- Create new INSERT policy that allows authenticated users to insert records where doc_id matches their auth ID
CREATE POLICY "Doctors can insert pre-consult forms"
  ON pre_consult
  FOR INSERT
  TO authenticated
  WITH CHECK (doc_id = auth.uid());