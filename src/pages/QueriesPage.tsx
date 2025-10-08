import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Modal from '../components/Modal';
import { Send, Paperclip, X } from 'lucide-react';
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
  const [attachments, setAttachments] = useState<File[]>([]);

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
    ? selectedPriority === 'Closed'
      ? queries.filter(q => q.status === 'Closed')
      : queries.filter(q => q.priority === selectedPriority && q.status !== 'Closed')
    : queries.filter(q => q.status !== 'Closed');

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedQuery) return;

    try {
      const attachmentData = attachments.map(file => ({
        url: `dummy-storage-url/${file.name}`,
        name: file.name,
        type: file.type,
        size: file.size
      }));

      await createMessage(selectedQuery.id, 'Doctor', replyText, attachmentData);
      setReplyText('');
      setAttachments([]);
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(Array.from(e.target.files));
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
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
          <button
            onClick={() => setSelectedPriority('Closed')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedPriority === 'Closed'
                ? 'bg-gray-600 text-white'
                : 'bg-white text-gray-600 border border-gray-600 hover:bg-gray-50'
            }`}
          >
            Closed
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
                    {query.patients?.case && (
                      <p className="text-sm text-[#024CDB]">{query.patients.case}</p>
                    )}
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
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
                <p className="border-t border-gray-100 m-4"></p>
                <p className="text-sm text-gray-400">{formatDate(query.created_at)}</p>
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

      {selectedQuery && (
        <div className="modal-overlay" onClick={() => setSelectedQuery(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Query Thread</h2>
                <p className="text-sm text-gray-600">{selectedQuery.patients?.name || 'Unknown Patient'}</p>
                {selectedQuery.patients?.case && (
                  <p className="text-sm text-[#024CDB]">{selectedQuery.patients.case}</p>
                )}
                <p className="text-sm text-gray-500">{selectedQuery.patients?.phone || 'No phone'}</p>
              </div>
              <button
                onClick={() => setSelectedQuery(null)}
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
                {messages.map((msg) => (
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
              {attachments.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {attachments.map((file, idx) => (
                    <div key={idx} className="flex items-center bg-gray-100 rounded px-2 py-1 text-sm">
                      <span className="mr-2">📎 {file.name}</span>
                      <button
                        onClick={() => removeAttachment(idx)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <label className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
                  <Paperclip className="w-5 h-5 text-gray-600" />
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
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
          </div>
        </div>
      )}
    </div>
  );
}
