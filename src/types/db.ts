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
  created_at: string;
}

export interface AppointmentRow {
  id: string;
  patient_id: string;
  doc_id: string;
  queue: number;
  completed: boolean;
  pre_consult_filled: boolean;
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
  created_at: string;
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
