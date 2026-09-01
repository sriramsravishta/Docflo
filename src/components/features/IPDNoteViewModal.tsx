import { X, AlertTriangle, Play, Stethoscope, FileText, Activity, ClipboardCheck } from 'lucide-react';
import type { IPDNoteRow, IPDNoteSummary, IPDNoteSection } from '../../types/db';

interface IPDNoteViewModalProps {
  note: IPDNoteRow;
  onClose: () => void;
}

const typeConfig: Record<string, { label: string; Icon: React.ElementType; color: string; bg: string }> = {
  admission_note:  { label: 'Admission Note',     Icon: Stethoscope,    color: 'text-violet-700', bg: 'bg-violet-50' },
  progress_note:   { label: 'Progress Note',      Icon: FileText,       color: 'text-blue-700',   bg: 'bg-blue-50' },
  procedure_note:  { label: 'Procedure Note',     Icon: Activity,       color: 'text-orange-700', bg: 'bg-orange-50' },
  pre_discharge:   { label: 'Pre-Discharge Note', Icon: ClipboardCheck, color: 'text-emerald-700', bg: 'bg-emerald-50' },
};

function formatDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ', ' +
      d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return dateStr; }
}

export default function IPDNoteViewModal({ note, onClose }: IPDNoteViewModalProps) {
  const conf = typeConfig[note.note_type] || { label: 'Note', Icon: FileText, color: 'text-gray-700', bg: 'bg-gray-50' };
  const { Icon } = conf;

  const summary = (note.structured_summary && 'sections' in note.structured_summary)
    ? note.structured_summary as IPDNoteSummary
    : null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-2xl sm:rounded-xl rounded-t-2xl shadow-xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${conf.bg}`}>
              <Icon className={`w-5 h-5 ${conf.color}`} />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-base leading-tight">
                {summary?.note_title || `Day ${note.day_number} — ${conf.label}`}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(note.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {note.recording_url && (
              <button
                onClick={() => window.open(note.recording_url!, '_blank')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Play recording"
              >
                <Play className="w-4 h-4 text-gray-500" />
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-5 space-y-3">
          {summary && summary.sections && summary.sections.length > 0 ? (
            <>
              {summary.sections.map((section: IPDNoteSection, index: number) => (
                <div key={index} className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
                    {section.heading}
                  </p>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                    {section.content}
                  </p>
                </div>
              ))}

              {summary.flags && summary.flags.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Flags for Review</p>
                  </div>
                  <ul className="space-y-1">
                    {summary.flags.map((flag: string, i: number) => (
                      <li key={i} className="text-sm text-amber-900 flex items-start gap-2">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        {flag}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-10">
              <p className="text-gray-500 mb-4">Note content not available.</p>
              {note.transcript && (
                <div className="text-left mt-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Raw Transcript</p>
                  <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 p-4 rounded-xl whitespace-pre-wrap leading-relaxed">
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