import { Mic, Square, Play, Pause, Plus, Upload } from 'lucide-react';
import InfoPill from '../ui/InfoPill';

interface Patient {
  name: string;
  age: number;
  gender: string;
  phone: string;
  case?: string;
  last_visit_at?: string;
}

interface PatientProfileHeaderProps {
  patient: Patient;
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  onStartRecording: () => void;
  onEndRecording: () => void;
  onPauseRecording: () => void;
  onEditPatient: () => void;
  onAddVitals: () => void;
  onUploadDocuments: () => void;
  formatDate: (s: string) => string;
}

function fmt(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PatientProfileHeader({
  patient,
  isRecording,
  isPaused,
  recordingTime,
  onStartRecording,
  onEndRecording,
  onPauseRecording,
  onEditPatient,
  onAddVitals,
  onUploadDocuments,
  formatDate,
}: PatientProfileHeaderProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap mb-3">
            <h1 className="text-2xl font-bold text-gray-900">{patient.name}</h1>
            {patient.case && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-[#024CDB] border border-blue-100">
                {patient.case}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <InfoPill label="Age" value={`${patient.age} yrs`} />
            <InfoPill label="Gender" value={patient.gender} />
            <InfoPill label="Phone" value={patient.phone} />
            {patient.last_visit_at && (
              <InfoPill label="Last Visit" value={formatDate(patient.last_visit_at)} />
            )}
          </div>
        </div>
        <button
          onClick={onEditPatient}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors ml-4 shrink-0"
          title="Edit patient"
        >
          <svg className="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <button onClick={onAddVitals} className="btn-secondary flex items-center gap-2 py-2.5 px-4">
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">Add Vitals</span>
        </button>

        <button onClick={onUploadDocuments} className="btn-secondary flex items-center gap-2 py-2.5 px-4">
          <Upload className="w-4 h-4" />
          <span className="text-sm font-medium">Upload</span>
        </button>

        <button
          onClick={isRecording ? onEndRecording : onStartRecording}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-lg transition-colors font-medium ${
            isRecording
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-[#024CDB] hover:bg-[#023BA3] text-white'
          }`}
        >
          {isRecording ? (
            <>
              <Square className="w-4 h-4" />
              <span className="text-sm font-medium">{fmt(recordingTime)}</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              <span className="text-sm font-medium">Start</span>
            </>
          )}
        </button>

        {isRecording && (
          <button
            onClick={onPauseRecording}
            className={`flex items-center gap-2 py-2.5 px-4 rounded-lg transition-colors font-medium ${
              isPaused
                ? 'bg-[#024CDB] hover:bg-[#023BA3] text-white'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            <span className="text-sm">{isPaused ? 'Resume' : 'Pause'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
