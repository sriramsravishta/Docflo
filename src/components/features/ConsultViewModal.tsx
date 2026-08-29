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
  Heart,
  History,
} from 'lucide-react';
import { CreditCard as Edit } from 'lucide-react';
import { Mic, Square } from 'lucide-react';
import { useVoiceEdit } from '../../hooks/useVoiceEdit';
import { supabase } from '../../lib/supabase';
import AttachmentGallery from '../AttachmentGallery';
import type { AttachmentItem } from '../AttachmentGallery';
import type { ConsultRow, ConsultMedicineRow, PatientRow } from '../../types/db';
import type { ConsultSummary, DiagnosisSummary, TreatmentSummary, InvestigationsSummary } from '../../types/db';

import {
  getConsultSummary,
  getElapsedSeconds,
  getDisplayedElapsed,
  getProgressPercent,
  safeJsonParse,
  isConsultError,
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
  onAddFavourites: () => void;
  onLoadPrevious: () => void;
  onRetryOptimistic: (consultId: string) => void;

  // existing
  onClose: () => void;
  onDownloadPDF: () => void;
  onSendWhatsApp: () => void;
  formatDate: (s: string) => string;
  uiNow: number;
    onRefreshMedicines?: () => void;
  onRefreshConsult?: () => void;
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

function diagnosisToText(diagnosis: unknown, hasExaminationFindings: boolean) {
  const parsed = safeJsonParse(diagnosis);
  const d = parsed ?? diagnosis;

  if (d == null || isBlankString(d)) return 'No diagnosis recorded';
  if (typeof d === 'string') return d;

  if (typeof d === 'object' && d !== null) {
    const dd = d as DiagnosisSummary;
    const prov = Array.isArray(dd.provisional) ? dd.provisional : [];
    // Show key_findings here ONLY for old consults that don't have examination_findings
    const keyf = !hasExaminationFindings && Array.isArray(dd.key_findings) ? dd.key_findings : [];
    if (!prov.length && !keyf.length) return 'No detailed diagnosis available';

    const lines: string[] = [];
    if (prov.length) {
      lines.push('Provisional:');
      prov.forEach((x) => lines.push(`- ${x}`));
    }
    if (keyf.length) {
      lines.push('');
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
        // 1. Check if 'o' is just a string first, otherwise look for o.name
        const name = typeof o === 'string' ? o : (o?.name ? String(o.name) : '-');
        
        // 2. Only check for body and priority if 'o' is actually an object
        const body = typeof o === 'object' && o !== null && o?.body_part_or_type ? ` — ${String(o.body_part_or_type)}` : '';
        const pr = typeof o === 'object' && o !== null && o?.priority ? ` (Priority: ${String(o.priority)})` : '';
        
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
  highlighted = false,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  tone?: 'default' | 'danger';
  highlighted?: boolean;
}) {
  const toneClass = highlighted 
    ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200'
    : tone === 'danger' 
      ? 'border-red-200 bg-red-50' 
      : 'border-gray-200 bg-white';

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
                    <div ref={openTimeDropdownId === m.id ? timeDropdownRef : null}>
                      <button
                        type="button"
                        onClick={(e) => {
                          if (openTimeDropdownId === m.id) {
                            setOpenTimeDropdownId(null);
                            setTimeDropdownPos(null);
                          } else {
                            setOpenTimeDropdownId(m.id);
                            // Calculate exact position on the screen
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTimeDropdownPos({ top: rect.bottom + 4, left: rect.left });
                          }
                        }}
                        className={`${inputBase} text-left hover:bg-gray-100 w-full`}
                      >
                        {Array.isArray(d.time) && d.time.length ? d.time.join(', ') : 'Select time'}
                      </button>

                      {openTimeDropdownId === m.id && timeDropdownPos && (
                        <div 
                          style={{
                            position: 'fixed',
                            top: timeDropdownPos.top,
                            left: timeDropdownPos.left,
                            zIndex: 9999,
                          }}
                          className="w-56 rounded-lg border border-gray-200 bg-white shadow-lg p-2"
                        >
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
    onAddFavourites,
    onLoadPrevious,
    onRetryOptimistic,
    onClose,
    onDownloadPDF,
    formatDate,
    uiNow,
  } = props;

  const summary = getConsultSummary(consult) as ConsultSummary | null;
    const isOTNote = (consult as any)?.type === 'ot_note';
  const otSummary = isOTNote ? (summary as any) : null;

  // OT Images state
    const [otImages, setOtImages] = useState<string[]>(Array.isArray((consult as any)?.ot_images) ? (consult as any).ot_images : []);
  const [uploadingImage, setUploadingImage] = useState(false);
  const otFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
        setOtImages(Array.isArray((consult as any)?.ot_images) ? (consult as any).ot_images : []);
  }, [consult?.id]);

  const handleOtImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !consult?.id) return;
    setUploadingImage(true);
    try {
      const newUrls: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop() || 'jpg';
        const fileName = `${consult.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { data, error } = await supabase.storage
          .from('ot-images')
          .upload(fileName, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('ot-images').getPublicUrl(data.path);
        newUrls.push(urlData.publicUrl);
      }
      const updated = [...otImages, ...newUrls];
      await supabase.from('consult').update({ ot_images: updated }).eq('id', consult.id);
      setOtImages(updated);
    } catch (err) {
      console.error('OT image upload failed:', err);
    } finally {
      setUploadingImage(false);
      if (otFileInputRef.current) otFileInputRef.current.value = '';
    }
  };

      const handleRemoveOtImage = async (url: string) => {
    if (!consult?.id) return;
    const updated = otImages.filter(u => u !== url);
    await supabase.from('consult').update({ ot_images: updated }).eq('id', consult.id);
    setOtImages(updated);
  };

  // OT images as AttachmentItems (public bucket — URLs used directly)
  const otAttachments: AttachmentItem[] = otImages.map((url, idx) => ({
    id: String(idx),
    url,
    name: `Image ${idx + 1}`,
    isImage: true,
  }));

  // Consultation Documents state (private bucket — needs signed URLs)
  const [consultDocs, setConsultDocs] = useState<AttachmentItem[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  useEffect(() => {
    if (!consult?.id || isOTNote) return;
    (async () => {
      const { data } = await supabase
        .from('consult_documents')
        .select('id, file_url, file_name, file_type')
        .eq('consult_id', consult.id)
        .order('uploaded_at', { ascending: false });
      if (!data || data.length === 0) { setConsultDocs([]); return; }
      const withUrls = await Promise.all(data.map(async (doc) => {
        const { data: signed } = await supabase.storage
          .from('consult-documents')
          .createSignedUrl(doc.file_url, 3600);
        return {
          id: doc.id,
          url: signed?.signedUrl || '',
          name: doc.file_name,
          isImage: (doc.file_type || '').startsWith('image/'),
        };
      }));
      setConsultDocs(withUrls);
    })();
  }, [consult?.id, isOTNote]);

  const handleDocUpload = async (files: FileList) => {
    if (!consult?.id || !props.userId) return;
    setUploadingDoc(true);
    try {
      for (const file of Array.from(files)) {
        const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${consult.id}/${Date.now()}-${sanitized}`;
        const { data: uploadData, error } = await supabase.storage
          .from('consult-documents')
          .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
        if (error) throw error;
        const { data: row } = await supabase
          .from('consult_documents')
          .insert({
            consult_id: consult.id,
            doc_id: props.userId,
            file_url: uploadData.path,
            file_name: file.name,
            file_type: file.type || null,
            file_size_bytes: file.size,
          })
          .select('id, file_url, file_name, file_type')
          .single();
        if (row) {
          const { data: signed } = await supabase.storage
            .from('consult-documents')
            .createSignedUrl(row.file_url, 3600);
          setConsultDocs(prev => [{
            id: row.id,
            url: signed?.signedUrl || '',
            name: row.file_name,
            isImage: (row.file_type || '').startsWith('image/'),
          }, ...prev]);
        }
      }
    } catch (err) {
      console.error('Document upload failed:', err);
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleRemoveDoc = async (item: AttachmentItem) => {
    await supabase.from('consult_documents').delete().eq('id', item.id);
    setConsultDocs(prev => prev.filter(d => d.id !== item.id));
  };

  // View text 

  // Consultation Documents state
  const [consultDocs, setConsultDocs] = useState<{ id: string; file_url: string; file_name: string; file_type?: string }[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const docFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!consult?.id || isOTNote) return;
    supabase
      .from('consult_documents')
      .select('id, file_url, file_name, file_type')
      .eq('consult_id', consult.id)
      .order('uploaded_at', { ascending: false })
      .then(({ data }) => { if (data) setConsultDocs(data); });
  }, [consult?.id, isOTNote]);

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !consult?.id || !props.userId) return;
    setUploadingDoc(true);
    try {
      for (const file of Array.from(files)) {
        const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${consult.id}/${Date.now()}-${sanitized}`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('consult-documents')
          .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
        if (uploadErr) throw uploadErr;
        // For private bucket, store the path; we'll get signed URL for display
        const fileUrl = uploadData.path;
        const { data: row } = await supabase
          .from('consult_documents')
          .insert({
            consult_id: consult.id,
            doc_id: props.userId,
            file_url: fileUrl,
            file_name: file.name,
            file_type: file.type || null,
            file_size_bytes: file.size,
          })
          .select('id, file_url, file_name, file_type')
          .single();
        if (row) setConsultDocs(prev => [row, ...prev]);
      }
    } catch (err) {
      console.error('Document upload failed:', err);
    } finally {
      setUploadingDoc(false);
      if (docFileInputRef.current) docFileInputRef.current.value = '';
    }
  };

  const handleViewDoc = async (fileUrl: string) => {
    const { data } = await supabase.storage.from('consult-documents').createSignedUrl(fileUrl, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const handleRemoveDoc = async (docId: string) => {
    await supabase.from('consult_documents').delete().eq('id', docId);
    setConsultDocs(prev => prev.filter(d => d.id !== docId));
  };

  // View text
  const viewFindings = useMemo(() => {
    // New consults: examination_findings at top level
    const newFindings = (summary as any)?.examination_findings;
    // Old consults: key_findings inside diagnosis
    const oldFindings = typeof summary?.diagnosis === 'object' && summary?.diagnosis !== null
      ? (summary.diagnosis as DiagnosisSummary).key_findings
      : undefined;
    const merged = newFindings || oldFindings;
    return toPlainText(merged, 'No examination findings recorded');
  }, [summary]);

  const hasFindings = useMemo(() => {
    const newF = (summary as any)?.examination_findings;
    const oldF = typeof summary?.diagnosis === 'object' && summary?.diagnosis !== null
      ? (summary.diagnosis as DiagnosisSummary).key_findings
      : undefined;
    const v = newF || oldF;
    return Array.isArray(v) ? v.length > 0 : typeof v === 'string' && v.trim().length > 0;
  }, [summary]);
  
const viewDiagnosis = useMemo(() => diagnosisToText(summary?.diagnosis, hasFindings), [summary, hasFindings]);
  const viewChief = useMemo(() => toPlainText(summary?.chief_complaints, 'No chief complaints recorded'), [summary]);
  const viewTreatment = useMemo(() => treatmentToText(summary?.treatment_suggested), [summary]);
  const viewInvestigations = useMemo(() => investigationsToText(summary?.investigations), [summary]);
  const viewHistory = useMemo(() => toPlainText(summary?.history, 'No history recorded'), [summary]);
  const viewPMH = useMemo(() => toPlainText((summary as any)?.past_medical_history, 'No past medical history recorded'), [summary]);
  
  const viewFollowup = useMemo(() => toPlainText(summary?.followup_recommendations, 'No follow-up recommendations recorded'), [summary]);
  const viewKeyInsights = useMemo(() => toPlainText(summary?.key_personal_insights, 'No personal insights recorded'), [summary]);

  const flags = useMemo(() => {
    const arr = summary && Array.isArray(summary.flags_for_review) ? summary.flags_for_review : [];
    return arr.filter((f) => typeof f === 'string' && f.trim().length > 0);
  }, [summary]);

  const [flagsOpen, setFlagsOpen] = useState(true);
  const [showPlayer, setShowPlayer] = useState(false);
    const voiceEdit = useVoiceEdit(consult.id, props.userId, props.onRefreshConsult);
  const [undoing, setUndoing] = useState(false);
  const isHighlighted = (fieldName: string): boolean => {
    return voiceEdit.editStatus === 'ready' && voiceEdit.changedFields.includes(fieldName);
  };

  const handleUndoEdit = async () => {
    if (!voiceEdit.lastEditId) return;
    setUndoing(true);
    try {
      const { data: editRow } = await supabase
        .from('consult_edits')
        .select('summary_before')
        .eq('id', voiceEdit.lastEditId)
        .single();
      if (editRow?.summary_before) {
        await supabase
          .from('consult')
          .update({ consult_summary_final: JSON.stringify(editRow.summary_before) })
          .eq('id', consult.id);
        // Log the undo as its own edit
        await supabase.from('consult_edits').insert({
          consult_id: consult.id,
          doc_id: props.userId || '',
          source: 'manual_edit',
          status: 'completed',
          changed_fields: voiceEdit.changedFields,
          summary_before: null,
          summary_after: editRow.summary_before,
        });
        voiceEdit.dismissEdit();
      } else {
        alert('Undo data not available for this edit.');
      }
    } catch (e) {
      console.error('Undo failed:', e);
      alert('Failed to undo. Please try again.');
    } finally {
      setUndoing(false);
    }
  };

  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 bg-white border-b border-gray-200 px-6 py-4">
         <div className="flex items-start justify-between gap-3">
  {/* Left: Title + time + (mobile buttons below) */}
  <div className="min-w-0 flex-1">
    <h2 className="text-xl font-semibold text-gray-900">
      {isOTNote
        ? (isEditing ? 'Edit OT Note' : 'OT Note')
        : (isEditing ? 'Edit Consultation Summary' : 'Consultation Summary')}
    </h2>
    <p className="text-sm text-gray-600">{formatDate(consult.created_at)}</p>

    {/* Mobile actions (below title/time) */}
    <div className="mt-3 flex flex-wrap gap-2 md:hidden">
      {!isEditing ? (
        <>
          {consult?.recording_file && (
            <button
              onClick={() => setShowPlayer(true)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-rose-500" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="5" />
                <path fillOpacity="0.25" d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z" />
              </svg>
              <span>Listen</span>
            </button>
          )}

          <button
            onClick={onStartEdit}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors"
          >
            <Edit className="w-4 h-4" />
            <span>Edit</span>
          </button>

                              {!isEditing && (
            <>
              <button
                onClick={voiceEdit.isRecording ? voiceEdit.stopEditRecording : voiceEdit.startEditRecording}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
                  voiceEdit.isRecording
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-purple-100 hover:bg-purple-200 text-purple-700'
                }`}
                title={voiceEdit.isRecording ? 'Stop and apply edits' : 'Voice edit'}
              >
                {voiceEdit.isRecording ? (
                  <>
                    <Square className="w-4 h-4" />
                    <span>{Math.floor(voiceEdit.recordingTime / 60)}:{(voiceEdit.recordingTime % 60).toString().padStart(2, '0')}</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    <span>Voice Edit</span>
                  </>
                )}
              </button>
              {voiceEdit.isRecording && (
                <>
                  <button
                    onClick={voiceEdit.pauseEditRecording}
                    className={`px-2 py-1.5 rounded text-sm transition-colors ${
                      voiceEdit.isPaused
                        ? 'bg-[#024CDB] hover:bg-[#023BA3] text-white'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                  >
                    {voiceEdit.isPaused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    onClick={voiceEdit.cancelEditRecording}
                    className="px-2 py-1.5 text-gray-500 hover:text-red-600 text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </>
              )}
            </>
          )}

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
          {consult?.recording_file && (
            <button
              onClick={() => setShowPlayer(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-rose-500" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="5" />
                <path fillOpacity="0.25" d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z" />
              </svg>
              <span>Listen</span>
            </button>
          )}
          <button
            onClick={onStartEdit}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors"
          >
            <Edit className="w-4 h-4" />
            <span>Edit</span>
          </button>

                   {!isEditing && (
            <>
              <button
                onClick={voiceEdit.isRecording ? voiceEdit.stopEditRecording : voiceEdit.startEditRecording}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
                  voiceEdit.isRecording
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-purple-100 hover:bg-purple-200 text-purple-700'
                }`}
                title={voiceEdit.isRecording ? 'Stop and apply edits' : 'Voice edit'}
              >
                {voiceEdit.isRecording ? (
                  <>
                    <Square className="w-4 h-4" />
                    <span>{Math.floor(voiceEdit.recordingTime / 60)}:{(voiceEdit.recordingTime % 60).toString().padStart(2, '0')}</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    <span>Voice Edit</span>
                  </>
                )}
              </button>
              {voiceEdit.isRecording && (
                <>
                  <button
                    onClick={voiceEdit.pauseEditRecording}
                    className={`px-2 py-1.5 rounded text-sm transition-colors ${
                      voiceEdit.isPaused
                        ? 'bg-[#024CDB] hover:bg-[#023BA3] text-white'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                  >
                    {voiceEdit.isPaused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    onClick={voiceEdit.cancelEditRecording}
                    className="px-2 py-1.5 text-gray-500 hover:text-red-600 text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </>
              )}
            </>
          )}
          
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
        <div className="flex-1 overflow-y-auto relative">
          {/* Voice edit processing overlay */}
                    {voiceEdit.editStatus === 'processing' && (
            <div className="sticky top-0 left-0 right-0 bg-white/70 backdrop-blur-[2px] z-10 flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-4 px-8 py-6 bg-white rounded-2xl shadow-xl border border-purple-100">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 rounded-full border-4 border-purple-100" />
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin" />
                  <Mic className="absolute inset-0 m-auto w-5 h-5 text-purple-500" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-800">Applying voice edits…</p>
                  <p className="text-xs text-gray-400 mt-1">Usually takes 10–20 seconds</p>
                </div>
              </div>
            </div>
          )}
          {summary ? (
            isOTNote ? (
              /* ── OT NOTE VIEW ── */
              <div className="px-6 py-6 space-y-6">
                {otSummary?.procedure_name === 'ROUTING_ERROR' && (
                  <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
                    <p className="text-sm font-medium text-amber-800">This recording was routed as an OT Note but appears to be a consultation. Please re-record using the Record button.</p>
                  </div>
                )}
                <SectionCard title="Procedure" highlighted={isHighlighted('procedure_name')}>
                  <SyncedAutoBox
                    isEditing={isEditing}
                    text={isEditing ? toEditText(editedConsult?.procedure_name) : (otSummary?.procedure_name || 'No procedure recorded')}
                    onChange={(v) => setEditedConsult({ ...editedConsult, procedure_name: v })}
                    emptyText="No procedure recorded"
                  />
                </SectionCard>
                <SectionCard title="Indications" highlighted={isHighlighted('indications')}>
                  <SyncedAutoBox
                    isEditing={isEditing}
                    text={isEditing ? toEditText(editedConsult?.indications) : (otSummary?.indications || 'No indications recorded')}
                    onChange={(v) => setEditedConsult({ ...editedConsult, indications: v })}
                    emptyText="No indications recorded"
                  />
                </SectionCard>
                {(isEditing || otSummary?.anesthesia_type) && (
                  <SectionCard title="Anesthesia" highlighted={isHighlighted('anesthesia_type')}>
                    <SyncedAutoBox
                      isEditing={isEditing}
                      text={isEditing ? toEditText(editedConsult?.anesthesia_type) : (otSummary?.anesthesia_type || '')}
                      onChange={(v) => setEditedConsult({ ...editedConsult, anesthesia_type: v })}
                      emptyText="Not specified"
                    />
                  </SectionCard>
                )}
                <SectionCard title="Intraoperative Findings" highlighted={isHighlighted('intraoperative_findings')}>
                  <SyncedAutoBox
                    isEditing={isEditing}
                    text={isEditing ? toEditText(editedConsult?.intraoperative_findings) : toPlainText(otSummary?.intraoperative_findings, 'No findings recorded')}
                    onChange={(v) => setEditedConsult({ ...editedConsult, intraoperative_findings: v })}
                    emptyText="No findings recorded"
                  />
                </SectionCard>
                <SectionCard title="Procedure Steps" highlighted={isHighlighted('procedure_steps')}>
                  <div className="px-3 py-2">
                    {isEditing ? (
                      <SyncedAutoBox
                        isEditing={true}
                        text={toEditText(editedConsult?.procedure_steps)}
                        onChange={(v) => setEditedConsult({ ...editedConsult, procedure_steps: v })}
                        emptyText="No steps recorded"
                      />
                    ) : (
                      <ol className="list-decimal list-inside space-y-1 text-gray-700 text-[16px]">
                                                {(Array.isArray(otSummary?.procedure_steps) ? otSummary.procedure_steps : []).map((step: string, i: number) => (
                          <li key={i}>{step}</li>
                        ))}
                        {(!otSummary?.procedure_steps || otSummary.procedure_steps.length === 0) && (
                          <p className="text-gray-400">No steps recorded</p>
                        )}
                      </ol>
                    )}
                  </div>
                </SectionCard>
               <SectionCard title="Complications" highlighted={isHighlighted('complications')}>
                  <SyncedAutoBox
                    isEditing={isEditing}
                    text={isEditing ? toEditText(editedConsult?.complications) : (otSummary?.complications || 'None. Procedure was uneventful.')}
                    onChange={(v) => setEditedConsult({ ...editedConsult, complications: v })}
                    emptyText="None. Procedure was uneventful."
                  />
                </SectionCard>
                {(isEditing || otSummary?.estimated_blood_loss) && (
                  <SectionCard title="Estimated Blood Loss" highlighted={isHighlighted('estimated_blood_loss')}>
                    <SyncedAutoBox
                      isEditing={isEditing}
                      text={isEditing ? toEditText(editedConsult?.estimated_blood_loss) : (otSummary?.estimated_blood_loss || '')}
                      onChange={(v) => setEditedConsult({ ...editedConsult, estimated_blood_loss: v })}
                      emptyText="Not specified"
                    />
                  </SectionCard>
                )}
                {(isEditing || otSummary?.specimens_sent) && (
                  <SectionCard title="Specimens Sent" highlighted={isHighlighted('specimens_sent')}>
                    <SyncedAutoBox
                      isEditing={isEditing}
                      text={isEditing ? toEditText(editedConsult?.specimens_sent) : (otSummary?.specimens_sent || '')}
                      onChange={(v) => setEditedConsult({ ...editedConsult, specimens_sent: v })}
                      emptyText="None"
                    />
                  </SectionCard>
                )}
                <SectionCard title="Post-op Instructions" highlighted={isHighlighted('post_op_instructions')}>
                  <SyncedAutoBox
                    isEditing={isEditing}
                    text={isEditing ? toEditText(editedConsult?.post_op_instructions) : toPlainText(otSummary?.post_op_instructions, 'No instructions recorded')}
                    onChange={(v) => setEditedConsult({ ...editedConsult, post_op_instructions: v })}
                    emptyText="No instructions recorded"
                  />
                </SectionCard>
                                {/* ── OT Images ── */}
                <SectionCard title="Surgery Images">
                  <div className="px-3 py-3">
                    <input
                      ref={otFileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleOtImageUpload}
                    />
                    {otImages.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                        {otImages.map((url, idx) => (
                          <div key={idx} className="relative group rounded-lg overflow-hidden border border-gray-200">
                            <img
                              src={url}
                              alt={`OT image ${idx + 1}`}
                              className="w-full h-32 object-cover cursor-pointer"
                              onClick={() => window.open(url, '_blank')}
                            />
                            <button
                              onClick={() => handleRemoveOtImage(url)}
                              className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => otFileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="flex items-center gap-2 text-sm text-[#024CDB] font-medium hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors"
                    >
                      {uploadingImage ? (
                        <><span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> Uploading...</>
                      ) : (
                        <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" /></svg> Add Surgery Images</>
                      )}
                    </button>
                    {otImages.length === 0 && !uploadingImage && (
                      <p className="text-xs text-gray-400 mt-1">Upload photos from the surgery for your records</p>
                    )}
                  </div>
                </SectionCard>
                <div className="h-6" />
              </div>
            ) : (
            <div className="px-6 py-6 space-y-6">
              <SectionCard title="Diagnosis" highlighted={isHighlighted('diagnosis')}>
                <SyncedAutoBox
                  isEditing={isEditing}
                  text={isEditing ? editedDiagnosisText : viewDiagnosis}
                  onChange={setEditedDiagnosisText}
                  emptyText="No diagnosis recorded"
                />
              </SectionCard>

              <SectionCard title="Chief Complaints" highlighted={isHighlighted('chief_complaints')}>
                <SyncedAutoBox
                  isEditing={isEditing}
                  text={isEditing ? toEditText(editedConsult?.chief_complaints) : viewChief}
                  onChange={(v) => setEditedConsult({ ...editedConsult, chief_complaints: v })}
                  emptyText="No chief complaints recorded"
                />
              </SectionCard>

              <SectionCard title="History of Present Illness" highlighted={isHighlighted('history')}>
                <SyncedAutoBox
                  isEditing={isEditing}
                  text={isEditing ? toEditText(editedConsult?.history) : viewHistory}
                  onChange={(v) => setEditedConsult({ ...editedConsult, history: v })}
                  emptyText="No history recorded"
                />
              </SectionCard>

              <SectionCard title="Past Medical History" highlighted={isHighlighted('past_medical_history')}>
                <SyncedAutoBox
                  isEditing={isEditing}
                  text={isEditing ? toEditText((editedConsult as any)?.past_medical_history) : viewPMH}
                  onChange={(v) => setEditedConsult({ ...editedConsult, past_medical_history: v })}
                  emptyText="No past medical history recorded"
                />
              </SectionCard>

              {(isEditing || hasFindings) && (
                <SectionCard title="Examination & Findings" highlighted={isHighlighted('examination_findings')}>
                  <SyncedAutoBox
                    isEditing={isEditing}
                    text={isEditing ? toEditText((editedConsult as any)?.examination_findings) : viewFindings}
                    onChange={(v) => setEditedConsult({ ...editedConsult, examination_findings: v })}
                    emptyText="No examination findings recorded"
                  />
                </SectionCard>
              )}

                            <SectionCard
                title="Current Medications"
                highlighted={isHighlighted('medications')}
                right={
                  isEditing ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={onLoadPrevious}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors"
                      >
                        <History className="w-4 h-4" />
                        <span className="hidden sm:inline">Load Previous</span>
                      </button>
                      <button
                        onClick={onAddFavourites}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors"
                      >
                        <Heart className="w-4 h-4" />
                        <span className="hidden sm:inline">Add Favourites</span>
                      </button>
                      <button
                        onClick={onAddMedicine}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add</span>
                      </button>
                    </div>
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


              <SectionCard title="Investigations" highlighted={isHighlighted('investigations')}>
                <SyncedAutoBox
                  isEditing={isEditing}
                  text={isEditing ? editedInvestigationsText : viewInvestigations}
                  onChange={setEditedInvestigationsText}
                  emptyText="No investigations recorded"
                />
              </SectionCard>

              
<SectionCard title="Treatment Suggested" highlighted={isHighlighted('treatment_suggested')}>
                <SyncedAutoBox
                  isEditing={isEditing}
                  text={isEditing ? editedTreatmentText : viewTreatment}
                  onChange={setEditedTreatmentText}
                  emptyText="No treatment recorded"
                />
              </SectionCard>
              
{(() => {
                const charts = (summary as any)?.attached_diet_charts;
                const chartList = Array.isArray(charts) ? charts.filter(Boolean) : [];
                if (!chartList.length) return null;
                return (
                  <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-green-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span className="text-sm font-medium text-green-800">
                      📎 Attached to prescription: {chartList.join(', ')}
                    </span>
                  </div>
                );
              })()}
              
              <SectionCard title="Follow-up Recommendations" highlighted={isHighlighted('followup_recommendations')}>
              
                <SyncedAutoBox
                  isEditing={isEditing}
                  text={isEditing ? toEditText(editedConsult?.followup_recommendations) : viewFollowup}
                  onChange={(v) => setEditedConsult({ ...editedConsult, followup_recommendations: v })}
                  emptyText="No follow-up recommendations recorded"
                />
              </SectionCard>

              {/* ✅ Key Personal Insights (view + editable) */}
              <SectionCard title="Key Personal Insights" highlighted={isHighlighted('key_personal_insights')}>
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

                            {/* ── Consultation Documents ── */}
              <SectionCard title="Attached Documents">
                <div className="px-3 py-3">
                  <input
                    ref={docFileInputRef}
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.txt"
                    multiple
                    className="hidden"
                    onChange={handleDocUpload}
                  />
                  {consultDocs.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {consultDocs.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between gap-3 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 group">
                          <button
                            onClick={() => handleViewDoc(doc.file_url)}
                            className="flex items-center gap-2 min-w-0 text-left hover:text-[#024CDB] transition-colors"
                          >
                            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            <span className="text-sm truncate">{doc.file_name}</span>
                          </button>
                          <button
                            onClick={() => handleRemoveDoc(doc.id)}
                            className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => docFileInputRef.current?.click()}
                    disabled={uploadingDoc}
                    className="flex items-center gap-2 text-sm text-[#024CDB] font-medium hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors"
                  >
                    {uploadingDoc ? (
                      <><span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> Uploading...</>
                    ) : (
                      <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg> Attach Documents</>
                    )}
                  </button>
                  {consultDocs.length === 0 && !uploadingDoc && (
                    <p className="text-xs text-gray-400 mt-1">Upload reports, images or documents for this consultation</p>
                  )}
                </div>
              </SectionCard>

              <div className="h-6" />
            </div>
            )
                    ) : consult.summary_streaming ? (
            <StreamingPreview consult={consult} />
          ) : (
            <div className="p-6">
              <ProcessingState consult={consult} uiNow={uiNow} onRetryOptimistic={onRetryOptimistic} />
            </div>
          )}
        </div>
      </div>

      {/* Voice edit status bar */}
            {voiceEdit.editStatus === 'ready' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-white rounded-full shadow-lg border border-blue-300 px-4 py-2 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-sm text-gray-700">
            {voiceEdit.changedFields.length === 0
              ? 'No changes applied'
              : `${voiceEdit.changedFields.length} field${voiceEdit.changedFields.length > 1 ? 's' : ''} updated`}
          </span>
          <button
            onClick={handleUndoEdit}
            disabled={undoing}
            className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
          >
            {undoing ? 'Undoing…' : 'Undo'}
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={() => { voiceEdit.dismissEdit(); onRefreshMedicines?.(); }}
            className="text-sm font-medium text-[#024CDB] hover:underline"
          >
            Got it
          </button>
        </div>
      )}

      {voiceEdit.editStatus === 'failed' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-white rounded-full shadow-lg border border-red-300 px-4 py-2 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-sm text-gray-700">Voice edit failed. Please try again.</span>
          <button
            onClick={voiceEdit.dismissEdit}
            className="text-sm font-medium text-red-600 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}
      
      {/* Recording Player Modal */}
      {showPlayer && consult?.recording_file && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowPlayer(false)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-sm font-semibold text-slate-800">Consultation Recording</span>
              </div>
              <button
                onClick={() => setShowPlayer(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
                aria-label="Close player"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Context line */}
            <p className="text-xs text-gray-400 mb-4">
              {props.patient?.name} &nbsp;·&nbsp; {formatDate(consult.created_at)}
            </p>

            {/* Audio player */}
            <audio
              controls
              className="w-full rounded-lg"
              style={{ colorScheme: 'light' }}
              preload="metadata"
              src={consult.recording_file}
            >
              Your browser does not support audio playback.
            </audio>

            <p className="text-xs text-gray-400 mt-3 text-center">
              For medico-legal reference only · Docflo
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══ STREAMING PREVIEW ═══
// Shows consultation summary sections one by one as the LLM generates them.
// Each section fades in when complete. Pending sections show as skeleton cards.
const STREAMING_SECTION_CONFIG = [
  { key: 'diagnosis', title: 'Diagnosis', render: (v: any) => {
    if (!v) return '';
    const prov = Array.isArray(v.provisional) ? v.provisional : (typeof v === 'string' ? [v] : []);
    return prov.join(', ') || 'No diagnosis recorded';
  }},
  { key: 'chief_complaints', title: 'Chief Complaints', render: (v: any) => Array.isArray(v) ? v.map(c => `• ${c}`).join('\n') : String(v || '') },
  { key: 'history', title: 'History of Present Illness', render: (v: any) => String(v || '') },
  { key: 'past_medical_history', title: 'Past Medical History', render: (v: any) => Array.isArray(v) ? v.map(c => `• ${c}`).join('\n') : String(v || '') },
  { key: 'examination_findings', title: 'Examination & Findings', render: (v: any) => Array.isArray(v) && v.length > 0 ? v.map(c => `• ${c}`).join('\n') : null },
  { key: 'medications', title: 'Current Medications', render: (v: any) => {
    if (!Array.isArray(v) || v.length === 0) return 'No medications';
    return v.map(m => {
      const parts = [m.name || '?'];
      if (m.dosage) parts.push(m.dosage);
      if (m.frequency) parts.push(m.frequency);
      if (m.duration) parts.push(`for ${m.duration}`);
      return `• ${parts.join(' — ')}`;
    }).join('\n');
  }},
  { key: 'investigations', title: 'Investigations', render: (v: any) => {
    if (!v) return 'No investigations';
    const ordered = Array.isArray(v.ordered) ? v.ordered : [];
    if (ordered.length === 0) return v.notes || 'No investigations';
    return ordered.map(i => `• ${i.name || '?'}${i.priority ? ` (${i.priority})` : ''}`).join('\n');
  }},
  { key: 'treatment_suggested', title: 'Treatment Suggested', render: (v: any) => {
    if (!v) return '';
    const items = [...(v.immediate_plan || []), ...(v.contingent_plan || [])];
    return items.map(i => `• ${i}`).join('\n') || 'No treatment recorded';
  }},
  { key: 'followup_recommendations', title: 'Follow-up Recommendations', render: (v: any) => Array.isArray(v) ? v.map(c => `• ${c}`).join('\n') : String(v || '') },
  { key: 'key_personal_insights', title: 'Key Personal Insights', render: (v: any) => Array.isArray(v) ? v.map(c => `• ${c}`).join('\n') : String(v || '') },
  { key: 'flags_for_review', title: 'Flags for Review', render: (v: any) => Array.isArray(v) && v.length > 0 ? v.map(c => `⚠ ${c}`).join('\n') : null },
];

function StreamingPreview({ consult }: { consult: ConsultRow }) {
  const streaming = consult.summary_streaming;
  if (!streaming) return null;

  const completed = streaming.completed_sections || [];
  const data = streaming.data || {};
  
  // Find the index of the next section to generate (for skeleton)
  const nextIdx = STREAMING_SECTION_CONFIG.findIndex(s => !completed.includes(s.key));

  return (
    <div className="px-6 py-6 space-y-4">
      {/* Generating badge */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-[#024CDB] rounded-full animate-pulse" />
          <span className="text-sm font-semibold text-[#024CDB]">Generating summary...</span>
        </div>
        <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-[#024CDB] rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.round((completed.length / STREAMING_SECTION_CONFIG.length) * 100)}%` }}
          />
        </div>
        <span className="text-xs text-gray-400">{completed.length}/{STREAMING_SECTION_CONFIG.length}</span>
      </div>

      {/* Completed sections */}
      {STREAMING_SECTION_CONFIG.map((section, idx) => {
        const isCompleted = completed.includes(section.key);
        const isNext = idx === nextIdx;
        
        if (!isCompleted && !isNext) return null; // Hide future sections

        if (!isCompleted && isNext) {
          // Skeleton card for the next section being generated
          return (
            <div key={section.key} className="border border-gray-200 bg-white rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#024CDB] rounded-full animate-pulse" />
                  <h3 className="font-semibold text-gray-400">{section.title}</h3>
                </div>
              </div>
              <div className="px-4 py-3 space-y-2">
                <div className="h-3 bg-gray-200 rounded-full animate-pulse w-3/4" />
                <div className="h-3 bg-gray-200 rounded-full animate-pulse w-1/2" style={{ animationDelay: '150ms' }} />
                <div className="h-3 bg-gray-200 rounded-full animate-pulse w-2/3" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          );
        }

        // Completed section — render it
        const rendered = section.render(data[section.key]);
        if (rendered === null) return null; // Skip sections that return null (e.g., empty examination_findings)

        const isFlag = section.key === 'flags_for_review';

        return (
          <div 
            key={section.key}
            className={`border rounded-lg overflow-hidden animate-[fadeIn_0.4s_ease-out] ${
              isFlag ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
            }`}
          >
            <div className={`px-4 py-3 border-b ${isFlag ? 'border-red-200 bg-red-100/50' : 'border-gray-200 bg-gray-50'}`}>
              <h3 className={`font-semibold ${isFlag ? 'text-red-800' : 'text-gray-900'}`}>{section.title}</h3>
            </div>
            <div className="px-4 py-3">
              <p className={`text-[15px] whitespace-pre-line leading-relaxed ${isFlag ? 'text-red-800 font-medium text-sm' : 'text-gray-700'}`}>
                {rendered}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProcessingState({ consult, uiNow, onRetryOptimistic }: { consult: ConsultRow; uiNow: number; onRetryOptimistic: (consultId: string) => void }) {
  const [isRetrying, setIsRetrying] = useState(false);
  // OPTIMISTIC STATE: Holds the instant UI reset so we don't have to wait for the network
  const [optimisticConsult, setOptimisticConsult] = useState<ConsultRow | null>(null);

  // If the real database sends us a new update via WebSockets, clear our optimistic fake state
  useEffect(() => {
    setOptimisticConsult(null);
  }, [consult.status, consult.updated_at]);

  // Always use the optimistic version if it exists, otherwise use the real DB one
  const activeConsult = optimisticConsult || consult;

  const elapsed = getElapsedSeconds(activeConsult, uiNow);
  const isError = isConsultError(activeConsult, uiNow);
  const takingLonger = !isError && elapsed > ESTIMATED_PROCESS_SECONDS;
  const pct = isError ? 100 : getProgressPercent(activeConsult, uiNow);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const newTime = new Date().toISOString();

      // 1. INSTANT UI UPDATE: Reset the progress bar locally right now
      setOptimisticConsult({
        ...consult,
        status: 'Processing',
        updated_at: newTime
      });

      // 2. Update parent cards array so closing the popup shows Processing not Error
      onRetryOptimistic(consult.id);

      // 3. UPDATE DB: Reset the timer and clear the old execution ID

      // 2. UPDATE DB: Reset the timer and clear the old execution ID
      await import('../../lib/supabase').then(({ supabase }) => 
        supabase
          .from('consult')
          .update({ 
            status: 'Processing',
            updated_at: newTime,
            n8n_execution_id: null // Clear the old tracking ID so it doesn't conflict
          })
          .eq('id', consult.id)
      );

     // 3. TRIGGER n8n: Fire the webhook again
      await fetch('https://atblink.app.n8n.cloud/webhook/voice_op', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record: { 
            id: consult.id,
            doc_id: 'e34a9b39-1b59-48c2-be29-42dc52c03f00'
          }
        })
      });
    } catch (error) {
      console.error("Retry failed:", error);
      setOptimisticConsult(null); // Revert the UI if the network failed completely
      alert("Failed to trigger retry. Please check your connection and try again.");
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-3">
        <p className="text-sm font-semibold text-gray-900">
          {isError
            ? 'Consultation summary failed'
                        : `Preparing consultation summary: ${getDisplayedElapsed(activeConsult, uiNow)}s`}
        </p>
      </div> 
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div 
          className={`h-3 rounded-full transition-all duration-500 ease-out ${isError ? 'bg-red-500' : 'bg-[#024CDB]'}`} 
          style={{ width: `${pct}%` }} 
        />
      </div>
      <div className="mt-3 text-center">
        {isError ? (
          <div className="flex flex-col items-center gap-4 mt-2">
            <p className="text-sm font-semibold text-red-600">
              There was an issue analyzing the recording. Spikes in AI demand are usually temporary.
            </p>
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="flex items-center gap-2 px-4 py-2 bg-[#024CDB] hover:bg-[#023BA3] disabled:bg-gray-400 text-white rounded-md text-sm font-medium transition-colors"
            >
              <History className="w-4 h-4" />
              {isRetrying ? 'Retrying...' : 'Retry Processing'}
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600">It takes around 60 sec to prepare the consultation summary.</p>
            {takingLonger && <p className="text-sm mt-1 font-medium text-red-600">Taking longer than expected…</p>}
          </>
        )}
      </div>
      <div className="mt-4 text-center text-xs text-gray-500">
        {isError ? 'Please click retry to process the audio again.' : 'You can keep this open — it will auto-update when ready.'}
      </div>
    </div>
  );
}