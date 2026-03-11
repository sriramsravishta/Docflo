import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import SummaryCard from './SummaryCard';

export interface SummaryJson {
  document_type?: string;
  patient_context?: string;
  sections?: { heading: string; content: string }[];
  flags_for_review?: string[];
  _text?: {
    patient_context?: string;
    sections?: { heading: string; content: string }[];
    flags_for_review?: string;
  };
}

interface SummaryContentProps {
  summary: SummaryJson;
  isEditing: boolean;
  edited: SummaryJson;
  onChange: (updated: SummaryJson) => void;
}

function FreeTextArea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  }, [value]);

  return (
    <textarea
      ref={ref}
      className="input-field text-sm w-full"
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{ resize: 'none', overflow: 'hidden' }}
    />
  );
}

function ViewText({ text }: { text: string }) {
  if (!text) return <span className="text-gray-400 italic text-sm">—</span>;
  return (
    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{text}</p>
  );
}

export default function SummaryContent({ summary, isEditing, edited, onChange }: SummaryContentProps) {
  const t = edited._text || {};

  const setPatientContext = (val: string) => {
    onChange({ ...edited, _text: { ...t, patient_context: val } });
  };

  const setSectionContent = (idx: number, val: string) => {
    const currentSections: { heading: string; content: string }[] =
      t.sections ?? (edited.sections ?? []).map((s) => ({ ...s }));
    const updated = currentSections.map((s, i) => (i === idx ? { ...s, content: val } : s));
    onChange({ ...edited, _text: { ...t, sections: updated } });
  };

  const setFlagsText = (val: string) => {
    onChange({ ...edited, _text: { ...t, flags_for_review: val } });
  };

  const editSections: { heading: string; content: string }[] =
    t.sections ?? (edited.sections ?? []).map((s) => ({ ...s }));

  const editFlagsText: string =
    t.flags_for_review !== undefined
      ? t.flags_for_review
      : (edited.flags_for_review ?? []).join('\n');

  const editPatientContext: string =
    t.patient_context !== undefined ? t.patient_context : (edited.patient_context ?? '');

  if (isEditing) {
    return (
      <div className="space-y-4">
        {edited.document_type && (
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#024CDB] border border-blue-100">
              {edited.document_type}
            </span>
          </div>
        )}

        <SummaryCard title="Patient Context">
          <FreeTextArea
            value={editPatientContext}
            onChange={setPatientContext}
            placeholder="Brief patient context..."
          />
        </SummaryCard>

        {editSections.map((section, idx) => (
          <SummaryCard key={idx} title={section.heading}>
            <FreeTextArea
              value={section.content}
              onChange={(v) => setSectionContent(idx, v)}
              placeholder={`Content for ${section.heading}...`}
            />
          </SummaryCard>
        ))}

        <SummaryCard title="Flags for Review">
          <FreeTextArea
            value={editFlagsText}
            onChange={setFlagsText}
            placeholder="- Flag 1&#10;- Flag 2"
          />
        </SummaryCard>
      </div>
    );
  }

  const data = summary;
  const st = data._text || {};

  const viewSections: { heading: string; content: string }[] =
    st.sections ?? (data.sections ?? []);

  const viewFlagsText: string | undefined = st.flags_for_review;
  const viewFlags: string[] = data.flags_for_review ?? [];

  return (
    <div className="space-y-4">
      {data.document_type && (
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#024CDB] border border-blue-100">
            {data.document_type}
          </span>
        </div>
      )}

      {(data.patient_context || st.patient_context) && (
        <SummaryCard title="Patient Context">
          <ViewText text={st.patient_context ?? data.patient_context ?? ''} />
        </SummaryCard>
      )}

      {viewSections.map((section, idx) => (
        <SummaryCard key={idx} title={section.heading}>
          <ViewText text={section.content} />
        </SummaryCard>
      ))}

      {(viewFlagsText !== undefined || viewFlags.length > 0) && (
        <SummaryCard title="Flags for Review">
          {viewFlagsText !== undefined ? (
            <ViewText text={viewFlagsText} />
          ) : (
            <ul className="space-y-2">
              {viewFlags.map((flag, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>{flag}</span>
                </li>
              ))}
            </ul>
          )}
        </SummaryCard>
      )}
    </div>
  );
}
