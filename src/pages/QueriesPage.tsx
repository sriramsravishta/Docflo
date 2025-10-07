import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Modal from '../components/Modal';
import { Send, Paperclip } from 'lucide-react';
import { getQueries, getMessages, createMessage, updateQuery } from '../lib/database';
import { useAuth } from '../contexts/AuthContext';

export default function QueriesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);
  const [selectedQuery, setSelectedQuery] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [queries, setQueries] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQueries();
  }, []);

  useEffect(() => {
    if (selectedQuery) {
      loadMessages(selectedQuery.id);
    }
  }, [selectedQuery]);

  const loadQueries = async () => {
    try {
      setLoading(true);
      const data = await getQueries(user?.id);
      setQueries(data);
    } catch (error) {
      console.error('Error loading queries:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (queryId: string) => {
    try {
      const data = await getMessages(queryId);
      setMessages(data);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const filteredQueries = selectedPriority
    ? queries.filter(q => q.priority === selectedPriority)
    : queries;

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedQuery) return;

    try {
      await createMessage(selectedQuery.id, 'Doctor', replyText);
      setReplyText('');
      await loadMessages(selectedQuery.id);
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    }
  };

  const handleMarkResolved = async () => {
    if (!selectedQuery) return;

    try {
      await updateQuery(selectedQuery.id, { status: 'Closed' });
      setSelectedQuery(null);
      await loadQueries();
    } catch (error) {
      console.error('Error updating query:', error);
      alert('Failed to update query');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar showBack />

      <div className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Patient Queries</h1>

        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#024CDB] mx-auto"></div>
          </div>
        )}

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

        {!loading && (
          <div className="space-y-3">
            {filteredQueries.map((query) => (
              <div
                key={query.id}
                onClick={() => setSelectedQuery(query)}
                className="card"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{query.patients?.name || 'Unknown Patient'}</h3>
                    <p className="text-sm text-gray-500">{formatDate(query.created_at)}</p>
                  </div>
                  <div className="flex gap-2 items-center">
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
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        query.status === 'Open' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {query.status}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2">{query.initial_query}</p>
              </div>
            ))}

            {filteredQueries.length === 0 && (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <p className="text-gray-500">No queries found</p>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        isOpen={!!selectedQuery}
        onClose={() => setSelectedQuery(null)}
        title="Query Thread"
      >
        {selectedQuery && (
          <div className="space-y-4">
            <div className="border-b border-gray-200 pb-4">
              <p className="text-sm text-gray-600">Patient</p>
              <p className="font-semibold text-gray-900">{selectedQuery.patients?.name || 'Unknown Patient'}</p>
              <p className="text-sm text-gray-500">{selectedQuery.patients?.phone || 'No phone'}</p>
            </div>

            <div className="border-b border-gray-200 pb-4 max-h-96 overflow-y-auto">
              <p className="text-sm font-medium text-gray-700 mb-3">Messages</p>
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Patient - {formatDate(selectedQuery.created_at)}</p>
                  <p className="text-gray-900">{selectedQuery.initial_query}</p>
                </div>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-lg p-3 ${
                      msg.sender_type === 'Doctor' ? 'bg-blue-50' : 'bg-gray-50'
                    }`}
                  >
                    <p className="text-xs text-gray-500 mb-1">
                      {msg.sender_type} - {formatDate(msg.created_at)}
                    </p>
                    <p className="text-gray-900">{msg.message}</p>
                  </div>
                ))}
              </div>
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
                onClick={() => navigate(`/patient/${selectedQuery.patient_id}`)}
                className="btn-secondary flex-1"
              >
                View Patient Profile
              </button>
              <button onClick={handleMarkResolved} className="btn-primary flex-1" disabled={selectedQuery.status === 'Closed'}>
                {selectedQuery.status === 'Closed' ? 'Resolved' : 'Mark Resolved'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
