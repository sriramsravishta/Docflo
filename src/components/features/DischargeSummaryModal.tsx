import { useState } from 'react';
import { X, Edit3, Save, FileDown, RefreshCw, Loader2 } from 'lucide-react';
import type { AdmissionRow, DischargeSummaryData } from '../../types/db';
import { updateAdmission, triggerGenerateDS } from '../../lib/database';

interface DischargeSummaryModalProps {
  admission: AdmissionRow;
  onClose: () => void;
  onUpdate: (updated: AdmissionRow) => void;
}

export default function DischargeSummaryModal({ admission, onClose, onUpdate }: DischargeSummaryModalProps) {
  const ds = (admission.discharge_summary && Object.keys(admission.discharge_summary).length > 0)
    ? admission.discharge_summary as DischargeSummaryData
    : null;

  const [isEditing, setIsEditing] = useState(false);
  const [editedDS, setEditedDS] = useState<DischargeSummaryData>(ds || {});
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const updateField = (path: string, value: unknown) => {
    setEditedDS(prev => {
      const updated = { ...prev };
      const keys = path.split('.');
      let obj: any = updated;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!obj[keys[i]]) obj[keys[i]] = {};
        obj[keys[i]] = { ...obj[keys[i]] };
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return updated;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateAdmission(admission.id, {
        discharge_summary: editedDS,
        ds_status: 'finalized',
      });
      onUpdate(result as AdmissionRow);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save DS:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await triggerGenerateDS(admission.id);
      onClose();
    } catch (error) {
      console.error('Failed to regenerate DS:', error);
      setRegenerating(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!ds) return;
    const html = `
      <!DOCTYPE html>
      <html><head><title>Discharge Summary</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #1a1a1a; line-height: 1.6; max-width: 800px; margin: 0 auto; }
        h1 { font-size: 20px; border-bottom: 2px solid #024CDB; padding-bottom: 8px; color: #024CDB; }
        h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #555; margin-top: 24px; margin-bottom: 8px; }
        p { font-size: 13px; margin: 4px 0; }
        table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 12px; }
        th { background: #f3f4f6; text-align: left; padding: 6px 8px; border: 1px solid #e5e7eb; font-weight: 600; }
        td { padding: 6px 8px; border: 1px solid #e5e7eb; }
        ul { padding-left: 20px; margin: 4px 0; }
        li { font-size: 13px; margin: 2px 0; }
        @media print { body { padding: 20px; } }
      </style></head><body>
      <h1>Discharge Summary</h1>
      ${ds.patient_details ? `<h2>Patient Details</h2>
        <p><strong>Name:</strong> ${ds.patient_details.name || '—'} | <strong>Age:</strong> ${ds.patient_details.age || '—'} | <strong>Gender:</strong> ${ds.patient_details.gender || '—'}</p>
        <p><strong>UHID:</strong> ${ds.patient_details.uhid || '—'} | <strong>Ward:</strong> ${ds.patient_details.ward || '—'}</p>
        <p><strong>Admission:</strong> ${ds.patient_details.admission_date || '—'} | <strong>Discharge:</strong> ${ds.patient_details.discharge_date || '—'}</p>` : ''}
      ${ds.diagnosis ? `<h2>Diagnosis</h2><p><strong>Primary:</strong> ${ds.diagnosis.primary || '—'}</p>
        ${ds.diagnosis.secondary?.length ? `<p><strong>Secondary:</strong></p><ul>${ds.diagnosis.secondary.map(s => `<li>${s}</li>`).join('')}</ul>` : ''}` : ''}
      ${ds.chief_complaints?.length ? `<h2>Chief Complaints</h2><ul>${ds.chief_complaints.map(c => `<li>${c}</li>`).join('')}</ul>` : ''}
      ${ds.history_of_present_illness ? `<h2>History of Present Illness</h2><p>${ds.history_of_present_illness}</p>` : ''}
      ${ds.history_past_personal_family ? `<h2>Past / Personal / Family History</h2><p>${ds.history_past_personal_family}</p>` : ''}
      ${ds.patient_course_in_hospital ? `<h2>Patient Course in Hospital</h2><p>${ds.patient_course_in_hospital}</p>` : ''}
      ${ds.discharge_medications?.length ? `<h2>Discharge Medications</h2>
        <table><tr><th>Drug</th><th>Dosage</th><th>Frequency</th><th>Route</th><th>Duration</th></tr>
        ${ds.discharge_medications.map(m => `<tr><td>${m.drug_name || '—'}</td><td>${m.dosage || m.strength || '—'}</td><td>${m.frequency || '—'}</td><td>${m.route || '—'}</td><td>${m.duration || '—'}</td></tr>`).join('')}
        </table>` : ''}
      ${ds.special_instructions ? `<h2>Special Instructions</h2>
        ${ds.special_instructions.diet ? `<p><strong>Diet:</strong> ${ds.special_instructions.diet}</p>` : ''}
        ${ds.special_instructions.follow_up ? `<p><strong>Follow-up:</strong> ${ds.special_instructions.follow_up}</p>` : ''}
        ${ds.special_instructions.post_discharge_investigations ? `<p><strong>Investigations:</strong> ${ds.special_instructions.post_discharge_investigations}</p>` : ''}
        ${ds.special_instructions.emergency_care ? `<p><strong>Emergency Care:</strong> ${ds.special_instructions.emergency_care}</p>` : ''}` : ''}
      ${ds.condition_at_discharge ? `<h2>Condition at Discharge</h2><p>${ds.condition_at_discharge}</p>` : ''}
      </body></html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  };

  const currentDS = isEditing ? editedDS : ds;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Discharge Summary</h2>
          <div className="flex items-center gap-2">
            {ds && !isEditing && (
              <button
                onClick={() => { setEditedDS(ds); setIsEditing(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Edit3 className="w-4 h-4" /> Edit
              </button>
            )}
            {isEditing && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-[#024CDB] text-white hover:bg-[#023BA3] rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Save'}
              </button>
            )}
            {ds && (
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title="Regenerate DS"
              >
                <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
              </button>
            )}
            {ds && (
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Download PDF"
              >
                <FileDown className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 space-y-4">
          {!currentDS || Object.keys(currentDS).length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">Discharge summary has not been generated yet.</p>
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="inline-flex items-center px-4 py-2 bg-[#024CDB] text-white rounded-lg hover:bg-[#023BA3] transition-colors font-medium disabled:opacity-50"
              >
                {regenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Generate Now
              </button>
            </div>
          ) : (
            <>
              {/* Patient Details */}
              {currentDS.patient_details && (
                <Section title="Patient Details">
                  {isEditing ? (
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="Name" value={currentDS.patient_details.name || ''} onChange={(v) => updateField('patient_details.name', v)} />
                      <Input label="Age" value={currentDS.patient_details.age || ''} onChange={(v) => updateField('patient_details.age', v)} />
                      <Input label="Gender" value={currentDS.patient_details.gender || ''} onChange={(v) => updateField('patient_details.gender', v)} />
                      <Input label="UHID" value={currentDS.patient_details.uhid || ''} onChange={(v) => updateField('patient_details.uhid', v)} />
                      <Input label="Ward" value={currentDS.patient_details.ward || ''} onChange={(v) => updateField('patient_details.ward', v)} />
                      <Input label="Bed" value={currentDS.patient_details.bed_number || ''} onChange={(v) => updateField('patient_details.bed_number', v)} />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                      <p><span className="text-gray-500">Name:</span> {currentDS.patient_details.name || '—'}</p>
                      <p><span className="text-gray-500">Age:</span> {currentDS.patient_details.age || '—'}</p>
                      <p><span className="text-gray-500">Gender:</span> {currentDS.patient_details.gender || '—'}</p>
                      <p><span className="text-gray-500">UHID:</span> {currentDS.patient_details.uhid || '—'}</p>
                      <p><span className="text-gray-500">Ward:</span> {currentDS.patient_details.ward || '—'}</p>
                      <p><span className="text-gray-500">Admission:</span> {currentDS.patient_details.admission_date || '—'}</p>
                    </div>
                  )}
                </Section>
              )}

              {/* Diagnosis */}
              <Section title="Diagnosis">
                {isEditing ? (
                  <div className="space-y-2">
                    <Input label="Primary" value={currentDS.diagnosis?.primary || ''} onChange={(v) => updateField('diagnosis.primary', v)} />
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Secondary (one per line)</label>
                      <textarea
                        value={(currentDS.diagnosis?.secondary || []).join('\n')}
                        onChange={(e) => updateField('diagnosis.secondary', e.target.value.split('\n').filter(Boolean))}
                        rows={2}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-sm">
                    <p className="font-medium text-gray-900">{currentDS.diagnosis?.primary || '—'}</p>
                    {currentDS.diagnosis?.secondary?.map((s, i) => (
                      <p key={i} className="text-gray-600 ml-4">• {s}</p>
                    ))}
                  </div>
                )}
              </Section>

              {/* Chief Complaints */}
              <Section title="Chief Complaints">
                {isEditing ? (
                  <textarea
                    value={(currentDS.chief_complaints || []).join('\n')}
                    onChange={(e) => updateField('chief_complaints', e.target.value.split('\n').filter(Boolean))}
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                ) : (
                  <ul className="text-sm text-gray-900 space-y-1">
                    {(currentDS.chief_complaints || []).map((c, i) => <li key={i}>• {c}</li>)}
                    {(!currentDS.chief_complaints || currentDS.chief_complaints.length === 0) && <p className="text-gray-400">—</p>}
                  </ul>
                )}
              </Section>

              {/* HPI */}
              <Section title="History of Present Illness">
                <TextBlock
                  value={currentDS.history_of_present_illness || ''}
                  isEditing={isEditing}
                  onChange={(v) => updateField('history_of_present_illness', v)}
                  rows={4}
                />
              </Section>

              {/* Past History */}
              {(currentDS.history_past_personal_family || isEditing) && (
                <Section title="Past / Personal / Family History">
                  <TextBlock
                    value={currentDS.history_past_personal_family || ''}
                    isEditing={isEditing}
                    onChange={(v) => updateField('history_past_personal_family', v)}
                    rows={3}
                  />
                </Section>
              )}

              {/* Course in Hospital */}
              <Section title="Patient Course in Hospital">
                <TextBlock
                  value={currentDS.patient_course_in_hospital || ''}
                  isEditing={isEditing}
                  onChange={(v) => updateField('patient_course_in_hospital', v)}
                  rows={6}
                />
              </Section>

              {/* Discharge Medications */}
              {(currentDS.discharge_medications?.length || isEditing) && (
                <Section title="Discharge Medications">
                  {!isEditing ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="text-left p-2 font-medium text-gray-600 text-xs">Drug</th>
                            <th className="text-left p-2 font-medium text-gray-600 text-xs">Dosage</th>
                            <th className="text-left p-2 font-medium text-gray-600 text-xs">Frequency</th>
                            <th className="text-left p-2 font-medium text-gray-600 text-xs">Route</th>
                            <th className="text-left p-2 font-medium text-gray-600 text-xs">Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(currentDS.discharge_medications || []).map((m, i) => (
                            <tr key={i} className="border-t border-gray-100">
                              <td className="p-2 text-gray-900">{m.drug_name}</td>
                              <td className="p-2 text-gray-600">{m.dosage || m.strength || '—'}</td>
                              <td className="p-2 text-gray-600">{m.frequency || '—'}</td>
                              <td className="p-2 text-gray-600">{m.route || '—'}</td>
                              <td className="p-2 text-gray-600">{m.duration || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <textarea
                      value={(currentDS.discharge_medications || []).map(m => `${m.drug_name} | ${m.dosage || ''} | ${m.frequency || ''} | ${m.route || ''} | ${m.duration || ''}`).join('\n')}
                      onChange={(e) => {
                        const meds = e.target.value.split('\n').filter(Boolean).map(line => {
                          const [drug_name = '', dosage = '', frequency = '', route = '', duration = ''] = line.split('|').map(s => s.trim());
                          return { drug_name, dosage, frequency, route, duration };
                        });
                        updateField('discharge_medications', meds);
                      }}
                      rows={5}
                      placeholder="Drug Name | Dosage | Frequency | Route | Duration (one per line)"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    />
                  )}
                </Section>
              )}

              {/* Special Instructions */}
              {(currentDS.special_instructions || isEditing) && (
                <Section title="Special Instructions">
                  {isEditing ? (
                    <div className="space-y-3">
                      <TextAreaField label="Diet" value={currentDS.special_instructions?.diet || ''} onChange={(v) => updateField('special_instructions.diet', v)} />
                      <TextAreaField label="Follow-up" value={currentDS.special_instructions?.follow_up || ''} onChange={(v) => updateField('special_instructions.follow_up', v)} />
                      <TextAreaField label="Post-discharge Investigations" value={currentDS.special_instructions?.post_discharge_investigations || ''} onChange={(v) => updateField('special_instructions.post_discharge_investigations', v)} />
                      <TextAreaField label="Emergency Care" value={currentDS.special_instructions?.emergency_care || ''} onChange={(v) => updateField('special_instructions.emergency_care', v)} />
                    </div>
                  ) : (
                    <div className="text-sm space-y-2">
                      {currentDS.special_instructions?.diet && <p><span className="font-medium text-gray-700">Diet:</span> {currentDS.special_instructions.diet}</p>}
                      {currentDS.special_instructions?.follow_up && <p><span className="font-medium text-gray-700">Follow-up:</span> {currentDS.special_instructions.follow_up}</p>}
                      {currentDS.special_instructions?.post_discharge_investigations && <p><span className="font-medium text-gray-700">Investigations:</span> {currentDS.special_instructions.post_discharge_investigations}</p>}
                      {currentDS.special_instructions?.emergency_care && <p><span className="font-medium text-gray-700">Emergency:</span> {currentDS.special_instructions.emergency_care}</p>}
                    </div>
                  )}
                </Section>
              )}

              {/* Condition at Discharge */}
              <Section title="Condition at Discharge">
                <TextBlock
                  value={currentDS.condition_at_discharge || ''}
                  isEditing={isEditing}
                  onChange={(v) => updateField('condition_at_discharge', v)}
                  rows={2}
                />
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper components
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
  );
}

function TextBlock({ value, isEditing, onChange, rows = 3 }: { value: string; isEditing: boolean; onChange: (v: string) => void; rows?: number }) {
  if (isEditing) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
      />
    );
  }
  return <p className="text-sm text-gray-900 whitespace-pre-wrap">{value || '—'}</p>;
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
      />
    </div>
  );
}