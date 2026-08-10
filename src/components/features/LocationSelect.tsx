import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus, Check, MapPin } from 'lucide-react';
import type { LocationRow } from '../../types/db';

interface LocationSelectProps {
  locations: LocationRow[];
  value: string;
  onChange: (id: string) => void;
  onCreate: (name: string) => Promise<LocationRow | null>;
}

export default function LocationSelect({ locations, value, onChange, onCreate }: LocationSelectProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = locations.find((l) => l.id === value);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setNewName('');
      }
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleSaveNew = async () => {
    const trimmed = newName.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    const created = await onCreate(trimmed);
    setSaving(false);
    if (created) {
      onChange(created.id);
      setCreating(false);
      setNewName('');
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input-field flex items-center justify-between text-left"
      >
        <span className={`flex items-center gap-2 truncate ${selected ? 'text-gray-900' : 'text-gray-400'}`}>
          <MapPin className="w-4 h-4 shrink-0 text-gray-400" />
          <span className="truncate">{selected ? selected.name : 'No location'}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-50"
          >
            <span className="text-gray-500">No location</span>
            {!value && <Check className="w-4 h-4 text-[#024CDB]" />}
          </button>

          {locations.map((loc) => (
            <button
              key={loc.id}
              type="button"
              onClick={() => { onChange(loc.id); setOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-50"
            >
              <span className="text-gray-900 truncate">{loc.name}</span>
              {value === loc.id && <Check className="w-4 h-4 text-[#024CDB] shrink-0" />}
            </button>
          ))}

          <div className="border-t border-gray-100">
            {creating ? (
              <div className="flex items-center gap-2 p-2">
                <input
                  type="text"
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveNew(); } }}
                  placeholder="New location name"
                  className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#024CDB] focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={handleSaveNew}
                  disabled={saving || !newName.trim()}
                  className="px-2 py-1.5 rounded-md bg-[#024CDB] text-white text-sm disabled:opacity-40"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-[#024CDB] hover:bg-gray-50"
              >
                <Plus className="w-4 h-4" />
                Create new
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
