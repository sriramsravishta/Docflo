/*
  # Create discharge_summaries table

  ## Summary
  Creates the discharge_summaries table to store clinical summariser records,
  including audio recording metadata, processing status, and the structured
  summary JSON once it has been generated.

  ## New Tables
  - `discharge_summaries`
    - `id` (uuid, primary key) — unique record identifier
    - `doctor_id` (uuid, FK to auth.users) — owning doctor
    - `created_at` (timestamptz) — when the record was created
    - `updated_at` (timestamptz) — last modification timestamp
    - `status` (text) — 'processing' | 'completed'
    - `recording_stopped_at` (timestamptz) — when the audio recording ended, used to start polling offset
    - `summary_json` (jsonb) — the structured discharge summary once generated
    - `summary_text` (text) — optional plain-text preview / snippet for list display

  ## Security
  - RLS enabled
  - Authenticated users can only SELECT / INSERT / UPDATE their own rows (doctor_id = auth.uid())
*/

CREATE TABLE IF NOT EXISTS discharge_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'processing',
  recording_stopped_at timestamptz,
  summary_json jsonb,
  summary_text text DEFAULT ''
);

ALTER TABLE discharge_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctors can view own discharge summaries"
  ON discharge_summaries FOR SELECT
  TO authenticated
  USING (auth.uid() = doctor_id);

CREATE POLICY "Doctors can insert own discharge summaries"
  ON discharge_summaries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = doctor_id);

CREATE POLICY "Doctors can update own discharge summaries"
  ON discharge_summaries FOR UPDATE
  TO authenticated
  USING (auth.uid() = doctor_id)
  WITH CHECK (auth.uid() = doctor_id);
