import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CreditCard as Edit, Copy, FileText, Link as LinkIcon } from 'lucide-react';
import Navbar from '../components/Navbar';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';

const mockPatient = {
  id: '1',
  name: 'Rajesh Kumar',
  case: 'Hypertension',
  age: 45,
  gender: 'Male',
  phone: '+91 98765 43210',
};

const mockPreConsults = [
  {
    id: '1',
    timestamp: '2025-10-04 09:00 AM',
    summary: 'Patient reporting increased blood pressure readings. Experiencing headaches and dizziness...',
    documents: 3,
  },
];

const mockConsultations = [
  {
    id: '1',
    timestamp: '2025-10-03 11:30 AM',
    summary: 'Blood pressure controlled. Continue medication. Patient feeling better overall...',
  },
];

const mockFollowUps = [
  {
    id: '1',
    timestamp: '2025-10-02 02:00 PM',
    summary: 'Taking medication regularly. Blood pressure readings stable. No new symptoms...',
  },
];

export default function PatientProfile() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'pre-consult' | 'consultations' | 'monitoring' | 'queries'>('pre-consult');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmAction, setConfirmAction] = useState<string>('');

  const handleSendLink = (type: 'pre-consult' | 'follow-up') => {
    setConfirmAction(type);
    setShowConfirmation(true);
  };

  const handleConfirmSend = () => {
    setShowConfirmation(false);
    alert(`${confirmAction === 'pre-consult' ? 'Pre-consult' : 'Follow-up'} form link sent via WhatsApp!`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar showBack />

      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{mockPatient.name}</h1>
              {mockPatient.case && (
                <p className="text-lg text-[#024CDB] mt-1">{mockPatient.case}</p>
              )}
              <p className="text-gray-600 mt-2">
                {mockPatient.age} yrs, {mockPatient.gender}
              </p>
              <p className="text-gray-600">{mockPatient.phone}</p>
            </div>
            <button
              onClick={() => setShowEditModal(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Edit className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <button
            onClick={() => navigate(`/consult/${patientId}`)}
            className="w-full btn-primary text-lg py-3"
          >
            Start Consultation
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <div className="flex overflow-x-auto">
              <button
                onClick={() => setActiveTab('pre-consult')}
                className={`px-6 py-4 font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === 'pre-consult'
                    ? 'border-[#024CDB] text-[#024CDB]'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Pre-consult
              </button>
              <button
                onClick={() => setActiveTab('consultations')}
                className={`px-6 py-4 font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === 'consultations'
                    ? 'border-[#024CDB] text-[#024CDB]'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Consultations
              </button>
              <button
                onClick={() => setActiveTab('monitoring')}
                className={`px-6 py-4 font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === 'monitoring'
                    ? 'border-[#024CDB] text-[#024CDB]'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Monitoring
              </button>
              <button
                onClick={() => setActiveTab('queries')}
                className={`px-6 py-4 font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === 'queries'
                    ? 'border-[#024CDB] text-[#024CDB]'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Queries
              </button>
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'pre-consult' && (
              <div>
                <div className="flex gap-3 mb-6">
                  <button
                    onClick={() => handleSendLink('pre-consult')}
                    className="btn-secondary flex items-center space-x-2"
                  >
                    <LinkIcon className="w-4 h-4" />
                    <span>Send Link</span>
                  </button>
                  <button
                    onClick={() => window.open(`/pre-consult/${patientId}?doctorId=1`, '_blank')}
                    className="btn-secondary flex items-center space-x-2"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Open Form</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {mockPreConsults.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedItem(item);
                        setShowDetailModal(true);
                      }}
                      className="card"
                    >
                      <p className="text-sm text-gray-500 mb-2">{item.timestamp}</p>
                      <p className="text-gray-900 line-clamp-2">{item.summary}</p>
                      <p className="text-sm text-[#024CDB] mt-2">{item.documents} documents</p>
                    </div>
                  ))}

                  {mockPreConsults.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-gray-500">No pre-consult forms submitted</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'consultations' && (
              <div className="space-y-3">
                {mockConsultations.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedItem(item);
                      setShowDetailModal(true);
                    }}
                    className="card"
                  >
                    <p className="text-sm text-gray-500 mb-2">{item.timestamp}</p>
                    <p className="text-gray-900 line-clamp-2">{item.summary}</p>
                  </div>
                ))}

                {mockConsultations.length === 0 && (
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
                  {mockFollowUps.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedItem(item);
                        setShowDetailModal(true);
                      }}
                      className="card"
                    >
                      <p className="text-sm text-gray-500 mb-2">{item.timestamp}</p>
                      <p className="text-gray-900 line-clamp-2">{item.summary}</p>
                    </div>
                  ))}

                  {mockFollowUps.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-gray-500">No follow-up forms submitted</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'queries' && (
              <div className="text-center py-12">
                <p className="text-gray-500">No queries from this patient</p>
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
        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input type="text" defaultValue={mockPatient.name} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Case</label>
            <input type="text" defaultValue={mockPatient.case} className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
              <input type="number" defaultValue={mockPatient.age} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select defaultValue={mockPatient.gender} className="input-field">
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

      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleConfirmSend}
        title="Send Form Link"
        message={`Send ${confirmAction === 'pre-consult' ? 'pre-consult' : 'follow-up'} form link to ${mockPatient.name} via WhatsApp?`}
      />
    </div>
  );
}
