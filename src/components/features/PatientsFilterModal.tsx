import { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { getAllCanonicalDiagnoses } from '../../lib/database';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  docId: string;
  selected: string[];
  onApply: (selected: string[]) => void;
}

export default function DiagnosisFilterModal({ isOpen, onClose, docId, selected, onApply }: Props) {
  const [allDiagnoses, setAllDiagnoses] = useState<{ canonical: string; count: number }[]>([]);
  const [search, setSearch] = useState('');
  const [localSelected, setLocalSelected] = useState<string[]>(selected);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLocalSelected(selected);
    setLoading(true);
    getAllCanonicalDiagnoses(docId)
      .then(setAllDiagnoses)
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [isOpen, docId, selected]);

  if (!isOpen) return null;

  const filtered = allDiagnoses.filter((d) =>
    d.canonical.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (canonical: string) => {
    setLocalSelected((prev) =>
      prev.includes(canonical) ? prev.filter((x) => x !== canonical) : [...prev, canonical]
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">Filter by Diagnosis</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search diagnoses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#024CDB] focus:border-transparent text-sm"
          />
        </div>

        {localSelected.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {localSelected.map((d) => (
              <span
                key={d}
                className="inline-flex items-center gap-1 bg-[#024CDB] text-white text-xs font-medium px-2 py-1 rounded-full"
              >
                {d}
                <button onClick={() => toggle(d)} className="hover:text-gray-200">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto -mx-2">
          {loading ? (
            <p className="text-sm text-gray-500 text-center py-8">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              {search ? 'No matching diagnoses' : 'No diagnoses on record yet'}
            </p>
          ) : (
            <div className="space-y-1">
              {filtered.map((d) => {
                const checked = localSelected.includes(d.canonical);
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
                        onChange={() => toggle(d.canonical)}
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
        </div>

        <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
          <button
            onClick={() => {
              setLocalSelected([]);
              onApply([]);
              onClose();
            }}
            className="flex-1 btn-secondary text-sm"
          >
            Clear
          </button>
          <button
            onClick={() => {
              onApply(localSelected);
              onClose();
            }}
            className="flex-1 btn-primary text-sm"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}