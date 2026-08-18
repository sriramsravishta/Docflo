import { Loader2, AlertCircle, ChevronRight } from 'lucide-react';
import type { IPDNoteRow, IPDNoteSummary } from '../../types/db';

interface IPDNoteCardProps {
  note: IPDNoteRow;
  onClick: () => void;
  formatDate?: (s: string) => string;
}

const noteTypeLabels: Record<string, string> = {
  admission_note: 'Admission Note',
  progress_note: 'Progress Note',
  procedure_note: 'Procedure Note',
  pre_discharge: 'Pre-Discharge Note',
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

  return (
    <div
      onClick={note.status === 'success' ? onClick : undefined}
      className={`bg-white border border-gray-200 rounded-lg p-4 transition-colors ${
        note.status === 'success' ? 'hover:border-blue-300 cursor-pointer' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Top badges row */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">
              Day {note.day_number}
            </span>
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
              {noteTypeLabels[note.note_type] || 'Note'}
            </span>
            <span className="text-xs text-gray-400">
              {formatTime(note.created_at)}
            </span>
          </div>

          {/* Content area */}
          {note.status === 'processing' && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin text-[#024CDB]" />
              <span>Processing audio and generating note...</span>
            </div>
          )}

          {note.status === 'failed' && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="w-4 h-4" />
              <span>Processing failed. Try recording again.</span>
            </div>
          )}

          {note.status === 'success' && previewText && (
            <p className="text-sm text-gray-600 line-clamp-2">{previewText}</p>
          )}

          {note.status === 'success' && !previewText && (
            <p className="text-sm text-gray-400 italic">Note processed — click to view</p>
          )}
        </div>

        {note.status === 'success' && (
          <ChevronRight className="w-5 h-5 text-gray-400 shrink-0 mt-1 ml-2" />
        )}
      </div>
    </div>
  );
}