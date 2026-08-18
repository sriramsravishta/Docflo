export interface LocationRow {
  id: string;
  doc_id: string;
  name: string;
  address?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PatientRow {
  id: string;
  doc_id: string;
  org_id: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  phone: string;
  case?: string | null;
  last_visit_at?: string | null;
  location_ids?: string[] | null;
  created_at: string;
}

export interface AppointmentRow {
  id: string;
  patient_id: string;
  doc_id: string;
  queue: number;
  completed: boolean;
  pre_consult_filled: boolean;
  location_id?: string | null;
  scheduled_at?: string | null;
  created_at: string;
  patients?: Pick<PatientRow, 'id' | 'name' | 'age' | 'gender' | 'phone' | 'last_visit_at' | 'case'>;
}

export interface PreConsultRow {
  id: string;
  doc_id: string;
  patient_id: string;
  status: 'Draft' | 'Submitted';
  documents_uploaded?: string[] | null;
  ai_summary?: Record<string, unknown> | null;
  created_at: string;
}

export interface ConsultRow {
  id: string;
  doc_id: string;
  patient_id: string;
  recording_file?: string | null;
  recording_transcript?: string | null;
  consult_summary_ai?: string | null;
  consult_summary_final?: Record<string, unknown> | string | null;
  type?: 'consultation' | 'ot_note';
  status?: string;
  updated_at?: string;
  created_at: string;
}

export interface OTNoteSummary {
  procedure_name?: string;
  indications?: string;
  anesthesia_type?: string;
  intraoperative_findings?: string[];
  procedure_steps?: string[];
  complications?: string;
  estimated_blood_loss?: string;
  specimens_sent?: string;
  post_op_instructions?: string[];
}

export interface ConsultMedicineRow {
  id: string;
  consult_id: string;
  name: string;
  dosage?: string;
  quantity?: string;
  type?: string;
  frequency?: string;
  time?: string[];
  food?: string;
  duration?: string;
  instructions?: string;
  flags?: string;
  created_at: string;
}

export interface VitalRow {
  id: string;
  patient_id: string;
  doctor_id: string;
  temperature?: string | null;
  blood_pressure?: string | null;
  heart_rate?: string | null;
  spo2?: string | null;
  weight?: string | null;
  created_at: string;
}

export interface SummaryRow {
  id: string;
  patient_id: string;
  doctor_id: string;
  summary: SummaryData;
  created_at: string;
}

export interface SummaryData {
  timeline_of_medical_events?: TimelineEvent[];
  diagnostic_trends?: DiagnosticTrend[];
  medications?: {
    current?: SummaryMedication[];
    past?: SummaryMedication[];
  };
}

export interface TimelineEvent {
  event_type?: string;
  event_datetime?: string;
  location?: string;
  summary?: string;
  important_findings?: string;
}

export interface DiagnosticTrend {
  parameter_name?: string;
  unit?: string;
  normal_range?: string;
  overall_trend_comment?: string;
  measurements?: DiagnosticMeasurement[];
}

export interface DiagnosticMeasurement {
  measurement_datetime: string;
  value_raw?: string | number;
  value_numeric?: number;
  clinical_interpretation?: string;
}

export interface SummaryMedication {
  drug_name?: string;
  dose?: string;
  frequency?: string;
  duration_or_quantity?: string;
  indication?: string;
  notes?: string;
}

export interface ConsultSummary {
  diagnosis?: DiagnosisSummary | string;
  chief_complaints?: string[] | string;
  treatment_suggested?: TreatmentSummary | string;
  medications?: SummaryMedication[];
  investigations?: InvestigationsSummary | string;
  past_medical_history?: string[] | string;
  history?: string;
  examination_findings?: string[] | string;
  followup_recommendations?: string[] | string;
  attached_diet_charts?: string[];
  key_personal_insights?: string[] | string;
  flags_for_review?: string[];
}

export interface DiagnosisSummary {
  provisional?: string[];
  key_findings?: string[];
}

export interface TreatmentSummary {
  immediate_plan?: string[];
  contingent_plan?: string[];
}

export interface InvestigationsSummary {
  ordered?: InvestigationItem[];
  notes?: string;
}

export interface InvestigationItem {
  name?: string;
  body_part_or_type?: string;
  priority?: string;
}

export type OutcomeStatus =
  | 'prescription_only'
  | 'investigation_ordered'
  | 'procedure_advised'
  | 'procedure_agreed'
  | 'follow_up_scheduled'
  | 'referred_out';

export type SurgeryStatus = 'pending' | 'scheduled' | 'completed' | 'cancelled';

export interface ConsultOutcomeRow {
  id: string;
  consult_id: string;
  patient_id: string;
  doc_id: string;
  outcome_status: OutcomeStatus;
  action_needed?: string | null;
  follow_up_date?: string | null;
  surgery_date?: string | null;
  surgery_status?: SurgeryStatus | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  consult?: {
    id: string;
    created_at: string;
    consult_summary_final?: Record<string, unknown> | string | null;
  };
  patients?: {
    id: string;
    name: string;
    age: number;
    gender: string;
    phone: string;
  };
}

export interface ConsultEditRow {
  id: string;
  consult_id: string;
  doc_id: string;
  recording_file?: string | null;
  transcript?: string | null;
  status: 'processing' | 'completed' | 'failed';
  changed_fields?: string[] | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// IPD (Inpatient) Types
// ============================================

export interface AdmissionRow {
  id: string;
  patient_id: string;
  doc_id: string;
  org_id?: string;
  admission_type: 'inpatient' | 'daycare';
  status: 'admitted' | 'discharged' | 'lama';
  admission_date: string;
  discharge_date: string | null;
  admitting_diagnosis: string;
  final_diagnosis: string;
  ward_bed: string;
  discharge_summary: DischargeSummaryData | Record<string, never>;
  ds_status: 'not_started' | 'generating' | 'generated' | 'finalized';
  created_at: string;
  updated_at: string;
}

export interface IPDNoteRow {
  id: string;
  admission_id: string;
  author_id: string;
  note_type: 'admission_note' | 'progress_note' | 'procedure_note' | 'pre_discharge';
  day_number: number;
  recording_url: string | null;
  transcript: string | null;
  structured_summary: IPDNoteSummary | Record<string, never>;
  status: 'processing' | 'success' | 'failed';
  n8n_execution_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface IPDNoteSection {
  heading: string;
  content: string;
}

export interface IPDNoteSummary {
  note_title: string;
  sections: IPDNoteSection[];
  flags?: string[];
}

export interface DischargeSummaryData {
  patient_details?: {
    name?: string;
    age?: string;
    gender?: string;
    uhid?: string;
    admission_date?: string;
    discharge_date?: string;
    ward?: string;
    bed_number?: string;
  };
  consultant_doctors?: string[];
  diagnosis?: {
    primary?: string;
    secondary?: string[];
  };
  chief_complaints?: string[];
  history_of_present_illness?: string;
  history_past_personal_family?: string;
  patient_course_in_hospital?: string;
  discharge_medications?: {
    drug_name: string;
    generic_name?: string;
    strength?: string;
    dosage?: string;
    frequency?: string;
    route?: string;
    relationship_with_meal?: string;
    duration?: string;
    comment?: string;
  }[];
  special_instructions?: {
    diet?: string;
    post_discharge_investigations?: string;
    follow_up?: string;
    emergency_care?: string;
  };
  condition_at_discharge?: string;
}