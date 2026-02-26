import { Mic, Square, Play, Pause, Plus, Upload, User, Phone, Calendar, FileText } from 'lucide-react';
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
      <div className="mb-3">
  {/* Top row: Name + Edit icon inline */}
  <div className="flex items-center justify-between gap-3 mb-3">
    <h1 className="text-2xl font-bold text-gray-900 truncate">{patient.name}</h1>

    <button
      onClick={onEditPatient}
      className="p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
      title="Edit patient"
    >
      <svg className="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </button>
  </div>

  {/* Below: 4 tiles (mobile 2×2, desktop 1×4) */}
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 mt-6">
    {/* Condition / Case */}
    <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
      <FileText className="w-5 h-5 text-gray-200 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-gray-500">Condition</div>
        <div className="text-sm text-gray-900 truncate">{patient.case ?? '—'}</div>
      </div>
    </div>

    {/* Age & Gender */}
    <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
      <User className="w-5 h-5 text-gray-200 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-gray-500">Age &amp; Gender</div>
        <div className="text-sm text-gray-900 truncate">{patient.age} yrs • {patient.gender}</div>
      </div>
    </div>

    {/* Mobile */}
    <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
      <Phone className="w-5 h-5 text-gray-200 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-gray-500">Mobile</div>
        <div className="text-sm text-gray-900 truncate">{patient.phone}</div>
      </div>
    </div>

    {/* Last Visit */}
    <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
      <Calendar className="w-5 h-5 text-gray-200 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-gray-500">Last Visit</div>
        <div className="text-sm text-gray-900 truncate">
          {patient.last_visit_at ? formatDate(patient.last_visit_at) : '—'}
        </div>
      </div>
    </div>
  </div>
</div>

      {/* ── Buttons: desktop = single row 1×4, mobile = two rows ── */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">

        {/* Row 1 on mobile: Add Vitals + Upload */}
        <div className="flex gap-3">
          <button
            onClick={onAddVitals}
            className="btn-secondary flex items-center justify-center gap-2 py-2.5 px-4 flex-1 sm:flex-none sm:min-w-[150px]"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">Add Vitals</span>
          </button>

          <button
            onClick={onUploadDocuments}
            className="btn-secondary flex items-center justify-center gap-2 py-2.5 px-4 flex-1 sm:flex-none sm:min-w-[150px]"
          >
            <Upload className="w-4 h-4" />
            <span className="text-sm font-medium">Upload</span>
          </button>
        </div>

        {/* Row 2 on mobile: Start/Stop + Pause (Pause only shown when recording)
            When Pause is absent, Start fills full width on mobile */}
        <div className="flex gap-3">
          <button
            onClick={isRecording ? onEndRecording : onStartRecording}
            className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg transition-colors font-medium sm:min-w-[150px] ${
              isRecording ? 'flex-1 sm:flex-none' : 'w-full sm:w-auto'
            } ${
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
              className={`flex-1 sm:flex-none sm:min-w-[150px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg transition-colors font-medium ${
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
    </div>
  );
}