import { useState } from 'react';
import { Mic } from 'lucide-react';

interface VoiceRecorderProps {
  onTranscript: (text: string) => void;
  className?: string;
}

export default function VoiceRecorder({ onTranscript, className = '' }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);

  const handleToggleRecording = () => {
    setIsRecording(!isRecording);

    if (!isRecording) {
      setTimeout(() => {
        setIsRecording(false);
        onTranscript('Sample transcribed text from voice input');
      }, 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggleRecording}
      className={`p-2 rounded-lg transition-colors ${
        isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-100 hover:bg-gray-200'
      } ${className}`}
      title={isRecording ? 'Recording... Click to stop' : 'Click to record'}
    >
      <Mic className={`w-5 h-5 ${isRecording ? 'text-white' : 'text-gray-600'}`} />
    </button>
  );
}
