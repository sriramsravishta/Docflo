import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check, MapPin } from 'lucide-react';
import type { LocationRow } from '../../types/db';

interface LocationMultiSelectProps {
  locations: LocationRow[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export default function LocationMultiSelect({ locations, selectedIds, onChange }: LocationMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) onChange(selectedIds.filter((x) => x !== id));
    else onChange([...selectedIds, id]);
  };

  const selectedNames = locations.filter((l) => selectedIds.includes(l.id)).map((l) => l.name);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input-field flex items-center justify-between text-left"
      >
        <span className={`flex items-center gap-2 truncate ${selectedNames.length ? 'text-gray-900' : 'text-gray-400'}`}>
          <MapPin className="w-4 h-4 shrink-0 text-gray-400" />
          <span className="truncate">{selectedNames.length ? selectedNames.join(', ') : 'No locations'}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {locations.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400">No locations available</div>
          ) : (
            locations.map((loc) => {
              const checked = selectedIds.includes(loc.id);
              return (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => toggle(loc.id)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-50"
                >
                  <span className="text-gray-900 truncate">{loc.name}</span>
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-[#024CDB] border-[#024CDB]' : 'border-gray-300'}`}>
                    {checked && <Check className="w-3 h-3 text-white" />}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
