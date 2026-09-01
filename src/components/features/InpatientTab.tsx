import { useState } from 'react';
import { Mic, Square, Play, Pause, XCircle, FileText, Plus, Clock, ChevronDown, ChevronRight, AlertCircle, Loader2, Calendar } from 'lucide-react';
import { useIPDRecording } from '../../hooks/useIPDRecording';
import { createAdmission, triggerGenerateDS } from '../../lib/database';
import type { AdmissionRow, IPDNoteRow, PatientRow } from '../../types/db';
import AdmitPatientModal from './AdmitPatientModal';
import IPDNoteCard from './IPDNoteCard';
import IPDNoteViewModal from './IPDNoteViewModal';
import DischargeSummaryModal from './DischargeSummaryModal';
import AdmissionCard from './AdmissionCard';

interface InpatientTabProps {
  patientId: string;
  userId: string | undefined;
  patient: PatientRow | null;
  admissionData: {
    admissions: AdmissionRow[];
    activeAdmission: AdmissionRow | null;
    ipdNotes: IPDNoteRow[];
    loading: boolean;
    loadAdmissions: () => Promise<void>;
    loadIPDNotes: (admissionId: string) => Promise<void>;
    setActiveAdmission: React.Dispatch<React.SetStateAction<AdmissionRow | null>>;
    setAdmissions: React.Dispatch<React.SetStateAction<AdmissionRow[]>>;
    setIpdNotes: React.Dispatch<React.SetStateAction<IPDNoteRow[]>>;
  };
  formatDate: (s: string) => string;
}

function fmt(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function InpatientTab({
  patientId,
  userId,
  patient,
  admissionData,
  formatDate,
}: InpatientTabProps) {
  const [showAdmitModal, setShowAdmitModal] = useState(false);
  const [selectedNote, setSelectedNote] = useState<IPDNoteRow | null>(null);
  const [showDSModal, setShowDSModal] = useState(false);
  const [generatingDS, setGeneratingDS] = useState(false);
  const [pastAdmissionsExpanded, setPastAdmissionsExpanded] = useState(false);

  const ipd = useIPDRecording(
    admissionData.activeAdmission?.id,
    userId,
    admissionData.activeAdmission?.admission_date,
    () => {
      if (admissionData.activeAdmission) admissionData.loadIPDNotes(admissionData.activeAdmission.id);
    }
  );

  const handleAdmit = async (admissionType: 'inpatient' | 'daycare', diagnosis: string, wardBed: string) => {
    if (!userId) return;
    try {
      await createAdmission(patientId, userId, admissionType, diagnosis, wardBed);
      await admissionData.loadAdmissions();
      setShowAdmitModal(false);
    } catch (error) {
      console.error('Failed to admit patient:', error);
    }
  };

  const handleGenerateDS = async () => {
    if (!admissionData.activeAdmission) return;
    setGeneratingDS(true);
    try {
      await triggerGenerateDS(admissionData.activeAdmission.id);
      admissionData.setActiveAdmission(prev =>
        prev ? { ...prev, ds_status: 'generating' } : null
      );
    } catch (error) {
      console.error('Failed to generate DS:', error);
      setGeneratingDS(false);
    }
  };

  const handleDSUpdate = (updated: AdmissionRow) => {
    admissionData.setActiveAdmission(updated);
    admissionData.setAdmissions(prev => prev.map(a => a.id === updated.id ? updated : a));
  };

  // Loading state
  if (admissionData.loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#024CDB]" />
      </div>
    );
  }

  const pastAdmissions = admissionData.admissions.filter(a => a.status !== 'admitted');

  // ──── STATE A: No active admission ────
  if (!admissionData.activeAdmission) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Inpatient Records</h2>
          <button
            onClick={() => setShowAdmitModal(true)}
            className="flex items-center px-4 py-2 bg-[#024CDB] text-white rounded-lg hover:bg-[#023BA3] transition-colors font-medium shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Admit Patient
          </button>
        </div>

        {pastAdmissions.length > 0 ? (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Past Admissions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pastAdmissions.map(admission => (
                <AdmissionCard
                  key={admission.id}
                  admission={admission}
                  formatDate={formatDate}
                  onClick={() => {
                    if (admission.discharge_summary && Object.keys(admission.discharge_summary).length > 0) {
                      admissionData.setActiveAdmission(admission);
                      setShowDSModal(true);
                    }
                  }}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No inpatient records yet</h3>
            <p className="text-gray-500 mb-6">Admit this patient to start documenting their stay.</p>
            <button
              onClick={() => setShowAdmitModal(true)}
              className="inline-flex items-center px-4 py-2 bg-[#024CDB] text-white rounded-lg hover:bg-[#023BA3] transition-colors font-medium shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Admit Patient
            </button>
          </div>
        )}

        {showAdmitModal && (
          <AdmitPatientModal
            onClose={() => setShowAdmitModal(false)}
            onAdmit={handleAdmit}
          />
        )}
      </div>
    );
  }

  // ──── STATE B: Active admission ────
  const active = admissionData.activeAdmission;
  const daysSinceAdmission = Math.max(1, Math.ceil((Date.now() - new Date(active.admission_date).getTime()) / 86400000));
  const hasSuccessfulNotes = admissionData.ipdNotes.some(n => n.status === 'success');
  const dsReady = active.ds_status === 'generated' || active.ds_status === 'finalized';

  // Group notes by day
  const notesByDay = admissionData.ipdNotes.reduce((acc, note) => {
    const day = note.day_number || 1;
    if (!acc[day]) acc[day] = [];
    acc[day].push(note);
    return acc;
  }, {} as Record<number, IPDNoteRow[]>);
  const sortedDays = Object.keys(notesByDay).map(Number).sort((a, b) => b - a);

  return (
    <div className="p-6 space-y-6">
       return (
    <div className="p-6 space-y-8">
      {/* ── Active Admission Dashboard ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="bg-white/10 p-3 rounded-xl border border-white/20 backdrop-blur-md text-center min-w-[80px]">
              <span className="block text-slate-300 text-[10px] font-bold uppercase tracking-widest mb-0.5">Day</span>
              <span className="block text-white text-3xl font-black">{daysSinceAdmission}</span>
            </div>
            <div>
              <h3 className="text-white text-2xl font-bold mb-2 tracking-tight">{active.admitting_diagnosis || 'Undiagnosed Admission'}</h3>
              <div className="flex items-center gap-4 text-slate-300 text-sm">
                 <span className="flex items-center font-medium"><Calendar className="w-4 h-4 mr-1.5" /> Admitted {formatDate(active.admission_date)}</span>
                 {active.ward_bed && (
                   <span className="flex items-center gap-2">
                     <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                     <span className="font-medium text-white bg-white/10 px-2.5 py-0.5 rounded text-xs border border-white/10">Ward/Bed: {active.ward_bed}</span>
                   </span>
                 )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Action Bar ── */}
        <div className="px-6 py-4 bg-slate-50 flex flex-wrap items-center justify-between gap-4 border-t border-gray-200">
          <div className="flex flex-wrap gap-3">
            {!ipd.isRecording ? (
              <>
                <button
                  onClick={ipd.handleStartRecording}
                  className="flex items-center px-5 py-2.5 bg-[#024CDB] text-white rounded-lg hover:bg-[#023BA3] transition-all font-semibold shadow-sm hover:shadow-md"
                >
                  <Mic className="w-4 h-4 mr-2" />
                  Record Progress Note
                </button>

                {active.ds_status === 'generating' || generatingDS ? (
                  <button disabled className="flex items-center px-5 py-2.5 bg-gray-100 text-gray-500 rounded-lg font-semibold border border-gray-200 cursor-not-allowed">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Generating DS...
                  </button>
                ) : dsReady ? (
                  <button
                    onClick={() => setShowDSModal(true)}
                    className="flex items-center px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all font-semibold shadow-sm hover:shadow-md"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    View Discharge Summary
                  </button>
                ) : (
                  <button
                    onClick={handleGenerateDS}
                    disabled={!hasSuccessfulNotes}
                    className={`flex items-center px-5 py-2.5 rounded-lg font-semibold shadow-sm transition-all ${
                      !hasSuccessfulNotes
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                    }`}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Generate Discharge Summary
                  </button>
                )}
              </>
            ) : (
              <div className="flex items-center space-x-2 bg-red-50 rounded-lg p-1.5 border border-red-200 shadow-sm">
                <button
                  onClick={() => ipd.handleEndRecording()}
                  className="flex items-center px-5 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-bold shadow-sm animate-pulse"
                >
                  <Square className="w-4 h-4 mr-2" fill="currentColor" />
                  {fmt(ipd.recordingTime)}
                </button>
                <button
                  onClick={ipd.handlePauseRecording}
                  className={`p-2 rounded-md transition-colors ${
                    ipd.isPaused
                      ? 'bg-[#024CDB] text-white hover:bg-[#023BA3]'
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                  title={ipd.isPaused ? 'Resume' : 'Pause'}
                >
                  {ipd.isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                </button>
                <button
                  onClick={ipd.handleCancelRecording}
                  className="p-2 text-gray-500 hover:bg-gray-200 hover:text-red-600 rounded-md transition-colors"
                  title="Cancel"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Notes Timeline ── */}
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-6 px-1">Timeline & Notes</h3>

        {sortedDays.length > 0 ? (
          <div className="relative mb-8">
            {/* Timeline vertical line */}
            <div className="absolute top-0 bottom-0 left-[23px] w-0.5 bg-gray-200" />
            
            <div className="space-y-10 relative">
              {sortedDays.map(day => (
                <div key={day} className="relative z-10">
                  <div className="flex items-start">
                    {/* Circle on line */}
                    <div className="w-12 h-12 bg-white rounded-full border-4 border-slate-50 flex items-center justify-center shrink-0 shadow-sm z-10 absolute left-0 top-0">
                      <span className="text-sm font-black text-slate-700">D{day}</span>
                    </div>
                    {/* Content */}
                    <div className="flex-1 ml-16 pt-2 min-w-0">
                       <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center">
                         Day {day} Notes
                         {day === daysSinceAdmission && <span className="ml-3 text-emerald-700 text-[10px] font-black bg-emerald-100 px-2.5 py-0.5 rounded-full uppercase tracking-widest border border-emerald-200 shadow-sm">Today</span>}
                       </h4>
                       <div className="space-y-3">
                         {notesByDay[day].map(note => (
                           <IPDNoteCard
                             key={note.id}
                             note={note}
                             onClick={() => note.status === 'success' && setSelectedNote(note)}
                           />
                         ))}
                       </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-xl border border-dashed border-gray-300 p-12 text-center">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No notes recorded yet</h3>
            <p className="text-gray-500 text-sm">Start recording daily progress notes to build the inpatient timeline.</p>
          </div>
        )}
      </div>

      {/* ── Past Admissions ── */}
      {pastAdmissions.length > 0 && (
        <div className="border-t border-gray-200 pt-6">
          <button
            onClick={() => setPastAdmissionsExpanded(!pastAdmissionsExpanded)}
            className="flex items-center text-base font-semibold text-gray-900 hover:text-gray-700 transition-colors w-full text-left"
          >
            {pastAdmissionsExpanded ? (
              <ChevronDown className="w-5 h-5 mr-2" />
            ) : (
              <ChevronRight className="w-5 h-5 mr-2" />
            )}
            Past Admissions ({pastAdmissions.length})
          </button>

          {pastAdmissionsExpanded && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {pastAdmissions.map(admission => (
                <AdmissionCard
                  key={admission.id}
                  admission={admission}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {showAdmitModal && (
        <AdmitPatientModal
          onClose={() => setShowAdmitModal(false)}
          onAdmit={handleAdmit}
        />
      )}

      {selectedNote && (
        <IPDNoteViewModal
          note={selectedNote}
          onClose={() => setSelectedNote(null)}
        />
      )}

      {showDSModal && active && (
        <DischargeSummaryModal
          admission={active}
          onClose={() => setShowDSModal(false)}
          onUpdate={handleDSUpdate}
        />
      )}
    </div>
  );
}