# Docflo

An AI-assisted OPD workflow application that improves patient preparation, doctor documentation, and treatment adherence without requiring a full EMR system.

## Overview

Docflo is designed specifically for the Indian OPD context, addressing the challenges of low EHR adoption and WhatsApp-centric communication. It streamlines workflows for doctors while empowering patients through structured data collection.

## Key Features

### For Doctors

- **Patient Management**: Organize and track all patients with quick access to consultation history
- **Pre-consult Forms**: Review patient information before consultations
- **AI-Assisted Consultations**: Voice-to-text consultation recording with AI-generated structured notes
- **Query Management**: Handle patient queries efficiently with priority-based filtering
- **Follow-up Monitoring**: Track patient progress through structured follow-up forms

### For Patients (No Login Required)

- **Pre-consult Forms**: Submit symptoms and medical history before appointments
- **Follow-up Forms**: Update doctors on progress and medication adherence
- **Query System**: Ask questions and communicate with doctors anytime
- **Multi-language Support**: Available in English, Hindi, and Telugu
- **Voice Input**: Speak responses instead of typing for better accessibility

## Technology Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS with Poppins font
- **Routing**: React Router
- **Icons**: Lucide React
- **Database**: Supabase (ready for integration)
- **Primary Color**: #024CDB

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Navbar.tsx
│   ├── PatientCard.tsx
│   ├── Modal.tsx
│   ├── ConfirmationModal.tsx
│   └── ProtectedRoute.tsx
├── contexts/           # React contexts
│   └── AuthContext.tsx
├── pages/             # Main application pages
│   ├── Login.tsx
│   ├── MainPage.tsx
│   ├── QueriesPage.tsx
│   ├── PatientProfile.tsx
│   ├── ConsultSession.tsx
│   ├── PreConsultForm.tsx
│   ├── FollowUpForm.tsx
│   └── PatientQueries.tsx
├── lib/               # Utilities and configurations
│   └── supabase.ts
├── App.tsx            # Main app component with routing
└── index.css          # Global styles and Tailwind config
```

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with Supabase credentials (for database functionality):
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Build for production:
   ```bash
   npm run build
   ```

## Key Workflows

### 1. Pre-Consult Workflow
- Doctor sends pre-consult form link via WhatsApp
- Patient fills multi-step form with voice input support
- AI analyzes uploaded documents
- Doctor reviews submissions before consultation

### 2. Consultation Workflow
- Doctor starts voice recording during patient visit
- AI generates structured consultation notes
- Doctor reviews and edits:
  - Diagnosis
  - History
  - Chief Complaints
  - Treatment Plan
  - Medications
  - Key Personal Insights (private)
  - Follow-up Recommendations
- Approved notes sent to patient as PDF via WhatsApp

### 3. Follow-up Workflow
- Doctor sends follow-up form to patient
- Patient updates on:
  - Overall feeling
  - Problem status
  - New symptoms
  - Medication adherence
  - Lifestyle changes
- Doctor reviews updates in patient profile

### 4. Query Management
- Patients can ask questions anytime via secure link
- Doctors see queries with priority filtering
- Chat-like interface for back-and-forth communication
- Queries can be marked as resolved

## Design Principles

- **Minimalist & Intuitive**: Clean UI with clear visual hierarchy
- **Mobile-First**: Fully responsive for all device sizes
- **Accessible**: Voice input, clear typography, and proper contrast ratios
- **Confirmation-First**: All destructive actions require confirmation
- **Progress Indicators**: Clear feedback on multi-step processes

## Database Schema (Ready for Integration)

The application is designed to work with the following Supabase tables:

- `doctors` - Doctor accounts and authentication
- `patients` - Patient information and demographics
- `pre_consult_forms` - Pre-consultation submissions
- `consultations` - Consultation records and notes
- `followup_forms` - Follow-up monitoring data
- `queries` - Query threads between doctors and patients
- `query_messages` - Individual messages in query threads

## Security Features

- Authentication for doctors only
- Patients access via secure tokenized URLs
- Row Level Security (RLS) policies on all tables
- Private notes (Key Personal Insights) never sent to patients
- Confirmation modals for sensitive actions

## Future Enhancements

- WhatsApp API integration for automated messaging
- AI-powered document analysis
- Voice-to-text with Whisper API
- PDF generation for consultation summaries
- Multi-doctor practice management
- Analytics and reporting dashboard

## Support

For questions or issues, please contact the development team.

---

Built with care for Indian healthcare providers.
