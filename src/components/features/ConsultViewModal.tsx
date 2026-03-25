import { useLayoutEffect, useEffect, useMemo, useRef, useState } from 'react';
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

  // unified edit mode props
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

// View-mode rendering: turn "- item" into "• item" (only display)
function bulletizeForView(s: string) {
  if (!s) return s;
  return s.replace(/(^|\n)(\s*)-\s+/g, '$1$2• ');
}

/**
 * View text: returns a consistent string representation (includes emptyText),
 * used ONLY for viewing (never for saving).
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

/**
 * Edit text: returns a consistent editable string representation,
 * BUT does NOT inject emptyText (so you don’t accidentally save placeholders).
 */
function toEditText(value: unknown) {
  const parsed = safeJsonParse(value);
  const v = parsed ?? value;

  if (v == null || isBlankString(v)) return '';

  if (typeof v === 'string') return v;

  if (Array.isArray(v)) {
    if (v.length === 0) return '';
    return v.map((x) => `- ${String(x)}`).join('\n');
  }

  try {
    return JSON.stringify(v, null, 2);
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
      lines.push('Provisional:');
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
 * - Same measured height in view/edit
 * - View displays bullets nicely (•) but keeps the SAME height
 *   by measuring max(hyphenText, bulletText)
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

    const cs = window.getComputedStyle(m);
    const lineHeight = parseFloat(cs.lineHeight || '20') || 20;
    const minHeight = Math.ceil(lineHeight * TEXT_MIN_ROWS + 16);

    // measure both, take max to avoid wrapping mismatch
    const measureOnce = (val: string) => {
      m.value = val;
      m.style.height = '0px';
      return m.scrollHeight;
    };

    const h1 = measureOnce(effective);
    const h2 = measureOnce(bulletizeForView(effective));
    const next = Math.min(Math.max(h1, h2), TEXT_MAX_HEIGHT);

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
      <textarea
        ref={measureRef}
        className="input-field resize-none absolute -left-[9999px] top-0 h-0 w-[600px] opacity-0 pointer-events-none"
      />

      {!isEditing ? (
        <div
          style={{ height: h ? `${h}px` : undefined, maxHeight: TEXT_MAX_HEIGHT }}
          className="w-full overflow-y-auto px-3 py-2 rounded-lg border border-transparent bg-white text-[16px] whitespace-pre-line text-gray-700"
        >
          {bulletizeForView(effective)}
        </div>
      ) : (
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => {
            onChange?.(e.target.value);
            requestAnimationFrame(recompute);
          }}
          className="w-full px-3 py-2 rounded-lg text-[16px] whitespace-pre-line resize-none border border-gray-300 bg-gray-50 text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#024CDB]"
          style={{ height: h ? `${h}px` : undefined, maxHeight: TEXT_MAX_HEIGHT }}
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
  const toneClass = tone === 'danger' ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white';

  return (
    <div className={`border rounded-lg ${toneClass} overflow-hidden`}>
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {right}
      </div>
      <div className="px-2 py-2">{children}</div> 
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
  // CHANGED: Track which medicine row's name field is currently being searched
  const [activeMedicineSearchId, setActiveMedicineSearchId] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [timeDropdownPos, setTimeDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const searchDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target as Node)) {
        setActiveMedicineSearchId(null);
        setMedicineSearchResults([]);
        setDropdownPos(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setMedicineSearchResults]);

  if (!consultMedicines.length) {
    return <p className="text-sm text-gray-600">No medications recorded</p>;
  }

  const draftFor = (m: ConsultMedicineRow): MedicineDraft => ({
    name: medicineDrafts[m.id]?.name ?? m.name ?? '',
    dosage: medicineDrafts[m.id]?.dosage ?? m.dosage ?? '',
    quantity: medicineDrafts[m.id]?.quantity ?? m.quantity ?? '',
    type: medicineDrafts[m.id]?.type ?? m.type ?? '',
    frequency: medicineDrafts[m.id]?.frequency ?? m.frequency ?? '',
    food: medicineDrafts[m.id]?.food ?? m.food ?? '',
    time: medicineDrafts[m.id]?.time ?? normalizeTime(m.time),
    duration: medicineDrafts[m.id]?.duration ?? m.duration ?? '',
    instructions: medicineDrafts[m.id]?.instructions ?? m.instructions ?? '',
    flags: medicineDrafts[m.id]?.flags ?? m.flags ?? '',
  });

  // ✅ Column-level: allow up to 300px ONLY if the column has any content, otherwise keep it compact
  const hasAnyInstructions = consultMedicines.some(
    (m) => (draftFor(m).instructions || '').trim().length > 0
  );
  const hasAnyFlags = consultMedicines.some(
    (m) => (draftFor(m).flags || '').trim().length > 0
  );

  // Column sizing rules (BOTH view + edit)
  const COL_NAME = 'min-w-[170px]';
  const COL_STD = 'w-[120px] min-w-[120px] max-w-[120px]';

  // ✅ Key change: DO NOT set fixed width (w-[300px]).
  // Let it auto-fit, but cap at 300px, then wrap.
  const COL_INSTR = `min-w-[120px] ${hasAnyInstructions ? 'max-w-[300px]' : 'max-w-[120px]'}`;
  const COL_FLAGS = `min-w-[120px] ${hasAnyFlags ? 'max-w-[300px]' : 'max-w-[120px]'}`;

  const COL_ACTION = 'w-[70px] min-w-[70px]';

  const thBase =
    'border border-gray-300 px-3 py-2 text-left text-xs font-semibold text-gray-700 align-top';
  const tdBase = 'border border-gray-300 px-1.5 py-1 align-top';

  const viewText = 'text-sm text-gray-600 whitespace-normal break-words';

  const inputBase =
    'w-full px-1.5 py-1 rounded-md border border-gray-300 bg-gray-50 focus:bg-white text-sm whitespace-normal break-words';

  const cellTextarea = (val: string, onVal: (v: string) => void) => (
    <textarea
      className={`${inputBase} resize-none leading-5`}
      rows={2}
      value={val}
      onChange={(e) => onVal(e.target.value)}
    />
  );

  // ✅ Inner wrapper to ensure the cell content respects max-width and wraps
  const instrWrapClass = `${hasAnyInstructions ? 'max-w-[300px]' : 'max-w-[120px]'} overflow-hidden whitespace-normal break-words`;
const flagsWrapClass = `${hasAnyFlags ? 'max-w-[300px]' : 'max-w-[120px]'} overflow-hidden whitespace-normal break-words`;

  return (
    <>
    <div className="max-h-[520px] overflow-auto">
      <table className="w-max border-collapse border border-gray-300 table-auto">
        <thead>
          <tr className="bg-gray-50">
            <th className={`${thBase} ${COL_NAME}`}>Name</th>
            <th className={`${thBase} ${COL_STD}`}>Dosage</th>
            <th className={`${thBase} ${COL_STD}`}>Quantity</th>
            <th className={`${thBase} ${COL_STD}`}>Type</th>
            <th className={`${thBase} ${COL_STD}`}>Frequency</th>
            <th className={`${thBase} ${COL_STD}`}>Time</th>
            <th className={`${thBase} ${COL_STD}`}>AF/BF</th>
            <th className={`${thBase} ${COL_STD}`}>Duration</th>
            <th className={`${thBase} ${COL_INSTR}`}>Instructions</th>
            <th className={`${thBase} ${COL_FLAGS}`}>Flags</th>
            {isEditing && <th className={`${thBase} ${COL_ACTION}`}>Action</th>}
          </tr>
        </thead>

        <tbody>
          {consultMedicines.map((m) => {
            const d = draftFor(m);

            return (
              <tr key={m.id} className="hover:bg-gray-50">
                {/* Name */}
                <td className={`${tdBase} ${COL_NAME}`}>
                  {!isEditing ? (
                    <div className="max-w-[170px] whitespace-normal break-words">
                      <span className={viewText}>{d.name || '-'}</span>
                    </div>
                  ) : (
                    <div className="relative max-w-[170px]">
                      <textarea
                        className={`${inputBase} resize-none leading-5`}
                        rows={2}
                        value={d.name}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateMedicineDraft(m.id, { name: v });
                          setActiveMedicineSearchId(m.id);
                          const rect = e.currentTarget.getBoundingClientRect();
                          setDropdownPos({
                            top: rect.bottom,
                            left: rect.left,
                            width: rect.width,
                          });
                          onMedicineSearch(v);
                        }}
                      />
                    </div>
                  )}
                </td>

                {/* Dosage */}
                <td className={`${tdBase} ${COL_STD}`}>
                  {!isEditing ? (
                    <span className={viewText}>{d.dosage || '-'}</span>
                  ) : (
                    cellTextarea(d.dosage, (v) => updateMedicineDraft(m.id, { dosage: v }))
                  )}
                </td>

                {/* Quantity */}
                <td className={`${tdBase} ${COL_STD}`}>
                  {!isEditing ? (
                    <span className={viewText}>{d.quantity || '-'}</span>
                  ) : (
                    cellTextarea(d.quantity, (v) => updateMedicineDraft(m.id, { quantity: v }))
                  )}
                </td>

                {/* Type */}
                <td className={`${tdBase} ${COL_STD}`}>
                  {!isEditing ? (
                    <span className={viewText}>{d.type || '-'}</span>
                  ) : (
                    cellTextarea(d.type, (v) => updateMedicineDraft(m.id, { type: v }))
                  )}
                </td>

                {/* Frequency */}
                <td className={`${tdBase} ${COL_STD}`}>
                  {!isEditing ? (
                    <span className={viewText}>{d.frequency || '-'}</span>
                  ) : (
                    <select
                      className={inputBase}
                      value={d.frequency}
                      onChange={(e) => updateMedicineDraft(m.id, { frequency: e.target.value })}
                    >
                      <option value="">Select</option>
                      {FREQUENCY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}
                </td>

                {/* Time */}
                <td className={`${tdBase} ${COL_STD}`}>
                  {!isEditing ? (
                    <span className={viewText}>
                      {Array.isArray(d.time) && d.time.length ? d.time.join(', ') : '-'}
                    </span>
                  ) : (
                    <div ref={openTimeDropdownId === m.id ? timeDropdownRef : null} className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenTimeDropdownId(openTimeDropdownId === m.id ? null : m.id)}
                        className={`${inputBase} text-left hover:bg-gray-100`}
                      >
                        {Array.isArray(d.time) && d.time.length ? d.time.join(', ') : 'Select time'}
                      </button>

                      {openTimeDropdownId === m.id && (
                        <div className="absolute z-30 mt-2 w-56 rounded-lg border border-gray-200 bg-white shadow-lg p-2">
                          {TIME_OPTIONS.map((opt) => {
                            const current = Array.isArray(d.time) ? d.time : [];
                            const checked = current.includes(opt);
                            return (
                              <label
                                key={opt}
                                className="flex items-center gap-2 px-2 py-2 rounded hover:bg-gray-50 cursor-pointer"
                              >
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
                <td className={`${tdBase} ${COL_STD}`}>
                  {!isEditing ? (
                    <span className={viewText}>{d.food || '-'}</span>
                  ) : (
                    <select
                      className={inputBase}
                      value={d.food}
                      onChange={(e) => updateMedicineDraft(m.id, { food: e.target.value })}
                    >
                      <option value="">Select</option>
                      {FOOD_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}
                </td>

                {/* Duration */}
                <td className={`${tdBase} ${COL_STD}`}>
                  {!isEditing ? (
                    <span className={viewText}>{d.duration || '-'}</span>
                  ) : (
                    cellTextarea(d.duration, (v) => updateMedicineDraft(m.id, { duration: v }))
                  )}
                </td>

                {/* Instructions */}
                <td className={`${tdBase} ${COL_INSTR}`}>
                  <div className={instrWrapClass}>
                    {!isEditing ? (
                      <span className={viewText}>{d.instructions || '-'}</span>
                    ) : (
                      cellTextarea(d.instructions, (v) => updateMedicineDraft(m.id, { instructions: v }))
                    )}
                  </div>
                </td>

                {/* Flags */}
                <td className={`${tdBase} ${COL_FLAGS}`}>
                  <div className={flagsWrapClass}>
                    {!isEditing ? (
                      <span className={viewText}>{d.flags || '-'}</span>
                    ) : (
                      cellTextarea(d.flags || '', (v) => updateMedicineDraft(m.id, { flags: v }))
                    )}
                  </div>
                </td>

                {isEditing && (
                  <td className={`${tdBase} ${COL_ACTION}`}>
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
    {/* Dropdown rendered in fixed position to escape overflow:auto clipping */}
    {medicineSearchResults.length > 0 && activeMedicineSearchId !== null && dropdownPos && (
      <div
        ref={searchDropdownRef}
        style={{
          position: 'fixed',
          top: dropdownPos.top,
          left: dropdownPos.left,
          width: dropdownPos.width,
          zIndex: 9999,
        }}
        className="bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto"
      >
        {medicineSearchResults.map((r, i) => (
          <button
            key={i}
            type="button"
            className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
            onClick={() => {
              if (activeMedicineSearchId) {
                updateMedicineDraft(activeMedicineSearchId, { name: r.name });
              }
              setMedicineSearchResults([]);
              setActiveMedicineSearchId(null);
              setDropdownPos(null);
            }}
          >
            {r.name}
          </button>
        ))}
      </div>
    )}
      </>
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

  // View text
  const viewDiagnosis = useMemo(() => diagnosisToText(summary?.diagnosis), [summary]);
  const viewChief = useMemo(() => toPlainText(summary?.chief_complaints, 'No chief complaints recorded'), [summary]);
  const viewTreatment = useMemo(() => treatmentToText(summary?.treatment_suggested), [summary]);
  const viewInvestigations = useMemo(() => investigationsToText(summary?.investigations), [summary]);
  const viewHistory = useMemo(() => toPlainText(summary?.history, 'No history recorded'), [summary]);
  const viewFollowup = useMemo(() => toPlainText(summary?.followup_recommendations, 'No follow-up recommendations recorded'), [summary]);
  const viewKeyInsights = useMemo(() => toPlainText(summary?.key_personal_insights, 'No personal insights recorded'), [summary]);

  const flags = useMemo(() => {
    const arr = summary && Array.isArray(summary.flags_for_review) ? summary.flags_for_review : [];
    return arr.filter((f) => typeof f === 'string' && f.trim().length > 0);
  }, [summary]);

  const [flagsOpen, setFlagsOpen] = useState(true);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 bg-white border-b border-gray-200 px-6 py-4">
         <div className="flex items-start justify-between gap-3">
  {/* Left: Title + time + (mobile buttons below) */}
  <div className="min-w-0 flex-1">
    <h2 className="text-xl font-semibold text-gray-900">
      {isEditing ? 'Edit Consultation Summary' : 'Consultation Summary'}
    </h2>
    <p className="text-sm text-gray-600">{formatDate(consult.created_at)}</p>

    {/* Mobile actions (below title/time) */}
    <div className="mt-3 flex flex-wrap gap-2 md:hidden">
      {!isEditing ? (
        <>
          <button
            onClick={onStartEdit}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors"
          >
            <Edit className="w-4 h-4" />
            <span>Edit</span>
          </button>

          <button
            onClick={onDownloadPDF}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>PDF</span>
          </button>
        </>
      ) : (
        <>
          <button
            onClick={onCancelEdit}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors"
          >
            <XCircle className="w-4 h-4" />
            <span>Cancel</span>
          </button>

          <button
            onClick={onSaveEdit}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-[#024CDB] hover:bg-[#023BA3] text-white rounded text-sm transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>Save</span>
          </button>
        </>
      )}
    </div>
  </div>

  {/* Right: Desktop actions + Close */}
  <div className="flex items-center gap-2">
    {/* Desktop actions stay on the right */}
    <div className="hidden md:flex items-center gap-2">
      {!isEditing ? (
        <>
          <button
            onClick={onStartEdit}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors"
          >
            <Edit className="w-4 h-4" />
            <span>Edit</span>
          </button>

          <button
            onClick={onDownloadPDF}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>PDF</span>
          </button>
        </>
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
    </div>

    {/* Close stays top-right on all sizes */}
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
              <SectionCard title="Diagnosis">
                <SyncedAutoBox
                  isEditing={isEditing}
                  text={isEditing ? editedDiagnosisText : viewDiagnosis}
                  onChange={setEditedDiagnosisText}
                  emptyText="No diagnosis recorded"
                />
              </SectionCard>

              <SectionCard title="Chief Complaints">
                <SyncedAutoBox
                  isEditing={isEditing}
                  text={isEditing ? toEditText(editedConsult?.chief_complaints) : viewChief}
                  onChange={(v) => setEditedConsult({ ...editedConsult, chief_complaints: v })}
                  emptyText="No chief complaints recorded"
                />
              </SectionCard>

              <SectionCard title="Treatment Suggested">
                <SyncedAutoBox
                  isEditing={isEditing}
                  text={isEditing ? editedTreatmentText : viewTreatment}
                  onChange={setEditedTreatmentText}
                  emptyText="No treatment recorded"
                />
              </SectionCard>

              <SectionCard title="Investigations">
                <SyncedAutoBox
                  isEditing={isEditing}
                  text={isEditing ? editedInvestigationsText : viewInvestigations}
                  onChange={setEditedInvestigationsText}
                  emptyText="No investigations recorded"
                />
              </SectionCard>

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

              <SectionCard title="History">
                <SyncedAutoBox
                  isEditing={isEditing}
                  text={isEditing ? toEditText(editedConsult?.history) : viewHistory}
                  onChange={(v) => setEditedConsult({ ...editedConsult, history: v })}
                  emptyText="No history recorded"
                />
              </SectionCard>

              <SectionCard title="Follow-up Recommendations">
                <SyncedAutoBox
                  isEditing={isEditing}
                  text={isEditing ? toEditText(editedConsult?.followup_recommendations) : viewFollowup}
                  onChange={(v) => setEditedConsult({ ...editedConsult, followup_recommendations: v })}
                  emptyText="No follow-up recommendations recorded"
                />
              </SectionCard>

              {/* ✅ Key Personal Insights (view + editable) */}
              <SectionCard title="Key Personal Insights">
                <SyncedAutoBox
                  isEditing={isEditing}
                  text={isEditing ? toEditText(editedConsult?.key_personal_insights) : viewKeyInsights}
                  onChange={(v) => setEditedConsult({ ...editedConsult, key_personal_insights: v })}
                  emptyText="No personal insights recorded"
                />
              </SectionCard>

              {/* Flags at the bottom */}
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