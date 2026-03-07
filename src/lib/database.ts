import { supabase } from './supabase';

// ✅ Helper: get "today" start/end based on your local time (IST)
function getTodayBoundsISO() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
  };
}


export async function completeTodaysAppointmentByPatientAndDoctor(
  patientId: string,
  doctorId: string
): Promise<boolean> {
  const { startISO, endISO } = getTodayBoundsISO();

  // ✅ Fetch ONLY today's appointment for this patient + doctor
  const { data: row, error: fetchError } = await supabase
    .from('appointments')
    .select('id, completed')
    .eq('patient_id', patientId)
    .eq('doc_id', doctorId)
    .gte('created_at', startISO)
    .lte('created_at', endISO)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (!row?.id) return false;     // no appointment today
  if (row.completed) return true; // already completed

  const { error: updateError } = await supabase
    .from('appointments')
    .update({ completed: true })
    .eq('id', row.id);

  if (updateError) throw updateError;

  return true;
}



export const createPatient = async (patientData: {
  name: string;
  age: number;
  phone: string;
  case?: string;
  gender: string;
  uhid?: string; // CHANGED: added uhid as optional field
}) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: userData } = await supabase
    .from('users')
    .select('org_id')
    .eq('auth_id', user.id)
    .limit(1)
    .single();

  if (!userData) throw new Error('User not found');

  const { data, error } = await supabase
    .from('patients')
    .insert({
      doc_id: user.id,
      org_id: userData.org_id,
      ...patientData, // uhid is included here automatically via spread
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getPatients = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: userData } = await supabase
    .from('users')
    .select('org_id')
    .eq('auth_id', user.id)
    .limit(1)
    .single();

  if (!userData) throw new Error('User not found');

  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('org_id', userData.org_id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const updatePatient = async (patientId: string, updates: Partial<{
  name: string;
  age: number;
  phone: string;
  case: string;
  gender: string;
  last_visit_at: string;
  uhid: string; // CHANGED: added uhid so PatientProfile edit modal can save it
}>) => {
  const { data, error } = await supabase
    .from('patients')
    .update(updates)
    .eq('id', patientId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const createPreConsult = async (docId: string, patientId: string) => {
  const { data, error } = await supabase
    .from('pre_consult')
    .insert({
      doc_id: docId,
      patient_id: patientId,
      status: 'Draft',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const createPreConsultWithDocuments = async (
  docId: string, 
  patientId: string, 
  documentsUploaded: string[]
) => {
  const { data, error } = await supabase
    .from('pre_consult')
    .insert({
      doc_id: docId,
      patient_id: patientId,
      status: 'Submitted',
      documents_uploaded: documentsUploaded,
      ai_summary: null // Will be filled by n8n workflow
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};
export const getPreConsults = async (patientId: string) => {
  const { data, error } = await supabase
    .from('pre_consult')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const updatePreConsult = async (id: string, updates: any) => {
  const { data, error} = await supabase
    .from('pre_consult')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const createConsult = async (docId: string, patientId: string, recordingFile: string) => {
  const { data, error } = await supabase
    .from('consult')
    .insert({
      doc_id: docId,
      patient_id: patientId,
      recording_file: recordingFile,
    })
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from('patients')
    .update({ last_visit_at: new Date().toISOString() })
    .eq('id', patientId);

  return data;
};

export const getConsults = async (patientId: string) => {
  const { data, error } = await supabase
    .from('consult')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const updateConsult = async (id: string, updates: any) => {
  const { data, error } = await supabase
    .from('consult')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const createFollowUp = async (docId: string, patientId: string) => {
  const { data, error } = await supabase
    .from('follow_up')
    .insert({
      doc_id: docId,
      patient_id: patientId,
      status: 'Draft',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getFollowUps = async (patientId: string) => {
  const { data, error } = await supabase
    .from('follow_up')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const updateFollowUp = async (id: string, updates: any) => {
  const { data, error } = await supabase
    .from('follow_up')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const createQuery = async (docId: string, patientId: string, initialQuery: string) => {
  const { data, error } = await supabase
    .from('queries')
    .insert({
      doc_id: docId,
      patient_id: patientId,
      initial_query: initialQuery,
      status: 'Open',
      priority: 'Medium',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getQueries = async (docId?: string) => {
  let query = supabase
    .from('queries')
    .select(`
      *,
      patients (name, phone, case)
    `)
    .order('created_at', { ascending: false });

  if (docId) {
    query = query.eq('doc_id', docId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const updateQuery = async (id: string, updates: any) => {
  const { data, error } = await supabase
    .from('queries')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const createMessage = async (queryId: string, senderType: 'Doctor' | 'Patient', message: string, attachments: any[] = []) => {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      query_id: queryId,
      sender_type: senderType,
      message,
      attachments,
    })
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from('queries')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', queryId);

  return data;
};

export const getMessages = async (queryId: string) => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('query_id', queryId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const getPatientById = async (id: string) => {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
};

export const getPreConsultById = async (id: string) => {
  const { data, error } = await supabase
    .from('pre_consult')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const getFollowUpById = async (id: string) => {
  const { data, error } = await supabase
    .from('follow_up')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const createSummary = async (patientId: string, summaryData: any) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('summaries')
    .insert({
      patient_id: patientId,
      doctor_id: user.id,
      summary: summaryData,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getSummaries = async (patientId: string) => {
  const { data, error } = await supabase
    .from('summaries')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getLatestSummary = async (patientId: string) => {
  const { data, error } = await supabase
    .from('summaries')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
};

// Consult Medicine functions
export const getConsultMedicines = async (consultId: string) => {
  const { data, error } = await supabase
    .from('consult_medicine')
    .select('*')
    .eq('consult_id', consultId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const createConsultMedicine = async (medicineData: {
  consult_id: string;
  name: string;
  quantity?: string;
  frequency?: string;
  time?: string[];        // ✅ array
  food?: string;
  duration?: string;
  instructions?: string;
}) => {
  const { data, error } = await supabase
    .from('consult_medicine')
    .insert({
      consult_id: medicineData.consult_id,
      name: medicineData.name ?? '',
      quantity: medicineData.quantity ?? '',
      frequency: medicineData.frequency ?? '',
      time: Array.isArray(medicineData.time) ? medicineData.time : [],  // ✅ force array
      food: medicineData.food ?? '',
      duration: medicineData.duration ?? '',
      instructions: medicineData.instructions ?? '',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};


export const updateConsultMedicine = async (id: string, updates: {
  name?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  route?: string;
  instructions?: string;
}) => {
  const { data, error } = await supabase
    .from('consult_medicine')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteConsultMedicine = async (id: string) => {
  const { error } = await supabase
    .from('consult_medicine')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const searchMedicines = async (query: string, limit: number = 10) => {
  const q = (query || '').trim();
  if (!q) return [];

  const { data, error } = await supabase
    .from('medicine_master_list')
    .select('name')
    .ilike('name', `${q}%`) // ✅ prefix match: starts with
    .order('name', { ascending: true }) // ✅ alphabetical A→Z
    .limit(limit);

  if (error) throw error;
  return data || [];
};

export const updateConsultSummary = async (consultId: string, summaryUpdates: any) => {
  const { data, error } = await supabase
    .from('consult')
    .update({
      consult_summary_final: summaryUpdates
    })
    .eq('id', consultId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const createAppointment = async (patientId: string, docId: string, referredBy?: string) => { // CHANGED: added referredBy param
  // Get next queue number for today
  const { startISO, endISO } = getTodayBoundsISO();

  const { data: existingAppointments } = await supabase
    .from('appointments')
    .select('queue')
    .eq('doc_id', docId)
    .gte('created_at', startISO)
    .lte('created_at', endISO)
    .order('queue', { ascending: false })
    .limit(1);

  const nextQueue = existingAppointments && existingAppointments.length > 0 
    ? existingAppointments[0].queue + 1 
    : 1;

  const { data, error } = await supabase
    .from('appointments')
    .insert({
      patient_id: patientId,
      doc_id: docId,
      queue: nextQueue,
      pre_consult_filled: false,
      completed: false,
      referred_by: referredBy || null, // CHANGED: save referred_by, null if not provided
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getTodaysAppointments = async (docId: string) => {
  const { startISO, endISO } = getTodayBoundsISO();


  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      patients (id, name, age, gender, phone, last_visit_at)
    `)
    .eq('doc_id', docId)
    // ✅ IMPORTANT: DO NOT filter completed here
    .gte('created_at', startISO)
.lte('created_at', endISO)
    // ✅ pending first, then completed
    .order('completed', { ascending: true })
    .order('queue', { ascending: true });

  if (error) throw error;
  return data || [];
};


export const updateAppointmentQueue = async (appointmentId: string, newQueue: number) => {
  const { data, error } = await supabase
    .from('appointments')
    .update({ queue: newQueue })
    .eq('id', appointmentId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const completeAppointment = async (appointmentId: string) => {
  const { data, error } = await supabase
    .from('appointments')
    .update({ completed: true })
    .eq('id', appointmentId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getPatientByPhone = async (phone: string, docId: string) => {
  const { data: userData } = await supabase
    .from('users')
    .select('org_id')
    .eq('auth_id', docId)
    .limit(1)
    .single();

  if (!userData) return null;

  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('phone', phone)
    .eq('org_id', userData.org_id)
    .limit(1);

  if (error) {
    console.error('Error fetching patient by phone:', error);
    return null;
  }
  
  return data && data.length > 0 ? data[0] : null;
};

// CHANGED: Updates today's appointment with the consult_id when recording ends
export const updateAppointmentConsultId = async (patientId: string, docId: string, consultId: string) => {
  const { startISO, endISO } = getTodayBoundsISO();

  const { data: row, error: fetchError } = await supabase
    .from('appointments')
    .select('id')
    .eq('patient_id', patientId)
    .eq('doc_id', docId)
    .gte('created_at', startISO)
    .lte('created_at', endISO)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!row?.id) return null; // no appointment today, skip silently

  const { data, error: updateError } = await supabase
    .from('appointments')
    .update({ consult_id: consultId })
    .eq('id', row.id)
    .select()
    .single();

  if (updateError) throw updateError;
  return data;
};

// CHANGED: Fetches appointment by consult_id to get referred_by for PDF
export const getAppointmentByConsultId = async (consultId: string) => {
  const { data, error } = await supabase
    .from('appointments')
    .select('referred_by, consult_id')
    .eq('consult_id', consultId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export type DischargeSummaryRow = {
  id: string;
  doctor_id: string;
  created_at: string;
  updated_at: string;
  status: 'processing' | 'completed';
  recording_stopped_at: string | null;
  summary_json: Record<string, unknown> | null;
  summary_text: string;
};

export const getDischargeSummaries = async (doctorId: string): Promise<DischargeSummaryRow[]> => {
  const { data, error } = await supabase
    .from('discharge_summaries')
    .select('*')
    .eq('doctor_id', doctorId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as DischargeSummaryRow[];
};

export const getDischargeSummaryById = async (id: string): Promise<DischargeSummaryRow | null> => {
  const { data, error } = await supabase
    .from('discharge_summaries')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as DischargeSummaryRow | null;
};

export const createDischargeSummary = async (doctorId: string): Promise<DischargeSummaryRow> => {
  const { data, error } = await supabase
    .from('discharge_summaries')
    .insert({ doctor_id: doctorId, status: 'processing' })
    .select()
    .single();
  if (error) throw error;
  return data as DischargeSummaryRow;
};

export const updateDischargeSummaryRecordingStopped = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('discharge_summaries')
    .update({ recording_stopped_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
};

export const updateDischargeSummaryJson = async (
  id: string,
  summaryJson: Record<string, unknown>,
  summaryText: string
): Promise<void> => {
  const { error } = await supabase
    .from('discharge_summaries')
    .update({
      summary_json: summaryJson,
      summary_text: summaryText,
      status: 'completed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
};

export const saveDischargeSummaryEdits = async (
  id: string,
  summaryJson: Record<string, unknown>,
  summaryText: string
): Promise<void> => {
  const { error } = await supabase
    .from('discharge_summaries')
    .update({
      summary_json: summaryJson,
      summary_text: summaryText,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
};