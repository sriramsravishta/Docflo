/*
  # Create favourite_medicines table

  1. New Tables
    - `favourite_medicines`
      - `id` (uuid, primary key)
      - `doc_id` (uuid, FK to auth.users) — the doctor who owns the favourite
      - `name` (text, required) — medicine name
      - `dosage` (text) — dosage info
      - `quantity` (text) — quantity info
      - `type` (text) — medicine type
      - `frequency` (text) — frequency of intake
      - `food` (text) — before/after food relation
      - `time` (text) — time of day (stored as text, e.g. comma-separated)
      - `duration` (text) — how long to take
      - `instructions` (text) — additional instructions
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `favourite_medicines` table
    - Doctors can only CRUD their own rows (doc_id = auth.uid())
*/

CREATE TABLE IF NOT EXISTS favourite_medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL DEFAULT '',
  dosage text DEFAULT '',
  quantity text DEFAULT '',
  type text DEFAULT '',
  frequency text DEFAULT '',
  food text DEFAULT '',
  time text DEFAULT '',
  duration text DEFAULT '',
  instructions text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE favourite_medicines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctors can view own favourites"
  ON favourite_medicines FOR SELECT
  TO authenticated
  USING (auth.uid() = doc_id);

CREATE POLICY "Doctors can insert own favourites"
  ON favourite_medicines FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = doc_id);

CREATE POLICY "Doctors can update own favourites"
  ON favourite_medicines FOR UPDATE
  TO authenticated
  USING (auth.uid() = doc_id)
  WITH CHECK (auth.uid() = doc_id);

CREATE POLICY "Doctors can delete own favourites"
  ON favourite_medicines FOR DELETE
  TO authenticated
  USING (auth.uid() = doc_id);
