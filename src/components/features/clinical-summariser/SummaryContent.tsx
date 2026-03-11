import SummaryCard from './SummaryCard';

export interface SummaryJson {
  patient_summary?: {
    presenting_complaint?: string;
    duration_of_stay?: string;
    admitting_diagnosis?: string;
  };
  history?: {
    past_medical_history?: string[];
    surgical_history?: string[];
    family_history?: string;
    social_history?: string;
  };
  investigations?: {
    key_findings?: string[];
    labs?: { name: string; value: string; interpretation: string }[];
  };
  procedures?: string[];
  hospital_course?: string;
  discharge_medications?: {
    name: string;
    dose: string;
    frequency: string;
    duration: string;
  }[];
  discharge_instructions?: string[];
  follow_up?: {
    appointments?: { department: string; timeframe: string }[];
    warning_signs?: string[];
  };
  flags_for_review?: string[];
}

interface SummaryContentProps {
  summary: SummaryJson;
  isEditing: boolean;
  edited: SummaryJson;
  onChange: (updated: SummaryJson) => void;
}

function EditableText({
  value,
  onChange,
  isEditing,
  placeholder,
  multiline,
}: {
  value: string;
  onChange: (v: string) => void;
  isEditing: boolean;
  placeholder?: string;
  multiline?: boolean;
}) {
  if (!isEditing) {
    return <span className="text-sm text-gray-800">{value || <span className="text-gray-400 italic">—</span>}</span>;
  }
  if (multiline) {
    return (
      <textarea
        className="input-field text-sm w-full resize-none"
        rows={3}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <input
      type="text"
      className="input-field text-sm w-full"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function EditableList({
  items,
  onChange,
  isEditing,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  isEditing: boolean;
}) {
  if (!isEditing) {
    return (
      <ul className="space-y-1.5">
        {(items || []).map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#024CDB] shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="space-y-2">
      {(items || []).map((item, i) => (
        <div key={i} className="flex gap-2">
          <input
            type="text"
            className="input-field text-sm flex-1"
            value={item}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="text-red-500 hover:text-red-700 text-xs px-2"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ''])}
        className="text-xs text-[#024CDB] hover:underline"
      >
        + Add item
      </button>
    </div>
  );
}

export default function SummaryContent({ summary, isEditing, edited, onChange }: SummaryContentProps) {
  const data = isEditing ? edited : summary;

  const set = (patch: Partial<SummaryJson>) => onChange({ ...edited, ...patch });

  return (
    <div className="space-y-4">
      <SummaryCard title="Patient Summary">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">Presenting Complaint</p>
            <EditableText
              value={data.patient_summary?.presenting_complaint || ''}
              onChange={(v) => set({ patient_summary: { ...edited.patient_summary, presenting_complaint: v } })}
              isEditing={isEditing}
              multiline
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Duration of Stay</p>
              <EditableText
                value={data.patient_summary?.duration_of_stay || ''}
                onChange={(v) => set({ patient_summary: { ...edited.patient_summary, duration_of_stay: v } })}
                isEditing={isEditing}
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Admitting Diagnosis</p>
              <EditableText
                value={data.patient_summary?.admitting_diagnosis || ''}
                onChange={(v) => set({ patient_summary: { ...edited.patient_summary, admitting_diagnosis: v } })}
                isEditing={isEditing}
              />
            </div>
          </div>
        </div>
      </SummaryCard>

      <SummaryCard title="History">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">Past Medical History</p>
            <EditableList
              items={data.history?.past_medical_history || []}
              onChange={(v) => set({ history: { ...edited.history, past_medical_history: v } })}
              isEditing={isEditing}
            />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">Surgical History</p>
            <EditableList
              items={data.history?.surgical_history || []}
              onChange={(v) => set({ history: { ...edited.history, surgical_history: v } })}
              isEditing={isEditing}
            />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">Family History</p>
            <EditableText
              value={data.history?.family_history || ''}
              onChange={(v) => set({ history: { ...edited.history, family_history: v } })}
              isEditing={isEditing}
              multiline
            />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">Social History</p>
            <EditableText
              value={data.history?.social_history || ''}
              onChange={(v) => set({ history: { ...edited.history, social_history: v } })}
              isEditing={isEditing}
              multiline
            />
          </div>
        </div>
      </SummaryCard>

      <SummaryCard title="Investigations">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">Key Findings</p>
            <EditableList
              items={data.investigations?.key_findings || []}
              onChange={(v) => set({ investigations: { ...edited.investigations, key_findings: v } })}
              isEditing={isEditing}
            />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">Lab Results</p>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-3 py-2">Test</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-3 py-2">Value</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-3 py-2">Interpretation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data.investigations?.labs || []).map((lab, i) => (
                    <tr key={i}>
                      {isEditing ? (
                        <>
                          <td className="px-3 py-2">
                            <input type="text" className="input-field text-sm w-full" value={lab.name}
                              onChange={(e) => {
                                const next = [...(edited.investigations?.labs || [])];
                                next[i] = { ...next[i], name: e.target.value };
                                set({ investigations: { ...edited.investigations, labs: next } });
                              }} />
                          </td>
                          <td className="px-3 py-2">
                            <input type="text" className="input-field text-sm w-full" value={lab.value}
                              onChange={(e) => {
                                const next = [...(edited.investigations?.labs || [])];
                                next[i] = { ...next[i], value: e.target.value };
                                set({ investigations: { ...edited.investigations, labs: next } });
                              }} />
                          </td>
                          <td className="px-3 py-2">
                            <input type="text" className="input-field text-sm w-full" value={lab.interpretation}
                              onChange={(e) => {
                                const next = [...(edited.investigations?.labs || [])];
                                next[i] = { ...next[i], interpretation: e.target.value };
                                set({ investigations: { ...edited.investigations, labs: next } });
                              }} />
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2 text-sm text-gray-800 font-medium">{lab.name}</td>
                          <td className="px-3 py-2 text-sm text-gray-800">{lab.value}</td>
                          <td className="px-3 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              lab.interpretation?.toLowerCase().includes('normal') ? 'bg-green-100 text-green-700' :
                              lab.interpretation?.toLowerCase().includes('elevat') || lab.interpretation?.toLowerCase().includes('high') ? 'bg-orange-100 text-orange-700' :
                              lab.interpretation?.toLowerCase().includes('low') ? 'bg-blue-100 text-blue-700' :
                              lab.interpretation?.toLowerCase().includes('poor') ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>{lab.interpretation}</span>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </SummaryCard>

      <SummaryCard title="Procedures">
        <EditableList
          items={data.procedures || []}
          onChange={(v) => set({ procedures: v })}
          isEditing={isEditing}
        />
      </SummaryCard>

      <SummaryCard title="Hospital Course">
        <EditableText
          value={data.hospital_course || ''}
          onChange={(v) => set({ hospital_course: v })}
          isEditing={isEditing}
          multiline
        />
      </SummaryCard>

      <SummaryCard title="Discharge Medications">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-3 py-2">Medication</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-3 py-2">Dose</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-3 py-2">Frequency</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-3 py-2">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(data.discharge_medications || []).map((med, i) => (
                <tr key={i}>
                  {isEditing ? (
                    <>
                      {(['name', 'dose', 'frequency', 'duration'] as const).map((field) => (
                        <td key={field} className="px-3 py-2">
                          <input type="text" className="input-field text-sm w-full" value={med[field]}
                            onChange={(e) => {
                              const next = [...(edited.discharge_medications || [])];
                              next[i] = { ...next[i], [field]: e.target.value };
                              set({ discharge_medications: next });
                            }} />
                        </td>
                      ))}
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 text-sm text-gray-800 font-medium">{med.name}</td>
                      <td className="px-3 py-2 text-sm text-gray-800">{med.dose}</td>
                      <td className="px-3 py-2 text-sm text-gray-600">{med.frequency}</td>
                      <td className="px-3 py-2 text-sm text-gray-600">{med.duration}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SummaryCard>

      <SummaryCard title="Discharge Instructions">
        <EditableList
          items={data.discharge_instructions || []}
          onChange={(v) => set({ discharge_instructions: v })}
          isEditing={isEditing}
        />
      </SummaryCard>

      <SummaryCard title="Follow-Up">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">Appointments</p>
            {(data.follow_up?.appointments || []).map((appt, i) => (
              <div key={i} className="flex items-center gap-3 mb-1.5">
                {isEditing ? (
                  <>
                    <input type="text" className="input-field text-sm flex-1" value={appt.department}
                      placeholder="Department"
                      onChange={(e) => {
                        const next = [...(edited.follow_up?.appointments || [])];
                        next[i] = { ...next[i], department: e.target.value };
                        set({ follow_up: { ...edited.follow_up, appointments: next } });
                      }} />
                    <input type="text" className="input-field text-sm w-28" value={appt.timeframe}
                      placeholder="Timeframe"
                      onChange={(e) => {
                        const next = [...(edited.follow_up?.appointments || [])];
                        next[i] = { ...next[i], timeframe: e.target.value };
                        set({ follow_up: { ...edited.follow_up, appointments: next } });
                      }} />
                  </>
                ) : (
                  <>
                    <span className="text-sm text-gray-800 font-medium">{appt.department}</span>
                    <span className="text-xs bg-blue-50 text-[#024CDB] px-2 py-0.5 rounded-full font-medium">{appt.timeframe}</span>
                  </>
                )}
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">Warning Signs</p>
            <EditableList
              items={data.follow_up?.warning_signs || []}
              onChange={(v) => set({ follow_up: { ...edited.follow_up, warning_signs: v } })}
              isEditing={isEditing}
            />
          </div>
        </div>
      </SummaryCard>

      <SummaryCard title="Flags for Review">
        <EditableList
          items={data.flags_for_review || []}
          onChange={(v) => set({ flags_for_review: v })}
          isEditing={isEditing}
        />
      </SummaryCard>
    </div>
  );
}
