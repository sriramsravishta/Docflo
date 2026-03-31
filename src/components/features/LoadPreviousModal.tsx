import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import Spinner from '../ui/Spinner';
import { getPreviousConsultMedicines } from '../../lib/database';
import type { ConsultMedicineRow } from '../../types/db';

interface LoadPreviousModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (medicines: ConsultMedicineRow[]) => void;
  patientId: string;
  currentConsultId: string;
}

export default function LoadPreviousModal({ isOpen, onClose, onAdd, patientId, currentConsultId }: LoadPreviousModalProps) {
  const [medicines, setMedicines] = useState<ConsultMedicineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    setSelected(new Set());
    setLoading(true);
    getPreviousConsultMedicines(patientId, currentConsultId)
      .then(setMedicines)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isOpen, patientId, currentConsultId]);

  if (!isOpen) return null;

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
          <h2 className="text-lg font-semibold text-gray-900">Load Previous Medicines</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner size="sm" /></div>
          ) : medicines.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-500">
              No previous consultation medicines found for this patient.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {medicines.map((med) => (
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
                    <p className="text-sm font-medium text-gray-900 truncate">{med.name || '(unnamed)'}</p>
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
