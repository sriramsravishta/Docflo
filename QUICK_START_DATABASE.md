# Quick Start Guide - Database Implementation

## What Has Been Done

The complete database schema for Docflo has been implemented in Supabase PostgreSQL with all necessary tables, relationships, security policies, and helper functions.

## Database Tables Created

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `organizations` | Stores doctor organization info | `auth_id`, `name` |
| `users` | Links auth users to organizations | `auth_id`, `org_id`, `role` |
| `patients` | Patient records | `doc_id`, `org_id`, `name`, `age`, `phone`, `case`, `gender` |
| `pre_consult` | Pre-consultation forms | `doc_id`, `patient_id`, `status`, `form_data`, `ai_summary` |
| `consult` | Consultation records | `doc_id`, `patient_id`, `recording_file`, `consult_summary_ai`, `consult_summary_final` |
| `follow_up` | Follow-up forms | `doc_id`, `patient_id`, `status`, `form_data`, `ai_summary` |
| `queries` | Query threads | `doc_id`, `patient_id`, `status`, `priority`, `initial_query` |
| `messages` | Query messages | `query_id`, `sender_type`, `message`, `attachments` |

## Working Features

### ✅ Authentication
```typescript
// Sign Up
await signUp(name, email, password, phone);
// Creates: auth.users + organizations + users records

// Sign In
await signIn(email, password);

// Sign Out
await signOut();
```

### ✅ Patient Management
```typescript
// Create Patient
const patient = await createPatient({
  name: 'John Doe',
  age: 45,
  phone: '+91 98765 43210',
  case: 'Hypertension',
  gender: 'Male'
});

// Get All Patients (auto-filtered by organization)
const patients = await getPatients();

// Update Patient
await updatePatient(patientId, { case: 'Updated Case' });
```

### ✅ Pre-Consult (Database Ready)
```typescript
// Create Pre-Consult Record
const preConsult = await createPreConsult(docId, patientId);
// Returns: { id, doc_id, patient_id, status: 'Draft', ... }

// Update with Documents
await updatePreConsult(preConsultId, {
  documents_uploaded: [{ url: '...', name: 'file.pdf', type: 'application/pdf' }],
  doc_summary: 'AI-generated summary...'
});

// Update with Form Data
await updatePreConsult(preConsultId, {
  form_data: {
    schema: [...questions],
    answers: {...}
  }
});

// Submit
await updatePreConsult(preConsultId, {
  status: 'Submitted',
  ai_summary: 'Generated summary...'
});

// Get All Pre-Consults for Patient
const preConsults = await getPreConsults(patientId);
```

### ✅ Consultation (Database Ready)
```typescript
// Create Consultation Record (on "End Recording")
const consult = await createConsult(docId, patientId, recordingFileUrl);
// Auto-updates patient.last_visit_at

// Update with AI Analysis
await updateConsult(consultId, {
  recording_transcript: 'transcription...',
  consult_summary_ai: {
    diagnosis: '...',
    history: '...',
    medications: [...]
  }
});

// Save Final Edited Version
await updateConsult(consultId, {
  consult_summary_final: editedSummaryJSON
});

// Get All Consultations for Patient
const consults = await getConsults(patientId);
```

### ✅ Follow-Up (Database Ready)
```typescript
// Create Follow-Up Record
const followUp = await createFollowUp(docId, patientId);

// Update with Personalized Form
await updateFollowUp(followUpId, {
  form_data: {
    schema: personalizedQuestions,
    answers: {}
  }
});

// Submit
await updateFollowUp(followUpId, {
  status: 'Submitted',
  ai_summary: 'Summary...'
});

// Get All Follow-Ups for Patient
const followUps = await getFollowUps(patientId);
```

### ✅ Queries (Database Ready)
```typescript
// Create Query Thread
const query = await createQuery(docId, patientId, 'Initial message...');
// Returns: { id, doc_id, patient_id, status: 'Open', priority: 'Medium', ... }

// Add Message (Doctor)
await createMessage(queryId, 'Doctor', 'Reply message...', []);
// Auto-updates query.updated_at

// Add Message (Patient)
await createMessage(queryId, 'Patient', 'Response...', attachments);

// Get All Messages in Thread
const messages = await getMessages(queryId);

// Mark as Resolved
await updateQuery(queryId, { status: 'Closed' });

// Get All Queries for Doctor
const queries = await getQueries(docId);
```

## Database Helper Functions Available

All functions are in `src/lib/database.ts`:

**Patients:**
- `createPatient(data)`
- `getPatients()`
- `updatePatient(id, updates)`
- `getPatientById(id)`

**Pre-Consult:**
- `createPreConsult(docId, patientId)`
- `getPreConsults(patientId)`
- `updatePreConsult(id, updates)`
- `getPreConsultById(id)`

**Consult:**
- `createConsult(docId, patientId, recordingFile)`
- `getConsults(patientId)`
- `updateConsult(id, updates)`

**Follow-Up:**
- `createFollowUp(docId, patientId)`
- `getFollowUps(patientId)`
- `updateFollowUp(id, updates)`
- `getFollowUpById(id)`

**Queries:**
- `createQuery(docId, patientId, initialQuery)`
- `getQueries(docId?)`
- `updateQuery(id, updates)`
- `createMessage(queryId, senderType, message, attachments)`
- `getMessages(queryId)`

## Row Level Security (RLS)

All tables have RLS enabled:

**For Authenticated Users (Doctors):**
- Can view/insert/update/delete only their organization's data
- Queries check: `user.org_id = resource.org_id`

**For Anonymous Users (Patients):**
- Can view/update forms by ID (for filling out forms)
- Can insert queries and messages (for patient query interface)
- No password required - access via secure URLs

## Column Naming

All columns use **snake_case**:
- `doc_id` (doctor's auth ID)
- `patient_id`
- `org_id`
- `auth_id`
- `created_at`
- `updated_at`
- `last_visit_at`
- `documents_uploaded`
- `form_data`
- `ai_summary`
- `recording_file`
- `consult_summary_ai`
- `consult_summary_final`
- `initial_query`
- `sender_type`

## JSONB Column Structures

### documents_uploaded / attachments
```json
[
  {
    "url": "storage_url",
    "name": "filename.pdf",
    "type": "application/pdf"
  }
]
```

### form_data (pre_consult, follow_up)
```json
{
  "schema": [
    {
      "id": "q1",
      "question": "Question text",
      "type": "textarea",
      "required": true
    }
  ],
  "answers": {
    "q1": "Patient answer..."
  }
}
```

### consult_summary_ai / consult_summary_final
```json
{
  "diagnosis": "...",
  "history": "...",
  "chief_complaints": "...",
  "treatment_suggested": "...",
  "medications": [
    {
      "name": "Medicine",
      "frequency": "Once daily",
      "duration": "30 days",
      "timing": "Morning"
    }
  ],
  "key_personal_insights": "Private notes...",
  "followup_recommendations": "..."
}
```

## Testing the Database

### 1. Test Signup Flow
```typescript
// Create new doctor account
await signUp('Dr. John', 'doctor@example.com', 'password123', '+91 9876543210');

// Check database:
// - auth.users should have new record
// - organizations should have new record with auth_id
// - users should have new record with auth_id, org_id, role='Doctor'
```

### 2. Test Patient Creation
```typescript
// After signing in
const patient = await createPatient({
  name: 'Test Patient',
  age: 45,
  phone: '+91 1234567890',
  case: 'Hypertension',
  gender: 'Male'
});

// Check database:
// - patients table should have new record
// - doc_id should match current user's auth.uid()
// - org_id should match user's organization
```

### 3. Test Pre-Consult Flow
```typescript
// Create draft
const preConsult = await createPreConsult(docId, patientId);
// status should be 'Draft'

// Update with data
await updatePreConsult(preConsult.id, {
  status: 'Submitted',
  form_data: { schema: [], answers: {} },
  ai_summary: 'Test summary'
});

// Verify
const updated = await getPreConsultById(preConsult.id);
// updated.status should be 'Submitted'
```

## Environment Variables

Required in `.env`:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Next Steps for Integration

1. **PreConsultForm.tsx**
   - On mount, create pre-consult record
   - Update form_data in real-time as patient types
   - On submit, update status to 'Submitted'

2. **ConsultSession.tsx**
   - On "End Recording", create consult record
   - Upload recording file to Supabase Storage
   - Update with transcript and AI summary
   - On "Approve", update consult_summary_final

3. **FollowUpForm.tsx**
   - Similar to PreConsultForm
   - Create follow-up record
   - Update form_data in real-time
   - On submit, update status to 'Submitted'

4. **QueriesPage.tsx & PatientQueries.tsx**
   - Load queries with getQueries()
   - Display messages with getMessages()
   - Create messages with createMessage()
   - Update query status with updateQuery()

## Useful Database Queries (for debugging)

```sql
-- View all tables
SELECT * FROM organizations;
SELECT * FROM users;
SELECT * FROM patients;
SELECT * FROM pre_consult;
SELECT * FROM consult;
SELECT * FROM follow_up;
SELECT * FROM queries;
SELECT * FROM messages;

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename IN (
  'organizations', 'users', 'patients', 'pre_consult',
  'consult', 'follow_up', 'queries', 'messages'
);

-- View indexes
SELECT tablename, indexname FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

## Support

For detailed documentation, see:
- `DATA_FLOWS.md` - Complete data flow specifications
- `DATABASE_SCHEMA.md` - Database schema documentation
- `IMPLEMENTATION_STATUS.md` - Current implementation status
- `COMPLETED_IMPLEMENTATION.md` - Summary of completed work

---

**Database Status:** ✅ OPERATIONAL
**Ready for Integration:** ✅ YES
**Build Status:** ✅ PASSING
