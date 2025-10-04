export interface Patient {
  id: string;
  doctorId: string;
  name: string;
  phone: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  case?: string;
  createdAt: string;
  updatedAt: string;
  lastVisit?: string;
}

export interface PreConsultForm {
  id: string;
  patientId: string;
  doctorId: string;
  language: 'en' | 'hi' | 'te';
  visitReason: string;
  isFirstVisit: boolean;
  symptoms: string;
  allergies?: string;
  habits?: string;
  documents: Array<{
    url: string;
    name: string;
    type: string;
  }>;
  docSummary?: string;
  createdAt: string;
}

export interface Consultation {
  id: string;
  patientId: string;
  doctorId: string;
  diagnosis: string;
  history: string;
  chiefComplaints: string;
  treatmentSuggested: string;
  medications: Array<{
    name: string;
    frequency: string;
    duration: string;
    timing: string;
  }>;
  keyPersonalInsights: string;
  followupRecommendations: string;
  audioUrl?: string;
  isApproved: boolean;
  createdAt: string;
}

export interface FollowUpForm {
  id: string;
  patientId: string;
  doctorId: string;
  language: 'en' | 'hi' | 'te';
  overallFeeling: string;
  problemStatus: string;
  newSymptoms: string;
  medicationAdherence: string;
  newReports: Array<{
    url: string;
    name: string;
    type: string;
  }>;
  lifestyleChanges?: string;
  createdAt: string;
}

export interface Query {
  id: string;
  patientId: string;
  doctorId: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Active' | 'Resolved';
  createdAt: string;
  updatedAt: string;
}

export interface QueryMessage {
  id: string;
  queryId: string;
  senderType: 'doctor' | 'patient';
  content: string;
  attachments: Array<{
    url: string;
    name: string;
    type: string;
  }>;
  createdAt: string;
}

export interface Doctor {
  id: string;
  email: string;
  createdAt: string;
}
