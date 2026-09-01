import { Loader2, AlertCircle, ChevronRight, Activity, FileText, Stethoscope, ClipboardCheck } from 'lucide-react';
import type { IPDNoteRow, IPDNoteSummary } from '../../types/db';

interface IPDNoteCardProps {
  note: IPDNoteRow;
  onClick: () => void;
  formatDate?: (s: string) => string;
}

const typeConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  admission_note: { label: 'Admission Note', icon: Stethoscope, color: 'text-purple-700', bg: 'bg-purple-100' },
  progress_note: { label: 'Progress Note', icon: FileText, color: 'text-blue-700', bg: 'bg-blue-100' },
  procedure_note: { label: 'Procedure Note', icon: Activity, color: 'text-orange-700', bg: 'bg-orange-100' },
  pre_discharge: { label: 'Pre-Discharge Note', icon: ClipboardCheck, color: 'text-emerald-700', bg: 'bg-emerald-100' },
};

function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

function getPreviewText(summary: IPDNoteSummary | Record<string, never>): string {
  if (!summary || !('sections' in summary) || !Array.isArray(summary.sections) || summary.sections.length === 0) {
    return '';
  }
  return summary.sections
    .slice(0, 2)
    .map((s) => `${s.heading}: ${s.content}`)
    .join(' · ')
    .slice(0, 150);
}

export default function IPDNoteCard({ note, onClick }: IPDNoteCardProps) {
  const summary = note.structured_summary as IPDNoteSummary | Record<string, never>;
  const previewText = getPreviewText(summary);

   const conf = typeConfig[note.note_type] || { label: 'Note', icon: FileText, color: 'text-gray-700', bg: 'bg-gray-100' };
  const Icon = conf.icon;

  return (
    <div
      onClick={note.status === 'success' ? onClick : undefined}
      className={`group bg-white border border-gray-200 rounded-xl p-4 transition-all ${
        note.status === 'success' ? 'hover:border-blue-300 hover:shadow-md cursor-pointer' : ''
      }`}
    >
      <div className="flex items-start gap-4">
        <div className={`p-2.5 rounded-lg shrink-0 ${conf.bg}`}>
          <Icon className={`w-5 h-5 ${conf.color}`} />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="font-semibold text-gray-900">
              {conf.label}
            </span>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
              {formatTime(note.created_at)}
            </span>
          </div>

          {note.status === 'processing' && (
            <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#024CDB]" />
              <span>Processing audio and generating note...</span>
            </div>
          )}

          {note.status === 'failed' && (
            <div className="flex items-center gap-2 text-sm text-red-600 mt-2">
              <AlertCircle className="w-4 h-4" />
              <span>Processing failed. Try recording again.</span>
            </div>
          )}

          {note.status === 'success' && previewText && (
            <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed mt-1">{previewText}</p>
          )}

          {note.status === 'success' && !previewText && (
            <p className="text-sm text-gray-400 italic mt-1">Note processed — click to view</p>
          )}
        </div>
        {note.status === 'success' && (
          <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 shrink-0 mt-1 transition-colors" />
        )}
      </div>
    </div>
  );
}