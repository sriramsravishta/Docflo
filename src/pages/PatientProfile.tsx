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
  Calendar,
  Phone,
  User,
  FileText,
  Activity,
  Clock,
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
  const [showConsultModal, setShowConsultModal] = useState(false);
  const [selectedConsult, setSelectedConsult] = useState<any>(null);
  const [isEditingConsult, setIsEditingConsult] = useState(false);
  const [editedConsult, setEditedConsult] = useState<any>(null);
  const [consultMedicines, setConsultMedicines] = useState<any[]>([]);
  const [medicineSearchResults, setMedicineSearchResults] = useState<any[]>([]);
  const [searchingMedicine, setSearchingMedicine] = useState(false);

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

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
  const [confirmationType, setConfirmationType] = useState<'preConsult' | 'followUp' | 'documents'>(
    'preConsult'
  );
  const [uploadError, setUploadError] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (patientId) {
      loadPatientData();
    }
  }, [patientId]);

  useEffect(() => {
    if (selectedConsult && selectedConsult.id) {
      loadConsultMedicines(selectedConsult.id);
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
          age: patientData.age.toString(),
          phone: patientData.phone,
          case: patientData.case || '',
          gender: patientData.gender,
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

  const handleEditConsult = () => {
    setIsEditingConsult(true);
    setEditedConsult({
      ...selectedConsult.consult_summary_final,
      id: selectedConsult.id
    });
  };

  const handleCancelEdit = () => {
    setIsEditingConsult(false);
    setEditedConsult(null);
    setSelectedConsult(null);
  };

  const handleSaveConsult = async () => {
    try {
      // Update consultation summary
      await updateConsultSummary(selectedConsult.id, editedConsult);
      
      // Reload consultation data
      await loadPatientData();
      
      setIsEditingConsult(false);
      setEditedConsult(null);
      setSelectedConsult(null);
      
      // Show success message
      alert('Changes saved successfully');
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
        instructions: ''
      });
      setConsultMedicines([...consultMedicines, newMedicine]);
    } catch (error) {
      console.error('Error adding medicine:', error);
    }
  };

  const handleUpdateMedicine = async (medicineId: string, updates: any) => {
    try {
      const updatedMedicine = await updateConsultMedicine(medicineId, updates);
      setConsultMedicines(consultMedicines.map(med => 
        med.id === medicineId ? updatedMedicine : med
      ));
    } catch (error) {
      console.error('Error updating medicine:', error);
    }
  };

  const handleDeleteMedicine = async (medicineId: string) => {
    try {
      await deleteConsultMedicine(medicineId);
      setConsultMedicines(consultMedicines.filter(med => med.id !== medicineId));
    } catch (error) {
      console.error('Error deleting medicine:', error);
    }
  };

  const handleMedicineSearch = async (query: string) => {
    if (query.length < 2) {
      setMedicineSearchResults([]);
      return;
    }

    try {
      setSearchingMedicine(true);
      const results = await searchMedicines(query, 10);
      setMedicineSearchResults(results);
    } catch (error) {
      console.error('Error searching medicines:', error);
    } finally {
      setSearchingMedicine(false);
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

  // ✅ CHANGE #1: Do NOT create a pre-consult row on Form open
  const handleOpenForm = async () => {
    try {
      const link = `${window.location.origin}/pre-consult/new?docId=${user!.id}&patientId=${patientId}`;
      window.open(link, '_blank');
    } catch (error) {
      console.error('Error opening pre-consult form:', error);
      alert('Failed to open form');
    }
  };

  // ✅ CHANGE #1: Do NOT create a pre-consult row on Link generation
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

      // Upload ALL files first before creating any DB records
      const uploadedUrls: string[] = [];

      for (const file of documentsToUpload) {
        const fileName = `${patientId}-${Date.now()}-${file.name}`;

        console.log('Uploading file:', fileName, 'Size:', file.size);

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('pre-consultation-documents')
          .upload(fileName, file, {
            // ✅ CHANGE #3: contentType fallback (helps DOC/HEIC where file.type may be empty)
            contentType: file.type || 'application/octet-stream',
            upsert: false,
          });

        if (uploadError) {
          console.error('Storage upload error:', uploadError);
          throw new Error('Failed to upload document: ' + file.name);
        }

        console.log('Upload successful:', uploadData);

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('pre-consultation-documents')
          .getPublicUrl(uploadData.path);

        const publicUrl = urlData.publicUrl;
        console.log('Public URL:', publicUrl);

        uploadedUrls.push(publicUrl);
      }

      // ONLY AFTER all uploads complete, create DB record with URLs
      const preConsult = await createPreConsult(user!.id, patientId!);
      await updatePreConsult(preConsult.id, {
        documents_uploaded: uploadedUrls,
        status: 'Draft',
      });

      console.log('Pre-consult updated with documents:', uploadedUrls);
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

      // Create a promise that resolves when recording stops
      const recordingPromise = new Promise<Blob[]>((resolve) => {
        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          resolve(chunks);
        };
      });

      // Stop recording
      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }

      try {
        // Wait for recording to complete
        const finalChunks = await recordingPromise;
        let recordingFileUrl = null;

        if (finalChunks.length > 0) {
          // Create audio blob from chunks
          const audioBlob = new Blob(finalChunks, { type: 'audio/webm' });
          const fileName = `consultation-${patientId}-${Date.now()}.webm`;

          console.log('Uploading audio file:', fileName, 'Size:', audioBlob.size);

          // Upload to Supabase Storage
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

          console.log('Upload successful:', uploadData);

          // Get public URL
          const { data: urlData } = supabase.storage
            .from('consultation-recordings')
            .getPublicUrl(uploadData.path);

          recordingFileUrl = urlData.publicUrl;
          console.log('Public URL:', recordingFileUrl);
        }

        // ONLY create consultation record AFTER audio upload completes
        const consult = await createConsult(user!.id, patientId!, recordingFileUrl || '');

        console.log('Consultation created with recording URL:', recordingFileUrl || 'No recording');

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
    if (isNaN(date.getTime())) {
      // ✅ keeps UI stable for "18-Dec-2025" style strings
      return dateString;
    }
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

  // ✅ CHANGE #2: Normalize consult_summary_final (object OR JSON string)
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

  // ✅ CHANGE #4: Render timeline summary as bullets when it has "- " lines
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

    // If it looks like a bullet list, show bullets; else show paragraph
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

            {/* ✅ CHANGE #4 */}
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

    // Prefer a readable short preview
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

  // ✅ CHANGE #5: Fix PDF flow (no blank window, supports your JSON structure, triggers print dialog reliably)
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

    // Diagnosis
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

    // History
    if (summary.history) {
      content += `
        <div class="section">
          <h2>HISTORY</h2>
          <p>${escapeHtml(summary.history)}</p>
        </div>
      `;
    }

    // Chief Complaints
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

    // Treatment Suggested
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

    // Medications
    if (Array.isArray(summary.medications) && summary.medications.length > 0) {
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
              ${summary.medications
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

    // Investigations
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

    // Follow-up Recommendations
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

    // Key Personal Insights
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

    // Flags for Review
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
          @media print {
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        ${htmlContent}
        <script>
          // Give the browser a moment to render before printing.
          setTimeout(function () {
            window.focus();
            window.print();
          }, 300);

          // Close after print (works in most browsers)
          window.onafterprint = function () {
            window.close();
          };
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
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-500" />
          )}
        </button>
        {isExpanded && <div className="px-4 pb-4">{content}</div>}
      </div>
    );
  };

  // Helper function to render diagnosis
  const renderDiagnosis = (diagnosis: any) => {
    if (typeof diagnosis === 'string') {
      return <p className="text-gray-800">{diagnosis}</p>;
    }

    if (typeof diagnosis === 'object' && diagnosis !== null) {
      const hasProvisional =
        diagnosis.provisional && Array.isArray(diagnosis.provisional) && diagnosis.provisional.length > 0;
      const hasKeyFindings =
        diagnosis.key_findings && Array.isArray(diagnosis.key_findings) && diagnosis.key_findings.length > 0;

      if (!hasProvisional && !hasKeyFindings) {
        return <p className="text-gray-800">No detailed diagnosis available</p>;
      }
    }

    return (
      <div className="space-y-3">
        {diagnosis.provisional && Array.isArray(diagnosis.provisional) && diagnosis.provisional.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Provisional Diagnosis</h4>
            <ul className="list-disc list-inside space-y-1">
              {diagnosis.provisional.map((item: string, idx: number) => (
                <li key={idx} className="text-gray-800">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
        {diagnosis.key_findings && Array.isArray(diagnosis.key_findings) && diagnosis.key_findings.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Key Findings</h4>
            <ul className="list-disc list-inside space-y-1">
              {diagnosis.key_findings.map((item: string, idx: number) => (
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

  // Helper function to render array content
  const renderArrayContent = (content: any) => {
    if (typeof content === 'string') {
      return <p className="text-gray-800 whitespace-pre-line">{content}</p>;
    }

    if (Array.isArray(content)) {
      return (
        <ul className="list-disc list-inside space-y-1">
          {content.map((item: string, idx: number) => (
            <li key={idx} className="text-gray-800">
              {item}
            </li>
          ))}
        </ul>
      );
    }

    return <p className="text-gray-800">{JSON.stringify(content)}</p>;
  };

  // Helper function to render treatment suggested
  const renderTreatmentSuggested = (treatment: any) => {
    if (typeof treatment === 'string') {
      return <p className="text-gray-800 whitespace-pre-line">{treatment}</p>;
    }

    return (
      <div className="space-y-3">
        {treatment.immediate_plan && treatment.immediate_plan.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Immediate Plan</h4>
            <ul className="list-disc list-inside space-y-1">
              {treatment.immediate_plan.map((item: string, idx: number) => (
                <li key={idx} className="text-gray-800">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
        {treatment.contingent_plan && treatment.contingent_plan.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Contingent Plan</h4>
            <ul className="list-disc list-inside space-y-1">
              {treatment.contingent_plan.map((item: string, idx: number) => (
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

  // Helper function to render medications
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

  // Helper function to render investigations
  const renderInvestigations = (investigations: any) => {
    return (
      <div className="space-y-3">
        {investigations.ordered && investigations.ordered.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Ordered Investigations</h4>
            <div className="space-y-2">
              {investigations.ordered.map((inv: any, idx: number) => (
                <div key={idx} className="bg-gray-50 border border-gray-200 rounded p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="font-medium text-gray-900">{inv.name}</h5>
                      {inv.body_part_or_type && <p className="text-sm text-gray-600">{inv.body_part_or_type}</p>}
                    </div>
                    {inv.priority && (
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          inv.priority === 'High'
                            ? 'bg-red-100 text-red-700'
                            : inv.priority === 'Medium'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {inv.priority}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {investigations.notes && (
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Notes</h4>
            <p className="text-gray-800">{investigations.notes}</p>
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
    { id: 'timeline', label: 'Timeline' },
    { id: 'trends', label: 'Diagnostic Trends' },
    { id: 'medications', label: 'Medications' },
    { id: 'past', label: 'Past Summaries' },
  ];

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
              // ✅ CHANGE #3: accept DOC/DOCX + HEIC/HEIF (and keep existing)
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
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">Diagnosis</h3>
                    {!isEditingConsult && (
                      <button
                        onClick={handleEditConsult}
                        className="btn-secondary flex items-center space-x-2"
                      >
                        <Edit className="w-4 h-4" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    {isEditingConsult ? (
                      <textarea
                        value={typeof editedConsult?.diagnosis === 'string' ? editedConsult.diagnosis : JSON.stringify(editedConsult?.diagnosis || '')}
                        onChange={(e) => setEditedConsult({...editedConsult, diagnosis: e.target.value})}
                        className="input-field min-h-20"
                        rows={3}
                      />
                    ) : (
                      renderDiagnosis(selectedConsult.consult_summary_final?.diagnosis)
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">History</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    {isEditingConsult ? (
                      <textarea
                        value={editedConsult?.history || ''}
                        onChange={(e) => setEditedConsult({...editedConsult, history: e.target.value})}
                        className="input-field min-h-20"
                        rows={3}
                      />
                    ) : (
                      <p className="text-gray-700">{selectedConsult.consult_summary_final?.history || 'No history recorded'}</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Chief Complaints</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    {isEditingConsult ? (
                      <textarea
                        value={editedConsult?.chief_complaints || ''}
                        onChange={(e) => setEditedConsult({...editedConsult, chief_complaints: e.target.value})}
                        className="input-field min-h-20"
                        rows={3}
                      />
                    ) : (
                      <p className="text-gray-700">{selectedConsult.consult_summary_final?.chief_complaints || 'No complaints recorded'}</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Treatment Suggested</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    {isEditingConsult ? (
                      <textarea
                        value={editedConsult?.treatment_suggested || ''}
                        onChange={(e) => setEditedConsult({...editedConsult, treatment_suggested: e.target.value})}
                        className="input-field min-h-20"
                        rows={3}
                      />
                    ) : (
                      <p className="text-gray-700">{selectedConsult.consult_summary_final?.treatment_suggested || 'No treatment recorded'}</p>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">Medications</h3>
                    {isEditingConsult && (
                      <button
                        onClick={handleAddMedicine}
                        className="btn-secondary flex items-center space-x-2"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Medicine</span>
                      </button>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    {isEditingConsult ? (
                      <div className="space-y-4">
                        {consultMedicines.map((medicine, index) => (
                          <div key={medicine.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                            <div className="flex items-center justify-between mb-3">
                              <span className="font-medium text-gray-900">Medicine {index + 1}</span>
                              <button
                                onClick={() => handleDeleteMedicine(medicine.id)}
                                className="text-red-600 hover:text-red-800"
                              >
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
                                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                    {medicineSearchResults.map((result, idx) => (
                                      <button
                                        key={idx}
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
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Route</label>
                                <input
                                  type="text"
                                  value={medicine.route}
                                  onChange={(e) => handleUpdateMedicine(medicine.id, { route: e.target.value })}
                                  className="input-field"
                                  placeholder="e.g., Oral"
                                />
                              </div>
                              <div>
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
                        {consultMedicines.length === 0 && (
                          <p className="text-gray-500 text-center py-4">No medicines added yet</p>
                        )}
                      </div>
                    ) : (
                      consultMedicines && consultMedicines.length > 0 ? (
                        <div className="space-y-3">
                          {consultMedicines.map((medicine, index) => (
                            <div key={medicine.id} className="border-l-4 border-[#024CDB] pl-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="font-medium text-gray-900">{medicine.name}</p>
                                  <div className="text-sm text-gray-600 mt-1">
                                    {medicine.dosage && <span>Dosage: {medicine.dosage}</span>}
                                    {medicine.frequency && <span className="ml-3">Frequency: {medicine.frequency}</span>}
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    {medicine.duration && <span>Duration: {medicine.duration}</span>}
                                    {medicine.route && <span className="ml-3">Route: {medicine.route}</span>}
                                  </div>
                                  {medicine.instructions && (
                                    <div className="text-sm text-gray-600">
                                      Instructions: {medicine.instructions}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500">No medications prescribed</p>
                      )
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Follow-up Recommendations</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    {isEditingConsult ? (
                      <textarea
                        value={editedConsult?.followup_recommendations || ''}
                        onChange={(e) => setEditedConsult({...editedConsult, followup_recommendations: e.target.value})}
                        className="input-field min-h-20"
                        rows={3}
                      />
                    ) : (
                      <p className="text-gray-700">{selectedConsult.consult_summary_final?.followup_recommendations || 'No follow-up recommendations'}</p>
                    )}
                  </div>
                </div>

                {isEditingConsult && (
                  <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={handleCancelEdit}
                      className="btn-secondary flex items-center space-x-2 flex-1"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Cancel</span>
                    </button>
                    <button
                      onClick={handleSaveConsult}
                      className="btn-primary flex items-center space-x-2 flex-1"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Changes</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedConsult && !isEditingConsult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Consultation Summary</h2>
                <p className="text-sm text-gray-600">{formatDate(selectedConsult.created_at)}</p>
              </div>
              <div className="flex items-center gap-3">
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
                      {Array.isArray(summary.medications) && (
                        <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs">
                          {summary.medications.length} Medications
                        </span>
                      )}
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
                    {summary.diagnosis &&
                      renderAccordionSection('Diagnosis', 'diagnosis', renderDiagnosis(summary.diagnosis))}

                    {summary.chief_complaints &&
                      renderAccordionSection('Chief Complaints', 'chiefComplaints', renderArrayContent(summary.chief_complaints))}

                    {summary.treatment_suggested &&
                      renderAccordionSection('Treatment Suggested', 'treatmentSuggested', renderTreatmentSuggested(summary.treatment_suggested))}

                    {Array.isArray(summary.medications) &&
                      summary.medications.length > 0 &&
                      renderAccordionSection('Medications', 'medications', renderMedications(summary.medications))}

                    {summary.investigations &&
                      renderAccordionSection('Investigations', 'investigations', renderInvestigations(summary.investigations))}

                    {summary.history &&
                      renderAccordionSection('History', 'history', renderArrayContent(summary.history))}

                    {summary.followup_recommendations &&
                      renderAccordionSection(
                        'Follow-up Recommendations',
                        'followupRecommendations',
                        renderArrayContent(summary.followup_recommendations)
                      )}

                    {summary.key_personal_insights &&
                      renderAccordionSection(
                        'Key Personal Insights',
                        'keyPersonalInsights',
                        renderArrayContent(summary.key_personal_insights)
                      )}

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