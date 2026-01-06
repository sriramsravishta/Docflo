/*
  # Create appointments table for queue management

  1. New Tables
    - `appointments`
      - `id` (uuid, primary key)
      - `patient_id` (uuid, foreign key to patients)
      - `doc_id` (uuid, foreign key to auth.users)
      - `queue` (integer, queue position)
      - `pre_consult_filled` (enum: yes/no)
      - `completed` (enum: yes/no)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `appointments` table
    - Add policies for doctors to manage their appointments

  3. Indexes
    - Index on doc_id for efficient querying
    - Index on patient_id for lookups
    - Composite index on doc_id, completed, queue for main page queries
*/

-- Create enum types for appointments
CREATE TYPE pre_consult_status AS ENUM ('yes', 'no');
CREATE TYPE appointment_status AS ENUM ('yes', 'no');

-- Create appointments table
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  doc_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  queue integer NOT NULL,
  pre_consult_filled pre_consult_status DEFAULT 'no' NOT NULL,
  completed appointment_status DEFAULT 'no' NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_appointments_doc_id ON appointments(doc_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_queue_management ON appointments(doc_id, completed, queue);
CREATE INDEX IF NOT EXISTS idx_appointments_today ON appointments(doc_id, DATE(created_at), completed, queue);

-- Enable RLS
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for appointments
CREATE POLICY "Doctors can view their appointments"
  ON appointments
  FOR SELECT
  TO authenticated
  USING (doc_id = auth.uid());

CREATE POLICY "Doctors can insert their appointments"
  ON appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (doc_id = auth.uid());

CREATE POLICY "Doctors can update their appointments"
  ON appointments
  FOR UPDATE
  TO authenticated
  USING (doc_id = auth.uid())
  WITH CHECK (doc_id = auth.uid());

CREATE POLICY "Doctors can delete their appointments"
  ON appointments
  FOR DELETE
  TO authenticated
  USING (doc_id = auth.uid());