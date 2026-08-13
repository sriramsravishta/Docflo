import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getOutcomes, updateOutcome } from '../../lib/database';
import Spinner from '../ui/Spinner';
import type { ConsultOutcomeRow, OutcomeStatus, SurgeryStatus } from '../../types/db';

function getTodayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

function safeGetDiagnosis(row: ConsultOutcomeRow): string {
  try {
    const raw = row.consult?.consult_summary_final;
    if (!raw) return '—';
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const diag = obj?.diagnosis;
    if (typeof diag === 'string' && diag.trim()) return diag.slice(0, 45);
    if (diag?.provisional?.[0]) return String(diag.provisional[0]).slice(0, 45);
    return '—';
  } catch {
    return '—';
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

const OUTCOME_LABELS: Record<OutcomeStatus, string> = {
  prescription_only: 'Prescription',
  investigation_ordered: 'Investigation',
  procedure_advised: 'Surgery Advised',
  procedure_agreed: 'Surgery Agreed',
  follow_up_scheduled: 'Follow-up',
  referred_out: 'Referred Out',
};

const OUTCOME_PILL: Record<OutcomeStatus, string> = {
  prescription_only: 'bg-blue-100 text-blue-700',
  investigation_ordered: 'bg-amber-100 text-amber-700',
  procedure_advised: 'bg-purple-100 text-purple-700',
  procedure_agreed: 'bg-purple-200 text-purple-800',
  follow_up_scheduled: 'bg-green-100 text-green-700',
  referred_out: 'bg-gray-200 text-gray-700',
};

const SURGERY_STATUS_LABELS: Record<SurgeryStatus, string> = {
  pending: 'Pending',
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

type SubTab = 'all' | 'surgery' | 'investigation_ordered' | 'follow_up_scheduled' | 'prescription_only' | 'referred_out';

export default function SummaryTab({ docId }: { docId: string }) {
  const navigate = useNavigate();
  const [outcomes, setOutcomes] = useState<ConsultOutcomeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('all');
  const [showFilter, setShowFilter] = useState(false);
  const [filterMode, setFilterMode] = useState<'today' | 'specific' | 'range'>('specific');
  const [filterDate, setFilterDate] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [appliedMode, setAppliedMode] = useState<'today' | 'specific' | 'range'>('specific');
  const [appliedDate, setAppliedDate] = useState('');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchOutcomes = useCallback(async () => {
    try {
      let start: string | undefined;
      let end: string | undefined;
      if (appliedMode === 'today') {
        const b = getTodayBounds();
        start = b.startISO;
        end = b.endISO;
      } else if (appliedMode === 'specific' && appliedDate) {
        const d = new Date(appliedDate);
        d.setHours(0, 0, 0, 0);
        const e = new Date(appliedDate);
        e.setHours(23, 59, 59, 999);
        start = d.toISOString();
        end = e.toISOString();
      } else if (appliedMode === 'range') {
        if (appliedFrom) {
          const f = new Date(appliedFrom);
          f.setHours(0, 0, 0, 0);
          start = f.toISOString();
        }
        if (appliedTo) {
          const t = new Date(appliedTo);
          t.setHours(23, 59, 59, 999);
          end = t.toISOString();
        }
      }
      const data = await getOutcomes(docId, start, end);
      setOutcomes(data);
    } catch (e) {
      console.error('Error fetching outcomes:', e);
    } finally {
      setLoading(false);
    }
  }, [docId, appliedMode, appliedDate, appliedFrom, appliedTo]);

  useEffect(() => {
    setLoading(true);
    fetchOutcomes();
  }, [fetchOutcomes]);

  useEffect(() => {
    const channel = supabase
      .channel('consult-outcomes-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consult_outcomes', filter: `doc_id=eq.${docId}` }, () => {
        fetchOutcomes();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [docId, fetchOutcomes]);

  const applyFilter = () => {
    setAppliedMode(filterMode);
    setAppliedDate(filterDate);
    setAppliedFrom(filterFrom);
    setAppliedTo(filterTo);
    setShowFilter(false);
  };

  const clearFilter = () => {
    setFilterMode('today');
    setFilterDate('');
    setFilterFrom('');
    setFilterTo('');
    setAppliedMode('today');
    setAppliedDate('');
    setAppliedFrom('');
    setAppliedTo('');
    setShowFilter(false);
  };

  const hasActiveFilter = appliedMode !== 'today';

  const filtered = outcomes.filter((o) => {
    if (activeSubTab === 'all') return true;
    if (activeSubTab === 'surgery') return o.outcome_status === 'procedure_advised' || o.outcome_status === 'procedure_agreed';
    return o.outcome_status === activeSubTab;
  });

  const counts = {
    all: outcomes.length,
    surgery: outcomes.filter((o) => o.outcome_status === 'procedure_advised' || o.outcome_status === 'procedure_agreed').length,
    investigation_ordered: outcomes.filter((o) => o.outcome_status === 'investigation_ordered').length,
    follow_up_scheduled: outcomes.filter((o) => o.outcome_status === 'follow_up_scheduled').length,
    prescription_only: outcomes.filter((o) => o.outcome_status === 'prescription_only').length,
    referred_out: outcomes.filter((o) => o.outcome_status === 'referred_out').length,
  };

  const handleFieldUpdate = async (id: string, field: string, value: unknown) => {
    setSavingId(id);
    setOutcomes((prev) => prev.map((o) => (o.id === id ? { ...o, [field]: value } : o)));
    try {
      await updateOutcome(id, { [field]: value } as Parameters<typeof updateOutcome>[1]);
    } catch (e) {
      console.error('Error saving outcome field:', e);
    } finally {
      setSavingId(null);
    }
  };

  const subTabs: { key: SubTab; label: string }[] = [
    { key: 'all', label: `All (${counts.all})` },
    { key: 'surgery', label: `Surgery (${counts.surgery})` },
    { key: 'investigation_ordered', label: `Investigations (${counts.investigation_ordered})` },
    { key: 'follow_up_scheduled', label: `Follow-up (${counts.follow_up_scheduled})` },
    { key: 'prescription_only', label: `Prescription (${counts.prescription_only})` },
    { key: 'referred_out', label: `Referred Out (${counts.referred_out})` },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tabs + filter row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-1">
          {subTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveSubTab(tab.key)}
              className={`shrink-0 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                activeSubTab === tab.key
                  ? 'bg-[#024CDB] text-white border-[#024CDB]'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasActiveFilter && (
            <button onClick={clearFilter} className="text-xs text-gray-500 hover:text-gray-700 underline">
              Clear
            </button>
          )}
          <button
            onClick={() => setShowFilter(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
              hasActiveFilter
                ? 'bg-[#024CDB] text-white border-[#024CDB]'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            {hasActiveFilter ? 'Filtered' : 'Filter'}
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-gray-200">
          <div className="flex-1 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Patients Seen</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{counts.all}</p>
          </div>
          <div className="flex-1 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Surgery</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{counts.surgery}</p>
          </div>
          <div className="flex-1 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Investigations</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{counts.investigation_ordered}</p>
          </div>
          <div className="flex-1 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Follow-ups</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{counts.follow_up_scheduled}</p>
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="md" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-gray-500">No outcomes for the selected filter</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Time</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Patient</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Diagnosis</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Outcome</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Action Needed</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Follow-up</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Surgery Date</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {formatTime(row.consult?.created_at || row.created_at)}
                        {savingId === row.id && <span className="ml-1 text-xs text-[#024CDB]">saving…</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => navigate(`/patient/${row.patient_id}`)}
                          className="text-sm font-medium text-[#024CDB] hover:underline text-left"
                        >
                          {row.patients?.name || '—'}
                        </button>
                        <p className="text-xs text-gray-500">{row.patients?.age}y · {row.patients?.gender}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 max-w-[140px] truncate">
                        {safeGetDiagnosis(row)}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={row.outcome_status}
                          onChange={(e) => handleFieldUpdate(row.id, 'outcome_status', e.target.value)}
                          className={`text-xs font-semibold px-2 py-1 rounded-full border-0 outline-none cursor-pointer ${OUTCOME_PILL[row.outcome_status]}`}
                        >
                          {(Object.keys(OUTCOME_LABELS) as OutcomeStatus[]).map((s) => (
                            <option key={s} value={s}>{OUTCOME_LABELS[s]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          defaultValue={row.action_needed || ''}
                          onBlur={(e) => { if (e.target.value !== (row.action_needed || '')) { handleFieldUpdate(row.id, 'action_needed', e.target.value || null); } }}
                          className="text-sm text-gray-700 w-full bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-[#024CDB] focus:outline-none py-0.5 min-w-[120px]"
                          placeholder="—"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="date"
                          defaultValue={row.follow_up_date || ''}
                          onBlur={(e) => { if (e.target.value !== (row.follow_up_date || '')) { handleFieldUpdate(row.id, 'follow_up_date', e.target.value || null); } }}
                          className="text-sm text-gray-700 bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-[#024CDB] focus:outline-none py-0.5"
                        />
                      </td>
                      <td className="px-4 py-3">
                        {(row.outcome_status === 'procedure_advised' || row.outcome_status === 'procedure_agreed') ? (
                          <div className="space-y-1">
                            <input
                              type="date"
                              defaultValue={row.surgery_date || ''}
                              onBlur={(e) => { if (e.target.value !== (row.surgery_date || '')) { handleFieldUpdate(row.id, 'surgery_date', e.target.value || null); } }}
                              className="text-sm text-gray-700 bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-[#024CDB] focus:outline-none py-0.5 block"
                            />
                            {row.surgery_date && (
                              <select
                                value={row.surgery_status || 'pending'}
                                onChange={(e) => handleFieldUpdate(row.id, 'surgery_status', e.target.value)}
                                className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded px-1 py-0.5 mt-1"
                              >
                                {(Object.keys(SURGERY_STATUS_LABELS) as SurgeryStatus[]).map((s) => (
                                  <option key={s} value={s}>{SURGERY_STATUS_LABELS[s]}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          defaultValue={row.notes || ''}
                          onBlur={(e) => { if (e.target.value !== (row.notes || '')) { handleFieldUpdate(row.id, 'notes', e.target.value || null); } }}
                          className="text-sm text-gray-700 w-full bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-[#024CDB] focus:outline-none py-0.5 min-w-[120px]"
                          placeholder="Add notes…"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((row) => (
              <div key={row.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <button
                      onClick={() => navigate(`/patient/${row.patient_id}`)}
                      className="font-medium text-[#024CDB] hover:underline text-left"
                    >
                      {row.patients?.name || '—'}
                    </button>
                    <p className="text-xs text-gray-500">{row.patients?.age}y · {row.patients?.gender} · {formatTime(row.consult?.created_at || row.created_at)}</p>
                  </div>
                  <select
                    value={row.outcome_status}
                    onChange={(e) => handleFieldUpdate(row.id, 'outcome_status', e.target.value)}
                    className={`text-xs font-semibold px-2 py-1 rounded-full border-0 outline-none cursor-pointer shrink-0 ${OUTCOME_PILL[row.outcome_status]}`}
                  >
                    {(Object.keys(OUTCOME_LABELS) as OutcomeStatus[]).map((s) => (
                      <option key={s} value={s}>{OUTCOME_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                <p className="text-sm text-gray-700">{safeGetDiagnosis(row)}</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Action Needed</p>
                    <input
                      type="text"
                      defaultValue={row.action_needed || ''}
                      onBlur={(e) => { if (e.target.value !== (row.action_needed || '')) { handleFieldUpdate(row.id, 'action_needed', e.target.value || null); } }}
                      className="w-full text-sm text-gray-700 border-b border-gray-200 focus:border-[#024CDB] focus:outline-none bg-transparent"
                      placeholder="—"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Follow-up</p>
                    <input
                      type="date"
                      defaultValue={row.follow_up_date || ''}
                      onBlur={(e) => { if (e.target.value !== (row.follow_up_date || '')) { handleFieldUpdate(row.id, 'follow_up_date', e.target.value || null); } }}
                      className="w-full text-sm text-gray-700 border-b border-gray-200 focus:border-[#024CDB] focus:outline-none bg-transparent"
                    />
                  </div>
                  {(row.outcome_status === 'procedure_advised' || row.outcome_status === 'procedure_agreed') && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Surgery Date</p>
                      <input
                        type="date"
                        defaultValue={row.surgery_date || ''}
                        onBlur={(e) => { if (e.target.value !== (row.surgery_date || '')) { handleFieldUpdate(row.id, 'surgery_date', e.target.value || null); } }}
                        className="w-full text-sm text-gray-700 border-b border-gray-200 focus:border-[#024CDB] focus:outline-none bg-transparent"
                      />
                    </div>
                  )}
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 mb-0.5">Notes</p>
                    <input
                      type="text"
                      defaultValue={row.notes || ''}
                      onBlur={(e) => { if (e.target.value !== (row.notes || '')) { handleFieldUpdate(row.id, 'notes', e.target.value || null); } }}
                      className="w-full text-sm text-gray-700 border-b border-gray-200 focus:border-[#024CDB] focus:outline-none bg-transparent"
                      placeholder="Add notes…"
                    />
                  </div>
                </div>
                {savingId === row.id && <p className="text-xs text-[#024CDB]">Saving…</p>}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Date filter modal */}
      {showFilter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowFilter(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">Filter by Date</h3>
              <button onClick={() => setShowFilter(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-5">
              {(['specific', 'range'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setFilterMode(m)}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${filterMode === m ? 'bg-[#024CDB] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {m === 'specific' ? 'Specific Date' : 'Date Range'}
              </button>
            ))}
            </div>
            {filterMode === 'specific' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="input-field" />
              </div>
            )}
            {filterMode === 'range' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                  <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                  <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="input-field" />
                </div>
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button onClick={clearFilter} className="flex-1 btn-secondary text-sm">Clear</button>
              <button onClick={applyFilter} className="flex-1 btn-primary text-sm">Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}