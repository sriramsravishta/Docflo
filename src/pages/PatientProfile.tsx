import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CreditCard as Edit, Link as LinkIcon, MessageSquare, ExternalLink, X, Send, Upload, CheckCircle } from 'lucide-react';
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

  const confirmDocumentSubmit = async () => {
    if (!patientId || !user) return;

    try {
      setIsUploading(true);
      setShowUploadConfirmation(false);

      // Create new pre-consult record
      const preConsult = await createPreConsult(user.id, patientId);

      // Upload each file to Supabase Storage
      const uploadedUrls = [];
      
      for (const file of uploadDocuments) {
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
      
      alert('Documents uploaded successfully!');
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

            {activeTab === 'consultations' && (
              <div className="space-y-3">
                {consultations.map((item) => (
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
                      <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                        Completed
                      </span>
                    </div>
                    <p className="text-gray-900 text-sm line-clamp-2">
                      {item.consult_summary_final?.diagnosis || item.consult_summary_ai?.diagnosis || 'Processing...'}
                    </p>
                  </div>
                ))}

                {consultations.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No consultations recorded</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'monitoring' && (
              <div>
                <div className="flex justify-end mb-6">
                  <button
                    onClick={() => handleSendLink('follow-up')}
                    className="btn-primary flex items-center space-x-2"
                  >
                    <LinkIcon className="w-4 h-4" />
                    <span>Send Follow-up Form</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {followUps.map((item) => (
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
                      <p className="text-gray-900 text-sm line-clamp-2">{item.ai_summary || 'Processing...'}</p>
                    </div>
                  ))}

                  {followUps.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-gray-500">No follow-up forms submitted</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'queries' && (
              <div>
                <div className="flex justify-end mb-6">
                  <button
                    onClick={() => window.open(`/patient-queries/${patientId}/${user?.id}`, '_blank')}
                    className="btn-primary flex items-center space-x-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Open Query Page</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {queries.map((query) => (
                    <div
                      key={query.id}
                      onClick={() => handleQueryClick(query)}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all duration-200 cursor-pointer hover:border-[#024CDB]"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {formatDate(query.created_at)}
                        </span>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            query.priority === 'High'
                              ? 'bg-red-100 text-red-700'
                              : query.priority === 'Medium'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {query.priority}
                        </span>
                      </div>
                      <p className="text-gray-900 text-sm line-clamp-2">{query.initial_query}</p>
                    </div>
                  ))}

                  {queries.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-gray-500">No queries from this patient</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Patient"
      >
        <form onSubmit={handleUpdatePatient} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Case</label>
            <input
              type="text"
              value={editForm.case}
              onChange={(e) => setEditForm({ ...editForm, case: e.target.value })}
              className="input-field"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
              <input
                type="number"
                value={editForm.age}
                onChange={(e) => setEditForm({ ...editForm, age: e.target.value })}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select
                value={editForm.gender}
                onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                className="input-field"
                required
              >
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </div>
          </div>
          <div className="flex space-x-3 justify-end pt-4">
            <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save
            </button>
          </div>
        </form>
      </Modal>

      {showQueryModal && selectedQuery && (
        <div className="modal-overlay" onClick={() => setShowQueryModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Query Thread</h2>
                <p className="text-sm text-gray-600">{patient?.name || 'Unknown Patient'}</p>
                {patient?.case && (
                  <p className="text-sm text-[#024CDB]">{patient.case}</p>
                )}
                <p className="text-sm text-gray-500">{patient?.phone || 'No phone'}</p>
              </div>
              <button
                onClick={() => setShowQueryModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 max-h-96">
              <div className="space-y-3">
                <div className="flex justify-start pr-12">
                  <div className="bg-gray-50 rounded-lg p-3 max-w-md">
                    <p className="text-xs text-gray-500 mb-1">{formatDate(selectedQuery.created_at)}</p>
                    <p className="text-gray-900">{selectedQuery.initial_query}</p>
                  </div>
                </div>
                {queryMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.sender_type === 'Doctor' ? 'justify-end pl-12' : 'justify-start pr-12'
                    }`}
                  >
                    <div
                      className={`rounded-lg p-3 max-w-md ${
                        msg.sender_type === 'Doctor' ? 'bg-blue-50' : 'bg-gray-50'
                      }`}
                    >
                      <p className="text-xs text-gray-500 mb-1">{formatDate(msg.created_at)}</p>
                      <p className="text-gray-900">{msg.message}</p>
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {msg.attachments.map((attachment: any, idx: number) => (
                            <div key={idx} className="text-xs text-[#024CDB] bg-white rounded px-2 py-1">
                              📎 {attachment.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your reply..."
                  className="flex-1 input-field"
                />
                <button onClick={handleSendReply} className="btn-primary flex items-center space-x-2">
                  <Send className="w-4 h-4" />
                  <span>Send</span>
                </button>
              </div>
              <div className="flex gap-3">
                <button onClick={handleMarkResolved} className="btn-primary flex-1" disabled={selectedQuery.status === 'Closed'}>
                  {selectedQuery.status === 'Closed' ? 'Resolved' : 'Mark Resolved'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && selectedItem && (
        <Modal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          title={activeTab === 'pre-consult' ? 'Pre-Consult Details' :
                 activeTab === 'consultations' ? 'Consultation Details' : 'Follow-Up Details'}
        >
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Date & Time</p>
              <p className="text-gray-900 font-semibold">{formatDate(selectedItem.created_at)}</p>
            </div>

            {activeTab === 'pre-consult' && (
              <>
                {selectedItem.ai_summary && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">AI Summary</p>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-gray-900 whitespace-pre-wrap text-sm leading-relaxed">{selectedItem.ai_summary}</p>
                    </div>
                  </div>
                )}
                {selectedItem.documents_uploaded && selectedItem.documents_uploaded.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">Uploaded Documents</p>
                    <div className="space-y-2 bg-gray-50 rounded-lg p-4">
                      {selectedItem.documents_uploaded.map((doc: any, idx: number) => (
                        <div key={idx} className="flex items-center text-sm text-[#024CDB] bg-white rounded px-3 py-2">
                          <span className="mr-2">📎</span>
                          <a href={doc} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            Document {idx + 1}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'consultations' && (selectedItem.consult_summary_final || selectedItem.consult_summary_ai) && (
              <div className="space-y-4">
                {(() => {
                  const summary = selectedItem.consult_summary_final || selectedItem.consult_summary_ai;
                  return (
                    <>
                {selectedItem.consult_summary_final.diagnosis && (
                  <div>
                        <p className="text-sm font-medium text-gray-500 mb-2">Diagnosis</p>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-gray-900 text-sm">{summary.diagnosis}</p>
                        </div>
                  </div>
                )}
                      {summary.history && (
                        <div>
                          <p className="text-sm font-medium text-gray-500 mb-2">History</p>
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-gray-900 text-sm">{summary.history}</p>
                          </div>
                        </div>
                      )}
                      {summary.chief_complaints && (
                        <div>
                          <p className="text-sm font-medium text-gray-500 mb-2">Chief Complaints</p>
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-gray-900 text-sm">{summary.chief_complaints}</p>
                          </div>
                        </div>
                      )}
                {selectedItem.consult_summary_final.treatment_suggested && (
                  <div>
                          <p className="text-sm font-medium text-gray-500 mb-2">Treatment Plan</p>
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-gray-900 text-sm">{summary.treatment_suggested}</p>
                          </div>
                  </div>
                )}
                {selectedItem.consult_summary_final.medications && selectedItem.consult_summary_final.medications.length > 0 && (
                  <div>
                          <p className="text-sm font-medium text-gray-500 mb-2">Medications</p>
                          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      {selectedItem.consult_summary_final.medications.map((med: any, idx: number) => (
                            <div key={idx} className="bg-white rounded p-3 border-l-4 border-[#024CDB]">
                              <p className="font-medium text-gray-900 text-sm">{med.name}</p>
                              <p className="text-gray-600 text-xs mt-1">{med.frequency} • {med.duration} • {med.timing}</p>
                            </div>
                      ))}
                    </div>
                  </div>
                )}
                      {summary.followup_recommendations && (
                        <div>
                          <p className="text-sm font-medium text-gray-500 mb-2">Follow-up Recommendations</p>
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-gray-900 text-sm">{summary.followup_recommendations}</p>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {activeTab === 'monitoring' && selectedItem.ai_summary && (
              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">Follow-up Summary</p>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-900 whitespace-pre-wrap text-sm leading-relaxed">{selectedItem.ai_summary}</p>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleConfirmSend}
        title="Send Form Link"
        message={`Send ${confirmAction === 'pre-consult' ? 'pre-consult' : 'follow-up'} form link to ${patient.name}?`}
      />

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
    </div>
  );
}
