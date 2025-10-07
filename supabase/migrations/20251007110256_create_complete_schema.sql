/*
  # Complete Docflo Database Schema

  ## Overview
  Creates the complete database schema for Docflo with all tables, relationships, and security policies.

  ## New Tables

  ### 1. organizations
  - `id` (uuid, primary key) - Organization unique identifier
  - `auth_id` (uuid, foreign key) - Connected to auth.users
  - `name` (text) - Organization name
  - `created_at` (timestamptz) - Creation timestamp

  ### 2. users
  - `id` (uuid, primary key) - User unique identifier
  - `auth_id` (uuid, foreign key) - Connected to auth.users
  - `org_id` (uuid, foreign key) - Connected to organizations
  - `role` (text) - Doctor or Assistant (default: Doctor)
  - `created_at` (timestamptz) - Creation timestamp

  ### 3. patients
  - `id` (uuid, primary key) - Patient unique identifier
  - `doc_id` (uuid, foreign key) - Connected to auth.users (doctor)
  - `org_id` (uuid, foreign key) - Connected to organizations
  - `name` (text) - Patient name
  - `age` (integer) - Patient age
  - `phone` (text) - Patient phone number
  - `case` (text, optional) - Medical case
  - `gender` (text) - Patient gender
  - `last_visit_at` (timestamptz) - Last visit timestamp
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 4. pre_consult
  - `id` (uuid, primary key) - Pre-consult identifier
  - `doc_id` (uuid, foreign key) - Connected to auth.users (doctor)
  - `patient_id` (uuid, foreign key) - Connected to patients
  - `documents_uploaded` (jsonb) - Uploaded documents URLs
  - `doc_summary` (text) - AI-generated document summary
  - `status` (text) - Draft or Submitted (default: Draft)
  - `form_data` (jsonb) - Form schema and answers
  - `ai_summary` (text) - AI-generated summary of answers
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 5. consult
  - `id` (uuid, primary key) - Consultation identifier
  - `doc_id` (uuid, foreign key) - Connected to auth.users (doctor)
  - `patient_id` (uuid, foreign key) - Connected to patients
  - `recording_file` (text) - Recording file URL
  - `recording_transcript` (text) - AI transcription
  - `consult_summary_ai` (jsonb) - AI-generated structured summary
  - `consult_summary_final` (jsonb) - Final edited summary
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 6. follow_up
  - `id` (uuid, primary key) - Follow-up identifier
  - `doc_id` (uuid, foreign key) - Connected to auth.users (doctor)
  - `patient_id` (uuid, foreign key) - Connected to patients
  - `status` (text) - Draft or Submitted (default: Draft)
  - `form_data` (jsonb) - Form schema and answers
  - `ai_summary` (text) - AI-generated summary
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 7. queries
  - `id` (uuid, primary key) - Query identifier
  - `doc_id` (uuid, foreign key) - Connected to auth.users (doctor)
  - `patient_id` (uuid, foreign key) - Connected to patients
  - `status` (text) - Open or Closed (default: Open)
  - `priority` (text) - High, Medium, or Low
  - `initial_query` (text) - First query message
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 8. messages
  - `id` (uuid, primary key) - Message identifier
  - `query_id` (uuid, foreign key) - Connected to queries
  - `sender_type` (text) - Doctor or Patient
  - `message` (text) - Message content
  - `attachments` (jsonb) - Attached files
  - `created_at` (timestamptz) - Creation timestamp

  ## Security
  - Enable RLS on all tables
  - Doctors can access only their organization's data
  - Patients can access via secure public URLs (handled in app logic)
*/

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization"
  ON organizations FOR SELECT
  TO authenticated
  USING (auth_id = auth.uid());

CREATE POLICY "Users can insert their organization"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (auth_id = auth.uid());

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'Doctor',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_role CHECK (role IN ('Doctor', 'Assistant'))
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own record"
  ON users FOR SELECT
  TO authenticated
  USING (auth_id = auth.uid());

CREATE POLICY "Users can insert their own record"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth_id = auth.uid());

-- Create patients table
CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  age integer NOT NULL,
  phone text NOT NULL,
  "case" text,
  gender text NOT NULL,
  last_visit_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctors can view their organization's patients"
  ON patients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.org_id = patients.org_id
    )
  );

CREATE POLICY "Doctors can insert patients"
  ON patients FOR INSERT
  TO authenticated
  WITH CHECK (
    doc_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.org_id = patients.org_id
    )
  );

CREATE POLICY "Doctors can update their organization's patients"
  ON patients FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.org_id = patients.org_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.org_id = patients.org_id
    )
  );

CREATE POLICY "Doctors can delete their organization's patients"
  ON patients FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.org_id = patients.org_id
    )
  );

-- Create pre_consult table
CREATE TABLE IF NOT EXISTS pre_consult (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  documents_uploaded jsonb DEFAULT '[]'::jsonb,
  doc_summary text,
  status text NOT NULL DEFAULT 'Draft',
  form_data jsonb DEFAULT '{}'::jsonb,
  ai_summary text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_pre_consult_status CHECK (status IN ('Draft', 'Submitted'))
);

ALTER TABLE pre_consult ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctors can view their pre-consult forms"
  ON pre_consult FOR SELECT
  TO authenticated
  USING (doc_id = auth.uid());

CREATE POLICY "Doctors can insert pre-consult forms"
  ON pre_consult FOR INSERT
  TO authenticated
  WITH CHECK (doc_id = auth.uid());

CREATE POLICY "Doctors can update their pre-consult forms"
  ON pre_consult FOR UPDATE
  TO authenticated
  USING (doc_id = auth.uid())
  WITH CHECK (doc_id = auth.uid());

CREATE POLICY "Anyone can view pre-consult by ID"
  ON pre_consult FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can update pre-consult by ID"
  ON pre_consult FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Create consult table
CREATE TABLE IF NOT EXISTS consult (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  recording_file text,
  recording_transcript text,
  consult_summary_ai jsonb DEFAULT '{}'::jsonb,
  consult_summary_final jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE consult ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctors can view their consultations"
  ON consult FOR SELECT
  TO authenticated
  USING (doc_id = auth.uid());

CREATE POLICY "Doctors can insert consultations"
  ON consult FOR INSERT
  TO authenticated
  WITH CHECK (doc_id = auth.uid());

CREATE POLICY "Doctors can update their consultations"
  ON consult FOR UPDATE
  TO authenticated
  USING (doc_id = auth.uid())
  WITH CHECK (doc_id = auth.uid());

-- Create follow_up table
CREATE TABLE IF NOT EXISTS follow_up (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'Draft',
  form_data jsonb DEFAULT '{}'::jsonb,
  ai_summary text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_follow_up_status CHECK (status IN ('Draft', 'Submitted'))
);

ALTER TABLE follow_up ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctors can view their follow-up forms"
  ON follow_up FOR SELECT
  TO authenticated
  USING (doc_id = auth.uid());

CREATE POLICY "Doctors can insert follow-up forms"
  ON follow_up FOR INSERT
  TO authenticated
  WITH CHECK (doc_id = auth.uid());

CREATE POLICY "Doctors can update their follow-up forms"
  ON follow_up FOR UPDATE
  TO authenticated
  USING (doc_id = auth.uid())
  WITH CHECK (doc_id = auth.uid());

CREATE POLICY "Anyone can view follow-up by ID"
  ON follow_up FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can update follow-up by ID"
  ON follow_up FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Create queries table
CREATE TABLE IF NOT EXISTS queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'Open',
  priority text,
  initial_query text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_query_status CHECK (status IN ('Open', 'Closed')),
  CONSTRAINT valid_priority CHECK (priority IN ('High', 'Medium', 'Low'))
);

ALTER TABLE queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctors can view their queries"
  ON queries FOR SELECT
  TO authenticated
  USING (doc_id = auth.uid());

CREATE POLICY "Doctors can insert queries"
  ON queries FOR INSERT
  TO authenticated
  WITH CHECK (doc_id = auth.uid());

CREATE POLICY "Doctors can update their queries"
  ON queries FOR UPDATE
  TO authenticated
  USING (doc_id = auth.uid())
  WITH CHECK (doc_id = auth.uid());

CREATE POLICY "Anyone can view queries by doc and patient"
  ON queries FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can insert queries"
  ON queries FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can update queries"
  ON queries FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id uuid REFERENCES queries(id) ON DELETE CASCADE NOT NULL,
  sender_type text NOT NULL,
  message text NOT NULL,
  attachments jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_sender CHECK (sender_type IN ('Doctor', 'Patient'))
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctors can view messages in their queries"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM queries
      WHERE queries.id = messages.query_id
      AND queries.doc_id = auth.uid()
    )
  );

CREATE POLICY "Doctors can insert messages in their queries"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM queries
      WHERE queries.id = messages.query_id
      AND queries.doc_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view messages by query"
  ON messages FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can insert messages"
  ON messages FOR INSERT
  TO anon
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_organizations_auth_id ON organizations(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(org_id);
CREATE INDEX IF NOT EXISTS idx_patients_doc_id ON patients(doc_id);
CREATE INDEX IF NOT EXISTS idx_patients_org_id ON patients(org_id);
CREATE INDEX IF NOT EXISTS idx_pre_consult_doc_id ON pre_consult(doc_id);
CREATE INDEX IF NOT EXISTS idx_pre_consult_patient_id ON pre_consult(patient_id);
CREATE INDEX IF NOT EXISTS idx_consult_doc_id ON consult(doc_id);
CREATE INDEX IF NOT EXISTS idx_consult_patient_id ON consult(patient_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_doc_id ON follow_up(doc_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_patient_id ON follow_up(patient_id);
CREATE INDEX IF NOT EXISTS idx_queries_doc_id ON queries(doc_id);
CREATE INDEX IF NOT EXISTS idx_queries_patient_id ON queries(patient_id);
CREATE INDEX IF NOT EXISTS idx_messages_query_id ON messages(query_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pre_consult_updated_at BEFORE UPDATE ON pre_consult
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_consult_updated_at BEFORE UPDATE ON consult
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_follow_up_updated_at BEFORE UPDATE ON follow_up
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_queries_updated_at BEFORE UPDATE ON queries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();