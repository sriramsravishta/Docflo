import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CreditCard as Edit,
  Upload,
  ExternalLink,
  Send,
  Mic,
  Square,
  Play,
  Pause,
  Download,
  MessageSquare,
  X,
  ChevronDown,
  ChevronRight,
  Plus,
  Save,
  XCircle,
  Trash2,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import {
  getPatientById,
  updatePatient,
  createPreConsult,
  updatePreConsult,
  createFollowUp,
  createConsult,
  updateConsult,
  getLatestSummary,
  getConsults,
  getConsultMedicines,
  createConsultMedicine,
  updateConsultMedicine,
  deleteConsultMedicine,
  searchMedicines,
  updateConsultSummary,
  completeTodaysAppointmentByPatientAndDoctor,
} from '../lib/database';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function PatientProfile() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Patient data
  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Summary data
  const [latestSummary, setLatestSummary] = useState<any>(null);
  const [consultations, setConsultations] = useState<any[]>([]);
  // ✅ NEW: check if any consult is still processing (cards refresher should run)
const hasAnyProcessingConsult = (list: any[]) => {
  return (list || []).some((c) => !isConsultProcessed(c));
};
  const [activeTab, setActiveTab] = useState('history');

  // UI states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [selectedConsult, setSelectedConsult] = useState<any>(null);

  const [isEditingConsult, setIsEditingConsult] = useState(false);
  const [editedConsult, setEditedConsult] = useState<any>(null);

  // NEW: editable text for fields that were showing JSON in edit mode
  const [editedDiagnosisText, setEditedDiagnosisText] = useState('');
  const [editedTreatmentText, setEditedTreatmentText] = useState('');
  const [editedInvestigationsText, setEditedInvestigationsText] = useState('');

  const [consultMedicines, setConsultMedicines] = useState<any[]>([]);
  const [medicineSearchResults, setMedicineSearchResults] = useState<any[]>([]);
  const [searchingMedicine, setSearchingMedicine] = useState(false);

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  // ✅ NEW: UI tick for progress loaders (updates every second)
const [uiNow, setUiNow] = useState(Date.now());

useEffect(() => {
  const t = setInterval(() => setUiNow(Date.now()), 1000);
  return () => clearInterval(t);
}, []);

// ✅ NEW: Keep consultation cards auto-updated (even when popup is NOT opened)
useEffect(() => {
  if (!patientId) return;

  const channel = supabase
    .channel(`consult-watch-patient-${patientId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'consult',
        filter: `patient_id=eq.${patientId}`,
      },
      (payload) => {
        const updated = payload.new as any;

        // ✅ Update cards list
        setConsultations((prev) =>
          prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
        );

        // ✅ If popup is open for this consult, update popup too
        setSelectedConsult((prev: any) =>
          prev?.id === updated.id ? { ...prev, ...updated } : prev
        );
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [patientId]);


  // Form states
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    diagnosis: true,
    chiefComplaints: true,
    treatmentSuggested: true,
    medications: false,
    investigations: false,
    history: false,
    followupRecommendations: false,
    keyPersonalInsights: false,
    flagsForReview: false,
  });

  const [editForm, setEditForm] = useState({
    name: '',
    age: '',
    phone: '',
    case: '',
    gender: 'Male',
  });

  const [documentsToUpload, setDocumentsToUpload] = useState<File[]>([]);
  const [confirmationType, setConfirmationType] = useState<'preConsult' | 'followUp' | 'documents'>('preConsult');
  const [uploadError, setUploadError] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (patientId) {
      loadPatientData();
    }
  }, [patientId]);

  // ✅ NEW: Auto-refresh CONSULTATION CARDS until all are processed
useEffect(() => {
  if (!patientId) return;

  // If nothing is processing, no need to poll
  if (!hasAnyProcessingConsult(consultations)) return;

  const interval = setInterval(async () => {
    try {
      // Fetch latest consult rows (only fields needed for "Processed" status)
      const { data, error } = await supabase
        .from('consult')
        .select('id, consult_summary_final, created_at')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(25);

      if (error) {
        console.error('Error polling consult cards:', error);
        return;
      }

      if (!data || data.length === 0) return;

      // Merge into existing consultations list
      setConsultations((prev) =>
        prev.map((c) => {
          const updated = data.find((d: any) => d.id === c.id);
          return updated ? { ...c, ...updated } : c;
        })
      );
    } catch (e) {
      console.error('Error polling consult cards (catch):', e);
    }
  }, 3000); // every 3 seconds

  return () => clearInterval(interval);
}, [patientId, consultations]);


  useEffect(() => {
    if (selectedConsult && selectedConsult.id) {
      loadConsultMedicines(selectedConsult.id);
    }
    // close medicine dropdown whenever consult changes
    setMedicineSearchResults([]);
  }, [selectedConsult]);

  useEffect(() => {
  if (!selectedConsult?.id) return;

  const channel = supabase
    .channel(`consult-watch-${selectedConsult.id}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'consult',
        filter: `id=eq.${selectedConsult.id}`,
      },
      async (payload) => {
        // ✅ payload.new has the updated row
        const updated = payload.new as any;

        // ✅ Update popup consult immediately
        setSelectedConsult((prev: any) => (prev?.id === updated?.id ? { ...prev, ...updated } : prev));

        // ✅ Update cards list immediately (so status flips to Processed)
        setConsultations((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));

        // (optional) if you want full refresh too, keep this:
        // await loadPatientData();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [selectedConsult?.id]);

useEffect(() => {
  if (!selectedConsult?.id) return;

  // ✅ If already processed, stop polling
  if (isConsultProcessed(selectedConsult)) return;

  const interval = setInterval(async () => {
    const { data, error } = await supabase
      .from('consult')
      .select('id, consult_summary_final, created_at')
      .eq('id', selectedConsult.id)
      .single();

    if (!error && data) {
      // ✅ Update popup
      setSelectedConsult((prev: any) => (prev?.id === data.id ? { ...prev, ...data } : prev));

      // ✅ Update cards list
      setConsultations((prev) => prev.map((c) => (c.id === data.id ? { ...c, ...data } : c)));
    }
  }, 3000); // poll every 3 seconds

  return () => clearInterval(interval);
}, [selectedConsult?.id, selectedConsult?.consult_summary_final]);


  const loadPatientData = async () => {
    try {
      setLoading(true);
      const [patientData, summaryData, consultsData] = await Promise.all([
        getPatientById(patientId!),
        getLatestSummary(patientId!),
        getConsults(patientId!),
      ]);

      setPatient(patientData);
      setLatestSummary(summaryData);
      setConsultations(consultsData);

      if (patientData) {
        setEditForm({
          name: patientData.name,
          age: patientData.age.toString(),
          phone: patientData.phone,
          case: patientData.case || '',
          gender: patientData.gender,
        });
      }

      return { patientData, summaryData, consultsData };
    } catch (error) {
      console.error('Error loading patient data:', error);
      return { patientData: null, summaryData: null, consultsData: [] as any[] };
    } finally {
      setLoading(false);
    }
  };

  const loadConsultMedicines = async (consultId: string) => {
    try {
      const medicines = await getConsultMedicines(consultId);
      setConsultMedicines(medicines);
    } catch (error) {
      console.error('Error loading consult medicines:', error);
    }
  };

  const handleEditPatient = async () => {
    try {
      await updatePatient(patientId!, {
        name: editForm.name,
        age: parseInt(editForm.age),
        phone: editForm.phone,
        case: editForm.case || null,
        gender: editForm.gender,
      });
      setShowEditModal(false);
      await loadPatientData();
    } catch (error) {
      console.error('Error updating patient:', error);
      alert('Failed to update patient');
    }
  };

  // -------------------------
  // Helpers: JSON safe parse + pretty/editable conversions
  // -------------------------
  const safeJsonParse = (value: any) => {
    if (typeof value !== 'string') return null;
    const t = value.trim();
    if (!(t.startsWith('{') || t.startsWith('['))) return null;
    try {
      return JSON.parse(t);
    } catch {
      return null;
    }
  };

  const bulletify = (arr: any[]) => arr.map((x) => `- ${String(x ?? '').trim()}`).filter((l) => l.trim() !== '-');

  const diagnosisToEditableText = (diagnosis: any) => {
    const parsed = safeJsonParse(diagnosis);
    const d = parsed ?? diagnosis;

    if (!d) return '';
    if (typeof d === 'string') return d;

    const prov = Array.isArray(d.provisional) ? d.provisional : [];
    const keyf = Array.isArray(d.key_findings) ? d.key_findings : [];

    const lines: string[] = [];
    if (prov.length) {
      lines.push('Provisional:');
      lines.push(...bulletify(prov));
      lines.push('');
    }
    if (keyf.length) {
      lines.push('Key Findings:');
      lines.push(...bulletify(keyf));
      lines.push('');
    }

    return lines.join('\n').trim() || '';
  };

  const parseSectionBullets = (lines: string[], startIdx: number) => {
    const items: string[] = [];
    for (let i = startIdx; i < lines.length; i++) {
      const l = lines[i].trim();
      if (!l) continue;
      if (/^(provisional|key findings|immediate plan|contingent plan|notes|ordered)\s*:/i.test(l)) break;
      if (/^[-•*]\s+/.test(l)) items.push(l.replace(/^[-•*]\s+/, '').trim());
      else items.push(l); // allow plain lines too
    }
    return items.filter(Boolean);
  };

  const diagnosisTextToJson = (text: string, fallbackOriginal: any) => {
    const raw = text.trim();
    if (!raw) return fallbackOriginal ?? '';

    const lines = raw.split('\n').map((l) => l.trim());
    const provIdx = lines.findIndex((l) => /^provisional\s*:/i.test(l));
    const keyIdx = lines.findIndex((l) => /^key findings\s*:/i.test(l));

    const provisional = provIdx >= 0 ? parseSectionBullets(lines, provIdx + 1) : [];
    const key_findings = keyIdx >= 0 ? parseSectionBullets(lines, keyIdx + 1) : [];

    if (provisional.length || key_findings.length) {
      return {
        ...(provisional.length ? { provisional } : {}),
        ...(key_findings.length ? { key_findings } : {}),
      };
    }

    // If user just typed bullets without headings, store as string to avoid bad parsing
    return raw;
  };

  const treatmentToEditableText = (treatment: any) => {
    const parsed = safeJsonParse(treatment);
    const t = parsed ?? treatment;

    if (!t) return '';
    if (typeof t === 'string') return t;

    const immediate = Array.isArray(t.immediate_plan) ? t.immediate_plan : [];
    const contingent = Array.isArray(t.contingent_plan) ? t.contingent_plan : [];

    const lines: string[] = [];
    if (immediate.length) {
      lines.push('Immediate Plan:');
      lines.push(...bulletify(immediate));
      lines.push('');
    }
    if (contingent.length) {
      lines.push('Contingent Plan:');
      lines.push(...bulletify(contingent));
      lines.push('');
    }

    return lines.join('\n').trim() || '';
  };

  const treatmentTextToJson = (text: string, fallbackOriginal: any) => {
    const raw = text.trim();
    if (!raw) return fallbackOriginal ?? '';

    const lines = raw.split('\n').map((l) => l.trim());
    const immIdx = lines.findIndex((l) => /^immediate plan\s*:/i.test(l));
    const conIdx = lines.findIndex((l) => /^contingent plan\s*:/i.test(l));

    const immediate_plan = immIdx >= 0 ? parseSectionBullets(lines, immIdx + 1) : [];
    const contingent_plan = conIdx >= 0 ? parseSectionBullets(lines, conIdx + 1) : [];

    if (immediate_plan.length || contingent_plan.length) {
      return {
        ...(immediate_plan.length ? { immediate_plan } : {}),
        ...(contingent_plan.length ? { contingent_plan } : {}),
      };
    }

    return raw;
  };

  const investigationsToEditableText = (investigations: any) => {
    const parsed = safeJsonParse(investigations);
    const inv = parsed ?? investigations;

    if (!inv) return '';
    if (typeof inv === 'string') return inv;

    const ordered = Array.isArray(inv.ordered) ? inv.ordered : [];
    const notes = inv.notes ? String(inv.notes) : '';

    const lines: string[] = [];
    if (notes) {
      lines.push('Notes:');
      lines.push(notes);
      lines.push('');
    }
    if (ordered.length) {
      lines.push('Ordered:');
      ordered.forEach((o: any) => {
        const name = o?.name ? String(o.name) : '-';
        const b = o?.body_part_or_type ? ` — ${String(o.body_part_or_type)}` : '';
        const p = o?.priority ? ` (Priority: ${String(o.priority)})` : '';
        lines.push(`- ${name}${b}${p}`.trim());
      });
      lines.push('');
    }
    return lines.join('\n').trim();
  };

  const investigationsTextToJson = (text: string, fallbackOriginal: any) => {
    const raw = text.trim();
    if (!raw) return fallbackOriginal ?? '';

    const lines = raw.split('\n').map((l) => l.trim());
    const notesIdx = lines.findIndex((l) => /^notes\s*:/i.test(l));
    const ordIdx = lines.findIndex((l) => /^ordered\s*:/i.test(l));

    let notes = '';
    if (notesIdx >= 0) {
      const after = lines.slice(notesIdx + 1, ordIdx >= 0 ? ordIdx : lines.length).filter(Boolean);
      notes = after.join('\n').trim();
    }

    let ordered: any[] = [];
    if (ordIdx >= 0) {
      const items = parseSectionBullets(lines, ordIdx + 1);
      ordered = items
        .map((item) => {
          let priority: string | null = null;
          const pr = item.match(/\(.*priority\s*:\s*([^)]+)\)/i);
          if (pr?.[1]) priority = pr[1].trim();

          const cleaned = item.replace(/\(.*priority\s*:\s*[^)]+\)/gi, '').trim();

          const parts = cleaned.split('—').map((p) => p.trim()).filter(Boolean);
          const name = parts[0] || cleaned;
          const body_part_or_type = parts.length > 1 ? parts.slice(1).join(' — ') : '';

          return {
            name,
            ...(body_part_or_type ? { body_part_or_type } : {}),
            ...(priority ? { priority } : {}),
          };
        })
        .filter((o) => o.name);
    }

    if (notes || ordered.length) {
      return {
        ...(notes ? { notes } : {}),
        ...(ordered.length ? { ordered } : {}),
      };
    }

    return raw;
  };

  // ✅ CHANGE #2: Normalize consult_summary_final (object OR JSON string)
  const getConsultSummary = (consult: any) => {
  const raw = consult?.consult_summary_final;
  if (!raw) return null;

  let obj: any = null;

  if (typeof raw === 'string') {
    const parsed = safeJsonParse(raw);
    obj = parsed ?? null;
  } else if (typeof raw === 'object') {
    obj = raw;
  }

  if (!obj) return null;

  // ✅ treat empty object {} as "not processed"
  if (typeof obj === 'object' && !Array.isArray(obj)) {
    if (Object.keys(obj).length === 0) return null;
  }

  return obj;
};


  const handleEditConsult = () => {
    const summary = getConsultSummary(selectedConsult) || {};
    setIsEditingConsult(true);
    setEditedConsult({
      ...summary,
      id: selectedConsult.id,
    });

    // ✅ CHANGE: show readable text (not JSON) in edit mode
    setEditedDiagnosisText(diagnosisToEditableText(summary.diagnosis));
    setEditedTreatmentText(treatmentToEditableText(summary.treatment_suggested));
    setEditedInvestigationsText(investigationsToEditableText(summary.investigations));

    // close any open dropdown
    setMedicineSearchResults([]);
  };

  // ✅ CHANGE: Cancel should exit edit mode but keep popup open (show view mode)
  const handleCancelEdit = () => {
    setIsEditingConsult(false);
    setEditedConsult(null);
    setEditedDiagnosisText('');
    setEditedTreatmentText('');
    setEditedInvestigationsText('');
    setMedicineSearchResults([]);
  };

  // ✅ CHANGE: Save should exit edit mode but keep popup open (show view mode)
  const handleSaveConsult = async () => {
    try {
      if (!selectedConsult) return;

      const originalSummary = getConsultSummary(selectedConsult) || {};

      const toSave = {
        ...editedConsult,
        diagnosis: diagnosisTextToJson(editedDiagnosisText, originalSummary.diagnosis),
        treatment_suggested: treatmentTextToJson(editedTreatmentText, originalSummary.treatment_suggested),
        investigations: investigationsTextToJson(editedInvestigationsText, originalSummary.investigations),
      };

      // do not persist internal id into JSON
      const { id, ...payload } = toSave || {};

      await updateConsultSummary(selectedConsult.id, payload);

      // Refresh lists + keep this consult selected
      const { consultsData } = await loadPatientData();
      const updated = consultsData.find((c: any) => c.id === selectedConsult.id);
      if (updated) setSelectedConsult(updated);

      setIsEditingConsult(false);
      setEditedConsult(null);
      setEditedDiagnosisText('');
      setEditedTreatmentText('');
      setEditedInvestigationsText('');
      setMedicineSearchResults([]);
    } catch (error) {
      console.error('Error saving consultation:', error);
      alert('Failed to save changes');
    }
  };

  const handleAddMedicine = async () => {
    try {
      const newMedicine = await createConsultMedicine({
        consult_id: selectedConsult.id,
        name: '',
        dosage: '',
        frequency: '',
        duration: '',
        route: '',
        instructions: '',
      });
      setConsultMedicines([...consultMedicines, newMedicine]);
    } catch (error) {
      console.error('Error adding medicine:', error);
    }
  };

  const handleUpdateMedicine = async (medicineId: string, updates: any) => {
    try {
      const updatedMedicine = await updateConsultMedicine(medicineId, updates);
      setConsultMedicines(consultMedicines.map((med) => (med.id === medicineId ? updatedMedicine : med)));
    } catch (error) {
      console.error('Error updating medicine:', error);
    }
  };

  const handleDeleteMedicine = async (medicineId: string) => {
    try {
      await deleteConsultMedicine(medicineId);
      setConsultMedicines(consultMedicines.filter((med) => med.id !== medicineId));
      setMedicineSearchResults([]);
    } catch (error) {
      console.error('Error deleting medicine:', error);
    }
  };

  const handleMedicineSearch = async (query: string) => {
    if (query.trim().length < 1) {
      setMedicineSearchResults([]);
      return;
    }

    try {
      setSearchingMedicine(true);
      const results = await searchMedicines(query.trim(), 10);
      setMedicineSearchResults(results);
    } catch (error) {
      console.error('Error searching medicines:', error);
    } finally {
      setSearchingMedicine(false);
    }
  };

 const handleSendPreConsultLink = () => {
  if (!patient || !patient.phone || !user) return;

  const preConsultUrl = `${window.location.origin}/pre-consult/new?docId=${user.id}&patientId=${patientId}`;

  const message = `Hi ${patient.name},\n\nBefore your visit, please upload all your past medical reports/prescriptions here: ${preConsultUrl}\n\nIt helps the doctor see a quick summary of your medical history and treat you better \n\nThank You! \n— Dr Ranga Reddy’s Clinic`;

  let phoneNumber = String(patient.phone).replace(/\D/g, '');
  if (!phoneNumber.startsWith('91') && phoneNumber.length === 10) {
    phoneNumber = `91${phoneNumber}`;
  }

  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

  // Direct open (no popup confirmation modal)
  window.location.href = whatsappUrl;
};


  const handleSendFollowUpLink = () => {
    setConfirmationType('followUp');
    setShowConfirmation(true);
  };

  const handleUploadDocuments = () => {
    setShowDocumentUpload(true);
  };

  // ✅ Do NOT create a pre-consult row on Form open
  const handleOpenForm = async () => {
    try {
      const link = `${window.location.origin}/pre-consult/new?docId=${user!.id}&patientId=${patientId}`;
      window.open(link, '_blank');
    } catch (error) {
      console.error('Error opening pre-consult form:', error);
      alert('Failed to open form');
    }
  };

  // ✅ Do NOT create a pre-consult row on Link generation
  const handleConfirmAction = async () => {
    try {
      if (confirmationType === 'preConsult') {
        const link = `${window.location.origin}/pre-consult/new?docId=${user!.id}&patientId=${patientId}`;
      } else if (confirmationType === 'followUp') {
        const followUp = await createFollowUp(user!.id, patientId!);
        const link = `${window.location.origin}/follow-up/${followUp.id}`;
        alert(`Follow-up link created: ${link}`);
      } else if (confirmationType === 'documents') {
        await confirmDocumentSubmit();
        return;
      }
      setShowConfirmation(false);
    } catch (error) {
      console.error('Error creating link:', error);
      alert('Failed to create link');
    }
  };

  const confirmDocumentSubmit = async () => {
    if (documentsToUpload.length === 0) return;

    try {
      setIsUploading(true);
      setUploadError('');

      // Upload ALL files first before creating any DB records
      const uploadedUrls: string[] = [];

      for (const file of documentsToUpload) {
        const fileName = `${patientId}-${Date.now()}-${file.name}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('pre-consultation-documents')
          .upload(fileName, file, {
            contentType: file.type || 'application/octet-stream',
            upsert: false,
          });

        if (uploadError) {
          console.error('Storage upload error:', uploadError);
          throw new Error('Failed to upload document: ' + file.name);
        }

        const { data: urlData } = supabase.storage.from('pre-consultation-documents').getPublicUrl(uploadData.path);

        uploadedUrls.push(urlData.publicUrl);
      }

      // ONLY AFTER all uploads complete, create DB record with URLs
      const preConsult = await createPreConsult(user!.id, patientId!);
      await updatePreConsult(preConsult.id, {
        documents_uploaded: uploadedUrls,
        status: 'Draft',
      });

      alert('Documents uploaded successfully');
      setShowConfirmation(false);
      handleCloseDocumentUpload();
    } catch (error) {
      console.error('Error uploading documents:', error);
      alert('Failed to upload documents. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCloseDocumentUpload = () => {
    setShowDocumentUpload(false);
    setDocumentsToUpload([]);
    setUploadError('');
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);

      const interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
      (window as any).recordingInterval = interval;
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to start recording. Please check microphone permissions.');
    }
  };

  const handlePauseRecording = () => {
    if (mediaRecorder) {
      if (isPaused) {
        mediaRecorder.resume();
        const interval = setInterval(() => {
          setRecordingTime((prev) => prev + 1);
        }, 1000);
        (window as any).recordingInterval = interval;
      } else {
        mediaRecorder.pause();
        clearInterval((window as any).recordingInterval);
      }
      setIsPaused(!isPaused);
    }
  };

  const handleEndRecording = async () => {
    if (mediaRecorder) {
      setIsRecording(false);
      clearInterval((window as any).recordingInterval);

      const recordingPromise = new Promise<Blob[]>((resolve) => {
        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };

        mediaRecorder.onstop = () => resolve(chunks);
      });

      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }

      try {
        const finalChunks = await recordingPromise;
        let recordingFileUrl = null;

        if (finalChunks.length > 0) {
          const audioBlob = new Blob(finalChunks, { type: 'audio/webm' });
          const fileName = `consultation-${patientId}-${Date.now()}.webm`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('consultation-recordings')
            .upload(fileName, audioBlob, { contentType: 'audio/webm', upsert: false });

          if (uploadError) throw new Error('Failed to upload recording');

          const { data: urlData } = supabase.storage.from('consultation-recordings').getPublicUrl(uploadData.path);
          recordingFileUrl = urlData.publicUrl;
        }

        const consult = await createConsult(user!.id, patientId!, recordingFileUrl || '');

        await updateConsult(consult.id, {
          recording_transcript:
            'Dummy transcription text. Patient reports feeling tired and experiencing headaches for the past week.',
          consult_summary_ai: '',
        });

        try {
  await completeTodaysAppointmentByPatientAndDoctor(patientId!, user!.id);
} catch (error) {
  console.error('Error marking appointment as completed:', error);
}
        await loadPatientData();
      } catch (error) {
        console.error('Error saving consultation:', error);
        alert('Failed to save consultation');
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  // ✅ NEW: Processing helpers (60s estimate)
const ESTIMATED_PROCESS_SECONDS = 60;
const MAX_PROCESS_SECONDS = 300; // ✅ 5 min hard limit

const isConsultProcessed = (consult: any) => {
  const summary = getConsultSummary(consult);
  if (!summary) return false;

  // treat empty object {} as NOT processed
  if (typeof summary === 'object' && Object.keys(summary).length === 0) return false;

  return true;
};

// ✅ NEW: treat as ERROR if still not processed after 5 mins
const isConsultError = (consult: any) => {
  if (isConsultProcessed(consult)) return false;
  const elapsed = getElapsedSeconds(consult);
  return elapsed > MAX_PROCESS_SECONDS;
};



const getElapsedSeconds = (consult: any) => {
  const createdAt = consult?.created_at ? new Date(consult.created_at).getTime() : null;
  if (!createdAt || isNaN(createdAt)) return 0;
  const elapsed = Math.floor((uiNow - createdAt) / 1000);
  return Math.max(0, elapsed);
};

const getProgressPercent = (consult: any) => {
  if (isConsultProcessed(consult)) return 100;
  if (isConsultError(consult)) return 0; // error state, % not meaningful

  const elapsed = getElapsedSeconds(consult);

  // Progress based on 60s estimate, capped at 99
  const pct = Math.floor((elapsed / ESTIMATED_PROCESS_SECONDS) * 100);
  return Math.max(0, Math.min(99, pct));
};



  // ✅ Render timeline summary as bullets when it has "- " lines
  const renderBulletSummary = (text: any) => {
    if (typeof text !== 'string') return <p className="text-gray-800">{String(text)}</p>;

    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const bulletLines = lines
      .filter((l) => l.startsWith('-') || l.startsWith('•'))
      .map((l) => l.replace(/^[-•]\s*/, '').trim())
      .filter(Boolean);

    if (bulletLines.length >= 1 && bulletLines.length === lines.length) {
      return (
        <ul className="list-disc list-inside space-y-1 text-gray-800">
          {bulletLines.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      );
    }

    return <p className="text-gray-800 whitespace-pre-line">{text}</p>;
  };

  const renderTimelineTab = () => {
    const timeline = Array.isArray(latestSummary?.summary?.timeline_of_medical_events)
      ? latestSummary.summary.timeline_of_medical_events
      : [];

    if (timeline.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-500">No timeline events available</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {timeline.map((event: any, index: number) => (
          <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-semibold text-gray-900">{event.event_type}</h4>
              <span className="text-sm text-gray-500">{formatDate(event.event_datetime)}</span>
            </div>
            {event.location && <p className="text-sm text-gray-600 mb-2">{event.location}</p>}
            {renderBulletSummary(event.summary)}
            {event.important_findings && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm text-yellow-800">{event.important_findings}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderDiagnosticTrendsTab = () => {
  const trends = Array.isArray(latestSummary?.summary?.diagnostic_trends)
    ? latestSummary.summary.diagnostic_trends
    : [];

  if (!trends.length) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No diagnostic trends available</p>
      </div>
    );
  }

  // -------- Helpers --------
  const toDayKey = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    // group by day (yyyy-mm-dd)
    return d.toISOString().slice(0, 10);
  };

  const formatColHeader = (dayKey: string) => {
    // dayKey like "2025-10-31"
    const d = new Date(dayKey + "T00:00:00");
    if (isNaN(d.getTime())) return dayKey;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toUpperCase(); // "31 OCT"
  };

  const badgeClass = (label: string) => {
    const t = (label || "").toLowerCase();
    if (t.includes("critical")) return "bg-red-100 text-red-700";
    if (t.includes("high")) return "bg-orange-100 text-orange-700";
    if (t.includes("elevat")) return "bg-amber-100 text-amber-700";
    if (t.includes("uncontrol")) return "bg-orange-100 text-orange-700";
    if (t.includes("normal")) return "bg-green-100 text-green-700";
    if (t.includes("low")) return "bg-blue-100 text-blue-700";
    return "bg-gray-100 text-gray-700";
  };

  // -------- Build columns (unique days across all parameters) --------
  const allDays: string[] = [];
  trends.forEach((p: any) => {
    (p?.measurements || []).forEach((m: any) => {
      if (m?.measurement_datetime) allDays.push(toDayKey(m.measurement_datetime));
    });
  });

  const uniqueDays = Array.from(new Set(allDays)).sort(); // chronological
  // Optional: if you only want latest 3 columns like screenshot:
  // const uniqueDays = Array.from(new Set(allDays)).sort().slice(-3);

  // -------- Build quick lookup: param -> day -> measurement --------
  const valueMap: Record<string, Record<string, any>> = {};
  trends.forEach((p: any) => {
    const key = String(p?.parameter_name || "").trim();
    if (!key) return;

    valueMap[key] = valueMap[key] || {};

    (p?.measurements || []).forEach((m: any) => {
      const day = m?.measurement_datetime ? toDayKey(m.measurement_datetime) : null;
      if (!day) return;

      // if multiple on same day, keep the latest by time
      const existing = valueMap[key][day];
      if (!existing) {
        valueMap[key][day] = m;
      } else {
        const a = new Date(existing.measurement_datetime).getTime();
        const b = new Date(m.measurement_datetime).getTime();
        if (!isNaN(a) && !isNaN(b) && b > a) valueMap[key][day] = m;
      }
    });
  });

  // -------- Interpretation source --------
  // Prefer latest measurement's "clinical_interpretation" if present,
  // else fallback to overall_trend_comment.
  const getInterpretation = (p: any) => {
    const ms = Array.isArray(p?.measurements) ? p.measurements : [];
    const latest = ms
      .filter((m: any) => m?.measurement_datetime)
      .sort(
        (a: any, b: any) =>
          new Date(b.measurement_datetime).getTime() - new Date(a.measurement_datetime).getTime()
      )[0];

    return (
      latest?.clinical_interpretation ||
      p?.overall_trend_comment ||
      ""
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          {/* Header */}
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left text-xs font-semibold tracking-wider text-gray-600 px-4 py-3">
                PARAMETER
              </th>

              {uniqueDays.map((dayKey) => (
                <th
                  key={dayKey}
                  className="text-left text-xs font-semibold tracking-wider text-blue-700 px-4 py-3"
                >
                  {formatColHeader(dayKey)}
                </th>
              ))}

              <th className="text-left text-xs font-semibold tracking-wider text-gray-600 px-4 py-3">
                INTERPRETATION
              </th>
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {trends.map((p: any, idx: number) => {
              const paramName = String(p?.parameter_name || "").trim();
              if (!paramName) return null;

              const interp = String(getInterpretation(p) || "").trim();
              const unit = p?.unit ? String(p.unit) : "";

              return (
                <tr
                  key={paramName + idx}
                  className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}
                >
                  {/* Parameter name */}
                  <td className="px-4 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">
                    {paramName}
                  </td>

                  {/* Value columns */}
                  {uniqueDays.map((dayKey) => {
                    const m = valueMap?.[paramName]?.[dayKey];
                    const val = m?.value_raw ?? "";
                    const display =
                      val === "" || val === null || val === undefined
                        ? "—"
                        : unit && typeof val === "number"
                        ? `${val} ${unit}`
                        : unit && typeof val === "string" && !val.includes(unit)
                        ? `${val} ${unit}`
                        : String(val);

                    return (
                      <td key={dayKey} className="px-4 py-4 text-sm text-gray-900 whitespace-nowrap">
                        {display}
                      </td>
                    );
                  })}

                  {/* Interpretation badge */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    {interp ? (
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${badgeClass(interp)}`}>
                        {interp}
                      </span>
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
    </div>
  );
};


  const renderMedicationsTab = () => {
    const medications = latestSummary?.summary?.medications || {};
    const currentMeds = medications.current || [];
    const pastMeds = medications.past || [];

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Current Medications</h3>
          {currentMeds.length === 0 ? (
            <p className="text-gray-500">No current medications</p>
          ) : (
            <div className="space-y-3">
              {currentMeds.map((med: any, index: number) => (
                <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-gray-900">{med.drug_name}</h4>
                      <p className="text-gray-600">
                        {med.dose} • {med.frequency}
                      </p>
                      {med.indication && <p className="text-sm text-gray-500 mt-1">{med.indication}</p>}
                    </div>
                    <span className="text-sm text-gray-500">{med.duration_or_quantity}</span>
                  </div>
                  {med.notes && <p className="text-sm text-gray-600 mt-2">{med.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {pastMeds.length > 0 && (
  <div>
    <h3 className="text-lg font-semibold text-gray-900 mb-3">Past Medications</h3>
    <div className="space-y-3">
      {pastMeds.map((med: any, index: number) => (
        <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-medium text-gray-700">{med.drug_name}</h4>
              <p className="text-gray-600">
                {med.dose} • {med.frequency}
              </p>
              {med.indication && <p className="text-sm text-gray-500 mt-1">{med.indication}</p>}
            </div>
            <span className="text-sm text-gray-500">{med.duration_or_quantity}</span>
          </div>
          {med.notes && <p className="text-sm text-gray-600 mt-2">{med.notes}</p>}
        </div>
      ))}
    </div>
  </div>
)}

      </div>
    );
  };

  const getConsultPreviewText = (consult: any) => {
    const summary = getConsultSummary(consult);
    if (!summary) return 'Consultation summary';

    if (typeof summary.diagnosis === 'string' && summary.diagnosis.trim()) return summary.diagnosis;
    if (summary.diagnosis && typeof summary.diagnosis === 'object') {
      const first = Array.isArray(summary.diagnosis.provisional) ? summary.diagnosis.provisional[0] : null;
      if (first) return first;
    }
    if (Array.isArray(summary.chief_complaints) && summary.chief_complaints.length > 0) return summary.chief_complaints[0];
    if (typeof summary.history === 'string' && summary.history.trim()) return 'History available';
    return 'Consultation summary';
  };

  const renderPastSummariesTab = () => {
    if (consultations.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-500">No past consultations available</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {consultations.map((consult: any) => (
          <div
            key={consult.id}
            onClick={() => setSelectedConsult(consult)}
            className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start gap-3">
  <div className="min-w-0">
    <p className="font-medium text-gray-900">{formatDate(consult.created_at)}</p>
    <p className="text-sm text-gray-600 mt-1">{getConsultPreviewText(consult)}</p>
  </div>

  {/* ✅ NEW: Processing / Processed indicator */}
  <div className="flex flex-col items-end shrink-0">
    {isConsultProcessed(consult) ? (
  <div className="flex items-center gap-2 text-sm text-[#024CDB]">
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-50">
      ✓
    </span>
    <span className="font-medium">Processed</span>
  </div>
) : isConsultError(consult) ? (
  <div className="flex items-center gap-2 text-sm text-red-600">
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-50">
      !
    </span>
    <span className="font-medium">Error</span>
  </div>
) : (
  <div className="flex items-center gap-3">
    <div className="relative w-9 h-9">
      <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
        <path
          className="text-gray-200"
          d="M18 2.0845
             a 15.9155 15.9155 0 0 1 0 31.831
             a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          className="text-[#024CDB]"
          d="M18 2.0845
             a 15.9155 15.9155 0 0 1 0 31.831
             a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray={`${getProgressPercent(consult)}, 100`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-gray-700">
        {getProgressPercent(consult)}%
      </div>
    </div>

    <div className="text-right">
      <p className="text-xs font-medium text-gray-700">Processing</p>
      <p className="text-[11px] text-gray-500">{getProgressPercent(consult)}% completed</p>
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

  // ✅ PDF helpers (kept as-is)
  const escapeHtml = (s: any) => {
    const str = String(s ?? '');
    return str
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  };

  const toHtmlList = (items: any[]) => {
    return `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;
  };

  const generatePDFHTMLContent = (consult: any) => {
    const summary = getConsultSummary(consult);
    if (!summary) return '<p>No consultation summary available.</p>';

    let content = `
      <div class="header">
        <h1>CONSULTATION SUMMARY</h1>
        <p><strong>Patient:</strong> ${escapeHtml(patient?.name)}</p>
        <p><strong>Date:</strong> ${escapeHtml(formatDate(consult.created_at))}</p>
        <p><strong>Doctor:</strong> ${escapeHtml(user?.user_metadata?.name || user?.email || 'Doctor')}</p>
      </div>
    `;

    if (summary.diagnosis) {
      if (typeof summary.diagnosis === 'string') {
        content += `
          <div class="section">
            <h2>DIAGNOSIS</h2>
            <p>${escapeHtml(summary.diagnosis)}</p>
          </div>
        `;
      } else if (typeof summary.diagnosis === 'object') {
        const prov = Array.isArray(summary.diagnosis.provisional) ? summary.diagnosis.provisional : [];
        const keyf = Array.isArray(summary.diagnosis.key_findings) ? summary.diagnosis.key_findings : [];
        content += `
          <div class="section">
            <h2>DIAGNOSIS</h2>
            ${prov.length ? `<h3>Provisional</h3>${toHtmlList(prov)}` : ''}
            ${keyf.length ? `<h3>Key Findings</h3>${toHtmlList(keyf)}` : ''}
          </div>
        `;
      }
    }

    if (summary.history) {
      content += `
        <div class="section">
          <h2>HISTORY</h2>
          <p>${escapeHtml(summary.history)}</p>
        </div>
      `;
    }

    if (summary.chief_complaints) {
      if (Array.isArray(summary.chief_complaints)) {
        content += `
          <div class="section">
            <h2>CHIEF COMPLAINTS</h2>
            ${toHtmlList(summary.chief_complaints)}
          </div>
        `;
      } else {
        content += `
          <div class="section">
            <h2>CHIEF COMPLAINTS</h2>
            <p>${escapeHtml(summary.chief_complaints)}</p>
          </div>
        `;
      }
    }

    if (summary.treatment_suggested) {
      if (typeof summary.treatment_suggested === 'string') {
        content += `
          <div class="section">
            <h2>TREATMENT SUGGESTED</h2>
            <p>${escapeHtml(summary.treatment_suggested)}</p>
          </div>
        `;
      } else if (typeof summary.treatment_suggested === 'object') {
        const immediate = Array.isArray(summary.treatment_suggested.immediate_plan)
          ? summary.treatment_suggested.immediate_plan
          : [];
        const contingent = Array.isArray(summary.treatment_suggested.contingent_plan)
          ? summary.treatment_suggested.contingent_plan
          : [];
        content += `
          <div class="section">
            <h2>TREATMENT SUGGESTED</h2>
            ${immediate.length ? `<h3>Immediate Plan</h3>${toHtmlList(immediate)}` : ''}
            ${contingent.length ? `<h3>Contingent Plan</h3>${toHtmlList(contingent)}` : ''}
          </div>
        `;
      }
    }

   // ✅ FIX: Use normalized meds (summary.medications OR consultMedicines fallback)
const pdfMeds = getViewModeMedicines(summary);

if (Array.isArray(pdfMeds) && pdfMeds.length > 0) {
  content += `
    <div class="section">
      <h2>MEDICATIONS</h2>
      <table class="table">
        <thead>
          <tr>
            <th>Name</th><th>Dosage</th><th>Route</th><th>Frequency</th><th>Duration</th><th>Purpose</th>
          </tr>
        </thead>
        <tbody>
          ${pdfMeds
            .map(
              (m: any) => `
            <tr>
              <td>${escapeHtml(m?.name || '-')}</td>
              <td>${escapeHtml(m?.dosage || '-')}</td>
              <td>${escapeHtml(m?.route || '-')}</td>
              <td>${escapeHtml(m?.frequency || '-')}</td>
              <td>${escapeHtml(m?.duration || '-')}</td>
              <td>${escapeHtml(m?.purpose || '-')}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}


    if (summary.investigations && typeof summary.investigations === 'object') {
      const ordered = Array.isArray(summary.investigations.ordered) ? summary.investigations.ordered : [];
      const notes = summary.investigations.notes;
      if (ordered.length || notes) {
        content += `
          <div class="section">
            <h2>INVESTIGATIONS</h2>
            ${
              ordered.length
                ? `<h3>Ordered</h3>
                   <ul>
                     ${ordered
                       .map(
                         (inv: any) =>
                           `<li><strong>${escapeHtml(inv?.name || '-')}</strong>${
                             inv?.body_part_or_type ? ` — ${escapeHtml(inv.body_part_or_type)}` : ''
                           }${inv?.priority ? ` (Priority: ${escapeHtml(inv.priority)})` : ''}</li>`
                       )
                       .join('')}
                   </ul>`
                : ''
            }
            ${notes ? `<h3>Notes</h3><p>${escapeHtml(notes)}</p>` : ''}
          </div>
        `;
      }
    }

    if (summary.followup_recommendations) {
      content += `
        <div class="section">
          <h2>FOLLOW-UP RECOMMENDATIONS</h2>
          ${
            Array.isArray(summary.followup_recommendations)
              ? toHtmlList(summary.followup_recommendations)
              : `<p>${escapeHtml(summary.followup_recommendations)}</p>`
          }
        </div>
      `;
    }

    if (summary.key_personal_insights) {
      content += `
        <div class="section">
          <h2>KEY PERSONAL INSIGHTS</h2>
          ${
            Array.isArray(summary.key_personal_insights)
              ? toHtmlList(summary.key_personal_insights)
              : `<p>${escapeHtml(summary.key_personal_insights)}</p>`
          }
        </div>
      `;
    }

    if (Array.isArray(summary.flags_for_review) && summary.flags_for_review.length > 0) {
      content += `
        <div class="section">
          <h2>FLAGS FOR REVIEW</h2>
          ${toHtmlList(summary.flags_for_review)}
        </div>
      `;
    }

    return content;
  };

  const handleDownloadPDF = () => {
    if (!selectedConsult) return;
   

    const htmlContent = generatePDFHTMLContent(selectedConsult);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up blocked. Please allow pop-ups to download the PDF.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <title>Consultation Summary</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; line-height: 1.6; color: #111; }
          h1 { font-size: 20px; margin: 0 0 8px 0; border-bottom: 2px solid #111; padding-bottom: 8px; }
          h2 { font-size: 14px; margin: 18px 0 8px 0; color: #333; }
          h3 { font-size: 12px; margin: 12px 0 6px 0; color: #444; }
          p { margin: 6px 0; }
          ul { margin: 6px 0 6px 18px; padding: 0; }
          .header { margin-bottom: 18px; }
          .section { margin-bottom: 14px; }
          .table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          .table th, .table td { border: 1px solid #ddd; padding: 8px; vertical-align: top; font-size: 12px; }
          .table th { background: #f3f4f6; text-align: left; }
          @page { margin: 12mm; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        ${htmlContent}
        <script>
          setTimeout(function () { window.focus(); window.print(); }, 300);
          window.onafterprint = function () { window.close(); };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleSendWhatsApp = () => {
    if (!selectedConsult || !patient) return;

    const doctorName = user?.user_metadata?.name || user?.email || 'Doctor';
    const consultDate = formatDate(selectedConsult.created_at);
    const message = `Hi ${patient.name}, here is your consultation summary for your visit with Dr ${doctorName} on ${consultDate}.`;

    let phoneNumber = patient.phone.replace(/\D/g, '');
    if (!phoneNumber.startsWith('91') && phoneNumber.length === 10) {
      phoneNumber = '91' + phoneNumber;
    }

    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Helper function to render accordion sections
  const renderAccordionSection = (title: string, key: string, content: React.ReactNode) => {
    const isExpanded = expandedSections[key];

    return (
      <div className="border-b border-gray-200 last:border-b-0">
        <button
          onClick={() => setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }))}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
        >
          <h3 className="font-semibold text-gray-900">{title}</h3>
          {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
        </button>
        {isExpanded && <div className="px-4 pb-4">{content}</div>}
      </div>
    );
  };

  // Helper function to render diagnosis
  const renderDiagnosis = (diagnosis: any) => {
    const parsed = safeJsonParse(diagnosis);
    const d = parsed ?? diagnosis;

    if (typeof d === 'string') return <p className="text-gray-800 whitespace-pre-line">{d}</p>;

    if (typeof d === 'object' && d !== null) {
      const hasProvisional = d.provisional && Array.isArray(d.provisional) && d.provisional.length > 0;
      const hasKeyFindings = d.key_findings && Array.isArray(d.key_findings) && d.key_findings.length > 0;

      if (!hasProvisional && !hasKeyFindings) return <p className="text-gray-800">No detailed diagnosis available</p>;

      return (
        <div className="space-y-3">
          {hasProvisional && (
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Provisional Diagnosis</h4>
              <ul className="list-disc list-inside space-y-1">
                {d.provisional.map((item: string, idx: number) => (
                  <li key={idx} className="text-gray-800">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {hasKeyFindings && (
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Key Findings</h4>
              <ul className="list-disc list-inside space-y-1">
                {d.key_findings.map((item: string, idx: number) => (
                  <li key={idx} className="text-gray-800">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    return <p className="text-gray-800">No detailed diagnosis available</p>;
  };

  // Helper function to render array/string content
  const renderArrayContent = (content: any) => {
    const parsed = safeJsonParse(content);
    const c = parsed ?? content;

    if (typeof c === 'string') return <p className="text-gray-800 whitespace-pre-line">{c}</p>;

    if (Array.isArray(c)) {
      return (
        <ul className="list-disc list-inside space-y-1">
          {c.map((item: string, idx: number) => (
            <li key={idx} className="text-gray-800">
              {item}
            </li>
          ))}
        </ul>
      );
    }

    // If object but not expected, show pretty-ish text instead of raw JSON
    try {
      return <p className="text-gray-800 whitespace-pre-line">{JSON.stringify(c, null, 2)}</p>;
    } catch {
      return <p className="text-gray-800">{String(c)}</p>;
    }
  };

  // ✅ CHANGE: Treatment suggested should NOT display raw JSON in view mode
  const renderTreatmentSuggested = (treatment: any) => {
    const parsed = safeJsonParse(treatment);
    const t = parsed ?? treatment;

    if (typeof t === 'string') return <p className="text-gray-800 whitespace-pre-line">{t}</p>;
    if (!t || typeof t !== 'object') return <p className="text-gray-800">No treatment recorded</p>;

    const immediate = Array.isArray(t.immediate_plan) ? t.immediate_plan : [];
    const contingent = Array.isArray(t.contingent_plan) ? t.contingent_plan : [];

    if (!immediate.length && !contingent.length) return <p className="text-gray-800">No treatment recorded</p>;

    return (
      <div className="space-y-3">
        {immediate.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Immediate Plan</h4>
            <ul className="list-disc list-inside space-y-1">
              {immediate.map((item: string, idx: number) => (
                <li key={idx} className="text-gray-800">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
        {contingent.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Contingent Plan</h4>
            <ul className="list-disc list-inside space-y-1">
              {contingent.map((item: string, idx: number) => (
                <li key={idx} className="text-gray-800">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  // Helper function to render medications (view popup - unchanged)
  const renderMedications = (medications: any[]) => {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-300 px-3 py-2 text-left font-medium text-gray-700">Name</th>
              <th className="border border-gray-300 px-3 py-2 text-left font-medium text-gray-700">Dosage</th>
              <th className="border border-gray-300 px-3 py-2 text-left font-medium text-gray-700">Route</th>
              <th className="border border-gray-300 px-3 py-2 text-left font-medium text-gray-700">Frequency</th>
              <th className="border border-gray-300 px-3 py-2 text-left font-medium text-gray-700">Duration</th>
              <th className="border border-gray-300 px-3 py-2 text-left font-medium text-gray-700">Purpose</th>
            </tr>
          </thead>
          <tbody>
            {medications.map((med: any, idx: number) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="border border-gray-300 px-3 py-2 text-gray-800">{med.name || '-'}</td>
                <td className="border border-gray-300 px-3 py-2 text-gray-800">{med.dosage || '-'}</td>
                <td className="border border-gray-300 px-3 py-2 text-gray-800">{med.route || '-'}</td>
                <td className="border border-gray-300 px-3 py-2 text-gray-800">{med.frequency || '-'}</td>
                <td className="border border-gray-300 px-3 py-2 text-gray-800">{med.duration || '-'}</td>
                <td className="border border-gray-300 px-3 py-2 text-gray-800">{med.purpose || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

const renderHistoryTab = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* LEFT: 2 parts (Diagnostic Trends + Timeline) */}
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Diagnostic Trends</h3>
          {renderDiagnosticTrendsTab()}
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Timeline</h3>
          {renderTimelineTab()}
        </div>
      </div>

      {/* RIGHT: 1 part (Medications) */}
      <div className="lg:col-span-1">
        
        {renderMedicationsTab()}
      </div>
    </div>
  );
};


  
  // ✅ NEW: Normalize meds for VIEW mode (prefer summary.medications, else consultMedicines)
const getViewModeMedicines = (summary: any) => {
  // 1) If AI summary has medications array, use it
  if (Array.isArray(summary?.medications) && summary.medications.length > 0) {
    return summary.medications.map((m: any) => ({
      name: m?.name || m?.drug_name || '',
      dosage: m?.dosage || m?.dose || '',
      route: m?.route || '',
      frequency: m?.frequency || '',
      duration: m?.duration || m?.duration_or_quantity || '',
      purpose: m?.purpose || m?.indication || '',
    }));
  }

  // 2) Else fallback to consult_medicine table (edit mode source)
  if (Array.isArray(consultMedicines) && consultMedicines.length > 0) {
    return consultMedicines.map((m: any) => ({
      name: m?.name || '',
      dosage: m?.dosage || '',
      route: m?.route || '',
      frequency: m?.frequency || '',
      duration: m?.duration || '',
      purpose: m?.instructions || '', // use instructions as purpose column fallback
    }));
  }

  return [];
};


  // ✅ CHANGE: Investigations should NOT display raw JSON in view mode
  const renderInvestigations = (investigations: any) => {
    const parsed = safeJsonParse(investigations);
    const inv = parsed ?? investigations;

    if (typeof inv === 'string') return <p className="text-gray-800 whitespace-pre-line">{inv}</p>;
    if (!inv || typeof inv !== 'object') return <p className="text-gray-800">No investigations recorded</p>;

    const ordered = Array.isArray(inv.ordered) ? inv.ordered : [];
    const notes = inv.notes;

    if (!ordered.length && !notes) return <p className="text-gray-800">No investigations recorded</p>;

    return (
      <div className="space-y-3">
        {ordered.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Ordered Investigations</h4>
            <div className="space-y-2">
              {ordered.map((o: any, idx: number) => (
                <div key={idx} className="bg-gray-50 border border-gray-200 rounded p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="font-medium text-gray-900">{o.name}</h5>
                      {o.body_part_or_type && <p className="text-sm text-gray-600">{o.body_part_or_type}</p>}
                    </div>
                    {o.priority && (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-gray-200 text-gray-700">{o.priority}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {notes && (
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Notes</h4>
            <p className="text-gray-800 whitespace-pre-line">{String(notes)}</p>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar showBack />
        <div className="max-w-5xl mx-auto px-4 py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading patient data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar showBack />
        <div className="max-w-5xl mx-auto px-4 py-12">
          <div className="text-center">
            <p className="text-gray-600">Patient not found</p>
          </div>
        </div>
      </div>
    );
  }

  
  const tabs = [
  { id: 'history', label: 'History' },
  { id: 'past', label: 'Past Consultations' },
];


  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar showBack />

      <div className="w-full px-4 py-6 xl:px-[160px]">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{patient.name}</h1>
              <div className="text-gray-600 mt-1">
                <span>
                  {patient.age} years • {patient.gender}
                </span>
                {patient.case && <span className="ml-4 text-blue-600">{patient.case}</span>}
              </div>
              <p className="text-gray-600 mt-1">{patient.phone}</p>
              {patient.last_visit_at && <p className="text-sm text-gray-500 mt-1">Last visit: {formatDate(patient.last_visit_at)}</p>}
            </div>
            <button onClick={() => setShowEditModal(true)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Edit className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button onClick={handleUploadDocuments} className="btn-secondary flex items-center justify-center space-x-2 py-3 px-4">
              <Upload className="w-4 h-4" />
              <span className="text-sm font-medium">Upload</span>
            </button>

            <button onClick={handleOpenForm} className="btn-secondary flex items-center justify-center space-x-2 py-3 px-4">
              <ExternalLink className="w-4 h-4" />
              <span className="text-sm font-medium">Form</span>
            </button>

            <button onClick={handleSendPreConsultLink} className="btn-secondary flex items-center justify-center space-x-2 py-3 px-4">
              <Send className="w-4 h-4" />
              <span className="text-sm font-medium">Link</span>
            </button>

            <button
              onClick={isRecording ? handleEndRecording : handleStartRecording}
              className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-lg transition-colors font-medium ${
                isRecording ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-[#024CDB] hover:bg-[#023BA3] text-white'
              }`}
            >
              {isRecording ? (
                <>
                  <Square className="w-4 h-4" />
                  <span className="text-sm font-medium">{formatTime(recordingTime)}</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span className="text-sm font-medium">Start</span>
                </>
              )}
            </button>
          </div>

          {isRecording && (
            <div className="mt-3 flex justify-center">
              <button
                onClick={handlePauseRecording}
                className="flex items-center space-x-2 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                <span className="text-sm">{isPaused ? 'Resume' : 'Pause'}</span>
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <div className="flex overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-gray-900 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
  {activeTab === 'history' && renderHistoryTab()}
  {activeTab === 'past' && renderPastSummariesTab()}
</div>

        </div>
      </div>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Patient">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleEditPatient();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
              <input
                type="number"
                value={editForm.age}
                onChange={(e) => setEditForm({ ...editForm, age: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select
                value={editForm.gender}
                onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Case</label>
            <input
              type="text"
              value={editForm.case}
              onChange={(e) => setEditForm({ ...editForm, case: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder="e.g., Hypertension, Diabetes"
            />
          </div>

          <div className="flex space-x-3 justify-end pt-4">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors">
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showDocumentUpload} onClose={handleCloseDocumentUpload} title="Upload Documents">
        <div className="space-y-4">
          <p className="text-gray-600">Upload medical documents for this patient</p>

          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            <Upload className="w-8 h-8 text-gray-400 mb-2" />
            <span className="text-gray-600">Click to upload files</span>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,.pdf,.doc,.docx"
              onChange={(e) => e.target.files && setDocumentsToUpload(Array.from(e.target.files))}
              className="hidden"
            />
          </label>

          {documentsToUpload.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">{documentsToUpload.length} file(s) selected:</p>
              <div className="space-y-1">
                {documentsToUpload.map((file, idx) => (
                  <div key={idx} className="text-sm text-gray-600 bg-gray-50 rounded px-3 py-2">
                    {file.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploadError && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{uploadError}</div>}

          <div className="flex space-x-3 justify-end pt-4">
            <button
              onClick={handleCloseDocumentUpload}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setConfirmationType('documents');
                setShowConfirmation(true);
              }}
              disabled={documentsToUpload.length === 0 || isUploading}
              className="px-4 py-2 bg-[#024CDB] hover:bg-[#023BA3] text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isUploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>
      </Modal>

      {/* EDIT MODE POPUP */}
      {selectedConsult && isEditingConsult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* ✅ CHANGE: higher z-index so dropdown does not overlap header */}
            <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Edit Consultation Summary</h2>
                <p className="text-sm text-gray-600">{formatDate(selectedConsult.created_at)}</p>
              </div>
              <button onClick={handleCancelEdit} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-6">
                {/* Diagnosis */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Diagnosis</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    {/* ✅ CHANGE: text (not JSON) */}
                    <textarea
                      value={editedDiagnosisText}
                      onChange={(e) => setEditedDiagnosisText(e.target.value)}
                      className="input-field min-h-20"
                      rows={4}
                    />
                  </div>
                </div>

                {/* History */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">History</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <textarea
                      value={editedConsult?.history || ''}
                      onChange={(e) => setEditedConsult({ ...editedConsult, history: e.target.value })}
                      className="input-field min-h-20"
                      rows={3}
                    />
                  </div>
                </div>

                {/* Chief Complaints */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Chief Complaints</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <textarea
                      value={editedConsult?.chief_complaints || ''}
                      onChange={(e) => setEditedConsult({ ...editedConsult, chief_complaints: e.target.value })}
                      className="input-field min-h-20"
                      rows={3}
                    />
                  </div>
                </div>

                {/* Treatment Suggested */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Treatment Suggested</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    {/* ✅ CHANGE: text (not JSON) */}
                    <textarea
                      value={editedTreatmentText}
                      onChange={(e) => setEditedTreatmentText(e.target.value)}
                      className="input-field min-h-20"
                      rows={5}
                    />
                  </div>
                </div>

                {/* Medications */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">Medications</h3>
                    <button onClick={handleAddMedicine} className="btn-secondary flex items-center space-x-2">
                      <Plus className="w-4 h-4" />
                      <span>Add Medicine</span>
                    </button>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="space-y-4">
                      {consultMedicines.map((medicine, index) => (
                        <div key={medicine.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-medium text-gray-900">Medicine {index + 1}</span>
                            <button onClick={() => handleDeleteMedicine(medicine.id)} className="text-red-600 hover:text-red-800">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="relative">
                              <label className="block text-sm font-medium text-gray-700 mb-1">Medicine Name</label>
                              <input
                                type="text"
                                value={medicine.name}
                                onChange={(e) => {
                                  handleUpdateMedicine(medicine.id, { name: e.target.value });
                                  handleMedicineSearch(e.target.value);
                                }}
                                className="input-field"
                                placeholder="Search medicine..."
                              />

                              {medicineSearchResults.length > 0 && (
                                // ✅ CHANGE: lower than header z-index to avoid overlap
                                <div className="absolute z-30 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                  {medicineSearchResults.map((result, idx) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => {
                                        handleUpdateMedicine(medicine.id, { name: result.name });
                                        setMedicineSearchResults([]);
                                      }}
                                      className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                                    >
                                      {result.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Dosage</label>
                              <input
                                type="text"
                                value={medicine.dosage}
                                onChange={(e) => handleUpdateMedicine(medicine.id, { dosage: e.target.value })}
                                className="input-field"
                                placeholder="e.g., 500mg"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                              <input
                                type="text"
                                value={medicine.frequency}
                                onChange={(e) => handleUpdateMedicine(medicine.id, { frequency: e.target.value })}
                                className="input-field"
                                placeholder="e.g., Twice daily"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                              <input
                                type="text"
                                value={medicine.duration}
                                onChange={(e) => handleUpdateMedicine(medicine.id, { duration: e.target.value })}
                                className="input-field"
                                placeholder="e.g., 7 days"
                              />
                            </div>

                            {/* ✅ CHANGE: REMOVE route field from UI */}
                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
                              <input
                                type="text"
                                value={medicine.instructions}
                                onChange={(e) => handleUpdateMedicine(medicine.id, { instructions: e.target.value })}
                                className="input-field"
                                placeholder="e.g., After meals"
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      {consultMedicines.length === 0 && <p className="text-gray-500 text-center py-4">No medicines added yet</p>}
                    </div>
                  </div>
                </div>

                {/* Investigations */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Investigations</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    {/* ✅ CHANGE: text (not JSON) */}
                    <textarea
                      value={editedInvestigationsText}
                      onChange={(e) => setEditedInvestigationsText(e.target.value)}
                      className="input-field min-h-20"
                      rows={5}
                    />
                  </div>
                </div>

                {/* Follow-up Recommendations */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Follow-up Recommendations</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <textarea
                      value={editedConsult?.followup_recommendations || ''}
                      onChange={(e) => setEditedConsult({ ...editedConsult, followup_recommendations: e.target.value })}
                      className="input-field min-h-20"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ✅ CHANGE: sticky footer buttons, not full width */}
            <div className="sticky bottom-0 z-40 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button onClick={handleCancelEdit} className="btn-secondary flex items-center space-x-2">
                <XCircle className="w-4 h-4" />
                <span>Cancel</span>
              </button>
              <button onClick={handleSaveConsult} className="btn-primary flex items-center space-x-2">
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE POPUP */}
      {selectedConsult && !isEditingConsult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* ✅ CHANGE: higher z-index for header */}
            <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-4">
  <div className="flex items-start justify-between gap-3">
    <div>
      <h2 className="text-xl font-semibold text-gray-900">Consultation Summary</h2>
      <p className="text-sm text-gray-600">{formatDate(selectedConsult.created_at)}</p>
    </div>

    {/* Close stays on the right always */}
    <button onClick={() => setSelectedConsult(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
      <X className="w-5 h-5 text-gray-600" />
    </button>
  </div>

  {/* Buttons move below title on mobile, stay right on desktop */}
  <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
    <div className="flex flex-wrap gap-2">
      <button
        onClick={handleEditConsult}
        className="flex items-center space-x-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors"
      >
        <Edit className="w-4 h-4" />
        <span>Edit</span>
      </button>

      <button
        onClick={handleDownloadPDF}
        className="flex items-center space-x-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors"
      >
        <Download className="w-4 h-4" />
        <span>Download PDF</span>
      </button>

      <button
        onClick={handleSendWhatsApp}
        className="flex items-center space-x-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors"
      >
        <MessageSquare className="w-4 h-4" />
        <span>Send via WhatsApp</span>
      </button>
    </div>
  </div>
</div>


            {(() => {
              const summary = getConsultSummary(selectedConsult);

              return summary ? (
                <>
                  <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                    <div className="flex flex-wrap gap-2">
                      {summary.chief_complaints && (
                        <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs">
                          {Array.isArray(summary.chief_complaints) ? summary.chief_complaints.length : 1} Complaints
                        </span>
                      )}
                      {Array.isArray(summary.medications) && (
                        <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs">{summary.medications.length} Medications</span>
                      )}
                      {summary.investigations?.ordered && Array.isArray(summary.investigations.ordered) && (
                        <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs">
                          {summary.investigations.ordered.length} Investigations
                        </span>
                      )}
                      {Array.isArray(summary.flags_for_review) && summary.flags_for_review.length > 0 && (
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">{summary.flags_for_review.length} Flags</span>
                      )}
                    </div>
                  </div>

                  <div className="divide-y divide-gray-200">
                    {summary.diagnosis && renderAccordionSection('Diagnosis', 'diagnosis', renderDiagnosis(summary.diagnosis))}

                    {summary.chief_complaints &&
                      renderAccordionSection('Chief Complaints', 'chiefComplaints', renderArrayContent(summary.chief_complaints))}

                    {summary.treatment_suggested &&
                      renderAccordionSection('Treatment Suggested', 'treatmentSuggested', renderTreatmentSuggested(summary.treatment_suggested))}

                    {(() => {
  const meds = getViewModeMedicines(summary);
  return meds.length > 0
    ? renderAccordionSection('Medications', 'medications', renderMedications(meds))
    : null;
})()}

                    {summary.investigations &&
                      renderAccordionSection('Investigations', 'investigations', renderInvestigations(summary.investigations))}

                    {summary.history && renderAccordionSection('History', 'history', renderArrayContent(summary.history))}

                    {summary.followup_recommendations &&
                      renderAccordionSection(
                        'Follow-up Recommendations',
                        'followupRecommendations',
                        renderArrayContent(summary.followup_recommendations)
                      )}

                    {summary.key_personal_insights &&
                      renderAccordionSection('Key Personal Insights', 'keyPersonalInsights', renderArrayContent(summary.key_personal_insights))}

                    {Array.isArray(summary.flags_for_review) &&
                      summary.flags_for_review.length > 0 &&
                      renderAccordionSection(
                        'Flags for Review',
                        'flagsForReview',
                        <div className="space-y-2">
                          {summary.flags_for_review.map((flag: string, idx: number) => (
                            <div key={idx} className="bg-red-50 border border-red-200 rounded p-3">
                              <span className="text-red-800 font-medium">⚠ {flag}</span>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                </>
              ) : (
                <div className="p-6">
  {(() => {
    const elapsed = getElapsedSeconds(selectedConsult);
    const pct = getProgressPercent(selectedConsult);
    const takingLonger = elapsed > ESTIMATED_PROCESS_SECONDS;
    const isError = elapsed > MAX_PROCESS_SECONDS;

    return (
      <div className="max-w-xl mx-auto">
        {/* counter */}
        <div className="text-center mb-3">
          <p className="text-sm font-semibold text-gray-900">
            Preparing consultation summary: {elapsed}s / {ESTIMATED_PROCESS_SECONDS}s
          </p>
        </div>

        {/* horizontal loader */}
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className="h-3 rounded-full bg-[#024CDB] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* guidance text */}
        <div className="mt-3 text-center">
          <p className="text-sm text-gray-600">
            It takes around 60 sec to prepare the consultation summary.
          </p>
          
          {isError ? (
  <div className="mt-3 text-center">
    <p className="text-sm font-semibold text-red-600">
      There was an issue analyzing the recording.
    </p>
    <p className="text-sm text-gray-600 mt-1">
      Please try recording again.
    </p>
  </div>
) : (
  <div className="mt-3 text-center">
    <p className="text-sm text-gray-600">
      It takes around 60 sec to prepare the consultation summary.
    </p>
    {takingLonger && (
      <p className="text-sm mt-1 font-medium text-red-600">
        Taking longer than expected…
      </p>
    )}
  </div>
)}

        </div>

        {/* subtle hint */}
        <div className="mt-4 text-center text-xs text-gray-500">
  {isError ? 'Please retry the recording.' : 'You can keep this open — it will auto-update when ready.'}
</div>

      </div>
    );
  })()}
</div>

              );
            })()}
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleConfirmAction}
        title={
          confirmationType === 'preConsult'
            ? 'Send Pre-Consult Link'
            : confirmationType === 'followUp'
            ? 'Send Follow-Up Link'
            : 'Upload Documents'
        }
        message={
          confirmationType === 'preConsult'
            ? 'Create and send pre-consultation form link to patient?'
            : confirmationType === 'followUp'
            ? 'Create and send follow-up form link to patient?'
            : 'Upload selected documents for this patient?'
        }
      />
    </div>
  );
}
