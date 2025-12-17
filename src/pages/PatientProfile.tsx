import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CreditCard as Edit, Upload, ExternalLink, Send, Mic, Square, X, CheckCircle, AlertCircle, Clock, Pill, TrendingUp, FileText } from 'lucide-react';
import Navbar from '../components/Navbar';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import { 
  getPatientById, 
  updatePatient, 
  createPreConsult, 
  getPreConsults,
  getSummaries,
  getLatestSummary,
  createConsult,
  updateConsult
} from '../lib/database';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function PatientProfile() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationType, setConfirmationType] = useState<'send-link' | 'open-form' | 'upload-docs'>('send-link');
  const [documentsToUpload, setDocumentsToUpload] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [latestSummary, setLatestSummary] = useState<any>(null);
  const [pastSummaries, setPastSummaries] = useState<any[]>([]);
  const [selectedSummary, setSelectedSummary] = useState<any>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'past-summaries'>('summary');

  const [editData, setEditData] = useState({
    name: '',
    age: '',
    phone: '',
    case: '',
    gender: 'Male',
  });

  useEffect(() => {
    if (patientId) {
      loadPatient();
      loadSummaries();
    }
  }, [patientId]);

  const loadPatient = async () => {
    try {
      setLoading(true);
      const data = await getPatientById(patientId!);
      setPatient(data);
      setEditData({
        name: data.name,
        age: data.age.toString(),
        phone: data.phone,
        case: data.case || '',
        gender: data.gender,
      });
    } catch (error) {
      console.error('Error loading patient:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSummaries = async () => {
    try {
      const [latest, all] = await Promise.all([
        getLatestSummary(patientId!),
        getSummaries(patientId!)
      ]);
      
      setLatestSummary(latest);
      setPastSummaries(all.slice(1)); // Exclude the latest one
    } catch (error) {
      console.error('Error loading summaries:', error);
    }
  };

  const handleEditPatient = async () => {
    try {
      await updatePatient(patientId!, {
        name: editData.name,
        age: parseInt(editData.age),
        phone: editData.phone,
        case: editData.case || null,
        gender: editData.gender,
      });
      setShowEditModal(false);
      await loadPatient();
    } catch (error) {
      console.error('Error updating patient:', error);
      alert('Failed to update patient');
    }
  };

  const handleSendLink = async () => {
    try {
      const preConsult = await createPreConsult(user!.id, patientId!);
      const link = `${window.location.origin}/pre-consult/${preConsult.id}`;
      alert(`Pre-consult link created: ${link}`);
      setShowConfirmation(false);
    } catch (error) {
      console.error('Error creating pre-consult:', error);
      alert('Failed to create pre-consult link');
    }
  };

  const handleOpenForm = async () => {
    try {
      const preConsult = await createPreConsult(user!.id, patientId!);
      window.open(`/pre-consult/${preConsult.id}`, '_blank');
      setShowConfirmation(false);
    } catch (error) {
      console.error('Error creating pre-consult:', error);
      alert('Failed to open pre-consult form');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setDocumentsToUpload(Array.from(e.target.files));
      setUploadError('');
    }
  };

  const handleCloseDocumentUpload = () => {
    setShowDocumentUpload(false);
    setDocumentsToUpload([]);
    setUploadError('');
  };

  const confirmDocumentSubmit = async () => {
    if (documentsToUpload.length === 0) return;

    try {
      setIsUploading(true);
      setUploadError('');

      const preConsult = await createPreConsult(user!.id, patientId!);
      const uploadedUrls = [];

      for (const file of documentsToUpload) {
        const fileName = `${preConsult.id}-${Date.now()}-${file.name}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('pre-consultation-documents')
          .upload(fileName, file, {
            contentType: file.type || 'application/octet-stream',
            upsert: false,
            duplex: 'half'
          });

        if (uploadError) {
          console.error('Storage upload error:', uploadError);
          throw new Error(`Failed to upload document: ${file.name}`);
        }

        const { data: urlData } = supabase.storage
          .from('pre-consultation-documents')
          .getPublicUrl(uploadData.path);

        uploadedUrls.push(urlData.publicUrl);
      }

      await updatePreConsult(preConsult.id, {
        status: 'Submitted',
        documents_uploaded: uploadedUrls,
        ai_summary: null
      });

      handleCloseDocumentUpload();
      alert('Documents uploaded successfully!');
    } catch (error: any) {
      console.error('Error submitting documents:', error);
      setUploadError(error.message || 'Failed to upload documents');
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartStopRecording = async () => {
    if (!isRecording) {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        recorder.onstop = async () => {
          const audioBlob = new Blob(chunks, { type: 'audio/webm' });
          await handleRecordingComplete(audioBlob);
          stream.getTracks().forEach(track => track.stop());
        };

        setMediaRecorder(recorder);
        recorder.start();
        setIsRecording(true);
        setRecordingTime(0);

        const interval = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
        (window as any).recordingInterval = interval;
      } catch (error) {
        console.error('Error starting recording:', error);
        alert('Failed to start recording. Please check microphone permissions.');
      }
    } else {
      // Stop recording
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      setIsRecording(false);
      clearInterval((window as any).recordingInterval);
    }
  };

  const handleRecordingComplete = async (audioBlob: Blob) => {
    try {
      const fileName = `consultation-${patientId}-${Date.now()}.webm`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('consultation-recordings')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
          upsert: false
        });

      if (uploadError) {
        throw new Error('Failed to upload recording');
      }

      const { data: urlData } = supabase.storage
        .from('consultation-recordings')
        .getPublicUrl(uploadData.path);

      const consult = await createConsult(
        user!.id,
        patientId!,
        urlData.publicUrl
      );

      // Update with dummy transcript and AI summary
      await updateConsult(consult.id, {
        recording_transcript: 'Recording completed and saved.',
        consult_summary_ai: {
          diagnosis: 'Consultation recorded',
          history: 'Audio recording completed successfully',
          chief_complaints: 'Recording saved for analysis',
          treatment_suggested: 'Review recording for treatment plan',
          medications: [],
          key_personal_insights: 'Recording available for review',
          followup_recommendations: 'Analyze recording and provide follow-up'
        }
      });

      setRecordingTime(0);
      alert('Recording saved successfully!');
    } catch (error) {
      console.error('Error saving recording:', error);
      alert('Failed to save recording');
    }
  };

  const handleConfirmAction = () => {
    switch (confirmationType) {
      case 'send-link':
        handleSendLink();
        break;
      case 'open-form':
        handleOpenForm();
        break;
      case 'upload-docs':
        setShowConfirmation(false);
        setShowDocumentUpload(true);
        break;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }) + ' at ' + date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderSummaryContent = (summary: any) => {
    if (!summary || !summary.summary) {
      return <p className="text-gray-500">No summary available</p>;
    }

    const summaryData = summary.summary;

    return (
      <div className="space-y-6">
        {/* Main Summary */}
        {summaryData.summary && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
              <FileText className="w-4 h-4 mr-2" />
              Summary
            </h4>
            <p className="text-blue-800">{summaryData.summary}</p>
          </div>
        )}

        {/* Analysis */}
        {summaryData.analysis && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">Analysis</h4>
            <p className="text-gray-700">{summaryData.analysis}</p>
          </div>
        )}

        {/* Key Findings */}
        {summaryData.key_findings && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-900 mb-2 flex items-center">
              <TrendingUp className="w-4 h-4 mr-2" />
              Key Findings
            </h4>
            {Array.isArray(summaryData.key_findings) ? (
              <ul className="list-disc list-inside space-y-1 text-yellow-800">
                {summaryData.key_findings.map((finding: string, idx: number) => (
                  <li key={idx}>{finding}</li>
                ))}
              </ul>
            ) : (
              <p className="text-yellow-800">{summaryData.key_findings}</p>
            )}
          </div>
        )}

        {/* Recommendations */}
        {summaryData.recommendations && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-900 mb-2">Recommendations</h4>
            {Array.isArray(summaryData.recommendations) ? (
              <ul className="list-disc list-inside space-y-1 text-green-800">
                {summaryData.recommendations.map((rec: string, idx: number) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            ) : (
              <p className="text-green-800">{summaryData.recommendations}</p>
            )}
          </div>
        )}

        {/* Medical History */}
        {summaryData.medical_history && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h4 className="font-semibold text-purple-900 mb-2">Medical History</h4>
            <p className="text-purple-800">{summaryData.medical_history}</p>
          </div>
        )}

        {/* Current Symptoms */}
        {summaryData.symptoms && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-semibold text-red-900 mb-2">Current Symptoms</h4>
            {Array.isArray(summaryData.symptoms) ? (
              <ul className="list-disc list-inside space-y-1 text-red-800">
                {summaryData.symptoms.map((symptom: string, idx: number) => (
                  <li key={idx}>{symptom}</li>
                ))}
              </ul>
            ) : (
              <p className="text-red-800">{summaryData.symptoms}</p>
            )}
          </div>
        )}

        {/* Current Medications */}
        {summaryData.medications && summaryData.medications.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <h4 className="font-semibold text-indigo-900 mb-3 flex items-center">
              <Pill className="w-4 h-4 mr-2" />
              Current Medications
            </h4>
            <div className="grid gap-3">
              {summaryData.medications.map((med: any, idx: number) => (
                <div key={idx} className="bg-white rounded-lg p-3 border border-indigo-200">
                  <div className="font-medium text-indigo-900">{med.name || med}</div>
                  {med.dosage && <div className="text-sm text-indigo-700">Dosage: {med.dosage}</div>}
                  {med.frequency && <div className="text-sm text-indigo-700">Frequency: {med.frequency}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Allergies */}
        {summaryData.allergies && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <h4 className="font-semibold text-orange-900 mb-2 flex items-center">
              <AlertCircle className="w-4 h-4 mr-2" />
              Allergies
            </h4>
            <p className="text-orange-800">{summaryData.allergies}</p>
          </div>
        )}

        {/* Urgency Level */}
        {summaryData.urgency && (
          <div className="flex items-center justify-center">
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${
              summaryData.urgency.toLowerCase() === 'high' 
                ? 'bg-red-100 text-red-700'
                : summaryData.urgency.toLowerCase() === 'medium'
                ? 'bg-orange-100 text-orange-700'
                : 'bg-green-100 text-green-700'
            }`}>
              Priority: {summaryData.urgency}
            </span>
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#024CDB] mx-auto"></div>
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
            <p className="text-gray-500">Patient not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar showBack />

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Patient Info Container */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{patient.name}</h1>
                  <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                    <span>{patient.age} years</span>
                    <span>{patient.gender}</span>
                    <span>{patient.phone}</span>
                  </div>
                  {patient.case && (
                    <div className="mt-2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-[#024CDB]">
                        {patient.case}
                      </span>
                    </div>
                  )}
                  {patient.last_visit_at && (
                    <p className="text-sm text-gray-500 mt-2">
                      Last visit: {formatDate(patient.last_visit_at)}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Edit patient"
                >
                  <Edit className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 lg:flex-col xl:flex-row">
              <button
                onClick={() => {
                  setConfirmationType('upload-docs');
                  setShowConfirmation(true);
                }}
                className="btn-secondary flex items-center justify-center space-x-2"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Documents</span>
              </button>
              
              <button
                onClick={() => {
                  setConfirmationType('open-form');
                  setShowConfirmation(true);
                }}
                className="btn-secondary flex items-center justify-center space-x-2"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open Form</span>
              </button>
              
              <button
                onClick={() => {
                  setConfirmationType('send-link');
                  setShowConfirmation(true);
                }}
                className="btn-secondary flex items-center justify-center space-x-2"
              >
                <Send className="w-4 h-4" />
                <span>Send Link</span>
              </button>

              <button
                onClick={handleStartStopRecording}
                className={`flex items-center justify-center space-x-2 font-medium py-2 px-4 rounded-lg transition-colors ${
                  isRecording 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : 'bg-[#024CDB] hover:bg-[#023BA3] text-white'
                }`}
              >
                {isRecording ? (
                  <>
                    <Square className="w-4 h-4" />
                    <span>Stop ({formatTime(recordingTime)})</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    <span>Start Consultation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Summary Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('summary')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'summary'
                    ? 'border-[#024CDB] text-[#024CDB]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Summary
              </button>
              <button
                onClick={() => setActiveTab('past-summaries')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'past-summaries'
                    ? 'border-[#024CDB] text-[#024CDB]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Past Summaries
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'summary' && (
              <div>
                {latestSummary ? (
                  renderSummaryContent(latestSummary)
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No summary available yet</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'past-summaries' && (
              <div>
                {pastSummaries.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pastSummaries.map((summary) => (
                      <div
                        key={summary.id}
                        onClick={() => {
                          setSelectedSummary(summary);
                          setShowSummaryModal(true);
                        }}
                        className="card"
                      >
                        <div className="flex items-center text-sm text-gray-500 mb-2">
                          <Clock className="w-4 h-4 mr-1" />
                          {formatDate(summary.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No past summaries available</p>
                  </div>
                )}
              </div>
            )}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={editData.name}
              onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Case (optional)
            </label>
            <input
              type="text"
              value={editData.case}
              onChange={(e) => setEditData({ ...editData, case: e.target.value })}
              className="input-field"
              placeholder="e.g., Hypertension, Diabetes"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={editData.phone}
              onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
              className="input-field"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Age <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={editData.age}
                onChange={(e) => setEditData({ ...editData, age: e.target.value })}
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender <span className="text-red-500">*</span>
              </label>
              <select
                value={editData.gender}
                onChange={(e) => setEditData({ ...editData, gender: e.target.value })}
                className="input-field"
                required
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="flex space-x-3 justify-end pt-4">
            <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
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
          <p className="text-gray-600">
            Upload medical documents, prescriptions, or reports for this patient.
          </p>
          
          <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            <Upload className="w-12 h-12 text-gray-400 mb-2" />
            <span className="text-gray-600">Click to upload files</span>
            <input
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
          
          {documentsToUpload.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">
                {documentsToUpload.length} file(s) selected:
              </p>
              {documentsToUpload.map((file, idx) => (
                <div key={idx} className="flex items-center text-sm text-gray-600 bg-gray-50 rounded px-3 py-2">
                  <span className="mr-2">📎</span>
                  <span className="flex-1">{file.name}</span>
                  <span className="text-xs text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                </div>
              ))}
            </div>
          )}

          {uploadError && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              {uploadError}
            </div>
          )}

          <div className="flex space-x-3 justify-end pt-4">
            <button onClick={handleCloseDocumentUpload} className="btn-secondary">
              Cancel
            </button>
            <button 
              onClick={confirmDocumentSubmit} 
              disabled={documentsToUpload.length === 0 || isUploading}
              className="btn-primary disabled:opacity-50"
            >
              {isUploading ? 'Uploading...' : 'Upload Documents'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Summary Modal */}
      <Modal
        isOpen={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        title={`Summary - ${selectedSummary ? formatDate(selectedSummary.created_at) : ''}`}
      >
        {selectedSummary && renderSummaryContent(selectedSummary)}
      </Modal>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleConfirmAction}
        title={
          confirmationType === 'send-link' ? 'Send Pre-consult Link' :
          confirmationType === 'open-form' ? 'Open Pre-consult Form' :
          'Upload Documents'
        }
        message={
          confirmationType === 'send-link' ? 'Create and display a pre-consult link for this patient?' :
          confirmationType === 'open-form' ? 'Open the pre-consult form in a new window?' :
          'Upload documents for this patient?'
        }
      />
    </div>
  );
}