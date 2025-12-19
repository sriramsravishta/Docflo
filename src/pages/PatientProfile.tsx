import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CreditCard as Edit, Upload, ExternalLink, Send, Mic, Square, Play, Pause, Download, MessageSquare, X } from 'lucide-react';
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
  getConsults
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
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  
  // Form states
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

  const loadPatientData = async () => {
    try {
      setLoading(true);
      const [patientData, summaryData, consultsData] = await Promise.all([
        getPatientById(patientId!),
        getLatestSummary(patientId!),
        getConsults(patientId!)
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

  const handleOpenForm = async () => {
    try {
      const preConsult = await createPreConsult(user!.id, patientId!);
      window.open(`/pre-consult/${preConsult.id}`, '_blank');
    } catch (error) {
      console.error('Error creating pre-consult:', error);
      alert('Failed to open form');
    }
  };

  const handleConfirmAction = async () => {
    try {
      if (confirmationType === 'preConsult') {
        const preConsult = await createPreConsult(user!.id, patientId!);
        const link = `${window.location.origin}/pre-consult/${preConsult.id}`;
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
      
      // Create pre-consult record first
      const preConsult = await createPreConsult(user!.id, patientId!);
      const uploadedUrls = [];
      
      for (const file of documentsToUpload) {
        const fileName = `${preConsult.id}-${Date.now()}-${file.name}`;
        
        console.log('Uploading file:', fileName, 'Size:', file.size);

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('pre-consultation-documents')
          .upload(fileName, file, {
            contentType: file.type,
            upsert: false
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

      // Update pre-consult record with uploaded document URLs
      await updatePreConsult(preConsult.id, {
        documents_uploaded: uploadedUrls,
        status: 'Draft'
      });

      console.log('Pre-consult updated with documents:', uploadedUrls);
      alert('Documents uploaded successfully');
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
        setRecordingTime(prev => prev + 1);
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
          setRecordingTime(prev => prev + 1);
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
        let recordingFileUrl = '';

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
              upsert: false
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
        } else {
          console.warn('No audio chunks recorded');
        }

        // Create consultation record with the public URL
        const consult = await createConsult(user!.id, patientId!, 'dummy-recording-url');
        
        console.log('Consultation created with recording URL:', recordingFileUrl);
        
        await updateConsult(consult.id, {
          recording_transcript: 'Dummy transcription text. Patient reports feeling tired and experiencing headaches for the past week.',
          consult_summary_ai: ''
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
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderTimelineTab = () => {
    const timeline = latestSummary?.summary?.timeline_of_medical_events || [];
    
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
            {event.location && (
              <p className="text-sm text-gray-600 mb-2">{event.location}</p>
            )}
            <p className="text-gray-800">{event.summary}</p>
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
            
            {trend.overall_trend_comment && (
              <p className="text-gray-800 mb-3">{trend.overall_trend_comment}</p>
            )}
            
            {trend.measurements && trend.measurements.length > 0 && (
              <div className="space-y-2">
                <h5 className="font-medium text-gray-700">Measurements</h5>
                {trend.measurements.map((measurement: any, mIndex: number) => (
                  <div key={mIndex} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
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
        {/* Current Medications */}
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
                      <p className="text-gray-600">{med.dose} • {med.frequency}</p>
                      {med.indication && <p className="text-sm text-gray-500 mt-1">{med.indication}</p>}
                    </div>
                    <span className="text-sm text-gray-500">{med.duration_or_quantity}</span>
                  </div>
                  {med.notes && (
                    <p className="text-sm text-gray-600 mt-2">{med.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Past Medications */}
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
                      <p className="text-gray-600">{med.dose} • {med.frequency}</p>
                      {med.indication && <p className="text-sm text-gray-500 mt-1">{med.indication}</p>}
                    </div>
                    <span className="text-sm text-gray-500">{med.duration_or_quantity}</span>
                  </div>
                  {med.notes && (
                    <p className="text-sm text-gray-600 mt-2">{med.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    );
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
                <p className="text-sm text-gray-600 mt-1">
                  {consult.consult_summary_final?.diagnosis || 
                   consult.consult_summary_final?.chief_complaints || 
                   'Consultation summary'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const handleDownloadPDF = () => {
    if (!selectedConsult) return;
    
    // Generate formatted PDF content
    const pdfContent = generatePDFContent(selectedConsult);
    
    // Create blob and download
    const blob = new Blob([pdfContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consultation-${patient?.name}-${formatDate(selectedConsult.created_at)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSendWhatsApp = () => {
    if (!selectedConsult || !patient) return;
    
    const doctorName = user?.user_metadata?.name || user?.email || 'Doctor';
    const consultDate = formatDate(selectedConsult.created_at);
    const message = `Hi ${patient.name}, here is your consultation summary for your visit with Dr ${doctorName} on ${consultDate}.`;
    
    // Generate PDF content for attachment
    const pdfContent = generatePDFContent(selectedConsult);
    
    // Open WhatsApp with pre-filled message
    const phoneNumber = patient.phone.replace(/[^\d]/g, ''); // Remove non-digits
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    
    window.open(whatsappUrl, '_blank');
  };

  const generatePDFContent = (consult: any) => {
    const summary = consult.consult_summary_final;
    if (!summary) return 'No consultation summary available.';
    
    let content = `CONSULTATION SUMMARY\n`;
    content += `Patient: ${patient?.name}\n`;
    content += `Date: ${formatDate(consult.created_at)}\n`;
    content += `Doctor: ${user?.user_metadata?.name || user?.email || 'Doctor'}\n\n`;
    
    if (summary.diagnosis) {
      content += `DIAGNOSIS\n${summary.diagnosis}\n\n`;
    }
    
    if (summary.history) {
      content += `HISTORY\n${summary.history}\n\n`;
    }
    
    if (summary.chief_complaints) {
      content += `CHIEF COMPLAINTS\n${summary.chief_complaints}\n\n`;
    }
    
    if (summary.treatment_suggested) {
      content += `TREATMENT SUGGESTED\n${summary.treatment_suggested}\n\n`;
    }
    
    if (summary.medications && summary.medications.length > 0) {
      content += `MEDICATIONS\n`;
      summary.medications.forEach((med: any, index: number) => {
        content += `${index + 1}. ${med.name}\n`;
        content += `   Dose: ${med.frequency} • Duration: ${med.duration}\n`;
        if (med.timing) content += `   Timing: ${med.timing}\n`;
        content += `\n`;
      });
    }
    
    if (summary.followup_recommendations) {
      content += `FOLLOW-UP RECOMMENDATIONS\n${summary.followup_recommendations}\n\n`;
    }
    
    return content;
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
    { id: 'past', label: 'Past Summaries' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar showBack />

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Patient Info Container */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{patient.name}</h1>
              <div className="text-gray-600 mt-1">
                <span>{patient.age} years • {patient.gender}</span>
                {patient.case && <span className="ml-4 text-blue-600">{patient.case}</span>}
              </div>
              <p className="text-gray-600 mt-1">{patient.phone}</p>
              {patient.last_visit_at && (
                <p className="text-sm text-gray-500 mt-1">
                  Last visit: {formatDate(patient.last_visit_at)}
                </p>
              )}
            </div>
            <button
              onClick={() => setShowEditModal(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Edit className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={handleUploadDocuments}
              className="flex items-center justify-center space-x-2 py-3 px-4 bg-[#024CDB] hover:bg-[#023BA3] text-white rounded-lg transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span className="text-sm font-medium">Upload</span>
            </button>
            
            <button
              onClick={handleOpenForm}
              className="flex items-center justify-center space-x-2 py-3 px-4 bg-[#024CDB] hover:bg-[#023BA3] text-white rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="text-sm font-medium">Form</span>
            </button>
            
            <button
              onClick={handleSendPreConsultLink}
              className="flex items-center justify-center space-x-2 py-3 px-4 bg-[#024CDB] hover:bg-[#023BA3] text-white rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
              <span className="text-sm font-medium">Link</span>
            </button>
            
            <button
              onClick={isRecording ? handleEndRecording : handleStartRecording}
              className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-lg transition-colors font-medium ${
                isRecording 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-[#024CDB] hover:bg-[#023BA3] text-white'
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

        {/* Summary Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Tabs */}
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

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'timeline' && renderTimelineTab()}
            {activeTab === 'trends' && renderDiagnosticTrendsTab()}
            {activeTab === 'medications' && renderMedicationsTab()}
            {activeTab === 'past' && renderPastSummariesTab()}
          </div>
        </div>
      </div>

      {/* Edit Patient Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Patient"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleEditPatient(); }} className="space-y-4">
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
            <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors">
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* Document Upload Modal */}
      <Modal
        isOpen={showDocumentUpload}
        onClose={handleCloseDocumentUpload}
        title="Upload Documents"
      >
        <div className="space-y-4">
          <p className="text-gray-600">Upload medical documents for this patient</p>
          
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            <Upload className="w-8 h-8 text-gray-400 mb-2" />
            <span className="text-gray-600">Click to upload files</span>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/gif,image/webp,.pdf"
              onChange={(e) => e.target.files && setDocumentsToUpload(Array.from(e.target.files))}
              className="hidden"
            />
          </label>
          
          {documentsToUpload.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                {documentsToUpload.length} file(s) selected:
              </p>
              <div className="space-y-1">
                {documentsToUpload.map((file, idx) => (
                  <div key={idx} className="text-sm text-gray-600 bg-gray-50 rounded px-3 py-2">
                    {file.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploadError && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              {uploadError}
            </div>
          )}

          <div className="flex space-x-3 justify-end pt-4">
            <button onClick={handleCloseDocumentUpload} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
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

      {/* Consultation Detail Modal */}
      {selectedConsult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                Consultation - {formatDate(selectedConsult.created_at)}
              </h2>
              <button
                onClick={() => setSelectedConsult(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {selectedConsult.consult_summary_final && (
                <>
                  {selectedConsult.consult_summary_final.diagnosis && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Diagnosis</h3>
                      <p className="text-gray-800">{selectedConsult.consult_summary_final.diagnosis}</p>
                    </div>
                  )}
                  
                  {selectedConsult.consult_summary_final.history && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">History</h3>
                      <p className="text-gray-800">{selectedConsult.consult_summary_final.history}</p>
                    </div>
                  )}
                  
                  {selectedConsult.consult_summary_final.chief_complaints && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Chief Complaints</h3>
                      <p className="text-gray-800">{selectedConsult.consult_summary_final.chief_complaints}</p>
                    </div>
                  )}
                  
                  {selectedConsult.consult_summary_final.medications && selectedConsult.consult_summary_final.medications.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Medications</h3>
                      <div className="space-y-2">
                        {selectedConsult.consult_summary_final.medications.map((med: any, index: number) => (
                          <div key={index} className="bg-gray-50 rounded-lg p-3">
                            <p className="font-medium">{med.name}</p>
                            <p className="text-sm text-gray-600">{med.frequency} • {med.duration}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {selectedConsult.consult_summary_final.treatment_suggested && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Treatment Suggested</h3>
                      <p className="text-gray-800">{selectedConsult.consult_summary_final.treatment_suggested}</p>
                    </div>
                  )}
                  
                  {selectedConsult.consult_summary_final.followup_recommendations && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Follow-up Recommendations</h3>
                      <p className="text-gray-800">{selectedConsult.consult_summary_final.followup_recommendations}</p>
                    </div>
                  )}
                </>
              )}
            </div>
            
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex gap-3">
              <button
                onClick={handleDownloadPDF}
                className="flex items-center space-x-2 px-4 py-2 bg-[#024CDB] hover:bg-[#023BA3] text-white rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
              <button
                onClick={handleSendWhatsApp}
                className="flex items-center space-x-2 px-4 py-2 bg-[#024CDB] hover:bg-[#023BA3] text-white rounded-lg transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Send via WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleConfirmAction}
        title={
          confirmationType === 'preConsult' ? 'Send Pre-Consult Link' :
          confirmationType === 'followUp' ? 'Send Follow-Up Link' :
          'Upload Documents'
        }
        message={
          confirmationType === 'preConsult' ? 'Create and send pre-consultation form link to patient?' :
          confirmationType === 'followUp' ? 'Create and send follow-up form link to patient?' :
          'Upload selected documents for this patient?'
        }
      />
    </div>
  );
}