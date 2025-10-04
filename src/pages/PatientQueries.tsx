import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Send, Paperclip, MessageSquare } from 'lucide-react';

const mockThreads = [
  {
    id: '1',
    messages: [
      { sender: 'patient', content: 'Doctor, I have been experiencing severe headaches for the past two days.', timestamp: '2025-10-04 10:30 AM' },
      { sender: 'doctor', content: 'I understand. Can you describe the type of pain? Is it throbbing or constant?', timestamp: '2025-10-04 11:15 AM' },
      { sender: 'patient', content: 'It is a throbbing pain, especially on the left side of my head.', timestamp: '2025-10-04 11:20 AM' },
    ],
    status: 'active',
  },
];

export default function PatientQueries() {
  const { patientId } = useParams();
  const [threads, setThreads] = useState(mockThreads);
  const [selectedThread, setSelectedThread] = useState<any>(null);
  const [newMessage, setNewMessage] = useState('');
  const [showNewThread, setShowNewThread] = useState(false);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    if (selectedThread) {
      const updatedThreads = threads.map(thread => {
        if (thread.id === selectedThread.id) {
          return {
            ...thread,
            messages: [
              ...thread.messages,
              {
                sender: 'patient',
                content: newMessage,
                timestamp: new Date().toLocaleString(),
              },
            ],
          };
        }
        return thread;
      });
      setThreads(updatedThreads);
      setSelectedThread({
        ...selectedThread,
        messages: [
          ...selectedThread.messages,
          {
            sender: 'patient',
            content: newMessage,
            timestamp: new Date().toLocaleString(),
          },
        ],
      });
    } else {
      const newThread = {
        id: (threads.length + 1).toString(),
        messages: [
          {
            sender: 'patient',
            content: newMessage,
            timestamp: new Date().toLocaleString(),
          },
        ],
        status: 'active',
      };
      setThreads([newThread, ...threads]);
      setSelectedThread(newThread);
      setShowNewThread(false);
    }

    setNewMessage('');
  };

  const handleEndChat = () => {
    if (selectedThread) {
      const updatedThreads = threads.map(thread => {
        if (thread.id === selectedThread.id) {
          return { ...thread, status: 'resolved' };
        }
        return thread;
      });
      setThreads(updatedThreads);
      setSelectedThread(null);
    }
  };

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
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-white border-b border-gray-200 px-4 py-4">
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

        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-4xl mx-auto space-y-4">
            {selectedThread.messages.map((message: any, index: number) => (
              <div
                key={index}
                className={`flex ${message.sender === 'patient' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-md rounded-lg p-4 ${
                    message.sender === 'patient'
                      ? 'bg-[#024CDB] text-white'
                      : 'bg-white border border-gray-200 text-gray-900'
                  }`}
                >
                  <p>{message.content}</p>
                  <p
                    className={`text-xs mt-2 ${
                      message.sender === 'patient' ? 'text-blue-100' : 'text-gray-500'
                    }`}
                  >
                    {message.timestamp}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border-t border-gray-200 px-4 py-4">
          <div className="max-w-4xl mx-auto flex gap-2">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Paperclip className="w-5 h-5 text-gray-600" />
            </button>
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
    <div className="min-h-screen bg-gray-50 py-6 px-4">
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
                  {thread.messages[thread.messages.length - 1].timestamp}
                </p>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    thread.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {thread.status === 'active' ? 'Active' : 'Resolved'}
                </span>
              </div>
              <p className="text-gray-900 line-clamp-2">
                {thread.messages[thread.messages.length - 1].content}
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
              />
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
