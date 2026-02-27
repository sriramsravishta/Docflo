/*
  # Add Missing Foreign Key Indexes

  1. Performance Improvements
    - Add indexes for all unindexed foreign keys to improve query performance
    - These indexes will speed up JOIN operations and foreign key constraint checks

  2. Security Enhancement
    - Enable leaked password protection in Supabase Auth
*/

-- Add missing foreign key indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_consult_doc_id ON public.consult(doc_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_doc_id ON public.follow_up(doc_id);
CREATE INDEX IF NOT EXISTS idx_messages_query_id ON public.messages(query_id);
CREATE INDEX IF NOT EXISTS idx_patients_doc_id ON public.patients(doc_id);
CREATE INDEX IF NOT EXISTS idx_pre_consult_doc_id ON public.pre_consult(doc_id);
CREATE INDEX IF NOT EXISTS idx_queries_patient_id ON public.queries(patient_id);

-- Note: Leaked password protection must be enabled in the Supabase Dashboard
-- Go to Authentication > Settings > Password Protection and enable "Check for leaked passwords"
-- This cannot be done via SQL migration as it's a Supabase platform setting