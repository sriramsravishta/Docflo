/*
  # Create Consult Medicine Table

  1. New Tables
    - `consult_medicine`
      - `id` (uuid, primary key)
      - `consult_id` (uuid, foreign key to consult table)
      - `name` (text, medicine name)
      - `dosage` (text, dosage information)
      - `frequency` (text, frequency of administration)
      - `duration` (text, duration of treatment)
      - `route` (text, route of administration)
      - `instructions` (text, additional instructions)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. New Tables
    - `medicine_master_list`
      - `id` (uuid, primary key)
      - `name` (text, medicine name)
      - `generic_name` (text, generic name)
      - `brand_name` (text, brand name)
      - `category` (text, medicine category)
      - `created_at` (timestamp)

  3. Security
    - Enable RLS on both tables
    - Add policies for authenticated users (doctors)
*/

-- Create consult_medicine table
CREATE TABLE IF NOT EXISTS consult_medicine (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consult_id uuid REFERENCES consult(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  dosage text DEFAULT '',
  frequency text DEFAULT '',
  duration text DEFAULT '',
  route text DEFAULT '',
  instructions text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create medicine_master_list table
CREATE TABLE IF NOT EXISTS medicine_master_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  generic_name text DEFAULT '',
  brand_name text DEFAULT '',
  category text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_consult_medicine_consult_id ON consult_medicine(consult_id);
CREATE INDEX IF NOT EXISTS idx_medicine_master_list_name ON medicine_master_list(name);

-- Enable RLS
ALTER TABLE consult_medicine ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicine_master_list ENABLE ROW LEVEL SECURITY;

-- RLS Policies for consult_medicine
CREATE POLICY "Doctors can view medicines for their consultations"
  ON consult_medicine
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM consult
      WHERE consult.id = consult_medicine.consult_id
      AND consult.doc_id = auth.uid()
    )
  );

CREATE POLICY "Doctors can insert medicines for their consultations"
  ON consult_medicine
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM consult
      WHERE consult.id = consult_medicine.consult_id
      AND consult.doc_id = auth.uid()
    )
  );

CREATE POLICY "Doctors can update medicines for their consultations"
  ON consult_medicine
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM consult
      WHERE consult.id = consult_medicine.consult_id
      AND consult.doc_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM consult
      WHERE consult.id = consult_medicine.consult_id
      AND consult.doc_id = auth.uid()
    )
  );

CREATE POLICY "Doctors can delete medicines for their consultations"
  ON consult_medicine
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM consult
      WHERE consult.id = consult_medicine.consult_id
      AND consult.doc_id = auth.uid()
    )
  );

-- RLS Policies for medicine_master_list (read-only for doctors)
CREATE POLICY "Doctors can view medicine master list"
  ON medicine_master_list
  FOR SELECT
  TO authenticated
  USING (true);

-- Create trigger for updating updated_at
CREATE OR REPLACE FUNCTION update_consult_medicine_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_consult_medicine_updated_at
  BEFORE UPDATE ON consult_medicine
  FOR EACH ROW
  EXECUTE FUNCTION update_consult_medicine_updated_at();

-- Insert sample medicine data
INSERT INTO medicine_master_list (name, generic_name, brand_name, category) VALUES
('Paracetamol 500mg', 'Paracetamol', 'Crocin', 'Analgesic'),
('Ibuprofen 400mg', 'Ibuprofen', 'Brufen', 'NSAID'),
('Amoxicillin 500mg', 'Amoxicillin', 'Amoxil', 'Antibiotic'),
('Metformin 500mg', 'Metformin', 'Glucophage', 'Antidiabetic'),
('Amlodipine 5mg', 'Amlodipine', 'Norvasc', 'Antihypertensive'),
('Atorvastatin 20mg', 'Atorvastatin', 'Lipitor', 'Statin'),
('Omeprazole 20mg', 'Omeprazole', 'Prilosec', 'PPI'),
('Aspirin 75mg', 'Aspirin', 'Disprin', 'Antiplatelet'),
('Cetirizine 10mg', 'Cetirizine', 'Zyrtec', 'Antihistamine'),
('Pantoprazole 40mg', 'Pantoprazole', 'Protonix', 'PPI')
ON CONFLICT (name) DO NOTHING;