/*
  # Fix RLS Performance and Security Issues

  1. Performance Optimizations
    - Replace auth.uid() with (select auth.uid()) in all RLS policies
    - Remove unused indexes that consume storage without benefit
    - Fix function search path security issue

  2. Security Improvements
    - Optimize RLS policy evaluation for better performance at scale
    - Maintain all existing security constraints
    - Fix mutable search path in trigger function
*/

-- Drop and recreate RLS policies with optimized auth function calls

-- Organizations table policies
DROP POLICY IF EXISTS "Users can view their organization" ON organizations;
DROP POLICY IF EXISTS "Users can insert their organization" ON organizations;

CREATE POLICY "Users can view their organization"
  ON organizations
  FOR SELECT
  TO authenticated
  USING (auth_id = (select auth.uid()));

CREATE POLICY "Users can insert their organization"
  ON organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth_id = (select auth.uid()));

-- Users table policies
DROP POLICY IF EXISTS "Users can view their own record" ON users;
DROP POLICY IF EXISTS "Users can insert their own record" ON users;

CREATE POLICY "Users can view their own record"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth_id = (select auth.uid()));

CREATE POLICY "Users can insert their own record"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth_id = (select auth.uid()));

-- Patients table policies
DROP POLICY IF EXISTS "Doctors can view their organization's patients" ON patients;
DROP POLICY IF EXISTS "Doctors can insert patients" ON patients;
DROP POLICY IF EXISTS "Doctors can update their organization's patients" ON patients;
DROP POLICY IF EXISTS "Doctors can delete their organization's patients" ON patients;

CREATE POLICY "Doctors can view their organization's patients"
  ON patients
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_id = (select auth.uid()) AND users.org_id = patients.org_id
  ));

CREATE POLICY "Doctors can insert patients"
  ON patients
  FOR INSERT
  TO authenticated
  WITH CHECK ((doc_id = (select auth.uid())) AND (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_id = (select auth.uid()) AND users.org_id = patients.org_id
  )));

CREATE POLICY "Doctors can update their organization's patients"
  ON patients
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_id = (select auth.uid()) AND users.org_id = patients.org_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_id = (select auth.uid()) AND users.org_id = patients.org_id
  ));

CREATE POLICY "Doctors can delete their organization's patients"
  ON patients
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_id = (select auth.uid()) AND users.org_id = patients.org_id
  ));

-- Pre-consult table policies
DROP POLICY IF EXISTS "Doctors can view their pre-consult forms" ON pre_consult;
DROP POLICY IF EXISTS "Doctors can insert pre-consult forms" ON pre_consult;
DROP POLICY IF EXISTS "Doctors can update their pre-consult forms" ON pre_consult;

CREATE POLICY "Doctors can view their pre-consult forms"
  ON pre_consult
  FOR SELECT
  TO authenticated
  USING (doc_id = (select auth.uid()));

CREATE POLICY "Doctors can insert pre-consult forms"
  ON pre_consult
  FOR INSERT
  TO authenticated
  WITH CHECK (doc_id = (select auth.uid()));

CREATE POLICY "Doctors can update their pre-consult forms"
  ON pre_consult
  FOR UPDATE
  TO authenticated
  USING (doc_id = (select auth.uid()))
  WITH CHECK (doc_id = (select auth.uid()));

-- Consult table policies
DROP POLICY IF EXISTS "Doctors can view their consultations" ON consult;
DROP POLICY IF EXISTS "Doctors can insert consultations" ON consult;
DROP POLICY IF EXISTS "Doctors can update their consultations" ON consult;

CREATE POLICY "Doctors can view their consultations"
  ON consult
  FOR SELECT
  TO authenticated
  USING (doc_id = (select auth.uid()));

CREATE POLICY "Doctors can insert consultations"
  ON consult
  FOR INSERT
  TO authenticated
  WITH CHECK (doc_id = (select auth.uid()));

CREATE POLICY "Doctors can update their consultations"
  ON consult
  FOR UPDATE
  TO authenticated
  USING (doc_id = (select auth.uid()))
  WITH CHECK (doc_id = (select auth.uid()));

-- Follow-up table policies
DROP POLICY IF EXISTS "Doctors can view their follow-up forms" ON follow_up;
DROP POLICY IF EXISTS "Doctors can insert follow-up forms" ON follow_up;
DROP POLICY IF EXISTS "Doctors can update their follow-up forms" ON follow_up;

CREATE POLICY "Doctors can view their follow-up forms"
  ON follow_up
  FOR SELECT
  TO authenticated
  USING (doc_id = (select auth.uid()));

CREATE POLICY "Doctors can insert follow-up forms"
  ON follow_up
  FOR INSERT
  TO authenticated
  WITH CHECK (doc_id = (select auth.uid()));

CREATE POLICY "Doctors can update their follow-up forms"
  ON follow_up
  FOR UPDATE
  TO authenticated
  USING (doc_id = (select auth.uid()))
  WITH CHECK (doc_id = (select auth.uid()));

-- Queries table policies
DROP POLICY IF EXISTS "Doctors can view their queries" ON queries;
DROP POLICY IF EXISTS "Doctors can insert queries" ON queries;
DROP POLICY IF EXISTS "Doctors can update their queries" ON queries;

CREATE POLICY "Doctors can view their queries"
  ON queries
  FOR SELECT
  TO authenticated
  USING (doc_id = (select auth.uid()));

CREATE POLICY "Doctors can insert queries"
  ON queries
  FOR INSERT
  TO authenticated
  WITH CHECK (doc_id = (select auth.uid()));

CREATE POLICY "Doctors can update their queries"
  ON queries
  FOR UPDATE
  TO authenticated
  USING (doc_id = (select auth.uid()))
  WITH CHECK (doc_id = (select auth.uid()));

-- Messages table policies
DROP POLICY IF EXISTS "Doctors can view messages in their queries" ON messages;
DROP POLICY IF EXISTS "Doctors can insert messages in their queries" ON messages;

CREATE POLICY "Doctors can view messages in their queries"
  ON messages
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM queries
    WHERE queries.id = messages.query_id AND queries.doc_id = (select auth.uid())
  ));

CREATE POLICY "Doctors can insert messages in their queries"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM queries
    WHERE queries.id = messages.query_id AND queries.doc_id = (select auth.uid())
  ));

-- Remove unused indexes to improve storage efficiency
DROP INDEX IF EXISTS idx_patients_doc_id;
DROP INDEX IF EXISTS idx_pre_consult_doc_id;
DROP INDEX IF EXISTS idx_consult_doc_id;
DROP INDEX IF EXISTS idx_follow_up_doc_id;
DROP INDEX IF EXISTS idx_queries_patient_id;
DROP INDEX IF EXISTS idx_messages_query_id;

-- Fix function search path security issue
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;