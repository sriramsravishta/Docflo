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
  _text?: {
    patient_summary?: string;
    history?: string;
    investigations?: string;
    procedures?: string;
    hospital_course?: string;
    discharge_medications?: string;
    discharge_instructions?: string;
    follow_up?: string;
    flags_for_review?: string;
  };
}

interface SummaryContentProps {
  summary: SummaryJson;
  isEditing: boolean;
  edited: SummaryJson;
  onChange: (updated: SummaryJson) => void;
}

function serializePatientSummary(s: SummaryJson['patient_summary'], t?: string): string {
  if (t !== undefined) return t;
  if (!s) return '';
  const parts: string[] = [];
  if (s.presenting_complaint) parts.push(`Presenting Complaint: ${s.presenting_complaint}`);
  if (s.duration_of_stay) parts.push(`Duration of Stay: ${s.duration_of_stay}`);
  if (s.admitting_diagnosis) parts.push(`Admitting Diagnosis: ${s.admitting_diagnosis}`);
  return parts.join('\n');
}

function serializeHistory(h: SummaryJson['history'], t?: string): string {
  if (t !== undefined) return t;
  if (!h) return '';
  const parts: string[] = [];
  if (h.past_medical_history?.length) parts.push(`Past Medical History:\n${h.past_medical_history.map((x) => `- ${x}`).join('\n')}`);
  if (h.surgical_history?.length) parts.push(`Surgical History:\n${h.surgical_history.map((x) => `- ${x}`).join('\n')}`);
  if (h.family_history) parts.push(`Family History: ${h.family_history}`);
  if (h.social_history) parts.push(`Social History: ${h.social_history}`);
  return parts.join('\n\n');
}

function serializeInvestigations(inv: SummaryJson['investigations'], t?: string): string {
  if (t !== undefined) return t;
  if (!inv) return '';
  const parts: string[] = [];
  if (inv.key_findings?.length) parts.push(`Key Findings:\n${inv.key_findings.map((x) => `- ${x}`).join('\n')}`);
  if (inv.labs?.length) {
    parts.push(`Labs:\n${inv.labs.map((l) => `- ${l.name}: ${l.value} (${l.interpretation})`).join('\n')}`);
  }
  return parts.join('\n\n');
}

function serializeProcedures(p: string[] | undefined, t?: string): string {
  if (t !== undefined) return t;
  if (!p?.length) return '';
  return p.map((x) => `- ${x}`).join('\n');
}

function serializeMedications(meds: SummaryJson['discharge_medications'], t?: string): string {
  if (t !== undefined) return t;
  if (!meds?.length) return '';
  return meds.map((m) => `${m.name} ${m.dose} — ${m.frequency} — ${m.duration}`).join('\n');
}

function serializeInstructions(items: string[] | undefined, t?: string): string {
  if (t !== undefined) return t;
  if (!items?.length) return '';
  return items.map((x) => `- ${x}`).join('\n');
}

function serializeFollowUp(f: SummaryJson['follow_up'], t?: string): string {
  if (t !== undefined) return t;
  if (!f) return '';
  const parts: string[] = [];
  if (f.appointments?.length) parts.push(`Appointments:\n${f.appointments.map((a) => `- ${a.department}: ${a.timeframe}`).join('\n')}`);
  if (f.warning_signs?.length) parts.push(`Warning Signs:\n${f.warning_signs.map((x) => `- ${x}`).join('\n')}`);
  return parts.join('\n\n');
}

function serializeFlags(items: string[] | undefined, t?: string): string {
  if (t !== undefined) return t;
  if (!items?.length) return '';
  return items.map((x) => `- ${x}`).join('\n');
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize logic
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto'; // Reset height to recalculate
      textarea.style.height = `${textarea.scrollHeight}px`; // Set to scroll height
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      className="input-field text-sm w-full p-3 resize-none overflow-hidden border-none focus:ring-0"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      rows={1} // Start small, let the height logic take over
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

  const setT = (key: keyof NonNullable<SummaryJson['_text']>, val: string) => {
    onChange({ ...edited, _text: { ...t, [key]: val } });
  };

  if (isEditing) {
    return (
      <div className="space-y-4">
        <SummaryCard title="Patient Summary">
          <FreeTextArea
            rows={4}
            value={serializePatientSummary(edited.patient_summary, t.patient_summary)}
            onChange={(v) => setT('patient_summary', v)}
            placeholder={'Presenting Complaint: ...\nDuration of Stay: ...\nAdmitting Diagnosis: ...'}
          />
        </SummaryCard>

        <SummaryCard title="History">
          <FreeTextArea
            rows={6}
            value={serializeHistory(edited.history, t.history)}
            onChange={(v) => setT('history', v)}
            placeholder={'Past Medical History:\n- ...\n\nSurgical History:\n- ...\n\nFamily History: ...\nSocial History: ...'}
          />
        </SummaryCard>

        <SummaryCard title="Investigations">
          <FreeTextArea
            rows={6}
            value={serializeInvestigations(edited.investigations, t.investigations)}
            onChange={(v) => setT('investigations', v)}
            placeholder={'Key Findings:\n- ...\n\nLabs:\n- HbA1c: 8.2% (Poorly controlled)'}
          />
        </SummaryCard>

        <SummaryCard title="Procedures">
          <FreeTextArea
            rows={3}
            value={serializeProcedures(edited.procedures, t.procedures)}
            onChange={(v) => setT('procedures', v)}
            placeholder={'- Primary PCI performed\n- ICU monitoring for 48 hours'}
          />
        </SummaryCard>

        <SummaryCard title="Hospital Course">
          <FreeTextArea
            rows={4}
            value={t.hospital_course !== undefined ? t.hospital_course : (edited.hospital_course || '')}
            onChange={(v) => setT('hospital_course', v)}
            placeholder={'Describe the hospital course...'}
          />
        </SummaryCard>

        <SummaryCard title="Discharge Medications">
          <FreeTextArea
            rows={7}
            value={serializeMedications(edited.discharge_medications, t.discharge_medications)}
            onChange={(v) => setT('discharge_medications', v)}
            placeholder={'Aspirin 75mg — Once daily — Lifelong\nClopidogrel 75mg — Once daily — 12 months'}
          />
        </SummaryCard>

        <SummaryCard title="Discharge Instructions">
          <FreeTextArea
            rows={5}
            value={serializeInstructions(edited.discharge_instructions, t.discharge_instructions)}
            onChange={(v) => setT('discharge_instructions', v)}
            placeholder={'- Avoid strenuous activity for 4 weeks\n- Monitor blood sugar twice daily'}
          />
        </SummaryCard>

        <SummaryCard title="Follow-Up">
          <FreeTextArea
            rows={5}
            value={serializeFollowUp(edited.follow_up, t.follow_up)}
            onChange={(v) => setT('follow_up', v)}
            placeholder={'Appointments:\n- Cardiology OPD: 2 weeks\n\nWarning Signs:\n- Return immediately if chest pain recurs'}
          />
        </SummaryCard>

        <SummaryCard title="Flags for Review">
          <FreeTextArea
            rows={3}
            value={serializeFlags(edited.flags_for_review, t.flags_for_review)}
            onChange={(v) => setT('flags_for_review', v)}
            placeholder={'- EF 38% — monitor for HFrEF progression'}
          />
        </SummaryCard>
      </div>
    );
  }

  const data = summary;
  const st = data._text || {};

  return (
    <div className="space-y-4">
      <SummaryCard title="Patient Summary">
        {st.patient_summary ? (
          <ViewText text={st.patient_summary} />
        ) : (
          <div className="space-y-3">
            {data.patient_summary?.presenting_complaint && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Presenting Complaint</p>
                <p className="text-sm text-gray-800">{data.patient_summary.presenting_complaint}</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.patient_summary?.duration_of_stay && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">Duration of Stay</p>
                  <p className="text-sm text-gray-800">{data.patient_summary.duration_of_stay}</p>
                </div>
              )}
              {data.patient_summary?.admitting_diagnosis && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">Admitting Diagnosis</p>
                  <p className="text-sm text-gray-800">{data.patient_summary.admitting_diagnosis}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </SummaryCard>

      <SummaryCard title="History">
        {st.history ? (
          <ViewText text={st.history} />
        ) : (
          <div className="space-y-3">
            {!!data.history?.past_medical_history?.length && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Past Medical History</p>
                <ul className="space-y-1.5">
                  {data.history.past_medical_history.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#024CDB] shrink-0" />{item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!!data.history?.surgical_history?.length && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Surgical History</p>
                <ul className="space-y-1.5">
                  {data.history.surgical_history.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#024CDB] shrink-0" />{item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data.history?.family_history && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Family History</p>
                <p className="text-sm text-gray-800">{data.history.family_history}</p>
              </div>
            )}
            {data.history?.social_history && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Social History</p>
                <p className="text-sm text-gray-800">{data.history.social_history}</p>
              </div>
            )}
          </div>
        )}
      </SummaryCard>

      <SummaryCard title="Investigations">
        {st.investigations ? (
          <ViewText text={st.investigations} />
        ) : (
          <div className="space-y-3">
            {!!data.investigations?.key_findings?.length && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Key Findings</p>
                <ul className="space-y-1.5">
                  {data.investigations.key_findings.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#024CDB] shrink-0" />{item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!!data.investigations?.labs?.length && (
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
                      {data.investigations.labs.map((lab, i) => (
                        <tr key={i}>
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </SummaryCard>

      <SummaryCard title="Procedures">
        {st.procedures ? (
          <ViewText text={st.procedures} />
        ) : (
          <ul className="space-y-1.5">
            {(data.procedures || []).map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#024CDB] shrink-0" />{item}
              </li>
            ))}
          </ul>
        )}
      </SummaryCard>

      <SummaryCard title="Hospital Course">
        {st.hospital_course ? (
          <ViewText text={st.hospital_course} />
        ) : (
          <p className="text-sm text-gray-800">{data.hospital_course || <span className="text-gray-400 italic">—</span>}</p>
        )}
      </SummaryCard>

      <SummaryCard title="Discharge Medications">
        {st.discharge_medications ? (
          <ViewText text={st.discharge_medications} />
        ) : (
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
                    <td className="px-3 py-2 text-sm text-gray-800 font-medium">{med.name}</td>
                    <td className="px-3 py-2 text-sm text-gray-800">{med.dose}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{med.frequency}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{med.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SummaryCard>

      <SummaryCard title="Discharge Instructions">
        {st.discharge_instructions ? (
          <ViewText text={st.discharge_instructions} />
        ) : (
          <ul className="space-y-1.5">
            {(data.discharge_instructions || []).map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#024CDB] shrink-0" />{item}
              </li>
            ))}
          </ul>
        )}
      </SummaryCard>

      <SummaryCard title="Follow-Up">
        {st.follow_up ? (
          <ViewText text={st.follow_up} />
        ) : (
          <div className="space-y-3">
            {!!data.follow_up?.appointments?.length && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Appointments</p>
                {data.follow_up.appointments.map((appt, i) => (
                  <div key={i} className="flex items-center gap-3 mb-1.5">
                    <span className="text-sm text-gray-800 font-medium">{appt.department}</span>
                    <span className="text-xs bg-blue-50 text-[#024CDB] px-2 py-0.5 rounded-full font-medium">{appt.timeframe}</span>
                  </div>
                ))}
              </div>
            )}
            {!!data.follow_up?.warning_signs?.length && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Warning Signs</p>
                <ul className="space-y-1.5">
                  {data.follow_up.warning_signs.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#024CDB] shrink-0" />{item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </SummaryCard>

      <SummaryCard title="Flags for Review">
        {st.flags_for_review ? (
          <ViewText text={st.flags_for_review} />
        ) : (
          <ul className="space-y-1.5">
            {(data.flags_for_review || []).map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#024CDB] shrink-0" />{item}
              </li>
            ))}
          </ul>
        )}
      </SummaryCard>
    </div>
  );
}
