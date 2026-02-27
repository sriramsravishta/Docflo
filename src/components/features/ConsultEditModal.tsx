import { useLayoutEffect, useRef } from 'react';
import { X, Plus, Save, XCircle, ChevronDown, Trash2 } from 'lucide-react';
import type { ConsultRow, ConsultMedicineRow } from '../../types/db';
import { FREQUENCY_OPTIONS, FOOD_OPTIONS, TIME_OPTIONS, normalizeTime } from '../../lib/utils';

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

interface ConsultEditModalProps {
  consult: ConsultRow;
  editedConsult: Record<string, unknown>;
  setEditedConsult: (v: Record<string, unknown>) => void;
  editedDiagnosisText: string;
  setEditedDiagnosisText: (v: string) => void;
  editedTreatmentText: string;
  setEditedTreatmentText: (v: string) => void;
  editedInvestigationsText: string;
  setEditedInvestigationsText: (v: string) => void;
  consultMedicines: ConsultMedicineRow[];
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
  onCancel: () => void;
  onSave: () => void;
  formatDate: (s: string) => string;
}

function AutoResizeTextarea({
  value,
  onChange,
  minRows = 3,
  maxHeight = 560,
  className = '',
  fillParent = false,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  minRows?: number;
  maxHeight?: number;
  className?: string;
  fillParent?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const resize = () => {
    const el = ref.current;
    if (!el) return;

    el.style.height = 'auto';

    const cs = window.getComputedStyle(el);
    const lineHeight = parseFloat(cs.lineHeight || '20') || 20;
    const minHeight = Math.ceil(lineHeight * minRows + 16);
    const nextHeight = Math.min(el.scrollHeight, maxHeight);

    if (!fillParent) {
      el.style.minHeight = `${minHeight}px`;
      el.style.height = `${Math.max(nextHeight, minHeight)}px`;
      el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
      return;
    }

    // fill-parent mode: match card body height too
    const parent = el.parentElement as HTMLElement | null;
    if (!parent) return;

    const pcs = window.getComputedStyle(parent);
    const padY = (parseFloat(pcs.paddingTop || '0') || 0) + (parseFloat(pcs.paddingBottom || '0') || 0);
    const avail = Math.max(0, parent.clientHeight - padY);

    const target = Math.max(minHeight, nextHeight, avail);

    el.style.minHeight = `${minHeight}px`;
    el.style.height = `${Math.min(target, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  };

  useLayoutEffect(() => {
    resize();
  }, [value, minRows, maxHeight, fillParent]);

  // ✅ KEY: re-run resize when the parent/card grows because the other column grew
  useLayoutEffect(() => {
    if (!fillParent) return;
    const el = ref.current;
    const parent = el?.parentElement as HTMLElement | null;
    if (!el || !parent || typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver(() => resize());
    ro.observe(parent);

    return () => ro.disconnect();
  }, [fillParent]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => {
        onChange(e);
        requestAnimationFrame(resize);
      }}
      className={`input-field resize-none bg-gray-50 focus:bg-white ${className}`}
    />
  );
}

function Card({
  title,
  children,
  right,
  fullWidth = false,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={[
        'border border-gray-200 rounded-lg overflow-hidden bg-white flex flex-col min-h-[220px]',
        fullWidth ? 'lg:col-span-2' : '',
      ].join(' ')}
    >
      <div className="px-4 py-3 border-b border-gray-200 bg-white/60 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {right}
      </div>
      <div className="px-4 py-4 flex-1 min-h-0">{children}</div>
    </div>
  );
}

export default function ConsultEditModal({
  consult,
  editedConsult,
  setEditedConsult,
  editedDiagnosisText,
  setEditedDiagnosisText,
  editedTreatmentText,
  setEditedTreatmentText,
  editedInvestigationsText,
  setEditedInvestigationsText,
  consultMedicines,
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
  onCancel,
  onSave,
  formatDate,
}: ConsultEditModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      {/* ✅ No bottom “gap”: modal is a flex column with its own scroll area */}
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header (same language as View modal) */}
        <div className="shrink-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Edit Consultation Summary</h2>
              <p className="text-sm text-gray-600">{formatDate(consult.created_at)}</p>
            </div>
            <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Scrollable content (footer does NOT overlay, so last content never hides) */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 pt-6 pb-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card title="Diagnosis">
                <AutoResizeTextarea
                  value={editedDiagnosisText}
                  onChange={(e) => setEditedDiagnosisText(e.target.value)}
                  minRows={6}
                  maxHeight={560}
                  fillParent
                />
              </Card>

              <Card title="Chief Complaints">
                <AutoResizeTextarea
                  value={(editedConsult?.chief_complaints as string) || ''}
                  onChange={(e) => setEditedConsult({ ...editedConsult, chief_complaints: e.target.value })}
                  minRows={6}
                  maxHeight={560}
                  fillParent
                />
              </Card>

              <Card title="Treatment Suggested">
                <AutoResizeTextarea
                  value={editedTreatmentText}
                  onChange={(e) => setEditedTreatmentText(e.target.value)}
                  minRows={6}
                  maxHeight={560}
                  fillParent
                />
              </Card>

              {/* ✅ Investigations ABOVE medications (matches View modal order) */}
              <Card title="Investigations">
                <AutoResizeTextarea
                  value={editedInvestigationsText}
                  onChange={(e) => setEditedInvestigationsText(e.target.value)}
                  minRows={6}
                  maxHeight={560}
                  fillParent
                />
              </Card>

              {/* ✅ Medications FULL WIDTH */}
              <Card
                title="Medications"
                fullWidth
                right={
                  <button
                    onClick={onAddMedicine}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Medicine</span>
                  </button>
                }
              >
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
                    };

                    return (
                      <div key={medicine.id} className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-semibold text-gray-900">Medicine {index + 1}</span>
                          <button
                            onClick={() => onDeleteMedicine(medicine.id)}
                            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
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
                              placeholder="e.g. 500 mg"
                            />
                          </div>

                          <div className="min-w-[120px] flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                            <input
                              type="text"
                              value={d.quantity}
                              onChange={(e) => updateMedicineDraft(medicine.id, { quantity: e.target.value })}
                              className="input-field bg-gray-50 focus:bg-white"
                              placeholder="e.g. 1 tab"
                            />
                          </div>

                          <div className="min-w-[120px] flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                            <input
                              type="text"
                              value={d.type}
                              onChange={(e) => updateMedicineDraft(medicine.id, { type: e.target.value })}
                              className="input-field bg-gray-50 focus:bg-white"
                              placeholder="e.g. Tablet"
                            />
                          </div>

                          <div className="min-w-[120px] flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                            <select
                              value={d.frequency}
                              onChange={(e) => updateMedicineDraft(medicine.id, { frequency: e.target.value })}
                              className="input-field bg-gray-50 focus:bg-white"
                            >
                              <option value="" disabled>
                                Select frequency
                              </option>
                              {FREQUENCY_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
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
                              <option value="" disabled>
                                Select food instruction
                              </option>
                              {FOOD_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
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
                              placeholder="e.g. 7 days"
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
                                      <label
                                        key={opt}
                                        className="flex items-center gap-2 px-2 py-2 rounded hover:bg-gray-50 cursor-pointer"
                                      >
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
                              placeholder="e.g. AF"
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
              </Card>

              {/* ✅ History FULL WIDTH */}
              <Card title="History" fullWidth>
                <AutoResizeTextarea
                  value={(editedConsult?.history as string) || ''}
                  onChange={(e) => setEditedConsult({ ...editedConsult, history: e.target.value })}
                  minRows={6}
                  maxHeight={560}
                  fillParent
                />
              </Card>

              {/* Follow-up (keep half width like view layout) */}
              <Card title="Follow-up Recommendations">
                <AutoResizeTextarea
                  value={(editedConsult?.followup_recommendations as string) || ''}
                  onChange={(e) => setEditedConsult({ ...editedConsult, followup_recommendations: e.target.value })}
                  minRows={6}
                  maxHeight={560}
                  fillParent
                />
              </Card>
            </div>
          </div>
        </div>

        {/* Footer (no gap below) */}
        <div className="shrink-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button onClick={onCancel} className="btn-secondary flex items-center space-x-2">
            <XCircle className="w-4 h-4" />
            <span>Cancel</span>
          </button>
          <button onClick={onSave} className="btn-primary flex items-center space-x-2">
            <Save className="w-4 h-4" />
            <span>Save Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
}