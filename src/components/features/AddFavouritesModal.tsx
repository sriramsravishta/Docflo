import { useEffect, useState } from 'react';
import { X, Search } from 'lucide-react';
import Spinner from '../ui/Spinner';
import { getFavouriteMedicines, type FavouriteMedicineRow } from '../../lib/database';

interface AddFavouritesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (medicines: FavouriteMedicineRow[]) => void;
  docId: string;
}

function parseTimeString(val: string): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return val.split(',').map((s) => s.trim()).filter(Boolean);
}

export { parseTimeString };

export default function AddFavouritesModal({ isOpen, onClose, onAdd, docId }: AddFavouritesModalProps) {
  const [medicines, setMedicines] = useState<FavouriteMedicineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    setSearch('');
    setSelected(new Set());
    setLoading(true);
    getFavouriteMedicines(docId)
      .then(setMedicines)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isOpen, docId]);

  if (!isOpen) return null;

  const filtered = medicines.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    const chosen = medicines.filter((m) => selected.has(m.id));
    onAdd(chosen);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Add Favourites</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 bg-gray-50 focus:bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#024CDB]"
              placeholder="Search favourites..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner size="sm" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-500">
              {medicines.length === 0 ? 'No favourite medicines saved yet.' : 'No matches found.'}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map((med) => (
                <label
                  key={med.id}
                  className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(med.id)}
                    onChange={() => toggleSelect(med.id)}
                    className="w-4 h-4 rounded border-gray-300 text-[#024CDB] focus:ring-[#024CDB]"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{med.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {[med.dosage, med.frequency, med.duration].filter(Boolean).join(' · ') || 'No details'}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <span className="text-sm text-gray-500">{selected.size} selected</span>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
            <button
              onClick={handleAdd}
              disabled={selected.size === 0}
              className="btn-primary text-sm disabled:opacity-50"
            >
              Add Selected
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
