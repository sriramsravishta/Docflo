import { useState, useEffect, useMemo } from 'react';
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
} from '../lib/database';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type ConfirmType = 'preConsult' | 'followUp' | 'documents';

type DraftMedicine = {
  id: string; // can be temp-*
  consult_id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string;
  instructions: string;
};

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
  const [activeTab, setActiveTab] = useState('timeline');

  // UI states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [selectedConsult, setSelectedConsult] = useState<any>(null);

  // ✅ Editing states
  const [isEditingConsult, setIsEditingConsult] = useState(false);
  const [editedConsult, setEditedConsult] = useState<any>(null);
  const [editJsonError, setEditJsonError] = useState<string>('');

  // ✅ Medicines from Consult Medicine table
  const [consultMedicines, setConsultMedicines] = useState<any[]>([]);
  const [consultMedicinesDraft, setConsultMedicinesDraft] = useState<DraftMedicine[]>([]);

  // ✅ Typeahead per medicine row
  const [medicineSearchResultsById, setMedicineSearchResultsById] = useState<Record<string, any[]>>({});
  const [searchingMedicineById, setSearchingMedicineById] = useState<Record<string, boolean>>({});

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  // Accordion open/close (view mode)
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
  const [confirmationType, setConfirmationType] = useState<ConfirmType>('preConsult');
  const [uploadError, setUploadError] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (patientId) loadPatientData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  useEffect(() => {
    if (selectedConsult?.id) {
      loadConsultMedicines(selectedConsult.id);
    } else {
      setConsultMedicines([]);
    }
  }, [selectedConsult]);

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
          age: patientData.age?.toString?.() || '',
          phone: patientData.phone || '',
          case: patientData.case || '',
          gender: patientData.gender || 'Male',
        });
      }
    } catch (error) {
      console.error('Error loading patient data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadConsultMedicines = async (consultId: string) => {
    try {
      const medicines = await getConsultMedicines(consultId);
      setConsultMedicines(medicines || []);
    } catch (error) {
      console.error('Error loading consult medicines:', error);
      setConsultMedicines([]);
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

  // ✅ Normalize consult_summary_final
  const getConsultSummary = (consult: any) => {
    const raw = consult?.consult_summary_final;
    if (!raw) return null;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    }
    if (typeof raw === 'object') return raw;
    return null;
  };

  // ✅ Start edit mode from VIEW popup
  const handleStartEditConsult = async () => {
    if (!selectedConsult?.id) return;

    const summary = getConsultSummary(selectedConsult) || {};

    // Build a safe editable copy
    setEditedConsult({
      ...summary,
      id: selectedConsult.id,
    });

    // Draft medicines copied from DB state (NO DB writes until Save)
    const consultId = selectedConsult.id;
    const dbMeds = await getConsultMedicines(consultId).catch(() => []);
    setConsultMedicines(dbMeds || []);
    setConsultMedicinesDraft(
      (dbMeds || []).map((m: any) => ({
        id: m.id,
        consult_id: consultId,
        name: m.name || '',
        dosage: m.dosage || '',
        frequency: m.frequency || '',
        duration: m.duration || '',
        route: m.route || '',
        instructions: m.instructions || '',
      }))
    );

    setEditJsonError('');
    setIsEditingConsult(true);
  };

  // ✅ Cancel edit mode: discard everything and close popup
  const handleCancelEdit = () => {
    setIsEditingConsult(false);
    setEditedConsult(null);
    setEditJsonError('');
    setConsultMedicinesDraft([]);
    setMedicineSearchResultsById({});
    setSearchingMedicineById({});
    setSelectedConsult(null); // closes popup
  };

  // ✅ Helpers for editing arrays as newline text
  const toMultiline = (value: any) => {
    if (Array.isArray(value)) return value.join('\n');
    if (typeof value === 'string') return value;
    if (value == null) return '';
    return JSON.stringify(value, null, 2);
  };

  const fromMultilineArray = (value: string) => {
    return value
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  };

  // ✅ For object fields, allow JSON editing
  const safeParseJSON = (text: string) => {
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch {
      return { ok: false, value: null };
    }
  };

  // ✅ Save consult summary + medicines (only now write to DB)
  const handleSaveConsult = async () => {
    try {
      if (!selectedConsult?.id) return;

      // Validate JSON fields if user edited them as JSON
      // We’ll treat these as “object-possible” fields:
      const maybeJsonFields = ['diagnosis', 'treatment_suggested', 'investigations'];

      let payload: any = { ...editedConsult };
      delete payload.id;

      // Convert certain fields back to arrays if user edited as multiline strings
      // (if they already are arrays, keep)
      const multilineArrayFields = [
        'chief_complaints',
        'followup_recommendations',
        'key_personal_insights',
        'flags_for_review',
      ];

      multilineArrayFields.forEach((f) => {
        const v = payload?.[f];
        if (typeof v === 'string') payload[f] = fromMultilineArray(v);
      });

      // For JSON-edit textareas, allow string OR JSON object
      // If it looks like JSON (starts with { or [), enforce valid JSON
      for (const f of maybeJsonFields) {
        const v = payload?.[f];
        if (typeof v === 'string') {
          const trimmed = v.trim();
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            const parsed = safeParseJSON(trimmed);
            if (!parsed.ok) {
              setEditJsonError(`Invalid JSON in "${f}". Please fix it before saving.`);
              return;
            }
            payload[f] = parsed.value;
          }
        }
      }

      // 1) Update consultation summary JSON
      await updateConsultSummary(selectedConsult.id, payload);

      // 2) Persist medicines (diff existing vs draft)
      const consultId = selectedConsult.id;

      const existing = consultMedicines || [];
      const existingIds = new Set(existing.map((m: any) => m.id));

      const draft = consultMedicinesDraft || [];
      const draftIds = new Set(draft.filter((m) => !m.id.startsWith('temp-')).map((m) => m.id));

      // Delete removed medicines
      for (const m of existing) {
        if (!draftIds.has(m.id)) {
          await deleteConsultMedicine(m.id);
        }
      }

      // Create/update medicines
      for (const m of draft) {
        const base = {
          consult_id: consultId,
          name: m.name,
          dosage: m.dosage,
          frequency: m.frequency,
          duration: m.duration,
          route: m.route,
          instructions: m.instructions,
        };

        if (m.id.startsWith('temp-')) {
          await createConsultMedicine(base);
        } else if (existingIds.has(m.id)) {
          await updateConsultMedicine(m.id, base);
        } else {
          // safety fallback
          await createConsultMedicine(base);
        }
      }

      // Reload
      await loadPatientData();

      setIsEditingConsult(false);
      setEditedConsult(null);
      setEditJsonError('');
      setConsultMedicinesDraft([]);
      setMedicineSearchResultsById({});
      setSearchingMedicineById({});
      setSelectedConsult(null);

      alert('Changes saved successfully');
    } catch (error) {
      console.error('Error saving consultation:', error);
      alert('Failed to save changes');
    }
  };

  // ✅ Draft medicine handlers (NO DB WRITES)
  const handleAddMedicineDraft = () => {
    if (!selectedConsult?.id) return;
    const tempId = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const consultId = selectedConsult.id;

    setConsultMedicinesDraft((prev) => [
      ...prev,
      {
        id: tempId,
        consult_id: consultId,
        name: '',
        dosage: '',
        frequency: '',
        duration: '',
        route: '',
        instructions: '',
      },
    ]);
  };

  const handleDeleteMedicineDraft = (medicineId: string) => {
    setConsultMedicinesDraft((prev) => prev.filter((m) => m.id !== medicineId));
    setMedicineSearchResultsById((prev) => {
      const copy = { ...prev };
      delete copy[medicineId];
      return copy;
    });
  };

  const handleUpdateMedicineDraft = (medicineId: string, updates: Partial<DraftMedicine>) => {
    setConsultMedicinesDraft((prev) =>
      prev.map((m) => (m.id === medicineId ? { ...m, ...updates } : m))
    );
  };

  const handleMedicineSearch = async (medicineId: string, query: string) => {
    if (!query || query.trim().length < 2) {
      setMedicineSearchResultsById((prev) => ({ ...prev, [medicineId]: [] }));
      return;
    }

    try {
      setSearchingMedicineById((prev) => ({ ...prev, [medicineId]: true }));
      const results = await searchMedicines(query, 10);
      setMedicineSearchResultsById((prev) => ({ ...prev, [medicineId]: results || [] }));
    } catch (error) {
      console.error('Error searching medicines:', error);
    } finally {
      setSearchingMedicineById((prev) => ({ ...prev, [medicineId]: false }));
    }
  };

  const handleSendPreConsultLink = () => {
    setConfirmationType('preConsult');
    setShowConfirmation(true);
  };

  const handleSendFollowUpLink = () => {
    setConfirmationType('followUp');
    setShowConfirmation(true);
  };

  const handleUploadDocuments = () => {
    setShowDocumentUpload(true);
  };

  // ✅ Do NOT create pre-consult row on open
  const handleOpenForm = async () => {
    try {
      const link = `${window.location.origin}/pre-consult/new?docId=${user!.id}&patientId=${patientId}`;
      window.open(link, '_blank');
    } catch (error) {
      console.error('Error opening pre-consult form:', error);
      alert('Failed to open form');
    }
  };

  // ✅ Do NOT create a pre-consult row on link generation
  const handleConfirmAction = async () => {
    try {
      if (confirmationType === 'preConsult') {
        const link = `${window.location.origin}/pre-consult/new?docId=${user!.id}&patientId=${patientId}`;
        alert(`Pre-consult link created: ${link}`);
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

        const { data: urlData } = supabase.storage
          .from('pre-consultation-documents')
          .getPublicUrl(uploadData.path);

        uploadedUrls.push(urlData.publicUrl);
      }

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

      if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();

      try {
        const finalChunks = await recordingPromise;
        let recordingFileUrl = null;

        if (finalChunks.length > 0) {
          const audioBlob = new Blob(finalChunks, { type: 'audio/webm' });
          const fileName = `consultation-${patientId}-${Date.now()}.webm`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('consultation-recordings')
            .upload(fileName, audioBlob, {
              contentType: 'audio/webm',
              upsert: false,
            });

          if (uploadError) {
            console.error('Storage upload error:', uploadError);
            throw new Error('Failed to upload recording');
          }

          const { data: urlData } = supabase.storage
            .from('consultation-recordings')
            .getPublicUrl(uploadData.path);

          recordingFileUrl = urlData.publicUrl;
        }

        const consult = await createConsult(user!.id, patientId!, recordingFileUrl || '');

        await updateConsult(consult.id, {
          recording_transcript:
            'Dummy transcription text. Patient reports feeling tired and experiencing headaches for the past week.',
          consult_summary_ai: '',
        });

        alert('Consultation recorded and saved successfully');
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

  // Timeline bullet helper
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
    const trends = latestSummary?.summary?.diagnostic_trends || [];

    if (trends.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-500">No diagnostic trends available</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {trends.map((trend: any, index: number) => (
          <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="mb-3">
              <h4 className="font-semibold text-gray-900">{trend.parameter_name}</h4>
              <div className="text-sm text-gray-600">
                {trend.unit && <span>Unit: {trend.unit}</span>}
                {trend.normal_range && <span className="ml-4">Normal: {trend.normal_range}</span>}
              </div>
            </div>

            {trend.overall_trend_comment && <p className="text-gray-800 mb-3">{trend.overall_trend_comment}</p>}

            {trend.measurements && trend.measurements.length > 0 && (
              <div className="space-y-2">
                <h5 className="font-medium text-gray-700">Measurements</h5>
                {trend.measurements.map((measurement: any, mIndex: number) => (
                  <div
                    key={mIndex}
                    className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0"
                  >
                    <span className="text-sm text-gray-600">{formatDate(measurement.measurement_datetime)}</span>
                    <span className="font-medium">{measurement.value_raw}</span>
                    <span className="text-sm text-gray-600">{measurement.clinical_interpretation}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
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
          <h3 className="font-semibold text-gray-900 mb-3">Current Medications</h3>
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
          <details className="group">
            <summary className="cursor-pointer font-semibold text-gray-900 mb-3 group-open:mb-3">
              Past Medications ({pastMeds.length})
            </summary>
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
          </details>
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
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium text-gray-900">{formatDate(consult.created_at)}</p>
                <p className="text-sm text-gray-600 mt-1">{getConsultPreviewText(consult)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ---------- PDF helpers ----------
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

  // ✅ IMPORTANT: PDF medications pulled from Consult Medicine table
  const generatePDFHTMLContent = (consult: any, medicinesFromTable: any[]) => {
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

    // Diagnosis
    if (summary.diagnosis) {
      if (typeof summary.diagnosis === 'string') {
        content += `<div class="section"><h2>DIAGNOSIS</h2><p>${escapeHtml(summary.diagnosis)}</p></div>`;
      } else if (typeof summary.diagnosis === 'object') {
        const prov = Array.isArray(summary.diagnosis.provisional) ? summary.diagnosis.provisional : [];
        const keyf = Array.isArray(summary.diagnosis.key_findings) ? summary.diagnosis.key_findings : [];
        content += `<div class="section"><h2>DIAGNOSIS</h2>
          ${prov.length ? `<h3>Provisional</h3>${toHtmlList(prov)}` : ''}
          ${keyf.length ? `<h3>Key Findings</h3>${toHtmlList(keyf)}` : ''}
        </div>`;
      }
    }

    // History
    if (summary.history) {
      content += `<div class="section"><h2>HISTORY</h2><p>${escapeHtml(summary.history)}</p></div>`;
    }

    // Chief Complaints
    if (summary.chief_complaints) {
      content += `<div class="section"><h2>CHIEF COMPLAINTS</h2>${
        Array.isArray(summary.chief_complaints) ? toHtmlList(summary.chief_complaints) : `<p>${escapeHtml(summary.chief_complaints)}</p>`
      }</div>`;
    }

    // Treatment Suggested
    if (summary.treatment_suggested) {
      content += `<div class="section"><h2>TREATMENT SUGGESTED</h2>${
        typeof summary.treatment_suggested === 'string'
          ? `<p>${escapeHtml(summary.treatment_suggested)}</p>`
          : `<pre>${escapeHtml(JSON.stringify(summary.treatment_suggested, null, 2))}</pre>`
      }</div>`;
    }

    // ✅ Medications from table
    if (Array.isArray(medicinesFromTable) && medicinesFromTable.length > 0) {
      content += `
        <div class="section">
          <h2>MEDICATIONS</h2>
          <table class="table">
            <thead>
              <tr>
                <th>Name</th><th>Dosage</th><th>Route</th><th>Frequency</th><th>Duration</th><th>Instructions</th>
              </tr>
            </thead>
            <tbody>
              ${medicinesFromTable
                .map(
                  (m: any) => `
                <tr>
                  <td>${escapeHtml(m?.name || '-')}</td>
                  <td>${escapeHtml(m?.dosage || '-')}</td>
                  <td>${escapeHtml(m?.route || '-')}</td>
                  <td>${escapeHtml(m?.frequency || '-')}</td>
                  <td>${escapeHtml(m?.duration || '-')}</td>
                  <td>${escapeHtml(m?.instructions || '-')}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // Investigations
    if (summary.investigations) {
      content += `<div class="section"><h2>INVESTIGATIONS</h2><pre>${escapeHtml(JSON.stringify(summary.investigations, null, 2))}</pre></div>`;
    }

    // Follow-up
    if (summary.followup_recommendations) {
      content += `<div class="section"><h2>FOLLOW-UP RECOMMENDATIONS</h2>${
        Array.isArray(summary.followup_recommendations)
          ? toHtmlList(summary.followup_recommendations)
          : `<p>${escapeHtml(summary.followup_recommendations)}</p>`
      }</div>`;
    }

    // Key insights
    if (summary.key_personal_insights) {
      content += `<div class="section"><h2>KEY PERSONAL INSIGHTS</h2>${
        Array.isArray(summary.key_personal_insights)
          ? toHtmlList(summary.key_personal_insights)
          : `<p>${escapeHtml(summary.key_personal_insights)}</p>`
      }</div>`;
    }

    // Flags
    if (Array.isArray(summary.flags_for_review) && summary.flags_for_review.length > 0) {
      content += `<div class="section"><h2>FLAGS FOR REVIEW</h2>${toHtmlList(summary.flags_for_review)}</div>`;
    }

    return content;
  };

  const handleDownloadPDF = async () => {
    if (!selectedConsult) return;

    const meds = await getConsultMedicines(selectedConsult.id).catch(() => consultMedicines || []);
    const htmlContent = generatePDFHTMLContent(selectedConsult, meds || []);

    // MUST happen on click gesture
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
          pre { background: #f8fafc; border: 1px solid #e5e7eb; padding: 10px; border-radius: 6px; white-space: pre-wrap; }
          @page { margin: 12mm; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        ${htmlContent}
        <script>
          setTimeout(function () {
            window.focus();
            window.print();
          }, 300);
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

    let phoneNumber = (patient.phone || '').replace(/\D/g, '');
    if (!phoneNumber.startsWith('91') && phoneNumber.length === 10) phoneNumber = '91' + phoneNumber;

    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Accordion
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

  const renderArrayContent = (content: any) => {
    if (typeof content === 'string') return <p className="text-gray-800 whitespace-pre-line">{content}</p>;
    if (Array.isArray(content)) {
      return (
        <ul className="list-disc list-inside space-y-1">
          {content.map((item: string, idx: number) => (
            <li key={idx} className="text-gray-800">{item}</li>
          ))}
        </ul>
      );
    }
    return <pre className="text-gray-800">{JSON.stringify(content, null, 2)}</pre>;
  };

  const renderDiagnosis = (diagnosis: any) => {
    if (typeof diagnosis === 'string') return <p className="text-gray-800">{diagnosis}</p>;

    if (typeof diagnosis === 'object' && diagnosis !== null) {
      const hasProvisional = Array.isArray(diagnosis.provisional) && diagnosis.provisional.length > 0;
      const hasKeyFindings = Array.isArray(diagnosis.key_findings) && diagnosis.key_findings.length > 0;
      if (!hasProvisional && !hasKeyFindings) return <p className="text-gray-800">No detailed diagnosis available</p>;

      return (
        <div className="space-y-3">
          {hasProvisional && (
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Provisional Diagnosis</h4>
              <ul className="list-disc list-inside space-y-1">
                {diagnosis.provisional.map((item: string, idx: number) => (
                  <li key={idx} className="text-gray-800">{item}</li>
                ))}
              </ul>
            </div>
          )}
          {hasKeyFindings && (
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Key Findings</h4>
              <ul className="list-disc list-inside space-y-1">
                {diagnosis.key_findings.map((item: string, idx: number) => (
                  <li key={idx} className="text-gray-800">{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    return <p className="text-gray-800">No diagnosis available</p>;
  };

  // ✅ View mode medications must come from consultMedicines table
  const renderConsultMedicinesView = (meds: any[]) => {
    if (!meds || meds.length === 0) return <p className="text-gray-500">No medications prescribed</p>;

    return (
      <div className="space-y-3">
        {meds.map((medicine, index) => (
          <div key={medicine.id} className="border-l-4 border-[#024CDB] pl-4">
            <div>
              <p className="font-medium text-gray-900">{medicine.name || '-'}</p>
              <div className="text-sm text-gray-600 mt-1">
                {medicine.dosage && <span>Dosage: {medicine.dosage}</span>}
                {medicine.frequency && <span className="ml-3">Frequency: {medicine.frequency}</span>}
              </div>
              <div className="text-sm text-gray-600">
                {medicine.duration && <span>Duration: {medicine.duration}</span>}
                {medicine.route && <span className="ml-3">Route: {medicine.route}</span>}
              </div>
              {medicine.instructions && <div className="text-sm text-gray-600">Instructions: {medicine.instructions}</div>}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Tabs
  const tabs = [
    { id: 'timeline', label: 'Timeline' },
    { id: 'trends', label: 'Diagnostic Trends' },
    { id: 'medications', label: 'Medications' },
    { id: 'past', label: 'Past Summaries' },
  ];

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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar showBack />

      <div className="max-w-5xl mx-auto px-4 py-6">
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
              {patient.last_visit_at && (
                <p className="text-sm text-gray-500 mt-1">Last visit: {formatDate(patient.last_visit_at)}</p>
              )}
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
            {activeTab === 'timeline' && renderTimelineTab()}
            {activeTab === 'trends' && renderDiagnosticTrendsTab()}
            {activeTab === 'medications' && renderMedicationsTab()}
            {activeTab === 'past' && renderPastSummariesTab()}
          </div>
        </div>
      </div>

      {/* Edit Patient Modal */}
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

      {/* Upload Documents Modal */}
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

      {/* ✅ EDIT CONSULT POPUP */}
      {selectedConsult && isEditingConsult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Edit Consultation Summary</h2>
                <p className="text-sm text-gray-600">{formatDate(selectedConsult.created_at)}</p>
              </div>
              <button onClick={handleCancelEdit} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="p-6">
              {editJsonError && (
                <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                  {editJsonError}
                </div>
              )}

              <div className="space-y-6">
                {/* Diagnosis */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Diagnosis</h3>
                  <textarea
                    value={toMultiline(editedConsult?.diagnosis)}
                    onChange={(e) => setEditedConsult({ ...editedConsult, diagnosis: e.target.value })}
                    className="input-field min-h-24 w-full"
                    rows={4}
                    placeholder='Text OR JSON (e.g. {"provisional":["..."],"key_findings":["..."]})'
                  />
                </div>

                {/* History */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">History</h3>
                  <textarea
                    value={toMultiline(editedConsult?.history)}
                    onChange={(e) => setEditedConsult({ ...editedConsult, history: e.target.value })}
                    className="input-field min-h-24 w-full"
                    rows={4}
                  />
                </div>

                {/* Chief Complaints */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Chief Complaints</h3>
                  <textarea
                    value={toMultiline(editedConsult?.chief_complaints)}
                    onChange={(e) => setEditedConsult({ ...editedConsult, chief_complaints: e.target.value })}
                    className="input-field min-h-24 w-full"
                    rows={4}
                    placeholder="One per line"
                  />
                </div>

                {/* Treatment Suggested */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Treatment Suggested</h3>
                  <textarea
                    value={toMultiline(editedConsult?.treatment_suggested)}
                    onChange={(e) => setEditedConsult({ ...editedConsult, treatment_suggested: e.target.value })}
                    className="input-field min-h-24 w-full"
                    rows={4}
                    placeholder='Text OR JSON (e.g. {"immediate_plan":["..."],"contingent_plan":["..."]})'
                  />
                </div>

                {/* ✅ Medicines from Consult Medicine table */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">Medications</h3>
                    <button onClick={handleAddMedicineDraft} className="btn-secondary flex items-center space-x-2">
                      <Plus className="w-4 h-4" />
                      <span>Add Medicine</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {consultMedicinesDraft.map((medicine, index) => (
                      <div key={medicine.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-medium text-gray-900">Medicine {index + 1}</span>
                          <button
                            onClick={() => handleDeleteMedicineDraft(medicine.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Name dropdown search */}
                          <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Medicine Name</label>
                            <input
                              type="text"
                              value={medicine.name}
                              onChange={(e) => {
                                const q = e.target.value;
                                handleUpdateMedicineDraft(medicine.id, { name: q });
                                handleMedicineSearch(medicine.id, q);
                              }}
                              className="input-field"
                              placeholder="Type to search..."
                              autoComplete="off"
                            />
                            {(medicineSearchResultsById[medicine.id] || []).length > 0 && (
                              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                                {(medicineSearchResultsById[medicine.id] || []).map((result, idx) => (
                                  <button
                                    type="button"
                                    key={idx}
                                    onClick={() => {
                                      handleUpdateMedicineDraft(medicine.id, { name: result.name });
                                      setMedicineSearchResultsById((prev) => ({ ...prev, [medicine.id]: [] }));
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
                              onChange={(e) => handleUpdateMedicineDraft(medicine.id, { dosage: e.target.value })}
                              className="input-field"
                              placeholder="e.g., 500mg"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                            <input
                              type="text"
                              value={medicine.frequency}
                              onChange={(e) => handleUpdateMedicineDraft(medicine.id, { frequency: e.target.value })}
                              className="input-field"
                              placeholder="e.g., Twice daily"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                            <input
                              type="text"
                              value={medicine.duration}
                              onChange={(e) => handleUpdateMedicineDraft(medicine.id, { duration: e.target.value })}
                              className="input-field"
                              placeholder="e.g., 7 days"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Route</label>
                            <input
                              type="text"
                              value={medicine.route}
                              onChange={(e) => handleUpdateMedicineDraft(medicine.id, { route: e.target.value })}
                              className="input-field"
                              placeholder="e.g., Oral"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
                            <input
                              type="text"
                              value={medicine.instructions}
                              onChange={(e) => handleUpdateMedicineDraft(medicine.id, { instructions: e.target.value })}
                              className="input-field"
                              placeholder="e.g., After meals"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    {consultMedicinesDraft.length === 0 && (
                      <p className="text-gray-500 text-center py-4">No medicines added yet</p>
                    )}
                  </div>
                </div>

                {/* Investigations */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Investigations</h3>
                  <textarea
                    value={toMultiline(editedConsult?.investigations)}
                    onChange={(e) => setEditedConsult({ ...editedConsult, investigations: e.target.value })}
                    className="input-field min-h-24 w-full"
                    rows={5}
                    placeholder='JSON recommended (e.g. {"ordered":[{"name":"CBC"}],"notes":"..."})'
                  />
                </div>

                {/* Follow-up */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Follow-up Recommendations</h3>
                  <textarea
                    value={toMultiline(editedConsult?.followup_recommendations)}
                    onChange={(e) => setEditedConsult({ ...editedConsult, followup_recommendations: e.target.value })}
                    className="input-field min-h-24 w-full"
                    rows={4}
                    placeholder="One per line"
                  />
                </div>

                {/* Key Insights */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Key Personal Insights</h3>
                  <textarea
                    value={toMultiline(editedConsult?.key_personal_insights)}
                    onChange={(e) => setEditedConsult({ ...editedConsult, key_personal_insights: e.target.value })}
                    className="input-field min-h-24 w-full"
                    rows={4}
                    placeholder="One per line"
                  />
                </div>

                {/* Flags */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Flags for Review</h3>
                  <textarea
                    value={toMultiline(editedConsult?.flags_for_review)}
                    onChange={(e) => setEditedConsult({ ...editedConsult, flags_for_review: e.target.value })}
                    className="input-field min-h-24 w-full"
                    rows={4}
                    placeholder="One per line"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button onClick={handleCancelEdit} className="btn-secondary flex items-center space-x-2 flex-1">
                    <XCircle className="w-4 h-4" />
                    <span>Cancel</span>
                  </button>
                  <button onClick={handleSaveConsult} className="btn-primary flex items-center space-x-2 flex-1">
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ VIEW CONSULT POPUP */}
      {selectedConsult && !isEditingConsult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Consultation Summary</h2>
                <p className="text-sm text-gray-600">{formatDate(selectedConsult.created_at)}</p>
              </div>

              <div className="flex items-center gap-3">
                {/* ✅ REQUIRED: Edit button visible in view mode */}
                <button
                  onClick={handleStartEditConsult}
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

                <button onClick={() => setSelectedConsult(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-gray-600" />
                </button>
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
                      {/* ✅ count medications from consult medicine table */}
                      <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs">
                        {(consultMedicines || []).length} Medications
                      </span>

                      {summary.investigations?.ordered && Array.isArray(summary.investigations.ordered) && (
                        <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs">
                          {summary.investigations.ordered.length} Investigations
                        </span>
                      )}
                      {Array.isArray(summary.flags_for_review) && summary.flags_for_review.length > 0 && (
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                          {summary.flags_for_review.length} Flags
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="divide-y divide-gray-200">
                    {summary.diagnosis && renderAccordionSection('Diagnosis', 'diagnosis', renderDiagnosis(summary.diagnosis))}

                    {summary.chief_complaints &&
                      renderAccordionSection('Chief Complaints', 'chiefComplaints', renderArrayContent(summary.chief_complaints))}

                    {summary.treatment_suggested &&
                      renderAccordionSection('Treatment Suggested', 'treatmentSuggested', renderArrayContent(summary.treatment_suggested))}

                    {/* ✅ Medications from consult medicine table */}
                    {renderAccordionSection('Medications', 'medications', renderConsultMedicinesView(consultMedicines || []))}

                    {summary.investigations && renderAccordionSection('Investigations', 'investigations', renderArrayContent(summary.investigations))}

                    {summary.history && renderAccordionSection('History', 'history', renderArrayContent(summary.history))}

                    {summary.followup_recommendations &&
                      renderAccordionSection('Follow-up Recommendations', 'followupRecommendations', renderArrayContent(summary.followup_recommendations))}

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
                <div className="p-6 text-center text-gray-500">Consultation summary not available yet.</div>
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
