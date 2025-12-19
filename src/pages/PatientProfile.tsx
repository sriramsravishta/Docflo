import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CreditCard as Edit, Upload, ExternalLink, Send, Mic, Square, Play, Pause, Download, MessageSquare, X, ChevronDown, ChevronRight } from 'lucide-react';
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
  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({
    diagnosis: true,
    chiefComplaints: true,
    treatmentSuggested: true,
    medications: false,
    investigations: false,
    history: false,
    followupRecommendations: false,
    keyPersonalInsights: false,
    flagsForReview: false
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
      
      // Upload ALL files first before creating any DB records
      const uploadedUrls = [];
      
      for (const file of documentsToUpload) {
        const fileName = `${patientId}-${Date.now()}-${file.name}`;
        
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

      // ONLY AFTER all uploads complete, create DB record with URLs
      const preConsult = await createPreConsult(user!.id, patientId!);
      await updatePreConsult(preConsult.id, {
        documents_uploaded: uploadedUrls,
        status: 'Draft'
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
        }

        // ONLY create consultation record AFTER audio upload completes
        // Create consultation record with the actual recording URL (or null if no recording)
        const consult = await createConsult(user!.id, patientId!, recordingFileUrl || '');
        
        console.log('Consultation created with recording URL:', recordingFileUrl || 'No recording');
        
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
    
    // Generate formatted PDF content as HTML
    const htmlContent = generatePDFHTMLContent(selectedConsult);
    
    // Create a simple PDF-like document using HTML and print styles
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Consultation Summary</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
            h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
            h2 { color: #666; margin-top: 20px; }
            .header { margin-bottom: 30px; }
            .section { margin-bottom: 20px; }
            .medication { background: #f5f5f5; padding: 10px; margin: 5px 0; border-radius: 5px; }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${htmlContent}
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const generatePDFHTMLContent = (consult: any) => {
    const summary = consult.consult_summary_final;
    if (!summary) return '<p>No consultation summary available.</p>';
    
    let content = `
      <div class="header">
        <h1>CONSULTATION SUMMARY</h1>
        <p><strong>Patient:</strong> ${patient?.name}</p>
        <p><strong>Date:</strong> ${formatDate(consult.created_at)}</p>
        <p><strong>Doctor:</strong> ${user?.user_metadata?.name || user?.email || 'Doctor'}</p>
      </div>
    `;
    
    if (summary.diagnosis) {
      content += `
        <div class="section">
          <h2>DIAGNOSIS</h2>
          <p>${summary.diagnosis}</p>
        </div>
      `;
    }
    
    if (summary.history) {
      content += `
        <div class="section">
          <h2>HISTORY</h2>
          <p>${summary.history}</p>
        </div>
      `;
    }
    
    if (summary.chief_complaints) {
      content += `
        <div class="section">
          <h2>CHIEF COMPLAINTS</h2>
          <p>${summary.chief_complaints}</p>
        </div>
      `;
    }
    
    if (summary.treatment_suggested) {
      content += `
        <div class="section">
          <h2>TREATMENT SUGGESTED</h2>
          <p>${summary.treatment_suggested}</p>
        </div>
      `;
    }
    
    if (summary.medications && summary.medications.length > 0) {
      content += `
        <div class="section">
          <h2>MEDICATIONS</h2>
      `;
      summary.medications.forEach((med: any, index: number) => {
        content += `
          <div class="medication">
            <strong>${index + 1}. ${med.name}</strong><br>
            <strong>Dose:</strong> ${med.dosage} • <strong>Duration:</strong> ${med.duration}<br>
            ${med.timing ? `<strong>Timing:</strong> ${med.timing}` : ''}
          </div>
        `;
      });
      content += `</div>`;
    }
    
    if (summary.followup_recommendations) {
      content += `
        <div class="section">
          <h2>FOLLOW-UP RECOMMENDATIONS</h2>
          <p>${summary.followup_recommendations}</p>
        </div>
      `;
    }
    
    return content;
  };

  const handleSendWhatsApp = () => {
    if (!selectedConsult || !patient) return;
    
    const doctorName = user?.user_metadata?.name || user?.email || 'Doctor';
    const consultDate = formatDate(selectedConsult.created_at);
    const message = `Hi ${patient.name}, here is your consultation summary for your visit with Dr ${doctorName} on ${consultDate}.`;
    
    // Format phone number for WhatsApp (remove any non-digits and add country code if needed)
    let phoneNumber = patient.phone.replace(/\D/g, '');
    if (!phoneNumber.startsWith('91') && phoneNumber.length === 10) {
      phoneNumber = '91' + phoneNumber; // Add India country code if missing
    }
    
    // Open WhatsApp with pre-filled message
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Helper function to render accordion sections
  const renderAccordionSection = (title: string, key: string, content: React.ReactNode) => {
    const isExpanded = expandedSections[key];
    
    return (
      <div className="border-b border-gray-200 last:border-b-0">
        <button
          onClick={() => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
        >
          <h3 className="font-semibold text-gray-900">{title}</h3>
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-500" />
          )}
        </button>
        {isExpanded && (
          <div className="px-4 pb-4">
            {content}
          </div>
        )}
      </div>
    );
  };

  // Helper function to render diagnosis
  const renderDiagnosis = (diagnosis: any) => {
    if (typeof diagnosis === 'string') {
      return <p className="text-gray-800">{diagnosis}</p>;
    }
    
    return (
      <div className="space-y-3">
        {diagnosis.provisional && diagnosis.provisional.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Provisional Diagnosis</h4>
            <ul className="list-disc list-inside space-y-1">
              {diagnosis.provisional.map((item: string, idx: number) => (
                <li key={idx} className="text-gray-800">{item}</li>
              ))}
            </ul>
          </div>
        )}
        {diagnosis.key_findings && diagnosis.key_findings.length > 0 && (
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
  };

  // Helper function to render array content
  const renderArrayContent = (content: any) => {
    if (typeof content === 'string') {
      return <p className="text-gray-800">{content}</p>;
    }
    
    if (Array.isArray(content)) {
      return (
        <ul className="list-disc list-inside space-y-1">
          {content.map((item: string, idx: number) => (
            <li key={idx} className="text-gray-800">{item}</li>
          ))}
        </ul>
      );
    }
    
    return <p className="text-gray-800">{JSON.stringify(content)}</p>;
  };

  // Helper function to render treatment suggested
  const renderTreatmentSuggested = (treatment: any) => {
    if (typeof treatment === 'string') {
      return <p className="text-gray-800">{treatment}</p>;
    }
    
    return (
      <div className="space-y-3">
        {treatment.immediate_plan && treatment.immediate_plan.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Immediate Plan</h4>
            <ul className="list-disc list-inside space-y-1">
              {treatment.immediate_plan.map((item: string, idx: number) => (
                <li key={idx} className="text-gray-800">{item}</li>
              ))}
            </ul>
          </div>
        )}
        {treatment.contingent_plan && treatment.contingent_plan.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Contingent Plan</h4>
            <ul className="list-disc list-inside space-y-1">
              {treatment.contingent_plan.map((item: string, idx: number) => (
                <li key={idx} className="text-gray-800">{item}</li>
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
                      {inv.body_part_or_type && (
                        <p className="text-sm text-gray-600">{inv.body_part_or_type}</p>
                      )}
                    </div>
                    {inv.priority && (
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        inv.priority === 'High' ? 'bg-red-100 text-red-700' :
                        inv.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
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
              className="btn-secondary flex items-center justify-center space-x-2 py-3 px-4"
            >
              <Upload className="w-4 h-4" />
              <span className="text-sm font-medium">Upload</span>
            </button>
            
            <button
              onClick={handleOpenForm}
              className="btn-secondary flex items-center justify-center space-x-2 py-3 px-4"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="text-sm font-medium">Form</span>
            </button>
            
            <button
              onClick={handleSendPreConsultLink}
              className="btn-secondary flex items-center justify-center space-x-2 py-3 px-4"
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
                <button
                  onClick={() => setSelectedConsult(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>
            
            {selectedConsult.consult_summary_final ? (
              <>
                {/* Summary chips */}
                <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                  <div className="flex flex-wrap gap-2">
                    {selectedConsult.consult_summary_final.chief_complaints && (
                      <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs">
                        {Array.isArray(selectedConsult.consult_summary_final.chief_complaints) 
                          ? selectedConsult.consult_summary_final.chief_complaints.length 
                          : 1} Complaints
                      </span>
                    )}
                    {selectedConsult.consult_summary_final.medications && (
                      <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs">
                        {selectedConsult.consult_summary_final.medications.length} Medications
                      </span>
                    )}
                    {selectedConsult.consult_summary_final.investigations?.ordered && (
                      <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs">
                        {selectedConsult.consult_summary_final.investigations.ordered.length} Investigations
                      </span>
                    )}
                    {selectedConsult.consult_summary_final.flags_for_review && selectedConsult.consult_summary_final.flags_for_review.length > 0 && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                        {selectedConsult.consult_summary_final.flags_for_review.length} Flags
                      </span>
                    )}
                  </div>
                </div>

                {/* Accordion sections */}
                <div className="divide-y divide-gray-200">
                  {selectedConsult.consult_summary_final.diagnosis && renderAccordionSection(
                    "Diagnosis", 
                    "diagnosis", 
                    renderDiagnosis(selectedConsult.consult_summary_final.diagnosis)
                  )}
                  
                  {selectedConsult.consult_summary_final.chief_complaints && renderAccordionSection(
                    "Chief Complaints", 
                    "chiefComplaints", 
                    renderArrayContent(selectedConsult.consult_summary_final.chief_complaints)
                  )}
                  
                  {selectedConsult.consult_summary_final.treatment_suggested && renderAccordionSection(
                    "Treatment Suggested", 
                    "treatmentSuggested", 
                    renderTreatmentSuggested(selectedConsult.consult_summary_final.treatment_suggested)
                  )}
                  
                  {selectedConsult.consult_summary_final.medications && selectedConsult.consult_summary_final.medications.length > 0 && renderAccordionSection(
                    "Medications", 
                    "medications", 
                    renderMedications(selectedConsult.consult_summary_final.medications)
                  )}
                  
                  {selectedConsult.consult_summary_final.investigations && renderAccordionSection(
                    "Investigations", 
                    "investigations", 
                    renderInvestigations(selectedConsult.consult_summary_final.investigations)
                  )}
                  
                  {selectedConsult.consult_summary_final.history && renderAccordionSection(
                    "History", 
                    "history", 
                    renderArrayContent(selectedConsult.consult_summary_final.history)
                  )}
                  
                  {selectedConsult.consult_summary_final.followup_recommendations && renderAccordionSection(
                    "Follow-up Recommendations", 
                    "followupRecommendations", 
                    renderArrayContent(selectedConsult.consult_summary_final.followup_recommendations)
                  )}
                  
                  {selectedConsult.consult_summary_final.key_personal_insights && renderAccordionSection(
                    "Key Personal Insights", 
                    "keyPersonalInsights", 
                    renderArrayContent(selectedConsult.consult_summary_final.key_personal_insights)
                  )}
                  
                  {selectedConsult.consult_summary_final.flags_for_review && selectedConsult.consult_summary_final.flags_for_review.length > 0 && renderAccordionSection(
                    "Flags for Review", 
                    "flagsForReview", 
                    <div className="space-y-2">
                      {selectedConsult.consult_summary_final.flags_for_review.map((flag: string, idx: number) => (
                        <div key={idx} className="bg-red-50 border border-red-200 rounded p-3">
                          <span className="text-red-800 font-medium">⚠ {flag}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-6 text-center text-gray-500">
                Consultation summary not available yet.
              </div>
            )}
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