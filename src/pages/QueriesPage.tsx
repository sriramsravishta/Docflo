import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Modal from '../components/Modal';
import { Send, Paperclip } from 'lucide-react';

const mockQueries = [
  {
    id: '1',
    patientId: '1',
    patientName: 'Rajesh Kumar',
    phone: '+91 98765 43210',
    timestamp: '2025-10-04 10:30 AM',
    preview: 'Doctor, I have been experiencing severe headaches for the past two days. Should I be worried about this?',
    priority: 'High',
    status: 'Active',
  },
  {
    id: '2',
    patientId: '2',
    patientName: 'Priya Sharma',
    phone: '+91 98765 43211',
    timestamp: '2025-10-04 09:15 AM',
    preview: 'Hi doctor, I forgot to ask during my last visit - can I take my diabetes medication with food or...',
    priority: 'Medium',
    status: 'Active',
  },
  {
    id: '3',
    patientId: '3',
    patientName: 'Amit Patel',
    phone: '+91 98765 43212',
    timestamp: '2025-10-03 03:45 PM',
    preview: 'The skin rash you prescribed medicine for is getting better. Should I continue the cream?',
    priority: 'Low',
    status: 'Active',
  },
];

export default function QueriesPage() {
  const navigate = useNavigate();
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);
  const [selectedQuery, setSelectedQuery] = useState<any>(null);
  const [replyText, setReplyText] = useState('');

  const filteredQueries = selectedPriority
    ? mockQueries.filter(q => q.priority === selectedPriority)
    : mockQueries;

  const handleSendReply = () => {
    setReplyText('');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar showBack />

      <div className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Patient Queries</h1>

        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setSelectedPriority(null)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedPriority === null
                ? 'bg-[#024CDB] text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setSelectedPriority('High')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedPriority === 'High'
                ? 'bg-red-600 text-white'
                : 'bg-white text-red-600 border border-red-600 hover:bg-red-50'
            }`}
          >
            High
          </button>
          <button
            onClick={() => setSelectedPriority('Medium')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedPriority === 'Medium'
                ? 'bg-orange-600 text-white'
                : 'bg-white text-orange-600 border border-orange-600 hover:bg-orange-50'
            }`}
          >
            Medium
          </button>
          <button
            onClick={() => setSelectedPriority('Low')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedPriority === 'Low'
                ? 'bg-green-600 text-white'
                : 'bg-white text-green-600 border border-green-600 hover:bg-green-50'
            }`}
          >
            Low
          </button>
        </div>

        <div className="space-y-3">
          {filteredQueries.map((query) => (
            <div
              key={query.id}
              onClick={() => setSelectedQuery(query)}
              className="card"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900">{query.patientName}</h3>
                  <p className="text-sm text-gray-500">{query.timestamp}</p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
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
              <p className="text-sm text-gray-600 line-clamp-2">{query.preview}</p>
            </div>
          ))}

          {filteredQueries.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <p className="text-gray-500">No queries found</p>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={!!selectedQuery}
        onClose={() => setSelectedQuery(null)}
        title="Query Details"
      >
        {selectedQuery && (
          <div className="space-y-4">
            <div className="border-b border-gray-200 pb-4">
              <p className="text-sm text-gray-600">Patient</p>
              <p className="font-semibold text-gray-900">{selectedQuery.patientName}</p>
            </div>

            <div className="border-b border-gray-200 pb-4">
              <p className="text-sm text-gray-600">Phone</p>
              <p className="text-gray-900">{selectedQuery.phone}</p>
            </div>

            <div className="border-b border-gray-200 pb-4">
              <p className="text-sm text-gray-600 mb-2">Timestamp</p>
              <p className="text-gray-900">{selectedQuery.timestamp}</p>
            </div>

            <div className="border-b border-gray-200 pb-4">
              <p className="text-sm text-gray-600 mb-2">Query</p>
              <p className="text-gray-900">{selectedQuery.preview}</p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Reply</p>
              <div className="flex gap-2">
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <Paperclip className="w-5 h-5 text-gray-600" />
                </button>
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
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => navigate(`/patient/${selectedQuery.patientId}`)}
                className="btn-secondary flex-1"
              >
                View Patient Profile
              </button>
              <button className="btn-primary flex-1">
                Mark Resolved
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
