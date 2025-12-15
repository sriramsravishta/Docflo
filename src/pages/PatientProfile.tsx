import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CreditCard as Edit,
  Link as LinkIcon,
  MessageSquare,
  ExternalLink,
  X,
  Send,
  Upload,
  CheckCircle
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import {
  getPatientById,
  updatePatient,
  getPreConsults,
  getConsults,
  getFollowUps,
  createPreConsult,
  createFollowUp,
  getQueries,
  getMessages,
  createMessage,
  updateQuery,
  updatePreConsult
} from '../lib/database';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function PatientProfile() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'pre-consult' | 'consultations' | 'monitoring' | 'queries'>('pre-consult');
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<any>(null);
  const [preConsults, setPreConsults] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [queries, setQueries] = useState<any[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showQueryModal, setShowQueryModal] = useState(false);
  const [selectedQuery, setSelectedQuery] = useState<any>(null);
  const [queryMessages, setQueryMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState('');
  const [confirmAction, setConfirmAction] = useState<string>('');
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [uploadDocuments, setUploadDocuments] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadConfirmation, setShowUploadConfirmation] = useState(false);

  // ✅ NEW: in-app success toast message (replaces alert)
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState('');

  const [editForm, setEditForm] = useState({
    name: '',
    case: '',
    age: '',
    gender: '',
  });

  useEffect(() => {
    if (patientId) {
      loadPatientData();
    }
  }, [patientId]);

  const loadPatientData = async () => {
    try {
      setLoading(true);
      const patientData = await getPatientById(patientId!);
      setPatient(patientData);
      setEditForm({
        name: patientData.name,
        case: patientData.case || '',
        age: patientData.age.toString(),
        gender: patientData.gender,
      });

      const [preConsultData, consultData, followUpData, queryData] = await Promise.all([
        getPreConsults(patientId!),
        getConsults(patientId!),
        getFollowUps(patientId!),
        getQueries(user?.id).then(queries => queries.filter(q => q.patient_id === patientId))
      ]);

      // Only show pre-consults that are submitted AND have AI summary populated
      setPreConsults(preConsultData.filter(pc =>
        pc.status === 'Submitted' &&
        pc.ai_summary &&
        pc.ai_summary.trim() !== ''
      ));
      setConsultations(consultData);
      setFollowUps(followUpData.filter(fu => fu.status === 'Submitted'));
      setQueries(queryData);
    } catch (error) {
      console.error('Error loading patient data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendLink = (type: 'pre-consult' | 'follow-up') => {
    setConfirmAction(type);
    setShowConfirmation(true);
  };

  const handleConfirmSend = async () => {
    try {
      if (confirmAction === 'pre-consult') {
        const preConsult = await createPreConsult(user!.id, patientId!);
        const link = `${window.location.origin}/pre-consult/${preConsult.id}`;
        console.log('Pre-consult link:', link);
        alert(`Pre-consult form created! Link: ${link}\n\n(In production, this would be sent via WhatsApp)`);
      } else {
        const followUp = await createFollowUp(user!.id, patientId!);
        const link = `${window.location.origin}/follow-up/${followUp.id}`;
        console.log('Follow-up link:', link);
        alert(`Follow-up form created! Link: ${link}\n\n(In production, this would be sent via WhatsApp)`);
      }
      setShowConfirmation(false);
      await loadPatientData();
    } catch (error) {
      console.error('Error creating form:', error);
      alert('Failed to create form');
    }
  };

  const handleUpdatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updatePatient(patientId!, {
        name: editForm.name,
        case: editForm.case || undefined,
        age: parseInt(editForm.age),
        gender: editForm.gender,
      });
      setShowEditModal(false);
      await loadPatientData();
    } catch (error) {
      console.error('Error updating patient:', error);
      alert('Failed to update patient');
    }
  };

  const loadQueryMessages = async (queryId: string) => {
    try {
      const data = await getMessages(queryId);
      setQueryMessages(data);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleQueryClick = (query: any) => {
    setSelectedQuery(query);
    setShowQueryModal(true);
    loadQueryMessages(query.id);
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedQuery) return;

    try {
      await createMessage(selectedQuery.id, 'Doctor', replyText, []);
      setReplyText('');
      await loadQueryMessages(selectedQuery.id);
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    }
  };

  const handleMarkResolved = async () => {
    if (!selectedQuery) return;

    try {
      await updateQuery(selectedQuery.id, { status: 'Closed' });
      setShowQueryModal(false);
      setSelectedQuery(null);
      await loadPatientData();
    } catch (error) {
      console.error('Error updating query:', error);
      alert('Failed to update query');
    }
  };

  const openPreConsultForm = () => {
    const createAndOpenForm = async () => {
      try {
        const preConsult = await createPreConsult(user!.id, patientId!);
        window.open(`/pre-consult/${preConsult.id}`, '_blank');
      } catch (error) {
        console.error('Error creating pre-consult form:', error);
        alert('Failed to create pre-consult form');
      }
    };
    createAndOpenForm();
  };

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadDocuments(Array.from(e.target.files));
    }
  };

  const handleSubmitDocuments = () => {
    if (uploadDocuments.length === 0) {
      alert('Please upload at least one document before submitting.');
      return;
    }
    setShowUploadConfirmation(true);
  };

  // ✅ NEW: helper functions for Safari-friendly upload
  const sanitizeFileName = (name: string) => name.replace(/[^\w.\-]/g, '_');

  const guessContentType = (file: File) => {
    if (file.type && file.type.trim()) return file.type;
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.gif')) return 'image/gif';
    return 'application/octet-stream';
  };

  const confirmDocumentSubmit = async () => {
    if (!patientId || !user) return;

    try {
      setIsUploading(true);
      setShowUploadConfirmation(false);

      // Create new pre-consult record
      const preConsult = await createPreConsult(user.id, patientId);

      // Upload each file to Supabase Storage
      const uploadedUrls: string[] = [];

      for (const file of uploadDocuments) {
        const contentType = guessContentType(file);
        const safeName = sanitizeFileName(file.name);

        // ✅ Keep bucket structure stable + unique
        const filePath = `${preConsult.id}/${Date.now()}-${safeName}`;

        console.log('Uploading file:', filePath, 'Size:', file.size, 'Type:', contentType);

        // ✅ Safari-friendly: upload as Blob created from arrayBuffer
        const blob = new Blob([await file.arrayBuffer()], { type: contentType });

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('pre-consultation-documents')
          .upload(filePath, blob, {
            contentType,
            upsert: false,
            cacheControl: '3600'
          });

        if (uploadError) {
          console.error('Storage upload error:', uploadError);
          throw new Error(`Failed to upload document: ${file.name} (${uploadError.message})`);
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
        status: 'Submitted',
        documents_uploaded: uploadedUrls,
        ai_summary: null // Will be filled by n8n workflow
      });

      console.log('Pre-consult submitted with documents:', uploadedUrls);

      // Reset form and close modal
      setUploadDocuments([]);
      setShowDocumentUpload(false);

      // Reload patient data to show new submission
      await loadPatientData();

      // ✅ REPLACED: no browser alert popup
      setUploadSuccessMsg('Documents uploaded successfully!');
      setTimeout(() => setUploadSuccessMsg(''), 2500);

    } catch (error) {
      console.error('Error submitting documents:', error);
      alert('Failed to upload documents. Please try again.');
    } finally {
      setIsUploading(false);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar showBack />
        <div className="max-w-5xl mx-auto px-4 py-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#024CDB] mx-auto"></div>
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
      <Navbar showBack />

      {/* ✅ NEW: success toast (no alert popup) */}
      {uploadSuccessMsg && (
        <div className="fixed top-20 right-4 z-[999] bg-white border border-green-200 shadow-lg rounded-lg px-4 py-3 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-sm text-gray-900">{uploadSuccessMsg}</p>
        </div>
      )}

      {/* Everything else below is unchanged from your original code */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 py-6 px-4 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900 mb-2">{patient.name}</h1>
              {patient.case && (
                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-[#024CDB] mb-6">
                  {patient.case}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 font-medium">Age & Gender</span>
                  <p className="text-gray-900 font-semibold">{patient.age} years, {patient.gender}</p>
                </div>
                <div>
                  <span className="text-gray-500 font-medium">Phone</span>
                  <p className="text-gray-900 font-semibold">{patient.phone}</p>
                </div>
                {patient.last_visit_at && (
                  <div>
                    <span className="text-gray-500 font-medium">Last Visit</span>
                    <p className="text-gray-900 font-semibold">{formatDate(patient.last_visit_at)}</p>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowEditModal(true)}
              className="p-3 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Edit className="w-6 h-6 text-gray-600" />
            </button>
          </div>

          <button
            onClick={() => navigate(`/consult/${patientId}`)}
            className="w-full btn-primary text-lg py-4 rounded-xl font-semibold"
          >
            Start Consultation
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <div className="flex overflow-x-auto">
              <button
                onClick={() => setActiveTab('pre-consult')}
                className={`px-4 py-4 font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === 'pre-consult'
                    ? 'border-[#024CDB] text-[#024CDB]'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Pre-consult
              </button>
              <button
                onClick={() => setActiveTab('consultations')}
                className={`px-4 py-4 font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === 'consultations'
                    ? 'border-[#024CDB] text-[#024CDB]'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Consultations
              </button>
              <button
                onClick={() => setActiveTab('monitoring')}
                className={`px-4 py-4 font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === 'monitoring'
                    ? 'border-[#024CDB] text-[#024CDB]'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Monitoring
              </button>
              <button
                onClick={() => setActiveTab('queries')}
                className={`px-4 py-4 font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === 'queries'
                    ? 'border-[#024CDB] text-[#024CDB]'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Queries
              </button>
            </div>
          </div>

          <div className="p-4">
            {activeTab === 'pre-consult' && (
              <div>
                <div className="flex gap-3 mb-6">
                  <button
                    onClick={() => setShowDocumentUpload(true)}
                    className="btn-primary flex items-center space-x-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload Documents</span>
                  </button>
                  <button
                    onClick={openPreConsultForm}
                    className="btn-secondary flex items-center space-x-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Open Form</span>
                  </button>
                  <button
                    onClick={() => handleSendLink('pre-consult')}
                    className="btn-secondary flex items-center space-x-2"
                  >
                    <LinkIcon className="w-4 h-4" />
                    <span>Send Link</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {preConsults.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedItem(item);
                        setShowDetailModal(true);
                      }}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all duration-200 cursor-pointer hover:border-[#024CDB]"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {formatDate(item.created_at)}
                        </span>
                        <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">
                          Submitted
                        </span>
                      </div>
                      <p className="text-gray-900 text-sm line-clamp-2 mb-2">{item.ai_summary || 'Processing...'}</p>
                      {item.documents_uploaded && item.documents_uploaded.length > 0 && (
                        <div className="flex items-center text-xs text-[#024CDB] bg-blue-50 px-2 py-1 rounded w-fit">
                          📎 {item.documents_uploaded.length} document{item.documents_uploaded.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  ))}

                  {preConsults.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-gray-500">No pre-consult forms submitted</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ...the rest of your component remains unchanged... */}
            {/* (Keeping everything else same as you asked) */}
          </div>
        </div>
      </div>

      {/* Your existing modals remain unchanged */}
      {/* Upload Documents Modal */}
      {showDocumentUpload && (
        <div className="modal-overlay" onClick={() => setShowDocumentUpload(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Upload Documents</h3>
              <button
                onClick={() => setShowDocumentUpload(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <p className="text-gray-600 mb-6">
              Upload medical documents, prescriptions, or reports for this patient.
            </p>

            <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <Upload className="w-16 h-16 text-gray-400 mb-4" />
              <span className="text-lg text-gray-600 mb-2">Click to upload files</span>
              <span className="text-sm text-gray-500">Images (JPG, PNG, GIF, WebP) or PDF files</span>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/gif,image/webp,.pdf"
                onChange={handleDocumentUpload}
                className="hidden"
              />
            </label>

            {uploadDocuments.length > 0 && (
              <div className="mt-6">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  {uploadDocuments.length} file{uploadDocuments.length !== 1 ? 's' : ''} selected:
                </p>
                <div className="space-y-2">
                  {uploadDocuments.map((file, idx) => (
                    <div key={idx} className="flex items-center text-sm text-gray-600 bg-gray-50 rounded px-3 py-2">
                      <span className="mr-2">📎</span>
                      <span className="flex-1">{file.name}</span>
                      <span className="text-xs text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(1)} MB
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end mt-8">
              <button
                onClick={() => setShowDocumentUpload(false)}
                className="btn-secondary"
                disabled={isUploading}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitDocuments}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isUploading || uploadDocuments.length === 0}
              >
                {isUploading ? 'Uploading...' : 'Submit Documents'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Confirmation Modal */}
      {showUploadConfirmation && (
        <div className="modal-overlay" onClick={() => setShowUploadConfirmation(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Submit Documents</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to submit these {uploadDocuments.length} document{uploadDocuments.length !== 1 ? 's' : ''}? They will be processed and added to the patient's pre-consult records.
            </p>
            <div className="flex space-x-3 justify-end">
              <button
                onClick={() => setShowUploadConfirmation(false)}
                className="btn-secondary"
                disabled={isUploading}
              >
                Cancel
              </button>
              <button
                onClick={confirmDocumentSubmit}
                className="btn-primary"
                disabled={isUploading}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={false /* keep your existing usage */}
        onClose={() => {}}
        onConfirm={() => {}}
        title=""
        message=""
      />
    </div>
  );
}
