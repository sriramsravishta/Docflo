# Database Schema for Docflo

This document describes the database schema needed for Docflo. The schema is designed for Supabase PostgreSQL.

## Tables

### doctors
Stores doctor account information.

```sql
CREATE TABLE doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

**RLS Policies:**
- Doctors can read their own data only

### patients
Stores patient information associated with each doctor.

```sql
CREATE TABLE patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid REFERENCES doctors(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  age integer NOT NULL,
  gender text NOT NULL,
  case text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Indexes:**
- `idx_patients_doctor_id` on `doctor_id`

**RLS Policies:**
- Doctors can view/insert/update/delete only their own patients

### pre_consult_forms
Stores pre-consultation form submissions from patients.

```sql
CREATE TABLE pre_consult_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  doctor_id uuid REFERENCES doctors(id) ON DELETE CASCADE NOT NULL,
  language text NOT NULL DEFAULT 'English',
  visit_reason text NOT NULL,
  is_first_visit boolean NOT NULL,
  symptoms text NOT NULL,
  allergies text,
  habits text,
  documents jsonb DEFAULT '[]'::jsonb,
  doc_summary text,
  created_at timestamptz DEFAULT now()
);
```

**Indexes:**
- `idx_pre_consult_forms_patient_id` on `patient_id`

**RLS Policies:**
- Doctors can view forms for their patients
- Anonymous users can insert forms (for patient access via links)

### consultations
Stores consultation records and AI-generated notes.

```sql
CREATE TABLE consultations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  doctor_id uuid REFERENCES doctors(id) ON DELETE CASCADE NOT NULL,
  diagnosis text NOT NULL DEFAULT '',
  history text NOT NULL DEFAULT '',
  chief_complaints text NOT NULL DEFAULT '',
  treatment_suggested text NOT NULL DEFAULT '',
  medications jsonb DEFAULT '[]'::jsonb,
  key_personal_insights text NOT NULL DEFAULT '',
  followup_recommendations text NOT NULL DEFAULT '',
  audio_url text,
  is_approved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

**Indexes:**
- `idx_consultations_patient_id` on `patient_id`
- `idx_consultations_doctor_id` on `doctor_id`

**RLS Policies:**
- Doctors can view/insert/update only their own consultations

### followup_forms
Stores follow-up form submissions from patients.

```sql
CREATE TABLE followup_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  doctor_id uuid REFERENCES doctors(id) ON DELETE CASCADE NOT NULL,
  language text NOT NULL DEFAULT 'English',
  overall_feeling text NOT NULL,
  problem_status text NOT NULL,
  new_symptoms text NOT NULL,
  medication_adherence text NOT NULL,
  new_reports jsonb DEFAULT '[]'::jsonb,
  lifestyle_changes text,
  created_at timestamptz DEFAULT now()
);
```

**Indexes:**
- `idx_followup_forms_patient_id` on `patient_id`

**RLS Policies:**
- Doctors can view forms for their patients
- Anonymous users can insert forms

### queries
Stores query thread metadata between doctors and patients.

```sql
CREATE TABLE queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  doctor_id uuid REFERENCES doctors(id) ON DELETE CASCADE NOT NULL,
  priority text NOT NULL DEFAULT 'Medium',
  status text NOT NULL DEFAULT 'Active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Indexes:**
- `idx_queries_doctor_id` on `doctor_id`

**RLS Policies:**
- Doctors can view/insert/update their own queries
- Anonymous users can insert queries

### query_messages
Stores individual messages within query threads.

```sql
CREATE TABLE query_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id uuid REFERENCES queries(id) ON DELETE CASCADE NOT NULL,
  sender_type text NOT NULL,
  content text NOT NULL,
  attachments jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);
```

**Indexes:**
- `idx_query_messages_query_id` on `query_id`

**RLS Policies:**
- Doctors can view/insert messages in their queries
- Anonymous users can insert messages

## Data Types

### JSONB Structures

**medications** (in consultations table):
```json
[
  {
    "name": "Medicine name",
    "frequency": "Once daily",
    "duration": "30 days",
    "timing": "Morning"
  }
]
```

**documents** (in pre_consult_forms and followup_forms):
```json
[
  {
    "url": "storage_url",
    "name": "filename.pdf",
    "type": "application/pdf"
  }
]
```

**attachments** (in query_messages):
```json
[
  {
    "url": "storage_url",
    "name": "image.jpg",
    "type": "image/jpeg"
  }
]
```

## Storage Buckets

### documents
For storing patient documents (prescriptions, reports, etc.)

**Access:**
- Public read access for authenticated users only
- Upload allowed for anonymous users (with token validation in application layer)

### audio-recordings
For storing consultation audio recordings

**Access:**
- Private, accessible only by the associated doctor

## Implementation Notes

1. **Authentication**: Use Supabase Auth for doctor authentication
2. **Patient Access**: Patients access via secure URLs with `patientId` and `doctorId` parameters
3. **File Upload**: Use Supabase Storage for document and audio file storage
4. **RLS**: All tables have Row Level Security enabled to ensure data privacy
5. **Indexes**: Created on foreign keys and frequently queried columns
6. **Timestamps**: All tables use `timestamptz` for timezone-aware timestamps

## Migration Script

To set up the database, use the migration file provided in the codebase or run the SQL scripts in order.

## Future Enhancements

- Add `assistants` table for multi-user practices
- Add `appointments` table for scheduling
- Add `templates` table for customizable form templates
- Add audit logging tables for compliance
