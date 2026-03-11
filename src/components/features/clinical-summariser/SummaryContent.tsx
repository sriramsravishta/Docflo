import SummaryCard from './SummaryCard';

export interface SummaryJson {
  patient_summary?: string;
  history?: string;
  investigations?: string;
  procedures?: string;
  hospital_course?: string;
  discharge_medications?: string;
  discharge_instructions?: string;
  follow_up?: string;
  flags_for_review?: string;
}

interface SummaryContentProps {
  summary: SummaryJson;
  isEditing: boolean;
  edited: SummaryJson;
  onChange: (updated: SummaryJson) => void;
}

function EditableSection({
  title,
  value,
  onChange,
  isEditing,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  isEditing: boolean;
}) {
  return (
    <SummaryCard title={title}>
      {isEditing ? (
        <textarea
          className="input-field text-sm w-full min-h-[100px] p-3 resize-y"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter details for ${title.toLowerCase()}...`}
        />
      ) : (
        <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
          {value || <span className="text-gray-400 italic">—</span>}
        </div>
      )}
    </SummaryCard>
  );
}

export default function SummaryContent({ summary, isEditing, edited, onChange }: SummaryContentProps) {
  const data = isEditing ? edited : summary;

  const handleUpdate = (key: keyof SummaryJson, value: string) => {
    onChange({ ...edited, [key]: value });
  };

  return (
    <div className="space-y-4">
      <EditableSection
        title="Patient Summary"
        value={data.patient_summary || ''}
        onChange={(v) => handleUpdate('patient_summary', v)}
        isEditing={isEditing}
      />
      
      <EditableSection
        title="History"
        value={data.history || ''}
        onChange={(v) => handleUpdate('history', v)}
        isEditing={isEditing}
      />

      <EditableSection
        title="Investigations"
        value={data.investigations || ''}
        onChange={(v) => handleUpdate('investigations', v)}
        isEditing={isEditing}
      />

      <EditableSection
        title="Procedures"
        value={data.procedures || ''}
        onChange={(v) => handleUpdate('procedures', v)}
        isEditing={isEditing}
      />

      <EditableSection
        title="Hospital Course"
        value={data.hospital_course || ''}
        onChange={(v) => handleUpdate('hospital_course', v)}
        isEditing={isEditing}
      />

      <EditableSection
        title="Discharge Medications"
        value={data.discharge_medications || ''}
        onChange={(v) => handleUpdate('discharge_medications', v)}
        isEditing={isEditing}
      />

      <EditableSection
        title="Discharge Instructions"
        value={data.discharge_instructions || ''}
        onChange={(v) => handleUpdate('discharge_instructions', v)}
        isEditing={isEditing}
      />

      <EditableSection
        title="Follow-Up"
        value={data.follow_up || ''}
        onChange={(v) => handleUpdate('follow_up', v)}
        isEditing={isEditing}
      />

      <EditableSection
        title="Flags for Review"
        value={data.flags_for_review || ''}
        onChange={(v) => handleUpdate('flags_for_review', v)}
        isEditing={isEditing}
      />
    </div>
  );
}