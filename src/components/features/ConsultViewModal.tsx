import { useEffect, useMemo, useRef } from 'react';
import { X, Download, Plus, Save, XCircle, ChevronDown, Trash2 } from 'lucide-react';
import { CreditCard as Edit } from 'lucide-react';
import type { ConsultRow, ConsultMedicineRow, PatientRow } from '../../types/db';
import type { ConsultSummary, DiagnosisSummary, TreatmentSummary, InvestigationsSummary } from '../../types/db';
import {
  getConsultSummary,
  getElapsedSeconds,
  getProgressPercent,
  getViewModeMedicines,
  safeJsonParse,
  ESTIMATED_PROCESS_SECONDS,
  MAX_PROCESS_SECONDS,
  FREQUENCY_OPTIONS,
  FOOD_OPTIONS,
  TIME_OPTIONS,
  normalizeTime,
} from '../../lib/utils';

/** --- medicine draft shape (same as edit modal) --- */
interface MedicineDraft {
  name: string;
  dosage: string;
  quantity: string;
  type: string;
  frequency: string;
  food: string;
  time: string[];
  duration: string;
  instructions: string;
  flags?: string;
}

interface ConsultViewModalProps {
  consult: ConsultRow;
  consultMedicines: ConsultMedicineRow[];
  patient: PatientRow;
  userId: string | undefined;

  /** existing props (kept; not used now since we show everything expanded) */
  expandedSections: Record<string, boolean>;
  onToggleSection: (key: string) => void;

  /** view modal actions */
  onClose: () => void;
  onEdit: () => void; // your existing handleEditConsult()
  onDownloadPDF: () => void;
  onSendWhatsApp: () => void;
  formatDate: (s: string) => string;
  uiNow: number;

  /** ✅ NEW: edit-mode controls (use your existing state + handlers) */
  isEditing: boolean;        // isEditingConsult
  onCancelEdit: () => void;  // handleCancelEdit
  onSaveEdit: () => void;    // handleSaveConsult

  /** ✅ NEW: edit state (use your existing state + setters) */
  editedConsult: Record<string, unknown>;
  setEditedConsult: (v: Record<string, unknown>) => void;

  editedDiagnosisText: string;
  setEditedDiagnosisText: (v: string) => void;

  editedTreatmentText: string;
  setEditedTreatmentText: (v: string) => void;

  editedInvestigationsText: string;
  setEditedInvestigationsText: (v: string) => void;

  /** ✅ medicines edit props (same as your old ConsultEditModal) */
  medicineDrafts: Record<string, MedicineDraft>;
  updateMedicineDraft: (id: string, patch: Partial<MedicineDraft>) => void;

  medicineSearchResults: { name: string }[];
  openTimeDropdownId: string | null;
  setOpenTimeDropdownId: (id: string | null) => void;
  timeDropdownRef: React.RefObject<HTMLDivElement | null>;

  onAddMedicine: () => void;
  onDeleteMedicine: (id: string) => void;
  onMedicineSearch: (q: string) => void;
  setMedicineSearchResults: (r: { name: string }[]) => void;
}

function isBlankString(v: unknown) {
  return typeof v === 'string' && v.trim().length === 0;
}

function SectionCard({
  title,
  children,
  tone = 'default',
}: {
  title: string;
  children: React.ReactNode;
  tone?: 'default' | 'danger';
}) {
  const toneClasses =
    tone === 'danger' ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white';

  return (
    <div className={`border rounded-lg ${toneClasses} overflow-hidden`}>
      <div className="px-4 py-3 border-b border-gray-100 bg-white/60">
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>

      {/* View text is slightly softer for differentiation */}
      <div className="px-4 py-4 text-gray-600 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

/** Fixed height textarea (prevents “jump while typing”) */
function FixedTextarea({
  value,
  onChange,
  heightClass = 'h-56 md:h-64',
}: {
  value: string;
  onChange: (v: string) => void;
  heightClass?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`input-field resize-none bg-gray-50 focus:bg-white w-full ${heightClass} overflow-y-auto`}
    />
  );
}

/** --- Render helpers (same behavior as your existing view modal) --- */
function renderDiagnosis(diagnosis: unknown) {
  const parsed = safeJsonParse(diagnosis);
  const d = parsed ?? diagnosis;

  if (d == null || isBlankString(d)) return <p className="whitespace-pre-line">No diagnosis recorded</p>;
  if (typeof d === 'string') return <p className="whitespace-pre-line">{d}</p>;

  if (typeof d === 'object' && d !== null) {
    const dd = d as DiagnosisSummary;
    const hasProvisional = Array.isArray(dd.provisional) && dd.provisional.length > 0;
    const hasKeyFindings = Array.isArray(dd.key_findings) && dd.key_findings.length > 0;

    if (!hasProvisional && !hasKeyFindings) return <p>No detailed diagnosis available</p>;

    return (
      <div className="space-y-3">
        {hasProvisional && (
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Provisional Diagnosis</h4>
            <ul className="list-disc list-inside space-y-1">
              {dd.provisional!.map((item, idx) => <li key={idx}>{item}</li>)}
            </ul>
          </div>
        )}
        {hasKeyFindings && (
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Key Findings</h4>
            <ul className="list-disc list-inside space-y-1">
              {dd.key_findings!.map((item, idx) => <li key={idx}>{item}</li>)}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return <p>No diagnosis recorded</p>;
}

function renderArrayContent(content: unknown, emptyText: string) {
  const parsed = safeJsonParse(content);
  const c = parsed ?? content;

  if (c == null || isBlankString(c)) return <p>{emptyText}</p>;
  if (typeof c === 'string') return <p className="whitespace-pre-line">{c}</p>;

  if (Array.isArray(c)) {
    if (c.length === 0) return <p>{emptyText}</p>;
    return (
      <ul className="list-disc list-inside space-y-1">
        {c.map((item, idx) => <li key={idx}>{String(item)}</li>)}
      </ul>
    );
  }

  try {
    const s = JSON.stringify(c, null, 2);
    if (!s) return <p>{emptyText}</p>;
    return <p className="whitespace-pre-line">{s}</p>;
  } catch {
    return <p>{String(c)}</p>;
  }
}

function renderTreatmentSuggested(treatment: unknown) {
  const parsed = safeJsonParse(treatment);
  const t = parsed ?? treatment;

  if (t == null || isBlankString(t)) return <p>No treatment recorded</p>;
  if (typeof t === 'string') return <p className="whitespace-pre-line">{t}</p>;
  if (!t || typeof t !== 'object') return <p>No treatment recorded</p>;

  const tt = t as TreatmentSummary;
  const immediate = Array.isArray(tt.immediate_plan) ? tt.immediate_plan : [];
  const contingent = Array.isArray(tt.contingent_plan) ? tt.contingent_plan : [];

  if (!immediate.length && !contingent.length) return <p>No treatment recorded</p>;

  return (
    <div className="space-y-3">
      {immediate.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-700 mb-2">Immediate Plan</h4>
          <ul className="list-disc list-inside space-y-1">
            {immediate.map((item, idx) => <li key={idx}>{item}</li>)}
          </ul>
        </div>
      )}
      {contingent.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-700 mb-2">Contingent Plan</h4>
          <ul className="list-disc list-inside space-y-1">
            {contingent.map((item, idx) => <li key={idx}>{item}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function renderMedicationsTable(medications: ReturnType<typeof getViewModeMedicines>) {
  if (!Array.isArray(medications) || medications.length === 0) {
    return <p>No medications recorded</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse border border-gray-300 text-gray-600">
        <thead>
          <tr className="bg-gray-50">
            {['Name','Dosage','Quantity','Type','Frequency','Time','AF/BF','Duration','Instructions','Flags'].map((h) => (
              <th key={h} className="border border-gray-300 px-3 py-2 text-left font-medium text-gray-700">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {medications.map((med, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="border border-gray-300 px-3 py-2">{med.name || '-'}</td>
              <td className="border border-gray-300 px-3 py-2">{med.dosage || '-'}</td>
              <td className="border border-gray-300 px-3 py-2">{med.quantity || '-'}</td>
              <td className="border border-gray-300 px-3 py-2">{med.type || '-'}</td>
              <td className="border border-gray-300 px-3 py-2">{med.frequency || '-'}</td>
              <td className="border border-gray-300 px-3 py-2">
                {Array.isArray(med.time) && med.time.length ? med.time.join(', ') : '-'}
              </td>
              <td className="border border-gray-300 px-3 py-2">{med.food || '-'}</td>
              <td className="border border-gray-300 px-3 py-2">{med.duration || '-'}</td>
              <td className="border border-gray-300 px-3 py-2">{med.instructions || '-'}</td>
              <td className="border border-gray-300 px-3 py-2">{med.flags || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderInvestigations(investigations: unknown) {
  const parsed = safeJsonParse(investigations);
  const inv = parsed ?? investigations;

  if (inv == null || isBlankString(inv)) return <p>No investigations recorded</p>;
  if (typeof inv === 'string') return <p className="whitespace-pre-line">{inv}</p>;
  if (!inv || typeof inv !== 'object') return <p>No investigations recorded</p>;

  const ii = inv as InvestigationsSummary;
  const ordered = Array.isArray(ii.ordered) ? ii.ordered : [];
  const notes = ii.notes;

  if (!ordered.length && !notes) return <p>No investigations recorded</p>;

  return (
    <div className="space-y-3">
      {ordered.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-700 mb-2">Ordered Investigations</h4>
          <div className="space-y-2">
            {ordered.map((o, idx) => (
              <div key={idx} className="bg-gray-50 border border-gray-200 rounded p-3 text-gray-600">
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="font-medium text-gray-900">{o.name}</h5>
                    {o.body_part_or_type && <p className="text-sm text-gray-600">{o.body_part_or_type}</p>}
                  </div>
                  {o.priority && (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-gray-200 text-gray-700">{o.priority}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {notes && (
        <div>
          <h4 className="font-medium text-gray-700 mb-2">Notes</h4>
          <p className="whitespace-pre-line">{String(notes)}</p>
        </div>
      )}
    </div>
  );
}

export default function ConsultViewModal(props: ConsultViewModalProps) {
  const {
    consult,
    consultMedicines,
    onClose,
    onEdit,
    onDownloadPDF,
    formatDate,
    uiNow,

    isEditing,
    onCancelEdit,
    onSaveEdit,

    editedConsult,
    setEditedConsult,
    editedDiagnosisText,
    setEditedDiagnosisText,
    editedTreatmentText,
    setEditedTreatmentText,
    editedInvestigationsText,
    setEditedInvestigationsText,

    medicineDrafts,
    updateMedicineDraft,
    medicineSearchResults,
    openTimeDropdownId,
    setOpenTimeDropdownId,
    timeDropdownRef,
    onAddMedicine,
    onDeleteMedicine,
    onMedicineSearch,
    setMedicineSearchResults,
  } = props;

  const summary = getConsultSummary(consult) as ConsultSummary | null;
  const medsView = getViewModeMedicines(summary, consultMedicines);

  const flags = useMemo(() => {
    const arr = summary && Array.isArray(summary.flags_for_review) ? summary.flags_for_review : [];
    return arr.filter((f) => typeof f === 'string' && f.trim().length > 0);
  }, [summary]);

  /** ✅ preserve scroll position across View ↔ Edit */
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const savedScrollTop = useRef(0);
  const pendingRestore = useRef(false);

  const captureScroll = () => {
    savedScrollTop.current = scrollRef.current?.scrollTop ?? 0;
    pendingRestore.current = true;
  };

  useEffect(() => {
    if (!pendingRestore.current) return;
    const el = scrollRef.current;
    if (!el) return;

    // restore after DOM swap
    requestAnimationFrame(() => {
      el.scrollTop = savedScrollTop.current;
      pendingRestore.current = false;
    });
  }, [isEditing]);

  const handleEnterEdit = () => {
    captureScroll();
    onEdit();
  };

  const handleCancel = () => {
    captureScroll();
    onCancelEdit();
  };

  const handleSave = () => {
    captureScroll();
    onSaveEdit();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      {/* ✅ single modal container always (no second popup => no top jump) */}
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Sticky header */}
        <div className="shrink-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {isEditing ? 'Edit Consultation Summary' : 'Consultation Summary'}
              </h2>
              <p className="text-sm text-gray-600">{formatDate(consult.created_at)}</p>
            </div>

            {/* keep behavior same: X in edit = cancel edit, X in view = close modal */}
            <button
              onClick={isEditing ? handleCancel : onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              type="button"
              title={isEditing ? 'Cancel edit' : 'Close'}
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* actions row */}
          <div className="mt-3 flex flex-wrap gap-2 justify-end">
            {!isEditing && (
              <button
                onClick={handleEnterEdit}
                className="flex items-center space-x-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors"
                type="button"
              >
                <Edit className="w-4 h-4" />
                <span>Edit</span>
              </button>
            )}

            {!isEditing && (
              <button
                onClick={onDownloadPDF}
                className="flex items-center space-x-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors"
                type="button"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
            )}
          </div>
        </div>

        {/* Scrollable body */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {!summary ? (
            <div className="p-6">
              <ProcessingState consult={consult} uiNow={uiNow} />
            </div>
          ) : (
            <div className="px-6 pt-6 pb-6 space-y-6">
              {/* ✅ Sections stacked vertically (one below the other) */}
              <SectionCard title="Diagnosis">
                {isEditing ? (
                  <FixedTextarea value={editedDiagnosisText} onChange={setEditedDiagnosisText} />
                ) : (
                  renderDiagnosis(summary.diagnosis)
                )}
              </SectionCard>

              <SectionCard title="Chief Complaints">
                {isEditing ? (
                  <FixedTextarea
                    value={(editedConsult?.chief_complaints as string) || ''}
                    onChange={(v) => setEditedConsult({ ...editedConsult, chief_complaints: v })}
                  />
                ) : (
                  renderArrayContent(summary.chief_complaints, 'No chief complaints recorded')
                )}
              </SectionCard>

              <SectionCard title="Treatment Suggested">
                {isEditing ? (
                  <FixedTextarea value={editedTreatmentText} onChange={setEditedTreatmentText} />
                ) : (
                  renderTreatmentSuggested(summary.treatment_suggested)
                )}
              </SectionCard>

              <SectionCard title="Investigations">
                {isEditing ? (
                  <FixedTextarea value={editedInvestigationsText} onChange={setEditedInvestigationsText} />
                ) : (
                  renderInvestigations(summary.investigations)
                )}
              </SectionCard>

              {/* Medications */}
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                <div className="px-4 py-3 border-b border-gray-100 bg-white/60 flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-gray-900">Medications</h3>

                  {isEditing && (
                    <button
                      onClick={onAddMedicine}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors"
                      type="button"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Medicine</span>
                    </button>
                  )}
                </div>

                <div className="px-4 py-4 text-gray-600 text-sm">
                  {!isEditing ? (
                    renderMedicationsTable(medsView)
                  ) : (
                    <div className="space-y-4">
                      {consultMedicines.map((medicine, index) => {
                        const d: MedicineDraft = medicineDrafts[medicine.id] || {
                          name: medicine.name || '',
                          dosage: medicine.dosage || '',
                          quantity: medicine.quantity || '',
                          type: medicine.type || '',
                          frequency: medicine.frequency || '',
                          food: medicine.food || '',
                          time: normalizeTime(medicine.time),
                          duration: medicine.duration || '',
                          instructions: medicine.instructions || '',
                          flags: medicine.flags || '',
                        };

                        return (
                          <div key={medicine.id} className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm font-semibold text-gray-900">Medicine {index + 1}</span>
                              <button
                                onClick={() => onDeleteMedicine(medicine.id)}
                                className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                                type="button"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </button>
                            </div>

                            <div className="flex flex-wrap gap-3 items-end">
                              <div className="relative min-w-[250px] flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Medicine Name</label>
                                <input
                                  type="text"
                                  value={d.name}
                                  onChange={(e) => {
                                    updateMedicineDraft(medicine.id, { name: e.target.value });
                                    onMedicineSearch(e.target.value);
                                  }}
                                  className="input-field bg-gray-50 focus:bg-white"
                                  placeholder="Search medicine..."
                                />

                                {medicineSearchResults.length > 0 && (
                                  <div className="absolute z-30 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                    {medicineSearchResults.map((result, idx) => (
                                      <button
                                        key={idx}
                                        type="button"
                                        onClick={() => {
                                          updateMedicineDraft(medicine.id, { name: result.name });
                                          setMedicineSearchResults([]);
                                        }}
                                        className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                                      >
                                        {result.name}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="min-w-[120px] flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Dosage</label>
                                <input
                                  type="text"
                                  value={d.dosage}
                                  onChange={(e) => updateMedicineDraft(medicine.id, { dosage: e.target.value })}
                                  className="input-field bg-gray-50 focus:bg-white"
                                />
                              </div>

                              <div className="min-w-[120px] flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                                <input
                                  type="text"
                                  value={d.quantity}
                                  onChange={(e) => updateMedicineDraft(medicine.id, { quantity: e.target.value })}
                                  className="input-field bg-gray-50 focus:bg-white"
                                />
                              </div>

                              <div className="min-w-[120px] flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                <input
                                  type="text"
                                  value={d.type}
                                  onChange={(e) => updateMedicineDraft(medicine.id, { type: e.target.value })}
                                  className="input-field bg-gray-50 focus:bg-white"
                                />
                              </div>

                              <div className="min-w-[120px] flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                                <select
                                  value={d.frequency}
                                  onChange={(e) => updateMedicineDraft(medicine.id, { frequency: e.target.value })}
                                  className="input-field bg-gray-50 focus:bg-white"
                                >
                                  <option value="" disabled>Select frequency</option>
                                  {FREQUENCY_OPTIONS.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="min-w-[120px] flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">AF/BF</label>
                                <select
                                  value={d.food}
                                  onChange={(e) => updateMedicineDraft(medicine.id, { food: e.target.value })}
                                  className="input-field bg-gray-50 focus:bg-white"
                                >
                                  <option value="" disabled>Select food instruction</option>
                                  {FOOD_OPTIONS.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="min-w-[120px] flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                                <input
                                  type="text"
                                  value={d.duration}
                                  onChange={(e) => updateMedicineDraft(medicine.id, { duration: e.target.value })}
                                  className="input-field bg-gray-50 focus:bg-white"
                                />
                              </div>

                              <div className="min-w-[250px] flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                                <div ref={openTimeDropdownId === medicine.id ? timeDropdownRef : null} className="relative">
                                  <button
                                    type="button"
                                    onClick={() => setOpenTimeDropdownId(openTimeDropdownId === medicine.id ? null : medicine.id)}
                                    className="input-field flex items-center justify-between bg-gray-50 focus:bg-white"
                                  >
                                    <span className="text-gray-900">
                                      {Array.isArray(d.time) && d.time.length > 0 ? d.time.join(', ') : 'Select time'}
                                    </span>
                                    <ChevronDown className="w-4 h-4 text-gray-500" />
                                  </button>

                                  {openTimeDropdownId === medicine.id && (
                                    <div className="absolute z-30 mt-2 w-full rounded-lg border border-gray-200 bg-white shadow-lg p-2">
                                      {TIME_OPTIONS.map((opt) => {
                                        const current = Array.isArray(d.time) ? d.time : [];
                                        const checked = current.includes(opt);
                                        return (
                                          <label key={opt} className="flex items-center gap-2 px-2 py-2 rounded hover:bg-gray-50 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={checked}
                                              onChange={() => {
                                                const next = checked ? current.filter((x) => x !== opt) : [...current, opt];
                                                updateMedicineDraft(medicine.id, { time: next });
                                              }}
                                            />
                                            <span className="text-sm text-gray-800">{opt}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="min-w-[250px] flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
                                <input
                                  type="text"
                                  value={d.instructions}
                                  onChange={(e) => updateMedicineDraft(medicine.id, { instructions: e.target.value })}
                                  className="input-field bg-gray-50 focus:bg-white"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {consultMedicines.length === 0 && (
                        <p className="text-gray-500 text-center py-4">No medicines added yet</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <SectionCard title="History">
                {isEditing ? (
                  <FixedTextarea
                    value={(editedConsult?.history as string) || ''}
                    onChange={(v) => setEditedConsult({ ...editedConsult, history: v })}
                  />
                ) : (
                  renderArrayContent(summary.history, 'No history recorded')
                )}
              </SectionCard>

              <SectionCard title="Follow-up Recommendations">
                {isEditing ? (
                  <FixedTextarea
                    value={(editedConsult?.followup_recommendations as string) || ''}
                    onChange={(v) => setEditedConsult({ ...editedConsult, followup_recommendations: v })}
                  />
                ) : (
                  renderArrayContent(summary.followup_recommendations, 'No follow-up recommendations recorded')
                )}
              </SectionCard>

              {/* Keep same functionality as earlier: Key Personal Insights stays read-only */}
              <SectionCard title="Key Personal Insights">
                {renderArrayContent(summary.key_personal_insights, 'No personal insights recorded')}
              </SectionCard>

              {/* ✅ Flags at the bottom */}
              {flags.length > 0 && (
                <SectionCard title="Flags for Review" tone="danger">
                  <div className="space-y-2">
                    {flags.map((flag, idx) => (
                      <div key={idx} className="bg-white border border-red-200 rounded-lg p-3">
                        <p className="text-sm font-medium text-red-800">⚠ {flag}</p>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}
            </div>
          )}
        </div>

        {/* Sticky footer ONLY in edit mode (same behavior as old edit modal) */}
        {isEditing && (
          <div className="shrink-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
            <button onClick={handleCancel} className="btn-secondary flex items-center space-x-2" type="button">
              <XCircle className="w-4 h-4" />
              <span>Cancel</span>
            </button>
            <button onClick={handleSave} className="btn-primary flex items-center space-x-2" type="button">
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ProcessingState({ consult, uiNow }: { consult: ConsultRow; uiNow: number }) {
  const elapsed = getElapsedSeconds(consult, uiNow);
  const pct = getProgressPercent(consult, uiNow);
  const takingLonger = elapsed > ESTIMATED_PROCESS_SECONDS;
  const isError = elapsed > MAX_PROCESS_SECONDS;

  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-3">
        <p className="text-sm font-semibold text-gray-900">
          {isError ? 'Consultation summary failed' : `Preparing consultation summary: ${elapsed}s / ${ESTIMATED_PROCESS_SECONDS}s`}
        </p>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div className="h-3 rounded-full bg-[#024CDB] transition-all" style={{ width: `${isError ? 100 : pct}%` }} />
      </div>
      <div className="mt-3 text-center">
        {isError ? (
          <p className="text-sm font-semibold text-red-600">There was an issue analyzing the recording.</p>
        ) : (
          <>
            <p className="text-sm text-gray-600">It takes around 60 sec to prepare the consultation summary.</p>
            {takingLonger && <p className="text-sm mt-1 font-medium text-red-600">Taking longer than expected…</p>}
          </>
        )}
      </div>
      <div className="mt-4 text-center text-xs text-gray-500">
        {isError ? 'Please retry the recording.' : 'You can keep this open — it will auto-update when ready.'}
      </div>
    </div>
  );
}

export {
  renderDiagnosis,
  renderArrayContent,
  renderTreatmentSuggested,
  renderMedicationsTable,
  renderInvestigations,
};