import { useState } from 'react';
import { Mic, Square, Play, Pause, XCircle, FileText, Plus, Clock, ChevronDown, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
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
    <div className="p-5 space-y-6">

      {/* ══ ADMISSION HEADER ══ */}
      <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        {/* Dark header strip */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Left: day counter + info */}
            <div className="flex items-center gap-4">
              <div className="text-center bg-white/10 rounded-xl px-4 py-2 border border-white/20 min-w-[64px]">
                <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest leading-none mb-1">Day</p>
                <p className="text-white text-3xl font-black leading-none">{daysSinceAdmission}</p>
              </div>
              <div className="min-w-0">
                <h3 className="text-white font-bold text-lg leading-tight truncate">
                  {active.admitting_diagnosis || 'No Diagnosis Recorded'}
                </h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                  <span className="text-slate-300 text-xs flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    Admitted {formatDate(active.admission_date)}
                  </span>
                  {active.ward_bed && (
                    <span className="text-xs bg-white/10 text-slate-200 px-2 py-0.5 rounded border border-white/10">
                      {active.ward_bed}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
                    active.admission_type === 'daycare'
                      ? 'bg-amber-400/20 text-amber-300 border-amber-400/30'
                      : 'bg-violet-400/20 text-violet-300 border-violet-400/30'
                  }`}>
                    {active.admission_type === 'daycare' ? 'Daycare' : 'Inpatient'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div className="bg-slate-50 border-t border-gray-200 px-5 py-3 flex flex-wrap items-center gap-3">
          {!ipd.isRecording ? (
            <>
              <button
                onClick={ipd.handleStartRecording}
                className="flex items-center px-4 py-2 bg-[#024CDB] text-white rounded-lg hover:bg-[#023BA3] transition-colors font-semibold text-sm shadow-sm"
              >
                <Mic className="w-4 h-4 mr-2" />
                Record Note
              </button>

              {active.ds_status === 'generating' || generatingDS ? (
                <button disabled className="flex items-center px-4 py-2 bg-gray-100 text-gray-400 rounded-lg font-semibold text-sm border border-gray-200 cursor-not-allowed">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Generating DS…
                </button>
              ) : dsReady ? (
                <button
                  onClick={() => setShowDSModal(true)}
                  className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-semibold text-sm shadow-sm"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  View Discharge Summary
                </button>
              ) : (
                <button
                  onClick={handleGenerateDS}
                  disabled={!hasSuccessfulNotes}
                  className={`flex items-center px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                    !hasSuccessfulNotes
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 shadow-sm'
                  }`}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Generate Discharge Summary
                </button>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 bg-red-50 rounded-lg px-2 py-1.5 border border-red-200">
              <button
                onClick={() => ipd.handleEndRecording()}
                className="flex items-center px-4 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-bold text-sm animate-pulse"
              >
                <Square className="w-3.5 h-3.5 mr-2" fill="currentColor" />
                {fmt(ipd.recordingTime)}
              </button>
              <button
                onClick={ipd.handlePauseRecording}
                className={`p-1.5 rounded-md transition-colors ${
                  ipd.isPaused ? 'bg-[#024CDB] text-white' : 'text-gray-600 hover:bg-gray-200'
                }`}
                title={ipd.isPaused ? 'Resume' : 'Pause'}
              >
                {ipd.isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
              <button
                onClick={ipd.handleCancelRecording}
                className="p-1.5 text-gray-400 hover:bg-gray-200 hover:text-red-600 rounded-md transition-colors"
                title="Cancel"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ══ DAILY NOTES TIMELINE ══ */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Clinical Notes</h3>

        {sortedDays.length > 0 ? (
          <div className="relative">
            {/* Vertical connector line */}
            <div className="absolute left-[19px] top-5 bottom-5 w-px bg-gray-200 z-0" />

            <div className="space-y-6 relative z-10">
              {sortedDays.map(day => (
                <div key={day} className="flex gap-4">
                  {/* Day bubble */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs font-black z-10 bg-white ${
                    day === daysSinceAdmission
                      ? 'border-[#024CDB] text-[#024CDB]'
                      : 'border-gray-300 text-gray-500'
                  }`}>
                    D{day}
                  </div>
                  {/* Notes for this day */}
                  <div className="flex-1 min-w-0 pb-2">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm font-bold text-gray-800">Day {day}</span>
                      {day === daysSinceAdmission && (
                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                          Today
                        </span>
                      )}
                    </div>
                    <div className="space-y-2">
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
              ))}
            </div>
          </div>
        ) : (
          <div className="border border-dashed border-gray-300 rounded-xl p-10 text-center bg-gray-50">
            <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-700 mb-1">No notes yet</p>
            <p className="text-sm text-gray-500">Record your first daily note to build the inpatient timeline.</p>
          </div>
        )}
      </div>

      {/* ══ PAST ADMISSIONS ══ */}
      {pastAdmissions.length > 0 && (
        <div className="border-t border-gray-200 pt-5">
          <button
            onClick={() => setPastAdmissionsExpanded(!pastAdmissionsExpanded)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors w-full text-left mb-1"
          >
            {pastAdmissionsExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            Past Admissions ({pastAdmissions.length})
          </button>

          {pastAdmissionsExpanded && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
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

      {/* ══ MODALS ══ */}
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