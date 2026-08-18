import { X, AlertTriangle, Play } from 'lucide-react';
import type { IPDNoteRow, IPDNoteSummary, IPDNoteSection } from '../../types/db';

interface IPDNoteViewModalProps {
  note: IPDNoteRow;
  onClose: () => void;
  formatDate?: (s: string) => string;
}

const noteTypeLabels: Record<string, string> = {
  admission_note: 'Admission Note',
  progress_note: 'Progress Note',
  procedure_note: 'Procedure Note',
  pre_discharge: 'Pre-Discharge Note',
};

function formatDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ', ' +
      d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return dateStr;
  }
}

export default function IPDNoteViewModal({ note, onClose }: IPDNoteViewModalProps) {
  const summary = (note.structured_summary && 'sections' in note.structured_summary)
    ? note.structured_summary as IPDNoteSummary
    : null;

  const handlePlayAudio = () => {
    if (note.recording_url) {
      window.open(note.recording_url, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {summary?.note_title || `Day ${note.day_number} ${noteTypeLabels[note.note_type] || 'Note'}`}
            </h2>
            <p className="text-sm text-gray-500 mt-1">{formatDateTime(note.created_at)}</p>
          </div>
          <div className="flex items-center gap-2">
            {note.recording_url && (
              <button
                onClick={handlePlayAudio}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Play recording"
              >
                <Play className="w-5 h-5 text-gray-500" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 space-y-4">
          {summary && summary.sections && summary.sections.length > 0 ? (
            <>
              {summary.sections.map((section: IPDNoteSection, index: number) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {section.heading}
                  </h3>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                    {section.content}
                  </p>
                </div>
              ))}

              {/* Flags */}
              {summary.flags && summary.flags.length > 0 && (
                <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                      Flags for Review
                    </h3>
                  </div>
                  <ul className="space-y-1">
                    {summary.flags.map((flag: string, index: number) => (
                      <li key={index} className="text-sm text-amber-800">
                        {flag}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">Note content not available.</p>
              {note.transcript && (
                <div className="mt-4 text-left">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Raw Transcript
                  </h3>
                  <p className="text-sm text-gray-700 bg-gray-50 p-4 rounded-lg whitespace-pre-wrap">
                    {note.transcript}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}