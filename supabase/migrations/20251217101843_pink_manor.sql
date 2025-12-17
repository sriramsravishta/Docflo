/*
  # Create summaries table

  1. New Tables
    - `summaries`
      - `id` (uuid, primary key)
      - `patient_id` (uuid, foreign key to patients)
      - `doctor_id` (uuid, foreign key to auth.users)
      - `summary` (jsonb, flexible structure)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `summaries` table
    - Add policies for doctors to manage their organization's summaries
*/

CREATE TABLE IF NOT EXISTS summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  doctor_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  summary jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_summaries_patient_id ON summaries(patient_id);
CREATE INDEX IF NOT EXISTS idx_summaries_doctor_id ON summaries(doctor_id);

-- Enable RLS
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Doctors can insert summaries for their patients"
  ON summaries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    doctor_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM patients 
      WHERE patients.id = summaries.patient_id 
      AND EXISTS (
        SELECT 1 FROM users 
        WHERE users.auth_id = auth.uid() 
        AND users.org_id = patients.org_id
      )
    )
  );

CREATE POLICY "Doctors can view summaries for their organization's patients"
  ON summaries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM patients 
      WHERE patients.id = summaries.patient_id 
      AND EXISTS (
        SELECT 1 FROM users 
        WHERE users.auth_id = auth.uid() 
        AND users.org_id = patients.org_id
      )
    )
  );

CREATE POLICY "Doctors can update summaries for their organization's patients"
  ON summaries
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM patients 
      WHERE patients.id = summaries.patient_id 
      AND EXISTS (
        SELECT 1 FROM users 
        WHERE users.auth_id = auth.uid() 
        AND users.org_id = patients.org_id
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM patients 
      WHERE patients.id = summaries.patient_id 
      AND EXISTS (
        SELECT 1 FROM users 
        WHERE users.auth_id = auth.uid() 
        AND users.org_id = patients.org_id
      )
    )
  );

CREATE POLICY "Doctors can delete summaries for their organization's patients"
  ON summaries
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM patients 
      WHERE patients.id = summaries.patient_id 
      AND EXISTS (
        SELECT 1 FROM users 
        WHERE users.auth_id = auth.uid() 
        AND users.org_id = patients.org_id
      )
    )
  );