import { Loader2, AlertCircle, ChevronRight, Stethoscope, FileText, Activity, ClipboardCheck } from 'lucide-react';
import type { IPDNoteRow, IPDNoteSummary } from '../../types/db';

interface IPDNoteCardProps {
  note: IPDNoteRow;
  onClick: () => void;
}

const typeConfig: Record<string, { label: string; Icon: React.ElementType; color: string; bg: string; border: string }> = {
  admission_note:  { label: 'Admission Note',    Icon: Stethoscope,    color: 'text-violet-700', bg: 'bg-violet-50',  border: 'border-violet-200' },
  progress_note:   { label: 'Progress Note',     Icon: FileText,       color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200' },
  procedure_note:  { label: 'Procedure Note',    Icon: Activity,       color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200' },
  pre_discharge:   { label: 'Pre-Discharge Note', Icon: ClipboardCheck, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
};

function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return ''; }
}

function getPreviewText(summary: IPDNoteSummary | Record<string, never>): string {
  if (!summary || !('sections' in summary) || !Array.isArray(summary.sections) || summary.sections.length === 0) return '';
  return summary.sections
    .slice(0, 2)
    .map((s) => `${s.heading}: ${s.content}`)
    .join(' · ')
    .slice(0, 160);
}

export default function IPDNoteCard({ note, onClick }: IPDNoteCardProps) {
  const conf = typeConfig[note.note_type] || { label: 'Note', Icon: FileText, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' };
  const { Icon } = conf;
  const summary = note.structured_summary as IPDNoteSummary | Record<string, never>;
  const previewText = getPreviewText(summary);
  const isClickable = note.status === 'success';

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      className={`group flex gap-4 p-4 rounded-xl border bg-white transition-all ${
        isClickable ? 'cursor-pointer hover:shadow-md hover:border-blue-300 active:scale-[0.99]' : 'opacity-90'
      }`}
    >
      {/* Icon */}
      <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${conf.bg} border ${conf.border}`}>
        <Icon className={`w-5 h-5 ${conf.color}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className={`text-sm font-semibold ${conf.color}`}>{conf.label}</span>
          <span className="text-xs text-gray-400 shrink-0">{formatTime(note.created_at)}</span>
        </div>

        {note.status === 'processing' && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#024CDB]" />
            <span>Processing audio…</span>
          </div>
        )}
        {note.status === 'failed' && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Processing failed — try recording again</span>
          </div>
        )}
        {note.status === 'success' && previewText && (
          <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">{previewText}</p>
        )}
        {note.status === 'success' && !previewText && (
          <p className="text-sm text-gray-400 italic">Tap to view note</p>
        )}
      </div>

      {/* Arrow */}
      {isClickable && (
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 shrink-0 self-center transition-colors" />
      )}
    </div>
  );
}