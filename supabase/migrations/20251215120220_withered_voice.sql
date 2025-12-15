/*
  # Reset and Configure Pre-Consult RLS Policies

  1. Security Setup
    - Drop all existing RLS policies for pre_consult table
    - Create new policies for both patient and doctor access
    - Allow patients to upload documents via public form links
    - Allow doctors to upload documents from patient profile

  2. New Policies
    - Anonymous users can SELECT, INSERT, UPDATE pre_consult records (for patient forms)
    - Authenticated users can SELECT, INSERT, UPDATE, DELETE their organization's pre_consult records (for doctors)
*/

-- Drop all existing RLS policies for pre_consult table
DROP POLICY IF EXISTS "Anonymous users can insert pre_consult records" ON pre_consult;
DROP POLICY IF EXISTS "Anonymous users can update pre_consult by ID" ON pre_consult;
DROP POLICY IF EXISTS "Anonymous users can select pre_consult by ID" ON pre_consult;
DROP POLICY IF EXISTS "Authenticated doctors can insert pre_consult" ON pre_consult;
DROP POLICY IF EXISTS "Doctors can insert pre_consult" ON pre_consult;
DROP POLICY IF EXISTS "Doctors can view pre_consult for their patients" ON pre_consult;
DROP POLICY IF EXISTS "Doctors can update pre_consult for their patients" ON pre_consult;
DROP POLICY IF EXISTS "Doctors can delete pre_consult for their patients" ON pre_consult;

-- Enable RLS on pre_consult table
ALTER TABLE pre_consult ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow anonymous users (patients) full access for public form submissions
CREATE POLICY "patients_can_access_pre_consult_forms"
  ON pre_consult
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Policy 2: Allow authenticated users (doctors) to SELECT their organization's pre_consult records
CREATE POLICY "doctors_can_view_org_pre_consult"
  ON pre_consult
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM patients
        WHERE patients.id = pre_consult.patient_id
        AND patients.org_id = users.org_id
      )
    )
  );

-- Policy 3: Allow authenticated users (doctors) to INSERT pre_consult records for their patients
CREATE POLICY "doctors_can_insert_org_pre_consult"
  ON pre_consult
  FOR INSERT
  TO authenticated
  WITH CHECK (
    doc_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM patients
        WHERE patients.id = pre_consult.patient_id
        AND patients.org_id = users.org_id
      )
    )
  );

-- Policy 4: Allow authenticated users (doctors) to UPDATE their organization's pre_consult records
CREATE POLICY "doctors_can_update_org_pre_consult"
  ON pre_consult
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM patients
        WHERE patients.id = pre_consult.patient_id
        AND patients.org_id = users.org_id
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM patients
        WHERE patients.id = pre_consult.patient_id
        AND patients.org_id = users.org_id
      )
    )
  );

-- Policy 5: Allow authenticated users (doctors) to DELETE their organization's pre_consult records
CREATE POLICY "doctors_can_delete_org_pre_consult"
  ON pre_consult
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM patients
        WHERE patients.id = pre_consult.patient_id
        AND patients.org_id = users.org_id
      )
    )
  );