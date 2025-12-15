/*
  # Fix pre_consult RLS policies for doctor inserts

  1. Security Changes
    - Drop existing conflicting INSERT policies for authenticated users
    - Create new INSERT policy that allows doctors to create pre-consult records
    - Ensure doc_id matches the authenticated user's ID
    - Maintain existing anonymous access policies

  This fixes the RLS violation when doctors try to create pre-consult records from the patient profile.
*/

-- Drop existing INSERT policies for authenticated users to avoid conflicts
DROP POLICY IF EXISTS "Doctors can insert pre-consult forms" ON pre_consult;
DROP POLICY IF EXISTS "Users can insert their own pre-consult" ON pre_consult;

-- Create a new INSERT policy for authenticated doctors
CREATE POLICY "Authenticated doctors can insert pre_consult"
  ON pre_consult
  FOR INSERT
  TO authenticated
  WITH CHECK (doc_id = auth.uid());

-- Ensure the anonymous INSERT policy exists (for patient form submissions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'pre_consult' 
    AND policyname = 'Anonymous users can insert pre_consult records'
  ) THEN
    CREATE POLICY "Anonymous users can insert pre_consult records"
      ON pre_consult
      FOR INSERT
      TO anon
      WITH CHECK (true);
  END IF;
END $$;