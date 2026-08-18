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
    <div className="p-6 space-y-6">
      {/* ── Admission Header Banner ── */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-green-500 p-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-4">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                Day {daysSinceAdmission}
              </span>
              <span className="text-gray-500 text-sm">
                Admitted {formatDate(active.admission_date)}
              </span>
            </div>
            <h3 className="text-lg font-bold text-gray-900">{active.admitting_diagnosis || 'No Diagnosis'}</h3>
            {active.ward_bed && (
              <p className="text-gray-600 text-sm mt-1">Ward/Bed: {active.ward_bed}</p>
            )}
          </div>

          {/* ── Action Buttons ── */}
          <div className="flex flex-wrap gap-2">
            {!ipd.isRecording ? (
              <>
                <button
                  onClick={ipd.handleStartRecording}
                  className="flex items-center px-4 py-2 bg-[#024CDB] text-white rounded-lg hover:bg-[#023BA3] transition-colors font-medium shadow-sm"
                >
                  <Mic className="w-4 h-4 mr-2" />
                  Record Note
                </button>

                {active.ds_status === 'generating' || generatingDS ? (
                  <button disabled className="flex items-center px-4 py-2 bg-gray-100 text-gray-500 rounded-lg font-medium border border-gray-200 cursor-not-allowed">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Generating...
                  </button>
                ) : dsReady ? (
                  <button
                    onClick={() => setShowDSModal(true)}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    View Discharge Summary
                  </button>
                ) : (
                  <button
                    onClick={handleGenerateDS}
                    disabled={!hasSuccessfulNotes}
                    className={`flex items-center px-4 py-2 rounded-lg font-medium shadow-sm transition-colors ${
                      !hasSuccessfulNotes
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Generate Discharge Summary
                  </button>
                )}
              </>
            ) : (
              <div className="flex items-center space-x-2 bg-red-50 rounded-lg p-1 border border-red-100">
                <button
                  onClick={() => ipd.handleEndRecording()}
                  className="flex items-center px-4 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium shadow-sm animate-pulse"
                >
                  <Square className="w-4 h-4 mr-2" fill="currentColor" />
                  {fmt(ipd.recordingTime)}
                </button>
                <button
                  onClick={ipd.handlePauseRecording}
                  className={`p-1.5 rounded-md transition-colors ${
                    ipd.isPaused
                      ? 'bg-[#024CDB] text-white hover:bg-[#023BA3]'
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                  title={ipd.isPaused ? 'Resume' : 'Pause'}
                >
                  {ipd.isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </button>
                <button
                  onClick={ipd.handleCancelRecording}
                  className="p-1.5 text-gray-500 hover:bg-gray-200 hover:text-red-600 rounded-md transition-colors"
                  title="Cancel"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Notes Timeline ── */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Daily Notes</h3>

        {sortedDays.length > 0 ? (
          <div className="space-y-6">
            {sortedDays.map(day => (
              <div key={day} className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                  <span className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center mr-2 text-xs font-bold">
                    {day}
                  </span>
                  Day {day}
                  {day === daysSinceAdmission && (
                    <span className="ml-2 text-xs text-green-600 font-normal">Today</span>
                  )}
                </h4>
                <div className="pl-4 ml-3.5 border-l-2 border-gray-100 space-y-3">
                  {notesByDay[day].map(note => (
                    <IPDNoteCard
                      key={note.id}
                      note={note}
                      onClick={() => note.status === 'success' && setSelectedNote(note)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No notes yet</h3>
            <p className="text-gray-500">Record your first daily note for this admission.</p>
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