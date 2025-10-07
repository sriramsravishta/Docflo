# Docflo Data Flows - Complete Implementation Guide

This document describes exactly how data flows through the system as implemented in the database.

## Overview

The database has been fully created in Supabase with all tables, relationships, Row Level Security policies, and triggers. This document explains how each workflow interacts with the database.

---

## 1. SIGNUP FLOW (Doctor)

### User Actions:
1. Doctor enters: **Name, Email, Mobile No (optional), Password**
2. Clicks "Sign Up"

### Database Operations:

```typescript
// Step 1: Create auth user
const { data: authData, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: { name, phone }
  }
});

// Step 2: Create organization record
await supabase.from('organizations').insert({
  auth_id: authData.user.id,  // Links to auth.users
  name: name                   // Doctor's name becomes org name
});

// Step 3: Get the created organization ID
const { data: orgData } = await supabase
  .from('organizations')
  .select('id')
  .eq('auth_id', authData.user.id)
  .single();

// Step 4: Create user record
await supabase.from('users').insert({
  auth_id: authData.user.id,     // Links to auth.users
  org_id: orgData.id,            // Links to organizations
  role: 'Doctor'                 // Default role
});

// Step 5: Sign out (user must sign in to continue)
await supabase.auth.signOut();
```

### Database Tables Updated:
- `auth.users` (Supabase Auth) - New auth record
- `organizations` - New organization with `auth_id` and `name`
- `users` - New user record linking auth_id to org_id with role

### Result:
- User sees success message
- User is redirected to login page
- All three records are atomically linked

---

## 2. PATIENT CREATION

### User Actions:
1. Doctor clicks "+ Patient"
2. Enters: **Name, Age, Phone No, Case (optional), Gender**
3. Clicks "Create"

### Database Operations:

```typescript
// Get current user
const { data: { user } } = await supabase.auth.getUser();

// Get user's organization
const { data: userData } = await supabase
  .from('users')
  .select('org_id')
  .eq('auth_id', user.id)
  .single();

// Create patient
const { data, error } = await supabase.from('patients').insert({
  doc_id: user.id,           // Current doctor's auth ID
  org_id: userData.org_id,   // Doctor's organization ID
  name: name,
  age: age,
  phone: phone,
  case: case || null,        // Optional
  gender: gender,
  last_visit_at: null        // No visit yet
});
```

### Database Tables Updated:
- `patients` - New patient record linked to doctor and organization

### Result:
- Patient appears in "All Patients" list
- Patient can be clicked to view profile
- Patient is searchable by name

---

## 3. PRE-CONSULT FLOW

### Part A: Sending Form

#### User Actions:
1. Doctor opens patient profile
2. Clicks "Send Link" or "Open Form" in Pre-consult tab

#### Database Operations:

```typescript
// Create new pre-consult record
const { data, error } = await supabase.from('pre_consult').insert({
  doc_id: doctorAuthId,
  patient_id: patientId,
  status: 'Draft',           // Default status
  documents_uploaded: [],    // Empty array initially
  form_data: {},            // Empty object initially
  doc_summary: null,
  ai_summary: null
}).select().single();

// Generate URL with pre-consult ID only
const formUrl = `/pre-consult/${data.id}`;
```

### Part B: Patient Fills Form

#### User Actions:
1. Patient opens link (contains only `pre_consult_id`)
2. Uploads documents (PDFs/images)

#### Database Operations:

```typescript
// Upload files to Supabase Storage
const uploadedUrls = [];
for (const file of files) {
  const { data } = await supabase.storage
    .from('patient-documents')
    .upload(`${preConsultId}/${file.name}`, file);
  uploadedUrls.push(data.path);
}

// Update pre-consult with documents
await supabase.from('pre_consult').update({
  documents_uploaded: uploadedUrls.map(url => ({
    url: url,
    name: filename,
    type: mimetype
  }))
}).eq('id', preConsultId);

// AI analyzes documents (Gemini API)
const docSummary = await analyzeDocuments(uploadedUrls);
const formQuestions = await generateFormQuestions(docSummary);

// Update with AI-generated content
await supabase.from('pre_consult').update({
  doc_summary: docSummary,
  form_data: {
    schema: formQuestions,    // Questions structure
    answers: {}               // Empty answers object
  }
}).eq('id', preConsultId);
```

#### User Actions Continue:
3. Patient answers questions (voice or text input)

#### Database Operations (Real-time updates):

```typescript
// As each answer is provided, update form_data
await supabase.from('pre_consult').update({
  form_data: {
    schema: existingSchema,
    answers: {
      ...existingAnswers,
      [questionId]: answer
    }
  }
}).eq('id', preConsultId);
```

### Part C: Form Submission

#### User Actions:
4. Patient clicks "Submit"

#### Database Operations:

```typescript
// Update status to Submitted
await supabase.from('pre_consult').update({
  status: 'Submitted'
}).eq('id', preConsultId);

// AI generates summary of answers
const aiSummary = await generateAnswerSummary(formData.answers);

// Update with AI summary
await supabase.from('pre_consult').update({
  ai_summary: aiSummary
}).eq('id', preConsultId);
```

### Database Tables Updated:
- `pre_consult` - Multiple updates:
  1. Initial Draft creation
  2. Documents uploaded
  3. Doc summary and form schema added
  4. Answers updated in real-time
  5. Status changed to Submitted
  6. AI summary added

### Result:
- Pre-consult appears in patient's profile under Pre-consult tab
- Clicking card opens popup showing AI summary + documents
- Doctor can review before consultation

---

## 4. CONSULT FLOW

### Part A: Start Consultation

#### User Actions:
1. Doctor clicks "Start Consultation" from patient profile
2. Records audio (start, pause, resume controls)
3. Clicks "End Recording"

### Part B: Save Recording & Process

#### Database Operations:

```typescript
// Upload recording to storage
const { data: fileData } = await supabase.storage
  .from('consultation-recordings')
  .upload(`${patientId}/${timestamp}.webm`, audioBlob);

// Create consult record
const { data, error } = await supabase.from('consult').insert({
  doc_id: doctorAuthId,
  patient_id: patientId,
  recording_file: fileData.path
}).select().single();

// AI processes recording (Gemini API)
const transcript = await transcribeAudio(fileData.path);
const structuredSummary = await generateConsultSummary(transcript);

// Update with AI-generated data
await supabase.from('consult').update({
  recording_transcript: transcript,
  consult_summary_ai: {
    diagnosis: "...",
    history: "...",
    chief_complaints: "...",
    treatment_suggested: "...",
    medications: [{...}],
    key_personal_insights: "...",
    followup_recommendations: "..."
  }
}).eq('id', data.id);

// Update patient's last visit
await supabase.from('patients').update({
  last_visit_at: new Date().toISOString()
}).eq('id', patientId);
```

### Part C: Doctor Reviews & Approves

#### User Actions:
4. Doctor edits the AI-generated summary
5. Adds/removes medications
6. Clicks "Approve & Send"

#### Database Operations:

```typescript
// Save final edited version
await supabase.from('consult').update({
  consult_summary_final: editedSummaryJSON
}).eq('id', consultId);

// Generate PDF (excluding key_personal_insights)
const pdfUrl = await generatePDF(editedSummaryJSON);

// Send via WhatsApp
await sendWhatsAppMessage(patientPhone, pdfUrl);
```

### Database Tables Updated:
- `consult` - Multiple updates:
  1. Initial record with recording_file
  2. Transcript and AI summary added
  3. Final edited summary saved
- `patients` - `last_visit_at` updated

### Result:
- Consultation visible in patient profile under Consultations tab
- Clicking card opens popup with full approved summary
- Patient receives PDF via WhatsApp

---

## 5. FOLLOW-UP FLOW

### Part A: Send Follow-Up Form

#### User Actions:
1. Doctor clicks "Send Follow-up Form" in Monitoring tab
2. Confirms in popup

#### Database Operations:

```typescript
// Create follow-up record
const { data, error } = await supabase.from('follow_up').insert({
  doc_id: doctorAuthId,
  patient_id: patientId,
  status: 'Draft',
  form_data: {},
  ai_summary: null
}).select().single();

// Get most recent consultation
const { data: latestConsult } = await supabase
  .from('consult')
  .select('*')
  .eq('patient_id', patientId)
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

// AI generates personalized form based on consultation
const personalizedForm = await generateFollowUpForm(latestConsult);

// Update with form schema
await supabase.from('follow_up').update({
  form_data: {
    schema: personalizedForm,
    answers: {}
  }
}).eq('id', data.id);

// Generate URL
const formUrl = `/follow-up/${data.id}`;

// Send via WhatsApp
await sendWhatsAppMessage(patientPhone, formUrl);
```

### Part B: Patient Fills Form

#### User Actions:
3. Patient opens link and answers questions (with voice support)

#### Database Operations (Real-time):

```typescript
// Update answers as patient fills form
await supabase.from('follow_up').update({
  form_data: {
    schema: existingSchema,
    answers: {
      ...existingAnswers,
      [questionId]: answer
    }
  }
}).eq('id', followUpId);
```

### Part C: Submit

#### User Actions:
4. Patient clicks "Submit"

#### Database Operations:

```typescript
// Update status
await supabase.from('follow_up').update({
  status: 'Submitted'
}).eq('id', followUpId);

// AI generates summary
const aiSummary = await generateFollowUpSummary(formData.answers);

// Update with summary
await supabase.from('follow_up').update({
  ai_summary: aiSummary
}).eq('id', followUpId);
```

### Database Tables Updated:
- `follow_up` - Multiple updates:
  1. Initial Draft record
  2. Personalized form schema added
  3. Answers updated in real-time
  4. Status changed to Submitted
  5. AI summary added

### Result:
- Follow-up visible in patient profile under Monitoring tab
- Clicking card opens popup with AI summary + any uploaded docs
- Doctor can track patient progress

---

## 6. QUERIES FLOW

### Part A: Patient Creates Query

#### User Actions:
1. Patient opens query interface (URL has `doc_id` and `patient_id`)
2. Types first message (or attaches files)
3. Sends query

#### Database Operations:

```typescript
// Create query thread
const { data: queryData, error } = await supabase.from('queries').insert({
  doc_id: docIdFromUrl,
  patient_id: patientIdFromUrl,
  initial_query: firstMessage,
  status: 'Open',
  priority: null  // Will be set by AI
}).select().single();

// AI assigns priority
const priority = await assignQueryPriority(firstMessage);

// Update with priority
await supabase.from('queries').update({
  priority: priority  // 'High', 'Medium', or 'Low'
}).eq('id', queryData.id);

// Create first message
await supabase.from('messages').insert({
  query_id: queryData.id,
  sender_type: 'Patient',
  message: firstMessage,
  attachments: uploadedFiles
});

// Update query timestamp
await supabase.from('queries').update({
  updated_at: new Date().toISOString()
}).eq('id', queryData.id);
```

### Part B: Ongoing Communication

#### User Actions (Doctor):
4. Doctor sees query in Queries Page
5. Doctor clicks query card to open
6. Doctor replies with text/attachments

#### Database Operations:

```typescript
// Create doctor's message
await supabase.from('messages').insert({
  query_id: queryId,
  sender_type: 'Doctor',
  message: replyText,
  attachments: attachedFiles
});

// Update query timestamp
await supabase.from('queries').update({
  updated_at: new Date().toISOString()
}).eq('id', queryId);
```

#### User Actions (Patient):
7. Patient replies back

#### Database Operations:

```typescript
// Create patient's message
await supabase.from('messages').insert({
  query_id: queryId,
  sender_type: 'Patient',
  message: replyText,
  attachments: attachedFiles
});

// Update query timestamp
await supabase.from('queries').update({
  updated_at: new Date().toISOString()
}).eq('id', queryId);
```

### Part C: Resolve Query

#### User Actions:
8. Doctor clicks "Mark Resolved"

#### Database Operations:

```typescript
// Update query status
await supabase.from('queries').update({
  status: 'Closed'
}).eq('id', queryId);
```

### Database Tables Updated:
- `queries` - Created and updated:
  1. Initial Open status
  2. Priority assigned by AI
  3. `updated_at` updated on each message
  4. Status changed to Closed when resolved
- `messages` - New message for each communication

### Result:
- Query appears in doctor's Queries Page with priority badge
- Messages display in chat-like interface
- Query can be filtered by priority (High/Medium/Low)
- Closed queries are marked differently

---

## Database Relationships Summary

```
auth.users (Supabase Auth)
    ↓
organizations (1:1 with auth.users)
    ↓
users (links auth.users to organizations)
    ↓
patients (linked to both doctor's auth_id and org_id)
    ↓
    ├── pre_consult (many pre-consults per patient)
    ├── consult (many consultations per patient)
    ├── follow_up (many follow-ups per patient)
    └── queries (many queries per patient)
            ↓
         messages (many messages per query)
```

## Key Implementation Notes

1. **URL Parameters:**
   - Pre-consult forms: Only `pre_consult_id` in URL
   - Follow-up forms: Only `follow_up_id` in URL
   - Query interface: Both `doc_id` and `patient_id` in URL

2. **Real-time Updates:**
   - Form answers update in real-time as patient types
   - No need to save draft - auto-saves continuously

3. **AI Processing:**
   - Document analysis happens after upload
   - Transcription happens after recording ends
   - Summaries generated on submit
   - Priority assigned immediately on query creation

4. **File Storage:**
   - All files stored in Supabase Storage
   - Organized by feature and ID
   - URLs stored as JSONB arrays in database

5. **Status Tracking:**
   - Pre-consult: Draft → Submitted
   - Follow-up: Draft → Submitted
   - Queries: Open → Closed

6. **Timestamps:**
   - All tables have `created_at`
   - Most tables have auto-updating `updated_at`
   - Patient has `last_visit_at` updated on consultation

This implementation ensures data consistency, proper relationships, and secure access control through Row Level Security policies.
