import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Download,
  Plus,
  Save,
  XCircle,
  Trash2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { CreditCard as Edit } from 'lucide-react';

import type { ConsultRow, ConsultMedicineRow, PatientRow } from '../../types/db';
import type { ConsultSummary, DiagnosisSummary, TreatmentSummary, InvestigationsSummary } from '../../types/db';

import {
  getConsultSummary,
  getElapsedSeconds,
  getProgressPercent,
  safeJsonParse,
  ESTIMATED_PROCESS_SECONDS,
  MAX_PROCESS_SECONDS,
  FREQUENCY_OPTIONS,
  FOOD_OPTIONS,
  TIME_OPTIONS,
  normalizeTime,
} from '../../lib/utils';

type UploadState = 'confirming' | 'uploading' | 'success' | 'error';

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

  // NEW: unified edit mode props (same ones you used for ConsultEditModal)
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;

  editedConsult: Record<string, unknown>;
  setEditedConsult: (v: Record<string, unknown>) => void;
  editedDiagnosisText: string;
  setEditedDiagnosisText: (v: string) => void;
  editedTreatmentText: string;
  setEditedTreatmentText: (v: string) => void;
  editedInvestigationsText: string;
  setEditedInvestigationsText: (v: string) => void;

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

  // existing
  onClose: () => void;
  onDownloadPDF: () => void;
  onSendWhatsApp: () => void;
  formatDate: (s: string) => string;
  uiNow: number;
}

const TEXT_MIN_ROWS = 3;
const TEXT_MAX_HEIGHT = 260; // same for ALL sections (your “max limit”)

function isBlankString(v: unknown) {
  return typeof v === 'string' && v.trim().length === 0;
}

/**
 * Converts summary fields to the SAME editable-looking plain text you want in view mode,
 * so view + edit have identical content and therefore identical measured height.
 */
function toPlainText(value: unknown, emptyText: string) {
  const parsed = safeJsonParse(value);
  const v = parsed ?? value;

  if (v == null || isBlankString(v)) return emptyText;

  if (typeof v === 'string') return v;

  if (Array.isArray(v)) {
    if (v.length === 0) return emptyText;
    return v.map((x) => `- ${String(x)}`).join('\n');
  }

  try {
    const s = JSON.stringify(v, null, 2);
    return s || emptyText;
  } catch {
    return String(v);
  }
}

function diagnosisToText(diagnosis: unknown) {
  const parsed = safeJsonParse(diagnosis);
  const d = parsed ?? diagnosis;

  if (d == null || isBlankString(d)) return 'No diagnosis recorded';
  if (typeof d === 'string') return d;

  if (typeof d === 'object' && d !== null) {
    const dd = d as DiagnosisSummary;
    const prov = Array.isArray(dd.provisional) ? dd.provisional : [];
    const keyf = Array.isArray(dd.key_findings) ? dd.key_findings : [];
    if (!prov.length && !keyf.length) return 'No detailed diagnosis available';

    const lines: string[] = [];
    if (prov.length) {
      lines.push('Provisional Diagnosis:');
      prov.forEach((x) => lines.push(`- ${x}`));
      lines.push('');
    }
    if (keyf.length) {
      lines.push('Key Findings:');
      keyf.forEach((x) => lines.push(`- ${x}`));
    }
    return lines.join('\n').trim();
  }

  return 'No diagnosis recorded';
}

function treatmentToText(treatment: unknown) {
  const parsed = safeJsonParse(treatment);
  const t = parsed ?? treatment;

  if (t == null || isBlankString(t)) return 'No treatment recorded';
  if (typeof t === 'string') return t;

  if (typeof t === 'object' && t !== null) {
    const tt = t as TreatmentSummary;
    const immediate = Array.isArray(tt.immediate_plan) ? tt.immediate_plan : [];
    const contingent = Array.isArray(tt.contingent_plan) ? tt.contingent_plan : [];
    if (!immediate.length && !contingent.length) return 'No treatment recorded';

    const lines: string[] = [];
    if (immediate.length) {
      lines.push('Immediate Plan:');
      immediate.forEach((x) => lines.push(`- ${x}`));
      lines.push('');
    }
    if (contingent.length) {
      lines.push('Contingent Plan:');
      contingent.forEach((x) => lines.push(`- ${x}`));
    }
    return lines.join('\n').trim();
  }

  return 'No treatment recorded';
}

function investigationsToText(investigations: unknown) {
  const parsed = safeJsonParse(investigations);
  const inv = parsed ?? investigations;

  if (inv == null || isBlankString(inv)) return 'No investigations recorded';
  if (typeof inv === 'string') return inv;

  if (typeof inv === 'object' && inv !== null) {
    const ii = inv as InvestigationsSummary;
    const ordered = Array.isArray(ii.ordered) ? ii.ordered : [];
    const notes = ii.notes;

    if (!ordered.length && !notes) return 'No investigations recorded';

    const lines: string[] = [];
    if (ordered.length) {
      lines.push('Ordered Investigations:');
      ordered.forEach((o) => {
        const name = o?.name ? String(o.name) : '-';
        const body = o?.body_part_or_type ? ` — ${String(o.body_part_or_type)}` : '';
        const pr = o?.priority ? ` (Priority: ${String(o.priority)})` : '';
        lines.push(`- ${name}${body}${pr}`);
      });
      lines.push('');
    }
    if (notes) {
      lines.push('Notes:');
      lines.push(String(notes));
    }
    return lines.join('\n').trim();
  }

  return 'No investigations recorded';
}

/**
 * Synced auto-height box:
 * - Measures height from the SAME text in both view/edit
 * - Auto grows up to maxHeight, then internal scroll
 * - Avoids view/edit height mismatch (smooth toggle)
 */
function SyncedAutoBox({
  isEditing,
  text,
  onChange,
  emptyText,
}: {
  isEditing: boolean;
  text: string;
  onChange?: (v: string) => void;
  emptyText: string;
}) {
  const measureRef = useRef<HTMLTextAreaElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [h, setH] = useState<number>(0);

  const effective = (text ?? '').trim().length ? text : emptyText;

  const recompute = () => {
    const m = measureRef.current;
    if (!m) return;

    m.value = effective;
    m.style.height = '0px';

    const cs = window.getComputedStyle(m);
    const lineHeight = parseFloat(cs.lineHeight || '20') || 20;
    const minHeight = Math.ceil(lineHeight * TEXT_MIN_ROWS + 16);

    const next = Math.min(m.scrollHeight, TEXT_MAX_HEIGHT);
    setH(Math.max(minHeight, next));
  };

  useLayoutEffect(() => {
    recompute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effective]);

  useLayoutEffect(() => {
    if (!isEditing) return;
    const el = inputRef.current;
    if (!el) return;

    el.style.height = `${h}px`;
    el.style.overflowY = el.scrollHeight > TEXT_MAX_HEIGHT ? 'auto' : 'hidden';
  }, [isEditing, h]);

  return (
    <>
      {/* hidden measurer */}
      <textarea
        ref={measureRef}
        className="input-field resize-none absolute -left-[9999px] top-0 h-0 w-[600px] opacity-0 pointer-events-none"
      />

      {!isEditing ? (
        <div
          style={{ height: h ? `${h}px` : undefined, maxHeight: TEXT_MAX_HEIGHT }}
          className="w-full overflow-y-auto px-3 py-2 rounded-lg border border-transparent bg-white text-sm whitespace-pre-line text-gray-600"
        >
          {effective}
        </div>
      ) : (
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => {
            onChange?.(e.target.value);
            // update height smoothly as user types
            requestAnimationFrame(recompute);
          }}
          className="w-full px-3 py-2 rounded-lg text-sm whitespace-pre-line resize-none border border-gray-300 bg-gray-50 text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#024CDB]"
          style={{ maxHeight: TEXT_MAX_HEIGHT }}
        />
      )}
    </>
  );
}

function SectionCard({
  title,
  right,
  children,
  tone = 'default',
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  tone?: 'default' | 'danger';
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-red-200 bg-red-50'
      : 'border-gray-200 bg-white';

  return (
    <div className={`border rounded-lg ${toneClass} overflow-hidden`}>
      <div className="px-4 py-3 border-b border-gray-200 bg-white/60 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {right}
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}

function MedicationsTable({
  isEditing,
  consultMedicines,
  medicineDrafts,
  updateMedicineDraft,
  medicineSearchResults,
  openTimeDropdownId,
  setOpenTimeDropdownId,
  timeDropdownRef,
  onDeleteMedicine,
  onMedicineSearch,
  setMedicineSearchResults,
}: {
  isEditing: boolean;
  consultMedicines: ConsultMedicineRow[];
  medicineDrafts: Record<string, MedicineDraft>;
  updateMedicineDraft: (id: string, patch: Partial<MedicineDraft>) => void;
  medicineSearchResults: { name: string }[];
  openTimeDropdownId: string | null;
  setOpenTimeDropdownId: (id: string | null) => void;
  timeDropdownRef: React.RefObject<HTMLDivElement | null>;
  onDeleteMedicine: (id: string) => void;
  onMedicineSearch: (q: string) => void;
  setMedicineSearchResults: (r: { name: string }[]) => void;
}) {
  if (!consultMedicines.length) {
    return <p className="text-sm text-gray-600">No medications recorded</p>;
  }

  return (
    <div className="max-h-[520px] overflow-auto">
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-50">
            {['Name','Dosage','Quantity','Type','Frequency','Time','AF/BF','Duration','Instructions','Flags'].map((h) => (
              <th key={h} className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold text-gray-700">
                {h}
              </th>
            ))}
            {isEditing && (
              <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold text-gray-700 w-[70px]">
                Action
              </th>
            )}
          </tr>
        </thead>

        <tbody>
          {consultMedicines.map((m, idx) => {
            const d: MedicineDraft = medicineDrafts[m.id] || {
              name: m.name || '',
              dosage: m.dosage || '',
              quantity: m.quantity || '',
              type: m.type || '',
              frequency: m.frequency || '',
              food: m.food || '',
              time: normalizeTime(m.time),
              duration: m.duration || '',
              instructions: m.instructions || '',
              flags: m.flags || '',
            };

            const cellInput = (val: string, onVal: (v: string) => void) => (
              <input
                className="w-full px-2 py-1 rounded-md border border-gray-300 bg-gray-50 focus:bg-white text-sm"
                value={val}
                onChange={(e) => onVal(e.target.value)}
              />
            );

            return (
              <tr key={m.id} className="hover:bg-gray-50">
                {/* Name */}
                <td className="border border-gray-300 px-3 py-2 align-top">
                  {!isEditing ? (
                    <span className="text-sm text-gray-600">{d.name || '-'}</span>
                  ) : (
                    <div className="relative">
                      {cellInput(d.name, (v) => {
                        updateMedicineDraft(m.id, { name: v });
                        onMedicineSearch(v);
                      })}
                      {medicineSearchResults.length > 0 && (
                        <div className="absolute z-30 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                          {medicineSearchResults.map((r, i) => (
                            <button
                              key={i}
                              type="button"
                              className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                              onClick={() => {
                                updateMedicineDraft(m.id, { name: r.name });
                                setMedicineSearchResults([]);
                              }}
                            >
                              {r.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </td>

                {/* Dosage */}
                <td className="border border-gray-300 px-3 py-2 align-top">
                  {!isEditing ? (
                    <span className="text-sm text-gray-600">{d.dosage || '-'}</span>
                  ) : (
                    cellInput(d.dosage, (v) => updateMedicineDraft(m.id, { dosage: v }))
                  )}
                </td>

                {/* Quantity */}
                <td className="border border-gray-300 px-3 py-2 align-top">
                  {!isEditing ? (
                    <span className="text-sm text-gray-600">{d.quantity || '-'}</span>
                  ) : (
                    cellInput(d.quantity, (v) => updateMedicineDraft(m.id, { quantity: v }))
                  )}
                </td>

                {/* Type */}
                <td className="border border-gray-300 px-3 py-2 align-top">
                  {!isEditing ? (
                    <span className="text-sm text-gray-600">{d.type || '-'}</span>
                  ) : (
                    cellInput(d.type, (v) => updateMedicineDraft(m.id, { type: v }))
                  )}
                </td>

                {/* Frequency */}
                <td className="border border-gray-300 px-3 py-2 align-top">
                  {!isEditing ? (
                    <span className="text-sm text-gray-600">{d.frequency || '-'}</span>
                  ) : (
                    <select
                      className="w-full px-2 py-1 rounded-md border border-gray-300 bg-gray-50 focus:bg-white text-sm"
                      value={d.frequency}
                      onChange={(e) => updateMedicineDraft(m.id, { frequency: e.target.value })}
                    >
                      <option value="">Select</option>
                      {FREQUENCY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}
                </td>

                {/* Time */}
                <td className="border border-gray-300 px-3 py-2 align-top">
                  {!isEditing ? (
                    <span className="text-sm text-gray-600">
                      {Array.isArray(d.time) && d.time.length ? d.time.join(', ') : '-'}
                    </span>
                  ) : (
                    <div ref={openTimeDropdownId === m.id ? timeDropdownRef : null} className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenTimeDropdownId(openTimeDropdownId === m.id ? null : m.id)}
                        className="w-full px-2 py-1 rounded-md border border-gray-300 bg-gray-50 hover:bg-gray-100 text-sm text-left"
                      >
                        {Array.isArray(d.time) && d.time.length ? d.time.join(', ') : 'Select time'}
                      </button>

                      {openTimeDropdownId === m.id && (
                        <div className="absolute z-30 mt-2 w-56 rounded-lg border border-gray-200 bg-white shadow-lg p-2">
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
                                    updateMedicineDraft(m.id, { time: next });
                                  }}
                                />
                                <span className="text-sm text-gray-800">{opt}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </td>

                {/* AF/BF */}
                <td className="border border-gray-300 px-3 py-2 align-top">
                  {!isEditing ? (
                    <span className="text-sm text-gray-600">{d.food || '-'}</span>
                  ) : (
                    <select
                      className="w-full px-2 py-1 rounded-md border border-gray-300 bg-gray-50 focus:bg-white text-sm"
                      value={d.food}
                      onChange={(e) => updateMedicineDraft(m.id, { food: e.target.value })}
                    >
                      <option value="">Select</option>
                      {FOOD_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}
                </td>

                {/* Duration */}
                <td className="border border-gray-300 px-3 py-2 align-top">
                  {!isEditing ? (
                    <span className="text-sm text-gray-600">{d.duration || '-'}</span>
                  ) : (
                    cellInput(d.duration, (v) => updateMedicineDraft(m.id, { duration: v }))
                  )}
                </td>

                {/* Instructions */}
                <td className="border border-gray-300 px-3 py-2 align-top">
                  {!isEditing ? (
                    <span className="text-sm text-gray-600">{d.instructions || '-'}</span>
                  ) : (
                    cellInput(d.instructions, (v) => updateMedicineDraft(m.id, { instructions: v }))
                  )}
                </td>

                {/* Flags */}
                <td className="border border-gray-300 px-3 py-2 align-top">
                  {!isEditing ? (
                    <span className="text-sm text-gray-600">{d.flags || '-'}</span>
                  ) : (
                    cellInput(d.flags || '', (v) => updateMedicineDraft(m.id, { flags: v }))
                  )}
                </td>

                {isEditing && (
                  <td className="border border-gray-300 px-3 py-2 align-top">
                    <button
                      type="button"
                      onClick={() => onDeleteMedicine(m.id)}
                      className="inline-flex items-center justify-center p-2 rounded-md hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ConsultViewModal(props: ConsultViewModalProps) {
  const {
    consult,
    consultMedicines,
    isEditing,
    onStartEdit,
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
    onClose,
    onDownloadPDF,
    formatDate,
    uiNow,
  } = props;

  const summary = getConsultSummary(consult) as ConsultSummary | null;

  // View text (so view mode still works even before Edit is clicked)
  const viewDiagnosis = useMemo(() => diagnosisToText(summary?.diagnosis), [summary]);
  const viewChief = useMemo(
    () => toPlainText(summary?.chief_complaints, 'No chief complaints recorded'),
    [summary]
  );
  const viewTreatment = useMemo(() => treatmentToText(summary?.treatment_suggested), [summary]);
  const viewInvestigations = useMemo(() => investigationsToText(summary?.investigations), [summary]);
  const viewHistory = useMemo(() => toPlainText(summary?.history, 'No history recorded'), [summary]);
  const viewFollowup = useMemo(
    () => toPlainText(summary?.followup_recommendations, 'No follow-up recommendations recorded'),
    [summary]
  );

  const flags = useMemo(() => {
    const arr = summary && Array.isArray(summary.flags_for_review) ? summary.flags_for_review : [];
    return arr.filter((f) => typeof f === 'string' && f.trim().length > 0);
  }, [summary]);

  const [flagsOpen, setFlagsOpen] = useState(true);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      {/* flex-col + overflow-hidden prevents footer gaps; single scroll area */}
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-gray-900">
                {isEditing ? 'Edit Consultation Summary' : 'Consultation Summary'}
              </h2>
              <p className="text-sm text-gray-600">{formatDate(consult.created_at)}</p>
            </div>

            <div className="flex items-center gap-2">
              {/* Actions (same place, no layout shift) */}
              {!isEditing ? (
                <button
                  onClick={onStartEdit}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  <span>Edit</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={onCancelEdit}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Cancel</span>
                  </button>
                  <button
                    onClick={onSaveEdit}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#024CDB] hover:bg-[#023BA3] text-white rounded text-sm transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save</span>
                  </button>
                </>
              )}

              <button
                onClick={onDownloadPDF}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>PDF</span>
              </button>

              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {summary ? (
            <div className="px-6 py-6 space-y-6">
              {/* 1) Diagnosis */}
              <SectionCard title="Diagnosis">
                <SyncedAutoBox
                  isEditing={isEditing}
                  text={isEditing ? editedDiagnosisText : viewDiagnosis}
                  onChange={setEditedDiagnosisText}
                  emptyText="No diagnosis recorded"
                />
              </SectionCard>

              {/* 2) Chief Complaints */}
              <SectionCard title="Chief Complaints">
                <SyncedAutoBox
                  isEditing={isEditing}
                  text={isEditing ? String((editedConsult?.chief_complaints as string) || '') : viewChief}
                  onChange={(v) => setEditedConsult({ ...editedConsult, chief_complaints: v })}
                  emptyText="No chief complaints recorded"
                />
              </SectionCard>

              {/* 3) Treatment Suggested */}
              <SectionCard title="Treatment Suggested">
                <SyncedAutoBox
                  isEditing={isEditing}
                  text={isEditing ? editedTreatmentText : viewTreatment}
                  onChange={setEditedTreatmentText}
                  emptyText="No treatment recorded"
                />
              </SectionCard>

              {/* 4) Investigations */}
              <SectionCard title="Investigations">
                <SyncedAutoBox
                  isEditing={isEditing}
                  text={isEditing ? editedInvestigationsText : viewInvestigations}
                  onChange={setEditedInvestigationsText}
                  emptyText="No investigations recorded"
                />
              </SectionCard>

              {/* 5) Medications (same table, becomes editable in edit mode) */}
              <SectionCard
                title="Medications"
                right={
                  isEditing ? (
                    <button
                      onClick={onAddMedicine}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add</span>
                    </button>
                  ) : null
                }
              >
                <MedicationsTable
                  isEditing={isEditing}
                  consultMedicines={consultMedicines}
                  medicineDrafts={medicineDrafts}
                  updateMedicineDraft={updateMedicineDraft}
                  medicineSearchResults={medicineSearchResults}
                  openTimeDropdownId={openTimeDropdownId}
                  setOpenTimeDropdownId={setOpenTimeDropdownId}
                  timeDropdownRef={timeDropdownRef}
                  onDeleteMedicine={onDeleteMedicine}
                  onMedicineSearch={onMedicineSearch}
                  setMedicineSearchResults={setMedicineSearchResults}
                />
              </SectionCard>

              {/* 6) History */}
              <SectionCard title="History">
                <SyncedAutoBox
                  isEditing={isEditing}
                  text={isEditing ? String((editedConsult?.history as string) || '') : viewHistory}
                  onChange={(v) => setEditedConsult({ ...editedConsult, history: v })}
                  emptyText="No history recorded"
                />
              </SectionCard>

              {/* 7) Follow-up Recommendations */}
              <SectionCard title="Follow-up Recommendations">
                <SyncedAutoBox
                  isEditing={isEditing}
                  text={isEditing ? String((editedConsult?.followup_recommendations as string) || '') : viewFollowup}
                  onChange={(v) => setEditedConsult({ ...editedConsult, followup_recommendations: v })}
                  emptyText="No follow-up recommendations recorded"
                />
              </SectionCard>

              {/* 8) Flags at the bottom */}
              {flags.length > 0 && (
                <div className="border border-red-200 bg-red-50 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setFlagsOpen((v) => !v)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-100/40 transition-colors"
                  >
                    {flagsOpen ? (
                      <ChevronDown className="w-5 h-5 text-gray-500 shrink-0" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-500 shrink-0" />
                    )}
                    <h3 className="font-semibold text-gray-900 flex-1">Flags for Review</h3>
                  </button>

                  {flagsOpen && (
                    <div className="px-4 pb-4 space-y-2">
                      {flags.map((flag, idx) => (
                        <div key={idx} className="bg-white border border-red-200 rounded-lg p-3">
                          <p className="text-sm font-medium text-red-800">⚠ {flag}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Bottom breathing room */}
              <div className="h-6" />
            </div>
          ) : (
            <div className="p-6">
              <ProcessingState consult={consult} uiNow={uiNow} />
            </div>
          )}
        </div>
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
          {isError
            ? 'Consultation summary failed'
            : `Preparing consultation summary: ${elapsed}s / ${ESTIMATED_PROCESS_SECONDS}s`}
        </p>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className="h-3 rounded-full bg-[#024CDB] transition-all"
          style={{ width: `${isError ? 100 : pct}%` }}
        />
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