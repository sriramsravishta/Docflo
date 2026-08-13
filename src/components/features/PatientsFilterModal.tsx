import { useState, useEffect } from 'react';
import { X, Search, Calendar } from 'lucide-react';
import { getAllCanonicalDiagnoses } from '../../lib/database';

export interface AppliedFilters {
  dateMode: 'none' | 'specific' | 'range';
  date: string;
  from: string;
  to: string;
  diagnoses: string[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  docId: string;
  applied: AppliedFilters;
  onApply: (filters: AppliedFilters) => void;
}

export default function PatientsFilterModal({ isOpen, onClose, docId, applied, onApply }: Props) {
  const [tab, setTab] = useState<'date' | 'diagnosis'>('diagnosis');
  const [allDiagnoses, setAllDiagnoses] = useState<{ canonical: string; count: number }[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const [dateMode, setDateMode] = useState<'none' | 'specific' | 'range'>('none');
  const [date, setDate] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setDateMode(applied.dateMode);
    setDate(applied.date);
    setFrom(applied.from);
    setTo(applied.to);
    setSelectedDiagnoses(applied.diagnoses);
    setLoading(true);
    getAllCanonicalDiagnoses(docId)
      .then(setAllDiagnoses)
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [isOpen, docId, applied]);

  if (!isOpen) return null;

  const filteredDiags = allDiagnoses.filter((d) =>
    d.canonical.toLowerCase().includes(search.toLowerCase())
  );

  const toggleDiag = (canonical: string) => {
    setSelectedDiagnoses((prev) =>
      prev.includes(canonical) ? prev.filter((x) => x !== canonical) : [...prev, canonical]
    );
  };

  const handleApply = () => {
    onApply({ dateMode, date, from, to, diagnoses: selectedDiagnoses });
    onClose();
  };

  const handleClear = () => {
    const empty: AppliedFilters = { dateMode: 'none', date: '', from: '', to: '', diagnoses: [] };
    setDateMode('none');
    setDate('');
    setFrom('');
    setTo('');
    setSelectedDiagnoses([]);
    onApply(empty);
    onClose();
  };

  const activeDateCount = dateMode !== 'none' ? 1 : 0;
  const activeDiagCount = selectedDiagnoses.length;
  const totalActive = activeDateCount + activeDiagCount;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">
            Filters {totalActive > 0 && <span className="text-[#024CDB]">({totalActive})</span>}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setTab('diagnosis')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === 'diagnosis'
                ? 'text-[#024CDB] border-b-2 border-[#024CDB]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Diagnosis {activeDiagCount > 0 && `(${activeDiagCount})`}
          </button>
          <button
            onClick={() => setTab('date')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === 'date'
                ? 'text-[#024CDB] border-b-2 border-[#024CDB]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Visit Date {activeDateCount > 0 && '(1)'}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {tab === 'diagnosis' ? (
            <>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search diagnoses..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#024CDB] focus:border-transparent text-sm"
                />
              </div>

              {selectedDiagnoses.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {selectedDiagnoses.map((d) => (
                    <span
                      key={d}
                      className="inline-flex items-center gap-1 bg-[#024CDB] text-white text-xs font-medium px-2 py-1 rounded-full"
                    >
                      {d}
                      <button onClick={() => toggleDiag(d)} className="hover:text-gray-200">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {loading ? (
                <p className="text-sm text-gray-500 text-center py-8">Loading…</p>
              ) : filteredDiags.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  {search ? 'No matching diagnoses' : 'No diagnoses on record yet'}
                </p>
              ) : (
                <div className="space-y-1">
                  {filteredDiags.map((d) => {
                    const checked = selectedDiagnoses.includes(d.canonical);
                    return (
                      <label
                        key={d.canonical}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                          checked ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleDiag(d.canonical)}
                            className="rounded"
                          />
                          <span className="text-sm text-gray-800">{d.canonical}</span>
                        </div>
                        <span className="text-xs text-gray-500">{d.count}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-4">
                {(['none', 'specific', 'range'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setDateMode(m)}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${
                      dateMode === m
                        ? 'bg-[#024CDB] text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {m === 'none' ? 'Any date' : m === 'specific' ? 'Specific' : 'Range'}
                  </button>
                ))}
              </div>

              {dateMode === 'specific' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Visit Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="input-field"
                  />
                </div>
              )}

              {dateMode === 'range' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                    <input
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                    <input
                      type="date"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      className="input-field"
                    />
                  </div>
                </div>
              )}

              {dateMode === 'none' && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No date filter applied. All patients shown regardless of visit date.
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={handleClear} className="flex-1 btn-secondary text-sm">
            Clear All
          </button>
          <button onClick={handleApply} className="flex-1 btn-primary text-sm">
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}