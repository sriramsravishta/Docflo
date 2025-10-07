import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Send, Paperclip, MessageSquare, X } from 'lucide-react';
import { getQueries, getMessages, createMessage, createQuery, getPatientById } from '../lib/database';

export default function PatientQueries() {
  const { patientId, doctorId } = useParams();
  const [threads, setThreads] = useState<any[]>([]);
  const [selectedThread, setSelectedThread] = useState<any>(null);
  const [newMessage, setNewMessage] = useState('');
  const [showNewThread, setShowNewThread] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [patient, setPatient] = useState<any>(null);
  const [doctorName, setDoctorName] = useState('Doctor');

  useEffect(() => {
    loadThreads();
    loadPatientData();
  }, []);

  useEffect(() => {
    if (selectedThread) {
      loadMessages(selectedThread.id);
    }
  }, [selectedThread]);

  const loadPatientData = async () => {
    try {
      const patientData = await getPatientById(patientId!);
      setPatient(patientData);
    } catch (error) {
      console.error('Error loading patient:', error);
    }
  };

  const loadThreads = async () => {
    try {
      setLoading(true);
      const allQueries = await getQueries();
      const patientQueries = allQueries.filter(q => q.patient_id === patientId);
      setThreads(patientQueries);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const attachmentData = attachments.map(file => ({
        url: `dummy-storage-url/${file.name}`,
        name: file.name,
        type: file.type,
        size: file.size
      }));

      if (selectedThread) {
        await createMessage(selectedThread.id, 'Patient', newMessage, attachmentData);
        setNewMessage('');
        setAttachments([]);
        await loadMessages(selectedThread.id);
      } else {
        const newQuery = await createQuery(doctorId!, patientId!, newMessage);
        setShowNewThread(false);
        setNewMessage('');
        await loadThreads();
        setSelectedThread(newQuery);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
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

  const handleEndChat = () => {
    setSelectedThread(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#024CDB]"></div>
      </div>
    );
  }

  if (threads.length === 0 && !showNewThread) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <MessageSquare className="w-20 h-20 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No queries yet</h2>
          <p className="text-gray-600 mb-6">
            Start a new question to communicate with your doctor.
          </p>
          <button onClick={() => setShowNewThread(true)} className="btn-primary">
            Start New Query
          </button>
        </div>
      </div>
    );
  }

  if (selectedThread) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col fixed inset-0">
        <div className="bg-white border-b border-gray-200 px-4 py-4 flex-shrink-0">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <button
              onClick={() => setSelectedThread(null)}
              className="text-[#024CDB] hover:underline"
            >
              ← Back to queries
            </button>
            <button onClick={handleEndChat} className="text-sm text-red-600 hover:underline">
              End Chat
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 min-h-0">
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex justify-end">
              <div className="max-w-md rounded-lg p-4 bg-white border border-gray-200 text-gray-900">
                <p className="text-xs text-gray-500 mb-1">{patient?.name || 'Patient'}</p>
                <p>{selectedThread.initial_query}</p>
                <p className="text-xs mt-2 text-gray-500">{formatDate(selectedThread.created_at)}</p>
              </div>
            </div>
            {messages.map((message: any) => (
              <div
                key={message.id}
                className={`flex ${message.sender_type === 'Patient' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-md rounded-lg p-4 ${
                    message.sender_type === 'Patient'
                      ? 'bg-[#024CDB] text-white'
                      : 'bg-white border border-gray-200 text-gray-900'
                  }`}
                >
                  <p>{message.message}</p>
                  <p
                    className={`text-xs mt-2 ${
                      message.sender_type === 'Patient' ? 'text-blue-100' : 'text-gray-500'
                    }`}
                  >
                    <span className="font-medium">
                      {message.sender_type === 'Patient' ? (patient?.name || 'Patient') : doctorName}
                    </span> - {formatDate(message.created_at)}
                  </p>
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {message.attachments.map((attachment: any, idx: number) => (
                        <div key={idx} className={`text-xs rounded px-2 py-1 ${
                          message.sender_type === 'Patient' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'
                        }`}>
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

        <div className="bg-white border-t border-gray-200 px-4 py-4 flex-shrink-0">
          <div className="max-w-4xl mx-auto flex gap-2">
            {attachments.length > 0 && (
              <div className="w-full mb-3 flex flex-wrap gap-2">
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
          </div>
          <div className="max-w-4xl mx-auto flex gap-2">
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
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type your message..."
              className="flex-1 input-field"
            />
            <button onClick={handleSendMessage} className="btn-primary flex items-center space-x-2">
              <Send className="w-4 h-4" />
              <span>Send</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4 fixed inset-0 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Your Queries</h1>
          <button onClick={() => setShowNewThread(true)} className="btn-primary">
            New Query
          </button>
        </div>

        <div className="space-y-3">
          {threads.map((thread) => (
            <div
              key={thread.id}
              onClick={() => setSelectedThread(thread)}
              className="card"
            >
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm text-gray-500">
                  {formatDate(thread.updated_at)}
                </p>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    thread.status === 'Open'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {thread.status === 'Open' ? 'Active' : 'Resolved'}
                </span>
              </div>
              <p className="text-gray-900 line-clamp-2">
                {thread.initial_query}
              </p>
            </div>
          ))}
        </div>

        {showNewThread && (
          <div className="modal-overlay" onClick={() => setShowNewThread(false)}>
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Start New Query</h3>
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your question or concern..."
                className="input-field min-h-32 mb-4"
                rows={5}
                autoFocus
              />
              {attachments.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
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
              <div className="flex gap-2 mb-4">
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
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowNewThread(false)} className="btn-secondary">
                  Cancel
                </button>
                <button onClick={handleSendMessage} className="btn-primary">
                  Send Query
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
