import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  CreditCard as Edit,
  X,
  ChevronDown,
  ChevronRight,
  Thermometer,
  Activity,
  HeartPulse,
  Droplets,
  Loader2,
  Weight,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import PatientProfileHeader from '../components/features/PatientProfileHeader';
import ConsultViewModal from '../components/features/ConsultViewModal';
import AddFavouritesModal from '../components/features/AddFavouritesModal';
import LoadPreviousModal from '../components/features/LoadPreviousModal';
import { parseTimeString } from '../components/features/AddFavouritesModal';
import { DocumentUploadModal, DocumentUploadStatusModal } from '../components/features/DocumentUploadModal';
import Spinner from '../components/ui/Spinner';
import Toast from '../components/ui/Toast';
import { usePatientData } from '../hooks/usePatientData';
import { useRecording } from '../hooks/useRecording';
import {
  updatePatient,
  createPreConsult,
  updatePreConsult,
  getConsultMedicines,
  createConsultMedicine,
  updateConsultMedicine,
  deleteConsultMedicine,
  searchMedicines,
  updateConsultSummary,
  getAppointmentByConsultId, // CHANGED: added for PDF referred_by lookup
} from '../lib/database';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  formatDate,
  formatDateShort,
  getConsultSummary,
  isConsultProcessed,
  isConsultError,
  getElapsedSeconds,
  getProgressPercent,
  getViewModeMedicines,
  getConsultPreviewText,
  normalizeTime,
  diagnosisToEditableText,
  diagnosisTextToJson,
  treatmentToEditableText,
  treatmentTextToJson,
  investigationsToEditableText,
  investigationsTextToJson,
  escapeHtml,
  toHtmlList,
  ESTIMATED_PROCESS_SECONDS,
  MAX_PROCESS_SECONDS,
  PRE_CONSULT_ESTIMATED_SECONDS,
} from '../lib/utils';
import type { ConsultRow, ConsultMedicineRow, VitalRow } from '../types/db';
import type { ConsultSummary, DiagnosisSummary, TreatmentSummary, InvestigationsSummary, DiagnosticTrend } from '../types/db';

type UploadState = 'confirming' | 'uploading' | 'success' | 'error';

interface MedicineDraft {
  name: string;
  dosage: string;
  quantity: string;
  type: string;
  frequency: string;
  food: string;
  time: string[];
  duration: string;
  instructions: string;
  flags?: string;
}

function formatEventDate(dt: string): string {
  if (!dt || dt.toLowerCase() === 'unknown') return dt;
  // Handle both "2026-08-08 13:43" (no TZ, treat as UTC) and full ISO with TZ
  const normalized = /[zZ+]|[+-]\d{2}:?\d{2}$/.test(dt) ? dt : dt.replace(' ', 'T') + 'Z';
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return dt;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function PatientProfile() {
  const { patientId } = useParams<{ patientId: string }>();
  const { user } = useAuth();

  const {
    patient,
    loading,
    consultations,
    setConsultations,
    latestSummary,
    setLatestSummary,
    processingPreConsults,
    todaysVitals,
    loadPatientData,
    loadTodaysVitals,
    addProcessingPreConsultOptimistic,
    preConsultSectionRef,
  } = usePatientData(patientId, user?.id);

  const { isRecording, isPaused, recordingTime, toast, clearToast, handleStartRecording, handlePauseRecording, handleEndRecording } =
    useRecording(patientId, user?.id, async () => { await loadPatientData(); });

  const [uiNow, setUiNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setUiNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const [showEditModal, setShowEditModal] = useState(false);
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [showVitalsModal, setShowVitalsModal] = useState(false);
 
  const [showGraphView, setShowGraphView] = useState(false);
  const [selectedGraphParam, setSelectedGraphParam] = useState<string>('');
  const [editingVital, setEditingVital] = useState<VitalRow | null>(null);
  const [vitalForm, setVitalForm] = useState({ temperature: '', blood_pressure: '', heart_rate: '', spo2: '', weight: '' });
  const [vitalsSubmitting, setVitalsSubmitting] = useState(false);

  const [editForm, setEditForm] = useState({ name: '', age: '', phone: '', case: '', gender: 'Male', uhid: '' }); // CHANGED: added uhid field

  useEffect(() => {
    if (patient) {
      setEditForm({
        name: patient.name,
        age: patient.age.toString(),
        phone: patient.phone,
        case: patient.case || '',
        gender: patient.gender,
        uhid: patient.uhid || '', // CHANGED: populate uhid from patient data
      });
    }
  }, [patient]);

  const [selectedConsult, setSelectedConsult] = useState<ConsultRow | null>(null);
  const [isEditingConsult, setIsEditingConsult] = useState(false);
  const [editedConsult, setEditedConsult] = useState<Record<string, unknown>>({});
  const [editedDiagnosisText, setEditedDiagnosisText] = useState('');
  const [editedTreatmentText, setEditedTreatmentText] = useState('');
  const [editedInvestigationsText, setEditedInvestigationsText] = useState('');

  const [consultMedicines, setConsultMedicines] = useState<ConsultMedicineRow[]>([]);
  const [medicineDrafts, setMedicineDrafts] = useState<Record<string, MedicineDraft>>({});
  const [medicineSearchResults, setMedicineSearchResults] = useState<{ name: string }[]>([]);
  const [openTimeDropdownId, setOpenTimeDropdownId] = useState<string | null>(null);
  const timeDropdownRef = useRef<HTMLDivElement | null>(null);
 
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    diagnosis: true,
    chiefComplaints: true,
    treatmentSuggested: true,
    medications: false,
    investigations: false,
    history: false,
    followupRecommendations: false,
    keyPersonalInsights: false,
    flagsForReview: false,
    currentMeds: false,
    pastMeds: false,
  });

  const [documentsToUpload, setDocumentsToUpload] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [documentUploadState, setDocumentUploadState] = useState<UploadState>('confirming');
  const [showDocumentConfirm, setShowDocumentConfirm] = useState(false);

  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    if (selectedConsult?.id) {
      loadConsultMedicines(selectedConsult.id);
    }
    setMedicineSearchResults([]);
  }, [selectedConsult]);

  // 1. GLOBAL WEBSOCKET WATCHER
  useEffect(() => {
    if (!patientId) return;
    const channel = supabase
      .channel(`patient-consult-watch-${patientId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'consult' },
        (payload) => {
          const updated = payload.new as ConsultRow;
          setConsultations((prev) => {
            const exists = prev.some((c) => c.id === updated.id);
            if (!exists) return prev;
            return prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c));
          });
          setSelectedConsult((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [patientId]);

  // 2. BULLETPROOF BACKGROUND POLLER 
  // Guarantees all cards (and popup) update every 4 seconds even if WebSockets drop partial payloads!
  useEffect(() => {
    const activeIds = consultations
      .filter(c => !isConsultProcessed(c) && c.status !== 'Failed' && c.status !== 'Error')
      .map(c => c.id);
      
    if (activeIds.length === 0) return;

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('consult')
        .select('id, consult_summary_final, created_at, updated_at, status')
        .in('id', activeIds);
        
      if (data && data.length > 0) {
        setConsultations((prev) => 
          prev.map(c => {
            const fetched = data.find(d => d.id === c.id);
            return fetched ? { ...c, ...fetched } : c;
          })
        );
        setSelectedConsult((prev) => {
          if (!prev) return prev;
          const fetched = data.find(d => d.id === prev.id);
          return fetched ? { ...prev, ...fetched } : prev;
        });
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [consultations]);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!openTimeDropdownId) return;
      const el = timeDropdownRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) setOpenTimeDropdownId(null);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [openTimeDropdownId]);

  const loadConsultMedicines = async (consultId: string) => {
    try {
      const medicines = await getConsultMedicines(consultId);
      const normalized = (medicines || []).map((m: ConsultMedicineRow) => ({ ...m, time: normalizeTime(m?.time) }));
      setConsultMedicines(normalized);
      const drafts: Record<string, MedicineDraft> = {};
      medicines.forEach((m: ConsultMedicineRow) => {
        drafts[m.id] = {
          name: m.name || '',
          dosage: m.dosage || '',
          quantity: m.quantity || '',
          type: m.type || '',
          frequency: m.frequency || '',
          food: m.food || '',
          time: normalizeTime(m.time),
          duration: m.duration || '',
          instructions: m.instructions || '',
          flags: m.flags || '',
        };
      });
      setMedicineDrafts(drafts);
    } catch (error) { console.error('Error loading consult medicines:', error); }
  };
 
  const handleEditPatient = async () => {
    try {
      await updatePatient(patientId!, {
        name: editForm.name,
        age: parseInt(editForm.age),
        phone: editForm.phone,
        case: editForm.case || undefined,
        gender: editForm.gender as 'Male' | 'Female' | 'Other',
        uhid: editForm.uhid || undefined, // CHANGED: save uhid
      });
      setShowEditModal(false);
      await loadPatientData();
    } catch (error) {
      console.error('Error updating patient:', error);
      alert('Failed to update patient');
    }
  };

  const handleAddVital = async () => {
    if (vitalsSubmitting) return;
    setVitalsSubmitting(true);
    try {
      const { error } = await supabase.from('vitals').insert([{
        patient_id: patientId,
        doctor_id: user!.id,
        temperature: vitalForm.temperature || null,
        blood_pressure: vitalForm.blood_pressure || null,
        heart_rate: vitalForm.heart_rate || null,
        spo2: vitalForm.spo2 || null,
        weight: vitalForm.weight || null,
      }]).select();
      if (error) throw error;
      await loadTodaysVitals();
      handleCloseVitalsModal();
    } catch (error) { console.error('Error adding vital:', error); alert('Failed to add vitals'); }
    finally { setVitalsSubmitting(false); }
  };

  const handleUpdateVital = async () => {
    if (!editingVital) return;
    if (vitalsSubmitting) return;
    setVitalsSubmitting(true);
    try {
      const { error } = await supabase.from('vitals').update({
        temperature: vitalForm.temperature || null,
        blood_pressure: vitalForm.blood_pressure || null,
        heart_rate: vitalForm.heart_rate || null,
        spo2: vitalForm.spo2 || null,
        weight: vitalForm.weight || null,
      }).eq('id', editingVital.id);
      if (error) throw error;
      await loadTodaysVitals();
      handleCloseVitalsModal();
    } catch (error) { console.error('Error updating vital:', error); alert('Failed to update vitals'); }
    finally { setVitalsSubmitting(false); }
  };

  const handleEditVital = (vital: VitalRow) => {
    setEditingVital(vital);
    setVitalForm({
      temperature: vital.temperature || '',
      blood_pressure: vital.blood_pressure || '',
      heart_rate: vital.heart_rate || '',
      spo2: vital.spo2 || '',
      weight: vital.weight || '',
    });
    setShowVitalsModal(true);
  };

  const handleCloseVitalsModal = () => {
    setShowVitalsModal(false);
    setEditingVital(null);
    setVitalForm({ temperature: '', blood_pressure: '', heart_rate: '', spo2: '', weight: '' });
  };

  const handleEditConsult = () => {
    if (!selectedConsult) return;
    const summary = getConsultSummary(selectedConsult) as ConsultSummary || {};
    setIsEditingConsult(true);
    setEditedConsult({ ...summary, id: selectedConsult.id });
    setEditedDiagnosisText(diagnosisToEditableText(summary.diagnosis));
    setEditedTreatmentText(treatmentToEditableText(summary.treatment_suggested));
    setEditedInvestigationsText(investigationsToEditableText(summary.investigations));
    setMedicineSearchResults([]);
  };

  const handleCancelEdit = () => {
    setIsEditingConsult(false);
    setEditedConsult({});
    setEditedDiagnosisText('');
    setEditedTreatmentText('');
    setEditedInvestigationsText('');
    setMedicineSearchResults([]);

    // CHANGED: Reset medicine drafts back to original DB values so
    // view mode shows the real saved data, not the cancelled edits
    setConsultMedicines((prev) => prev.filter((m) => !m.id.startsWith('temp_')));
const resetDrafts: Record<string, MedicineDraft> = {};
    consultMedicines.forEach((m) => {
      resetDrafts[m.id] = {
        name: m.name || '',
        dosage: m.dosage || '',
        quantity: m.quantity || '',
        type: m.type || '',
        frequency: m.frequency || '',
        food: m.food || '',
        time: normalizeTime(m.time),
        duration: m.duration || '',
        instructions: m.instructions || '',
        flags: m.flags || '',
      };
    });
    setMedicineDrafts(resetDrafts);
  };

  const saveMedicineDraftsToDB = async () => {
    for (const m of consultMedicines) {
      const d = medicineDrafts[m.id];
      if (!d) continue;
      if (m.id.startsWith('temp_')) {
        // New row — INSERT
        await createConsultMedicine({
          consult_id: selectedConsult!.id,
          name: d.name || '',
          dosage: d.dosage || '',
          quantity: d.quantity || '',
          type: d.type || '',
          frequency: d.frequency || '',
          food: d.food || '',
          time: normalizeTime(d.time),
          duration: d.duration || '',
          instructions: d.instructions || '',
          flags: d.flags || '',
        });
      } else {
        // Existing row — UPDATE
        await updateConsultMedicine(m.id, {
          name: d.name || '',
          dosage: d.dosage || '',
          quantity: d.quantity || '',
          type: d.type || '',
          frequency: d.frequency || '',
          food: d.food || '',
          time: normalizeTime(d.time),
          duration: d.duration || '',
          instructions: d.instructions || '',
          flags: d.flags || '',
        });
      }
    }
    if (selectedConsult?.id) await loadConsultMedicines(selectedConsult.id);
  };

  const handleSaveConsult = async () => {
    try {
      if (!selectedConsult) return;
      const originalSummary = (getConsultSummary(selectedConsult) as ConsultSummary) || {};
      const toSave = {
        ...editedConsult,
        diagnosis: diagnosisTextToJson(editedDiagnosisText, originalSummary.diagnosis),
        treatment_suggested: treatmentTextToJson(editedTreatmentText, originalSummary.treatment_suggested),
        investigations: investigationsTextToJson(editedInvestigationsText, originalSummary.investigations),
      };
      const { id: _id, ...payload } = toSave;
      await updateConsultSummary(selectedConsult.id, payload);
      await saveMedicineDraftsToDB();
      const { consultsData } = await loadPatientData();
      const updated = consultsData.find((c: ConsultRow) => c.id === selectedConsult.id);
      if (updated) setSelectedConsult(updated);
      setIsEditingConsult(false);
      setEditedConsult({});
      setEditedDiagnosisText('');
      setEditedTreatmentText('');
      setEditedInvestigationsText('');
      setMedicineSearchResults([]);
    } catch (error) {
      console.error('Error saving consultation:', error);
      alert('Failed to save changes');
    }
  };

  const handleAddMedicine = () => {
  const tempId = `temp_${crypto.randomUUID()}`;
  const tempMed = {
    id: tempId,
    consult_id: selectedConsult!.id,
    name: '', dosage: '', quantity: '', type: '',
    frequency: '', time: [], food: '', duration: '', instructions: '', flags: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    patient_id: patientId || '',
  } as ConsultMedicineRow;
  setConsultMedicines((prev) => [tempMed, ...prev]);
  setMedicineDrafts((prev) => ({
    ...prev,
    [tempId]: { name: '', dosage: '', quantity: '', type: '', frequency: '', food: '', time: [], duration: '', instructions: '', flags: '' },
  }));
};

  const handleDeleteMedicine = async (medicineId: string) => {
    try {
      if (!medicineId.startsWith('temp_')) {
        await deleteConsultMedicine(medicineId);
      }
      setConsultMedicines((prev) => prev.filter((m) => m.id !== medicineId));
      setMedicineDrafts((prev) => { const next = { ...prev }; delete next[medicineId]; return next; });
      setMedicineSearchResults([]);
    } catch (error) { console.error('Error deleting medicine:', error); }
  };

  const updateMedicineDraft = (medicineId: string, patch: Partial<MedicineDraft>) => {
    setMedicineDrafts((prev) => ({ ...prev, [medicineId]: { ...(prev[medicineId] || {}), ...patch } as MedicineDraft }));
  };

  const handleMedicineSearch = async (query: string) => {
    if (query.trim().length < 1) { setMedicineSearchResults([]); return; }
    try {
      const results = await searchMedicines(query.trim(), 10);
      setMedicineSearchResults(results);
    } catch (error) { console.error('Error searching medicines:', error); }
  };

  const [showAddFavourites, setShowAddFavourites] = useState(false);
  const [showLoadPrevious, setShowLoadPrevious] = useState(false);

  const handleAddFromFavourites = (favs: import('../lib/database').FavouriteMedicineRow[]) => {
  if (!selectedConsult) return;
  for (const fav of favs) {
    const tempId = `temp_${crypto.randomUUID()}`;
    const parsedTime = parseTimeString(fav.time || '');
    const tempMed = {
      id: tempId,
      consult_id: selectedConsult.id,
      name: fav.name || '', dosage: fav.dosage || '', quantity: fav.quantity || '',
      type: fav.type || '', frequency: fav.frequency || '', food: fav.food || '',
      time: parsedTime, duration: fav.duration || '',
      instructions: fav.instructions || '', flags: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      patient_id: patientId || '',
    } as ConsultMedicineRow;
    setConsultMedicines((prev) => [...prev, tempMed]);
    setMedicineDrafts((prev) => ({
      ...prev,
      [tempId]: {
        name: fav.name || '', dosage: fav.dosage || '', quantity: fav.quantity || '',
        type: fav.type || '', frequency: fav.frequency || '', food: fav.food || '',
        time: parsedTime, duration: fav.duration || '',
        instructions: fav.instructions || '', flags: '',
      },
    }));
  }
};

  const handleAddFromPrevious = (prevMeds: ConsultMedicineRow[]) => {
  if (!selectedConsult) return;
  for (const pm of prevMeds) {
    const tempId = `temp_${crypto.randomUUID()}`;
    const parsedTime = normalizeTime(pm.time);
    const tempMed = {
      id: tempId,
      consult_id: selectedConsult.id,
      name: pm.name || '', dosage: pm.dosage || '', quantity: pm.quantity || '',
      type: pm.type || '', frequency: pm.frequency || '', food: pm.food || '',
      time: parsedTime, duration: pm.duration || '',
      instructions: pm.instructions || '', flags: pm.flags || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      patient_id: patientId || '',
    } as ConsultMedicineRow;
    setConsultMedicines((prev) => [...prev, tempMed]);
    setMedicineDrafts((prev) => ({
      ...prev,
      [tempId]: {
        name: pm.name || '', dosage: pm.dosage || '', quantity: pm.quantity || '',
        type: pm.type || '', frequency: pm.frequency || '', food: pm.food || '',
        time: parsedTime, duration: pm.duration || '',
        instructions: pm.instructions || '', flags: pm.flags || '',
      },
    }));
  }
};

  const handleSendPreConsultLink = () => {
    if (!patient || !patient.phone || !user) return;
    const preConsultUrl = `${window.location.origin}/pre-consult/new?docId=${user.id}&patientId=${patientId}`;
    const message = `Hi ${patient.name},\n\nBefore your visit, please upload all your past medical reports/prescriptions here: ${preConsultUrl}\n\nIt helps the doctor see a quick summary of your medical history and treat you better \n\nThank You! \n— Dr Ranga Reddy's Clinic`;
    let phoneNumber = String(patient.phone).replace(/\D/g, '');
    if (!phoneNumber.startsWith('91') && phoneNumber.length === 10) phoneNumber = `91${phoneNumber}`;
    window.location.href = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
  };

  const confirmDocumentSubmit = async () => {
    if (documentsToUpload.length === 0) return;
    try {
      setDocumentUploadState('uploading');
      setUploadError('');
      const uploadedUrls: string[] = [];
      for (const file of documentsToUpload) {
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileName = `${patientId}-${Date.now()}-${sanitizedFileName}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('pre-consultation-documents')
          .upload(fileName, file, { contentType: file.type || 'application/octet-stream', upsert: false });
        if (uploadError) throw new Error('Failed to upload document: ' + file.name);
        const { data: urlData } = supabase.storage.from('pre-consultation-documents').getPublicUrl(uploadData.path);
        uploadedUrls.push(urlData.publicUrl);
      }
      const preConsult = await createPreConsult(user!.id, patientId!);
      await updatePreConsult(preConsult.id, { documents_uploaded: uploadedUrls, status: 'Draft' });
      addProcessingPreConsultOptimistic({ id: preConsult.id, documents_uploaded: uploadedUrls, ai_summary: null, created_at: new Date().toISOString(), doc_id: user!.id, patient_id: patientId!, status: 'Draft' });
      setDocumentUploadState('success');
    } catch (error) {
      console.error('Error uploading documents:', error);
      setDocumentUploadState('error');
    }
  };

  const handleDocumentUploadOkay = () => {
    setShowDocumentConfirm(false);
    setShowDocumentUpload(false);
    setDocumentsToUpload([]);
    setUploadError('');
    setDocumentUploadState('confirming');
    requestAnimationFrame(() => {
      if (preConsultSectionRef.current) {
        const el = preConsultSectionRef.current;
        const offsetPosition = el.getBoundingClientRect().top + window.pageYOffset - 32;
        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
      }
    });
  };

  const generatePDFHTMLContent = (consult: ConsultRow, referredBy?: string, doctorName?: string): string => {
    // CHANGED: Fully rewritten for Apollo247-inspired clean layout
    const summary = getConsultSummary(consult) as ConsultSummary | null;
    if (!summary) return '<p>No consultation summary available.</p>';

    const meds = getViewModeMedicines(summary, consultMedicines);

    // CHANGED: Helper to compute M-A-N dosage grid from medicine time[] and quantity
    const getMaNGrid = (time: string[], quantity: string): string => {
      // CHANGED: only use numeric quantity, never fall back to dosage string
  const rawQty = (quantity || '').trim();
  const qty = rawQty || '1';
      const normalizedTime = (time || []).map((t) => t.toLowerCase());
      const morning = normalizedTime.some((t) => t.includes('morning')) ? qty : '0';
      const afternoon = normalizedTime.some((t) => t.includes('afternoon') || t.includes('noon')) ? qty : '0';
      const night = normalizedTime.some((t) => t.includes('night') || t.includes('evening')) ? qty : '0';
      return `
        <table class="man-grid">
          <tr>
            <td class="man-val">${escapeHtml(morning)}</td>
            <td class="man-sep">-</td>
            <td class="man-val">${escapeHtml(afternoon)}</td>
            <td class="man-sep">-</td>
            <td class="man-val">${escapeHtml(night)}</td>
          </tr>
          <tr>
            <td class="man-label">M</td>
            <td class="man-sep"> </td>
            <td class="man-label">A</td>
            <td class="man-sep"> </td>
            <td class="man-label">N</td>
          </tr>
        </table>
      `;
    };

    let content = `
      <div class="info-block"> 

    <div class="info-box"> <!-- CHANGED: added bordered container -->

      <div class="info-grid">

        <div class="info-item">
          <span class="info-label">Doctor -</span>
          <span class="info-value">
            ${escapeHtml(doctorName || '—')}
          </span>
        </div>

        <div class="info-item">
          <span class="info-label">Date -</span>
          <span class="info-value">
            ${escapeHtml(formatDate(consult.created_at))}
          </span>
        </div>

        <div class="info-item">
          <span class="info-label">Patient -</span>
          <span class="info-value">
            ${escapeHtml(patient?.name || '—')}, ${escapeHtml(String(patient?.age || '—'))}${escapeHtml((patient?.gender || '').charAt(0))}
          </span>
        </div>

        <div class="info-item">
          <span class="info-label">UHID -</span>
          <span class="info-value">
            ${escapeHtml(patient?.uhid || '—')}
          </span>
        </div>

        <div class="info-item">
          <span class="info-label">Referred by -</span>
          <span class="info-value">
            ${escapeHtml(referredBy || '—')}
          </span>
        </div>

      </div>

    </div>

  </div>
    `; // CHANGED: added UHID (if exists) and Referred By (if exists)

    // CHANGED: Diagnosis section — only if data exists
    if (summary.diagnosis) {
      let diagContent = '';
      if (typeof summary.diagnosis === 'string') {
        diagContent = `<p class="section-text">${escapeHtml(summary.diagnosis)}</p>`;
      } else {
        const d = summary.diagnosis as DiagnosisSummary;
        const prov = Array.isArray(d.provisional) ? d.provisional : [];
        if (prov.length) diagContent += `<p class="sub-label">Provisional Diagnosis</p>${toHtmlList(prov)}`;
      }
      if (diagContent) {
        content += `
          <div class="section">
            <div class="section-header">Diagnosis / Provisional Diagnosis</div>
            ${diagContent}
          </div>
        `;
      }
    }

    // CHANGED: Chief Complaints — only if data exists
    if (summary.chief_complaints) {
      const cc = summary.chief_complaints;
      const ccHtml = Array.isArray(cc)
        ? toHtmlList(cc)
        : `<p class="section-text">${escapeHtml(String(cc))}</p>`;
      content += `
        <div class="section">
          <div class="section-header">Chief Complaints</div>
          ${ccHtml}
        </div>
      `;
    }

    // CHANGED: History — only if data exists
    if (summary.history) {
      content += `
        <div class="section">
          <div class="section-header">History</div>
          <p class="section-text">${escapeHtml(summary.history)}</p>
        </div>
      `;
    }

    // Past Medical History — K/C/O line per Indian OP prescription convention
    if ((summary as any).past_medical_history) {
      const pmh = (summary as any).past_medical_history;
      const pmhArr = Array.isArray(pmh) ? pmh : String(pmh).split('\n');
      const cleaned = pmhArr.map((s: unknown) => String(s).replace(/^[-•]\s*/, '').trim()).filter(Boolean);
      if (cleaned.length) {
        content += `
          <div class="section">
            <div class="section-header">Past Medical History (K/C/O)</div>
            <p class="section-text">${escapeHtml(cleaned.join(', '))}</p>
          </div>
        `;
      }
    }

    // CHANGED: Medications — Apollo-style numbered table, only if medicines exist
    if (meds.length > 0) {
      const medsRows = meds.map((m, idx) => {
        const timeArr = Array.isArray(m?.time) ? m.time : [];
        const manGrid = getMaNGrid(timeArr, m?.quantity || m?.dosage || '');
        // CHANGED: prepend quantity to detail line, show "1 Tab | 1x everyday | after food"
        const rawQty = (m?.quantity || '').trim();
        const displayQty = rawQty || '1';
        const detailParts = [
          m?.type ? `${displayQty} ${escapeHtml(m.type)}` : '',  // e.g. "1 Tab"
          m?.frequency ? escapeHtml(m.frequency) : '',            // e.g. "1x everyday"
          m?.food ? `${escapeHtml(m.food)} food` : '',            // e.g. "after food"
        ].filter(Boolean);
        const detailLine = detailParts.join(' | ');
        const instructionLine = m?.instructions ? `<div class="med-instruction">${escapeHtml(m.instructions)}</div>` : '';
        return `
          <tr class="${idx % 2 === 0 ? 'row-even' : 'row-odd'}">
            <td class="td-num">${idx + 1}.</td>
            <td class="td-name">
              <strong>${escapeHtml(m?.name || '—')}</strong>
              ${m?.dosage && m.dosage !== m.quantity ? `<div class="med-sub">${escapeHtml(m.dosage)}</div>` : ''}
              ${instructionLine}
            </td>
            <td class="td-man">${manGrid}</td>
            <td class="td-detail">${detailLine || '—'}</td>
            <td class="td-dur">${escapeHtml(m?.duration || '—')}</td>
          </tr>
        `;
      }).join('');

      content += `
        <div class="section">
          <div class="section-header">Medication Prescribed</div>
          <table class="med-table">
            <thead>
              <tr>
                <th class="th-num">#</th>
                <th class="th-name">Medicine Name</th>
                <th class="th-man">Dosage</th>
                <th class="th-detail">Medicine Details</th>
                <th class="th-dur">Duration</th>
              </tr>
            </thead>
            <tbody>${medsRows}</tbody>
          </table>
          <p class="man-legend"><strong>M-A-N:</strong> Morning - Afternoon - Night</p>
        </div>
      `;
    }

    // CHANGED: Treatment Suggested — only if data exists
    if (summary.treatment_suggested) {
      let treatHtml = '';
      if (typeof summary.treatment_suggested === 'string') {
        treatHtml = `<p class="section-text">${escapeHtml(summary.treatment_suggested)}</p>`;
      } else {
        const t = summary.treatment_suggested as TreatmentSummary;
        const immediate = Array.isArray(t.immediate_plan) ? t.immediate_plan : [];
        const contingent = Array.isArray(t.contingent_plan) ? t.contingent_plan : [];
        if (immediate.length) treatHtml += `<p class="sub-label">Immediate Plan</p>${toHtmlList(immediate)}`;
        if (contingent.length) treatHtml += `<p class="sub-label">Contingent Plan</p>${toHtmlList(contingent)}`;
      }
      if (treatHtml) {
        content += `
          <div class="section">
            <div class="section-header">Treatment Suggested</div>
            ${treatHtml}
          </div>
        `;
      }
    }

    // REPLACEMENT

  if (summary.investigations) {
  let invHtml = '';

  if (typeof summary.investigations === 'string' && summary.investigations.trim()) {
    invHtml = `<p class="section-text">${escapeHtml(summary.investigations)}</p>`;
  } else if (typeof summary.investigations === 'object') {
    const inv = summary.investigations as InvestigationsSummary;
    const ordered = Array.isArray(inv.ordered) ? inv.ordered : [];
    if (ordered.length) {
      invHtml += `<ul class="section-list">${ordered.map((o) =>
        `<li><strong>${escapeHtml(o?.name || '—')}</strong>${o?.body_part_or_type ? ` — ${escapeHtml(o.body_part_or_type)}` : ''}${o?.priority ? ` <span class="inv-priority">(${escapeHtml(o.priority)})</span>` : ''}</li>`
      ).join('')}</ul>`;
    }
    if (inv.notes) invHtml += `<p class="section-text">${escapeHtml(inv.notes)}</p>`;
  }

  if (invHtml) {
    content += `
      <div class="section">
        <div class="section-header">Investigations</div>
        ${invHtml}
      </div>
    `;
  }
}

    // Attached diet charts — note in PDF
    const attachedCharts = (summary as any)?.attached_diet_charts;
    if (Array.isArray(attachedCharts) && attachedCharts.length > 0) {
      content += `
        <div class="section" style="margin-top: 24px; padding: 12px; border: 1px solid #d1fae5; background: #f0fdf4; border-radius: 8px;">
          <p style="font-size: 11px; color: #166534; font-weight: 600;">📎 Diet Chart Attached — See following pages</p>
        </div>
      `;
    }
    
    // CHANGED: Follow-up Recommendations — only if data exists
    if (summary.followup_recommendations) {
      const fu = summary.followup_recommendations;
      const fuHtml = Array.isArray(fu)
        ? toHtmlList(fu)
        : `<p class="section-text">${escapeHtml(String(fu))}</p>`;
      content += `
        <div class="section">
          <div class="section-header">Advice & Instructions</div>
          ${fuHtml}
        </div>
      `;
    }

    return content;
  };

  const handleDownloadPDF = async () => {
    if (!selectedConsult) return;
    let referredBy: string | undefined;
    let fetchedDoctorName: string | undefined;

    try {
      // 1. Fetch referred_by
      const appt = await getAppointmentByConsultId(selectedConsult.id);
      referredBy = appt?.referred_by || undefined;

      // 2. Fetch doctor name from the organizations table
      if (user?.id) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('name')
          .eq('auth_id', user.id)
          .single();
        
        if (orgData?.name) {
          fetchedDoctorName = orgData.name;
        }
      }
    } catch (e) {
      console.error('Error fetching data for PDF:', e);
    }

    // Fallback to Auth metadata if the database fetch fails
    const finalDoctorName = fetchedDoctorName || user?.user_metadata?.display_name || user?.user_metadata?.name || '—';

    let htmlContent = generatePDFHTMLContent(selectedConsult, referredBy, finalDoctorName);

    // Append diet chart image pages if attached
    const attachedChartNames = (selectedConsult.consult_summary_final as any)?.attached_diet_charts || [];
    if (attachedChartNames.length > 0) {
      try {
        const { data: chartData } = await supabase
          .from('diet_charts')
          .select('name, file_urls')
          .eq('doc_id', user!.id)
          .in('name', attachedChartNames);

        if (chartData && chartData.length > 0) {
          for (const chart of chartData) {
            for (const url of (chart.file_urls || [])) {
              htmlContent += `<div style="page-break-before: always; text-align: center; padding: 0;">
                <img src="${url}" style="width: 100%; max-width: 794px;" />
              </div>`;
            }
          }
        }
      } catch (e) {
        console.error('Error fetching diet charts for PDF:', e);
      }
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) { alert('Pop-up blocked. Please allow pop-ups to download the PDF.'); return; }
    printWindow.document.open();
    // CHANGED: Replaced with Apollo-inspired clean print styles
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>
*{box-sizing:border-box}
body{font-family:Arial,sans-serif;margin:24px 28px;line-height:1.5;color:#111;font-size:13px;background:#fff}
/* CHANGED: remove divider line under patient info */
.info-block{
  margin-bottom:20px;
  padding-bottom:0;
  border-bottom:none;
}

/* CHANGED: add bordered square box around patient info */
.info-box{
  border:1.5px solid #111;  /* same color/thickness as section header line */
  padding:16px 16px;
  margin-bottom:32px;
}

/* CHANGED: keep 2-column layout */
.info-grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:6px 40px;
}

.info-item{
  font-size:12px;
}

.info-label{
  font-weight:700;
  color:#333;
  margin-right:4px;
}

.info-value{
  color:#111;
}

/* CHANGED: remove light divider from sections but keep spacing */
.section{
  margin-bottom:18px;
  padding-bottom:12px;
  border-bottom:none;
}
.section-header{font-size:13px;font-weight:700;color:#111;margin-bottom:8px;padding-bottom:4px;border-bottom:1.5px solid #111;text-transform:none;letter-spacing:0}
.section-text{margin:4px 0;font-size:12px;color:#222}
.sub-label{font-size:11px;font-weight:700;color:#444;margin:8px 0 4px 0;text-transform:uppercase;letter-spacing:0.03em}
.section-list{margin:4px 0 4px 18px;padding:0}
.section-list li{font-size:12px;margin-bottom:3px;color:#222}
.inv-priority{font-size:11px;color:#666;font-style:italic}
.med-table{width:100%;border-collapse:collapse;margin-top:6px;font-size:12px}
.med-table thead tr{background:#f3f4f6}
.med-table th{text-align:left;padding:7px 8px;font-size:11px;font-weight:700;border:1px solid #d1d5db;color:#333}
.med-table td{padding:7px 8px;border:1px solid #d1d5db;vertical-align:top;color:#222}
.th-num,.td-num{width:28px;text-align:center}
.th-man,.td-man{width:90px;text-align:center}
.th-dur,.td-dur{width:80px}
.th-detail,.td-detail{width:140px}
.td-name strong{font-size:12px;font-weight:700}
.med-sub{font-size:11px;color:#555;margin-top:2px}
.med-instruction{font-size:11px;color:#555;margin-top:3px;font-style:italic}
.row-even{background:#fff}
.row-odd{background:#f9fafb}
.man-grid{border-collapse:collapse;margin:0 auto;font-size:11px}
.man-val{font-weight:700;text-align:center;padding:1px 4px;color:#111}
.man-label{font-size:10px;text-align:center;color:#555;padding:0 4px}
.man-sep{text-align:center;padding:1px 1px;color:#999;font-weight:400}
.man-legend{font-size:10px;color:#666;margin-top:6px;font-style:italic}
@page{margin-top:160px;margin-bottom:100px;margin-left:12mm;margin-right:12mm}
@media print{body{margin:0}}
</style></head><body>${htmlContent}<script>setTimeout(function(){window.focus();window.print()},300);window.onafterprint=function(){window.close()};</script></body></html>`);
    printWindow.document.close();
  };

  const handleSendWhatsApp = () => {
    if (!selectedConsult || !patient) return;
    const doctorName = user?.user_metadata?.name || user?.email || 'Doctor';
    const message = `Hi ${patient.name}, here is your consultation summary for your visit with Dr ${doctorName} on ${formatDate(selectedConsult.created_at)}.`;
    let phoneNumber = patient.phone.replace(/\D/g, '');
    if (!phoneNumber.startsWith('91') && phoneNumber.length === 10) phoneNumber = '91' + phoneNumber;
    window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const renderBulletSummary = (text: unknown) => {
    if (typeof text !== 'string') return <p className="text-gray-800">{String(text)}</p>;
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const bulletLines = lines.filter((l) => l.startsWith('-') || l.startsWith('•')).map((l) => l.replace(/^[-•]\s*/, '').trim()).filter(Boolean);
    if (bulletLines.length >= 1 && bulletLines.length === lines.length) {
      return <ul className="list-disc list-inside space-y-1 text-gray-800">{bulletLines.map((b, i) => <li key={i}>{b}</li>)}</ul>;
    }
    return <p className="text-gray-800 whitespace-pre-line">{text}</p>;
  };

  const renderTimelineTab = () => {
    const allEvents = Array.isArray(latestSummary?.summary?.timeline_of_medical_events) ? latestSummary!.summary.timeline_of_medical_events! : [];
    const pmhEvent = allEvents.find(e => e.event_type === 'Past Medical History');
    const timeline = allEvents.filter(e => e.event_type !== 'Past Medical History');
    if (timeline.length === 0 && !pmhEvent) {
      return <div className="text-center py-12 bg-gray-50 border border-gray-200 rounded-lg"><p className="text-gray-500">No timeline events available</p></div>;
    }
    return (
      <div className="space-y-4">
        {pmhEvent && (
          <div className="bg-blue-50/60 border border-blue-100 rounded-lg px-4 py-3">
            <p className="text-xs font-semibold text-blue-900/80 uppercase tracking-wide mb-2">
              Patient Background
            </p>
            {renderBulletSummary(pmhEvent.summary)}
          </div>
        )}
        {timeline.map((event, index) => (
          <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-start mb-0.5">
              <h4 className="font-semibold text-gray-900">{event.event_type}</h4>
              <button type="button" className="hidden" onClick={() => {}} />
            </div>
            {(event.location || event.event_datetime) && (
              <p className="text-sm text-gray-600 mb-4">
                {event.event_datetime ? formatEventDate(event.event_datetime) : '—'}
                {event.location && event.event_datetime ? ' • ' : ''}
                {event.location || ''}
              </p>
            )}
            {renderBulletSummary(event.summary)}
            {event.important_findings && (
              <div className="mt-3 p-3 rounded border border-[#024CDB]/60 bg-[#024CDB]/5">
                {(() => {
                  const txt = String(event.important_findings || '').trim();
                  const bullets = txt.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => l.replace(/^[-•]\s*/, '').trim()).filter(Boolean);
                  if (bullets.length >= 2) {
                    return <ul className="list-disc list-inside space-y-1 text-sm text-gray-800">{bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>;
                  }
                  return <p className="text-sm text-gray-800 whitespace-pre-line">{txt}</p>;
                })()}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderDiagnosticTrendsTab = () => {
    const trends: DiagnosticTrend[] = Array.isArray(latestSummary?.summary?.diagnostic_trends) ? latestSummary!.summary.diagnostic_trends! : [];
    if (!trends.length) {
      return <div className="text-center py-12 bg-gray-50 border border-gray-200 rounded-lg"><p className="text-gray-500">No diagnostic trends available</p></div>;
    }

    const toDayKey = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 10); };
    const formatColHeader = (dayKey: string) => {
      const d = new Date(dayKey + 'T00:00:00');
      return isNaN(d.getTime()) ? dayKey : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase();
    };
    const badgeClass = (label: string) => {
      const t = (label || '').toLowerCase();
      if (t.includes('critical')) return 'bg-red-100 text-red-700';
      if (t.includes('high')) return 'bg-orange-100 text-orange-700';
      if (t.includes('elevat')) return 'bg-amber-100 text-amber-700';
      if (t.includes('uncontrol')) return 'bg-orange-100 text-orange-700';
      if (t.includes('normal')) return 'bg-green-100 text-green-700';
      if (t.includes('low')) return 'bg-blue-100 text-blue-700';
      return 'bg-gray-100 text-gray-700';
    };

    const allDays: string[] = [];
    trends.forEach((p) => { (p?.measurements || []).forEach((m) => { if (m?.measurement_datetime) allDays.push(toDayKey(m.measurement_datetime)); }); });
    const uniqueDays = Array.from(new Set(allDays)).sort();

    const valueMap: Record<string, Record<string, typeof trends[0]['measurements'] extends (infer T)[] | undefined ? T : never>> = {};
    trends.forEach((p) => {
      const key = String(p?.parameter_name || '').trim();
      if (!key) return;
      valueMap[key] = valueMap[key] || {};
      (p?.measurements || []).forEach((m) => {
        const day = m?.measurement_datetime ? toDayKey(m.measurement_datetime) : null;
        if (!day) return;
        const existing = valueMap[key][day];
        if (!existing) { valueMap[key][day] = m; }
        else {
          const a = new Date((existing as typeof m).measurement_datetime).getTime();
          const b = new Date(m.measurement_datetime).getTime();
          if (!isNaN(a) && !isNaN(b) && b > a) valueMap[key][day] = m;
        }
      });
    });

    const getInterpretation = (p: DiagnosticTrend) => {
      const ms = Array.isArray(p?.measurements) ? p.measurements : [];
      const latest = ms.filter((m) => m?.measurement_datetime).sort((a, b) => new Date(b.measurement_datetime).getTime() - new Date(a.measurement_datetime).getTime())[0];
      return latest?.clinical_interpretation || p?.overall_trend_comment || '';
    };

    const renderTable = () => (
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left text-xs font-semibold tracking-wider text-gray-600 px-4 py-3">PARAMETER</th>
              {uniqueDays.map((dayKey) => (
                <th key={dayKey} className="text-left text-xs font-semibold tracking-wider text-blue-700 px-4 py-3">{formatColHeader(dayKey)}</th>
              ))}
              <th className="text-left text-xs font-semibold tracking-wider text-gray-600 px-4 py-3">INTERPRETATION</th>
            </tr>
          </thead>
          <tbody>
            {trends.map((p, idx) => {
              const paramName = String(p?.parameter_name || '').trim();
              if (!paramName) return null;
              const interp = String(getInterpretation(p) || '').trim();
              const unit = p?.unit ? String(p.unit) : '';
              return (
                <tr key={paramName + idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                  <td className="px-4 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">{paramName}</td>
                  {uniqueDays.map((dayKey) => {
                    const m = valueMap?.[paramName]?.[dayKey] as { value_raw?: string | number } | undefined;
                    const val = m?.value_raw ?? '';
                    const display = val === '' || val === null || val === undefined ? '—' : unit && typeof val === 'number' ? `${val} ${unit}` : unit && typeof val === 'string' && !val.includes(unit) ? `${val} ${unit}` : String(val);
                    return <td key={dayKey} className="px-4 py-4 text-sm text-gray-900 whitespace-nowrap">{display}</td>;
                  })}
                  <td className="px-4 py-4 whitespace-nowrap">
                    {interp ? (
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${badgeClass(interp)}`}>{interp}</span>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );

    const renderGraphsInline = () => {
  const firstParam = trends.map((t) => String(t?.parameter_name || '').trim()).find(Boolean) || '';
  const currentParam = selectedGraphParam || firstParam;

  const selected =
    trends.find((t) => String(t?.parameter_name || '').trim() === currentParam) || trends[0];

  if (!selected) return null;

  const selectedName = String(selected?.parameter_name || '').trim();

  const measurements = (selected.measurements || [])
    .map((m) => ({ ...m, timestamp: new Date((m.measurement_datetime || '').replace('~', '').trim()).getTime() }))
    .filter((m) => !isNaN(m.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);

  return (
    <div className="p-4 space-y-4">
      {/* Dropdown */}
      <div className="relative">
        <select
          value={currentParam}
          onChange={(e) => setSelectedGraphParam(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#024CDB] focus:border-transparent"
        >
          {trends.map((t, idx) => {
            const name = String(t?.parameter_name || '').trim();
            if (!name) return null;
            return (
              <option key={idx} value={name}>
                {name}
              </option>
            );
          })}
        </select>
      </div>

      {/* If no data */}
      {measurements.length === 0 ? (
        <div className="border border-gray-200 rounded-lg p-6 bg-white">
          <p className="text-sm text-gray-500">No graph data available for this parameter.</p>
        </div>
      ) : (
        (() => {
          const graphWidth = Math.max(700, measurements.length * 120);
          const graphHeight = 450;
          const padding = { top: 60, right: 80, bottom: 80, left: 80 };
          const chartWidth = graphWidth - padding.left - padding.right;
          const chartHeight = graphHeight - padding.top - padding.bottom;

          const values = measurements.map((m) => m.value_numeric ?? 0).filter((v) => v !== undefined);
          const minValue = Math.min(...values);
          const maxValue = Math.max(...values);
          const valueRange = maxValue - minValue || 1;

          const yMin = Math.floor((minValue - valueRange * 0.2) / 10) * 10;
          const yMax = Math.ceil((maxValue + valueRange * 0.15) / 10) * 10;

          const normalRangeMatch = selected.normal_range?.match(/[<>]?\s*(\d+)/);
          const normalThreshold = normalRangeMatch ? parseFloat(normalRangeMatch[1]) : null;

          const points = measurements.map((m, i) => ({
            x: padding.left + (i / (measurements.length - 1 || 1)) * chartWidth,
            y: padding.top + chartHeight - ((((m.value_numeric ?? 0) - yMin) / (yMax - yMin)) * chartHeight),
            ...m,
          }));

          const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

          const yTicks = 6;
          const yTickValues = Array.from({ length: yTicks }, (_, i) => yMin + ((yMax - yMin) / (yTicks - 1)) * i);

          const normalZoneY =
            normalThreshold && normalThreshold >= yMin && normalThreshold <= yMax
              ? padding.top + chartHeight - ((normalThreshold - yMin) / (yMax - yMin)) * chartHeight
              : null;

          const normalZoneHeight =
            normalZoneY !== null
              ? chartHeight - (chartHeight - ((normalThreshold! - yMin) / (yMax - yMin)) * chartHeight)
              : null;

          return (
            <div className="border border-gray-200 rounded-lg p-6 bg-white">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{selectedName}</h3>
                <p className="text-sm text-gray-600">
                  {selected.unit && `Unit: ${selected.unit}`}
                  {selected.normal_range && ` • Normal Range: ${selected.normal_range}`}
                </p>
              </div>

              <div className="overflow-x-auto">
                <svg width={graphWidth} height={graphHeight} className="bg-white" style={{ minWidth: '700px' }}>
                  {normalZoneY !== null && normalZoneHeight !== null && (
                    <rect x={padding.left} y={normalZoneY} width={chartWidth} height={normalZoneHeight} fill="rgba(16, 185, 129, 0.08)" />
                  )}

                  {yTickValues.map((val, i) => {
                    const y = padding.top + chartHeight - ((val - yMin) / (yMax - yMin)) * chartHeight;
                    return (
                      <g key={i}>
                        <line x1={padding.left} y1={y} x2={padding.left + chartWidth} y2={y} stroke="#f3f4f6" strokeWidth="1" strokeDasharray="4,4" />
                        <text x={padding.left - 12} y={y + 4} textAnchor="end" fontSize="12" fill="#6b7280" fontWeight="500">
                          {Math.round(val)}
                        </text>
                      </g>
                    );
                  })}

                  {normalThreshold && normalThreshold >= yMin && normalThreshold <= yMax && (
                    <g>
                      <line x1={padding.left} y1={normalZoneY!} x2={padding.left + chartWidth} y2={normalZoneY!} stroke="#10b981" strokeWidth="2" strokeDasharray="6,3" />
                      <text x={padding.left + chartWidth + 10} y={normalZoneY! + 4} fontSize="11" fill="#10b981" fontWeight="600">
                        Normal
                      </text>
                    </g>
                  )}

                  <line x1={padding.left} y1={padding.top + chartHeight} x2={padding.left + chartWidth} y2={padding.top + chartHeight} stroke="#9ca3af" strokeWidth="2" />
                  <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + chartHeight} stroke="#9ca3af" strokeWidth="2" />

                  <path d={linePath} fill="none" stroke="#024CDB" strokeWidth="2.5" strokeLinejoin="round" />

                  {points.map((p, i) => {
                    const val = p.value_numeric ?? 0;
                    const isAbove = normalThreshold && val > normalThreshold;
                    const color = isAbove ? '#ef4444' : '#024CDB';
                    return (
                      <g key={i}>
                        <circle cx={p.x} cy={p.y} r="5" fill={color} stroke="white" strokeWidth="2" />
                        <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="12" fill={color} fontWeight="600">
                          {val}
                        </text>
                        <text x={p.x} y={padding.top + chartHeight + 20} textAnchor="middle" fontSize="11" fill="#6b7280">
                          {new Date((p.measurement_datetime || '').replace('~', '').trim())
                            .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
                            .toUpperCase()}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
};

    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
       <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
  <h3 className="text-sm font-semibold text-gray-900">DIAGNOSTIC TRENDS</h3>

  <div className="flex items-center gap-2">
    <span className="text-sm font-semibold text-[#024CDB]">Graph view</span>
    <button
      type="button"
      role="switch"
      aria-checked={showGraphView}
      onClick={() => {
        // when turning ON, default to first parameter (avoid empty dropdown)
        if (!showGraphView) {
          const firstParam =
            trends.map((t) => String(t?.parameter_name || '').trim()).find(Boolean) || '';
          setSelectedGraphParam((prev) => prev || firstParam);
        }
        setShowGraphView((v) => !v);
      }}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#024CDB] ${
        showGraphView ? 'bg-[#024CDB]' : 'bg-gray-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
          showGraphView ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  </div>
</div>
        {showGraphView ? renderGraphsInline() : renderTable()}
      </div>
    );
  };

  const renderHistoryTab = () => {
    const medications = latestSummary?.summary?.medications || {};
    const currentMeds = medications.current || [];
    const pastMeds = medications.past || [];
    const currentOpen = !!expandedSections.currentMeds;
    const pastOpen = !!expandedSections.pastMeds;

    const renderCollapsible = (title: React.ReactNode, open: boolean, onToggle: () => void, body: React.ReactNode) => (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <button
  onClick={onToggle}
  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
>
  {open ? (
    <ChevronDown className="w-5 h-5 text-gray-500 shrink-0" />
  ) : (
    <ChevronRight className="w-5 h-5 text-gray-500 shrink-0" />
  )}

  <h3 className="text-lg font-semibold text-gray-900 flex-1">{title}</h3>
</button>
        {open && <div className="px-4 pb-4">{body}</div>}
      </div>
    );

    const medCard = (med: { drug_name?: string; dose?: string; frequency?: string; indication?: string; duration_or_quantity?: string; notes?: string }, idx: number, past = false) => (
      <div key={idx} className={`${past ? 'bg-gray-50' : 'bg-white'} border border-gray-200 rounded-lg p-4`}>
        <div className="flex justify-between items-start">
          <div>
            <h4 className={`${past ? 'font-medium text-gray-700' : 'font-semibold text-gray-900'}`}>{med.drug_name}</h4>
            <p className="text-gray-600">{med.dose} • {med.frequency}</p>
            {med.indication && <p className="text-sm text-gray-500 mt-1">{med.indication}</p>}
          </div>
          <span className="text-sm text-gray-500">{med.duration_or_quantity}</span>
        </div>
        {med.notes && <p className="text-sm text-gray-600 mt-2">{med.notes}</p>}
      </div>
    );

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Diagnostic Trends</h3>
          {renderDiagnosticTrendsTab()}
        </div>
        {renderCollapsible(
          `Current Medications (${currentMeds.length})`,
          currentOpen,
          () => setExpandedSections((prev) => ({ ...prev, currentMeds: !currentOpen })),
          currentMeds.length === 0 ? <p className="text-gray-500">No current medications</p> : (
            <div className="mt-2 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(400px,1fr))]">
              {currentMeds.map((med, idx) => medCard(med, idx, false))}
            </div>
          )
        )}
        {renderCollapsible(
          `Past Medications (${pastMeds.length})`,
          pastOpen,
          () => setExpandedSections((prev) => ({ ...prev, pastMeds: !pastOpen })),
          pastMeds.length === 0 ? <p className="text-gray-500">No past medications</p> : (
            <div className="mt-2 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(400px,1fr))]">
              {pastMeds.map((med, idx) => medCard(med, idx, true))}
            </div>
          )
        )}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Timeline</h3>
          {renderTimelineTab()}
        </div>
      </div>
    );
  };

  const renderPastSummariesTab = () => {
    if (consultations.length === 0) {
      return <div className="text-center py-12 bg-gray-50 border border-gray-200 rounded-lg"><p className="text-gray-500">No past consultations available</p></div>;
    }
    return (
      <div className="flex flex-wrap gap-3">
        {consultations.map((consult) => (
          <div
            key={consult.id}
            onClick={() => {
  handleCancelEdit();     // resets edit state + edited text (same behavior as earlier)
  setSelectedConsult(consult);
}}
            className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow min-w-[350px] max-w-[500px] flex-1"
          >
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <p className="font-medium text-gray-900">{formatDate(consult.created_at)}</p>
                <p className="text-sm text-gray-600 mt-1">{getConsultPreviewText(consult)}</p>
              </div>
              <div className="flex flex-col items-end shrink-0">
                {isConsultProcessed(consult) ? (
                  <div className="flex items-center gap-2 text-sm text-[#024CDB]">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-50">✓</span>
                    <span className="font-medium">Processed</span>
                  </div>
                ) : isConsultError(consult, uiNow) ? (
                  <div className="flex items-center gap-2 text-sm text-red-600">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-50">!</span>
                    <span className="font-medium">Error</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="relative w-9 h-9">
                      <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                        <path className="text-gray-200" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                        <path className="text-[#024CDB]" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${getProgressPercent(consult, uiNow)}, 100`} strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-gray-700">{getProgressPercent(consult, uiNow)}%</div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-gray-700">Processing</p>
                      <p className="text-[11px] text-gray-500">{getProgressPercent(consult, uiNow)}% completed</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar showBack />
        <div className="max-w-5xl mx-auto px-4 py-12 text-center">
          <Spinner size="lg" className="mx-auto" />
          <p className="mt-4 text-gray-600">Loading patient data...</p>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar showBack />
        <div className="max-w-5xl mx-auto px-4 py-12 text-center">
          <p className="text-gray-600">Patient not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={clearToast} />}
      <Navbar showBack />

      <div className="w-full px-4 py-6 xl:px-[160px]">
        <PatientProfileHeader
          patient={patient}
          isRecording={isRecording}
          isPaused={isPaused}
          recordingTime={recordingTime}
          onStartRecording={handleStartRecording}
          onEndRecording={handleEndRecording}
          onPauseRecording={handlePauseRecording}
          onEditPatient={() => setShowEditModal(true)}
          onAddVitals={() => setShowVitalsModal(true)}
          onUploadDocuments={() => setShowDocumentUpload(true)}
          formatDate={formatDateShort}
        />

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {todaysVitals.length > 0 && (
            <div className="mb-0">
              <div className="p-6">
                <div className="mb-4"><h2 className="text-lg font-semibold text-gray-900">Today's Vitals</h2></div>
                <div className="space-y-4">
                  {todaysVitals.map((vital, index) => (
                    <div key={vital.id}>
                      
                    <div className="flex items-center justify-between mb-3">
  <div className="min-w-0">
    <div className="text-[10px] uppercase tracking-wider text-gray-500">Recorded at: {vital.created_at ? formatDate(vital.created_at) : '—'}</div>
    
      

  </div>

  <button
    onClick={() => handleEditVital(vital)}
    className="inline-flex items-center gap-2 text-sm font-medium text-[#024CDB] hover:bg-blue-50 px-2 py-1 rounded-md transition-colors shrink-0"
  >
    <Edit className="w-4 h-4" />
    <span>Edit</span>
  </button>
</div>

<div className="grid grid-cols-2 md:grid-cols-5 gap-3">
  {[
    { label: 'Temperature', value: vital.temperature, unit: '°C', Icon: Thermometer },
    { label: 'Blood Pressure', value: vital.blood_pressure, unit: 'mmHg', Icon: Activity },
    { label: 'Heart Rate', value: vital.heart_rate, unit: 'bpm', Icon: HeartPulse },
    { label: 'SpO2', value: vital.spo2, unit: '%', Icon: Droplets },
    { label: 'Weight', value: vital.weight, unit: 'kg', Icon: Weight },
  ].map(({ label, value, unit, Icon }) => (
    <div
      key={label}
      className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white px-3 py-3"
    >
      <Icon className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{label}</div>
        <div className="text-sm text-gray-900 truncate">
          {value || '—'}{value ? ` ${unit}` : ''}
        </div>
      </div>
    </div>
  ))}
</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="p-6 space-y-8">
            {processingPreConsults.length > 0 && (
              <section ref={preConsultSectionRef}>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Pre-Consultation Processing</h2>
                <div className="space-y-3">
                  {processingPreConsults.map((preConsult) => {
                    const hasAiSummary = preConsult.ai_summary && (typeof preConsult.ai_summary !== 'object' || Object.keys(preConsult.ai_summary).length > 0);
                    const isComplete = !!hasAiSummary;
                    const createdAt = preConsult.created_at ? new Date(preConsult.created_at).getTime() : Date.now();
                    const elapsed = Math.floor((uiNow - createdAt) / 1000);
                    const pct = isComplete ? 100 : Math.min(99, Math.floor((elapsed / PRE_CONSULT_ESTIMATED_SECONDS) * 100));
                    const docCount = Array.isArray(preConsult.documents_uploaded) ? preConsult.documents_uploaded.length : 0;
                    return (
                      <div key={preConsult.id} className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900">{isComplete ? 'Pre-consultation processed' : 'Processing pre-consultation documents...'}</p>
                            <p className="text-sm text-gray-600 mt-1">{docCount} {docCount === 1 ? 'file' : 'files'} uploaded</p>
                          </div>
                          <div className="flex flex-col items-end shrink-0">
                            {isComplete ? (
                              <div className="flex items-center gap-2 text-sm text-green-600">
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-50">✓</span>
                                <span className="font-medium">Complete</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <div className="relative w-9 h-9">
                                  <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                                    <path className="text-gray-200" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                                    <path className="text-[#024CDB]" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${pct}, 100`} strokeLinecap="round" />
                                  </svg>
                                  <div className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-gray-700">{pct}%</div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-medium text-gray-700">Processing</p>
                                  <p className="text-[11px] text-gray-500">{pct}% completed</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Past Consultations</h2>
              {renderPastSummariesTab()}
            </section>

            <section>{renderHistoryTab()}</section>
          </div>
        </div>
      </div>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Patient">
        <form onSubmit={(e) => { e.preventDefault(); handleEditPatient(); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="input-field" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
              <input type="number" value={editForm.age} onChange={(e) => setEditForm({ ...editForm, age: e.target.value })} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })} className="input-field">
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input type="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Case</label>
            <input type="text" value={editForm.case} onChange={(e) => setEditForm({ ...editForm, case: e.target.value })} className="input-field" placeholder="e.g., Hypertension, Diabetes" />
          </div>

          {/* CHANGED: Added UHID field to edit modal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              UHID <span className="text-gray-400 text-xs">(optional)</span>
            </label>
            <input
              type="text"
              value={editForm.uhid}
              onChange={(e) => setEditForm({ ...editForm, uhid: e.target.value })}
              className="input-field"
              placeholder="e.g., UHID-00123"
            />
          </div>

          <div className="flex space-x-3 justify-end pt-4">
            <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Save Changes</button>
          </div>
        </form>
      </Modal>

      <DocumentUploadModal
        isOpen={showDocumentUpload}
        documentsToUpload={documentsToUpload}
        uploadError={uploadError}
        isUploading={isUploading}
        onClose={() => { setShowDocumentUpload(false); setDocumentsToUpload([]); setUploadError(''); }}
        onFileChange={setDocumentsToUpload}
        onUploadClick={() => { setDocumentUploadState('confirming'); setShowDocumentConfirm(true); }}
      />

      <DocumentUploadStatusModal
        isOpen={showDocumentConfirm}
        uploadState={documentUploadState}
        onConfirm={confirmDocumentSubmit}
        onCancel={() => setShowDocumentConfirm(false)}
        onOkay={handleDocumentUploadOkay}
        onRetry={() => { setShowDocumentConfirm(false); setDocumentUploadState('confirming'); }}
      />

    {selectedConsult && (
  <ConsultViewModal
    // --- existing view props (same as before) ---
    consult={selectedConsult}
    consultMedicines={consultMedicines}
    patient={patient}
    userId={user?.id}
    expandedSections={expandedSections}
    onToggleSection={(key) => setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }))}
    onClose={() => {
      setSelectedConsult(null);
      handleCancelEdit(); // ensures edit mode is reset when closing (same outcome as before)
    }}
    onDownloadPDF={handleDownloadPDF}
    onSendWhatsApp={handleSendWhatsApp}
    formatDate={formatDate}
    uiNow={uiNow}

    // --- NEW: edit-mode toggle + actions (UI only, logic already exists) ---
    isEditing={isEditingConsult}
    onStartEdit={handleEditConsult}
    onCancelEdit={handleCancelEdit}
    onSaveEdit={handleSaveConsult}

    // --- NEW: pass the edit-state you already maintain in PatientProfile ---
    editedConsult={editedConsult}
    setEditedConsult={setEditedConsult}
    editedDiagnosisText={editedDiagnosisText}
    setEditedDiagnosisText={setEditedDiagnosisText}
    editedTreatmentText={editedTreatmentText}
    setEditedTreatmentText={setEditedTreatmentText}
    editedInvestigationsText={editedInvestigationsText}
    setEditedInvestigationsText={setEditedInvestigationsText}

    medicineDrafts={medicineDrafts}
    updateMedicineDraft={updateMedicineDraft}
    medicineSearchResults={medicineSearchResults}
    openTimeDropdownId={openTimeDropdownId}
    setOpenTimeDropdownId={setOpenTimeDropdownId}
    timeDropdownRef={timeDropdownRef}
    onAddMedicine={handleAddMedicine}
    onDeleteMedicine={handleDeleteMedicine}
    onMedicineSearch={handleMedicineSearch}
    setMedicineSearchResults={setMedicineSearchResults}
    onAddFavourites={() => setShowAddFavourites(true)}
    onLoadPrevious={() => setShowLoadPrevious(true)}
    onRetryOptimistic={(consultId: string) => {
      const newTime = new Date().toISOString();
      // Update background cards
      setConsultations((prev) =>
        prev.map((c) =>
          c.id === consultId ? { ...c, status: 'Processing', updated_at: newTime } : c
        )
      );
      // Update the popup memory so it doesn't revert when reopened!
      setSelectedConsult((prev) => 
        prev?.id === consultId ? { ...prev, status: 'Processing', updated_at: newTime } : prev
      );
    }}
  />
)}
  

    {user?.id && (
      <AddFavouritesModal
        isOpen={showAddFavourites}
        onClose={() => setShowAddFavourites(false)}
        onAdd={handleAddFromFavourites}
        docId={user.id}
      />
    )}

    {selectedConsult && patientId && (
      <LoadPreviousModal
        isOpen={showLoadPrevious}
        onClose={() => setShowLoadPrevious(false)}
        onAdd={handleAddFromPrevious}
        patientId={patientId}
        currentConsultId={selectedConsult.id}
      />
    )}

      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={() => setShowConfirmation(false)}
        title="Send Pre-Consult Link"
        message="Create and send pre-consultation form link to patient?"
      />

      <Modal isOpen={showVitalsModal} onClose={handleCloseVitalsModal} title={editingVital ? 'Edit Vitals' : 'Add Vitals'}>
        <form onSubmit={(e) => { e.preventDefault(); editingVital ? handleUpdateVital() : handleAddVital(); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Temperature (°C)</label>
            <input
              type="text"
              value={vitalForm.temperature}
              onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setVitalForm({ ...vitalForm, temperature: v }); }}
              className="input-field"
              placeholder="e.g., 98.6"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Blood Pressure (mmHg)</label>
            <input type="text" value={vitalForm.blood_pressure} onChange={(e) => setVitalForm({ ...vitalForm, blood_pressure: e.target.value })} className="input-field" placeholder="e.g., 120/80" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Heart Rate (bpm)</label>
            <input
              type="text"
              value={vitalForm.heart_rate}
              onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*$/.test(v)) setVitalForm({ ...vitalForm, heart_rate: v }); }}
              className="input-field"
              placeholder="e.g., 72"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SpO2 (%)</label>
            <input
              type="text"
              value={vitalForm.spo2}
              onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*$/.test(v)) setVitalForm({ ...vitalForm, spo2: v }); }}
              className="input-field"
              placeholder="e.g., 98"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
            <input
              type="text"
              value={vitalForm.weight}
              onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setVitalForm({ ...vitalForm, weight: v }); }}
              className="input-field"
              placeholder="e.g., 70"
            />
          </div>
          <div className="flex space-x-3 justify-end pt-4">
            <button type="button" onClick={handleCloseVitalsModal} className="btn-secondary" disabled={vitalsSubmitting}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={vitalsSubmitting}>
              {vitalsSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {editingVital ? 'Updating...' : 'Adding...'}
                </span>
              ) : (
                editingVital ? 'Update Vitals' : 'Add Vitals'
              )}
            </button>
          </div>
        </form>
      </Modal>

      
    </div>
  );
}
