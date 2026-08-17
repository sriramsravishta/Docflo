import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { FREQUENCY_OPTIONS, FOOD_OPTIONS, TIME_OPTIONS } from '../../lib/utils';
import type { FavouriteMedicineRow } from '../../lib/database';

interface FavouriteMedicineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: FavouriteMedicineFormData) => void;
  initial?: FavouriteMedicineRow | null;
  isSaving?: boolean;
}

export interface FavouriteMedicineFormData {
  name: string;
  dosage: string;
  quantity: string;
  type: string;
  frequency: string;
  food: string;
  time: string[];
  duration: string;
  instructions: string;
}

function parseTimeString(val: string): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return val.split(',').map((s) => s.trim()).filter(Boolean);
}

export default function FavouriteMedicineModal({
  isOpen,
  onClose,
  onSave,
  initial,
  isSaving,
}: FavouriteMedicineModalProps) {
  const [form, setForm] = useState<FavouriteMedicineFormData>({
    name: '',
    dosage: '',
    quantity: '',
    type: '',
    frequency: '',
    food: '',
    time: [],
    duration: '',
    instructions: '',
  });
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const [error, setError] = useState('');
  const timeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name || '',
        dosage: initial.dosage || '',
        quantity: initial.quantity || '',
        type: initial.type || '',
        frequency: initial.frequency || '',
        food: initial.food || '',
        time: parseTimeString(initial.time || ''),
        duration: initial.duration || '',
        instructions: initial.instructions || '',
      });
    } else {
      setForm({
        name: '', dosage: '', quantity: '', type: '',
        frequency: '', food: '', time: [], duration: '', instructions: '',
      });
    }
    setError('');
  }, [initial, isOpen]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (timeRef.current && !timeRef.current.contains(e.target as Node)) {
        setShowTimeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSubmit = () => {
    if (!form.name.trim()) {
      setError('Medicine name is required');
      return;
    }
    onSave(form);
  };

  if (!isOpen) return null;

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-gray-300 bg-gray-50 focus:bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#024CDB] transition-colors';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {initial ? 'Edit Favourite Medicine' : 'Add Favourite Medicine'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className={labelClass}>Name *</label>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => { setForm({ ...form, name: e.target.value }); setError(''); }}
              placeholder="Medicine name"
            />
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Dosage</label>
              <input className={inputClass} value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} placeholder="e.g. 500mg" />
            </div>
            <div>
              <label className={labelClass}>Quantity</label>
              <input className={inputClass} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="e.g. 30 tablets" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Type</label>
              <input className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="e.g. Tablet, Syrup" />
            </div>
            <div>
              <label className={labelClass}>Frequency</label>
              <select className={inputClass} value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
                <option value="">Select</option>
                {FREQUENCY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div ref={timeRef} className="relative">
              <label className={labelClass}>Time</label>
              <button
                type="button"
                onClick={() => setShowTimeDropdown(!showTimeDropdown)}
                className={`${inputClass} text-left`}
              >
                {form.time.length ? form.time.join(', ') : 'Select time'}
              </button>
              {showTimeDropdown && (
                <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-2">
                  {TIME_OPTIONS.map((opt) => {
                    const checked = form.time.includes(opt);
                    return (
                      <label key={opt} className="flex items-center gap-2 px-2 py-2 rounded hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = checked ? form.time.filter((x) => x !== opt) : [...form.time, opt];
                            setForm({ ...form, time: next });
                          }}
                        />
                        <span className="text-sm text-gray-800">{opt}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <label className={labelClass}>AF/BF Food Relation</label>
              <select className={inputClass} value={form.food} onChange={(e) => setForm({ ...form, food: e.target.value })}>
                <option value="">Select</option>
                {FOOD_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Duration</label>
            <input className={inputClass} value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="e.g. 7 days" />
          </div>

          <div>
            <label className={labelClass}>Instructions</label>
            <textarea
              className={`${inputClass} resize-none`}
              rows={3}
              value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              placeholder="Any special instructions..."
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button onClick={handleSubmit} disabled={isSaving} className="btn-primary text-sm">
            {isSaving ? 'Saving...' : initial ? 'Save Changes' : 'Add Medicine'}
          </button>
        </div>
      </div>
    </div>
  );
}
