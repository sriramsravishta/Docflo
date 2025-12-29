import { supabase } from './supabase';

export const createPatient = async (patientData: {
  name: string;
  age: number;
  phone: string;
  case?: string;
  gender: string;
}) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: userData } = await supabase
    .from('users')
    .select('org_id')
    .eq('auth_id', user.id)
    .single();

  if (!userData) throw new Error('User not found');

  const { data, error } = await supabase
    .from('patients')
    .insert({
      doc_id: user.id,
      org_id: userData.org_id,
      ...patientData,
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
  dosage?: string;
  frequency?: string;
  duration?: string;
  route?: string;
  instructions?: string;
}) => {
  const { data, error } = await supabase
    .from('consult_medicine')
    .insert(medicineData)
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