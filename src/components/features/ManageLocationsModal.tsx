import { useState } from 'react';
import { Pencil, Trash2, Check, X, Plus } from 'lucide-react';
import Modal from '../Modal';
import EmptyState from '../ui/EmptyState';
import type { LocationRow } from '../../types/db';

interface ManageLocationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  locations: LocationRow[];
  onCreate: (name: string) => Promise<LocationRow | null>;
  onUpdate: (id: string, name: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

export default function ManageLocationsModal({ isOpen, onClose, locations, onCreate, onUpdate, onDelete }: ManageLocationsModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const startEdit = (loc: LocationRow) => {
    setEditingId(loc.id);
    setEditName(loc.name);
    setConfirmDeleteId(null);
  };

  const saveEdit = async (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    const ok = await onUpdate(id, trimmed);
    setBusy(false);
    if (ok) setEditingId(null);
  };

  const saveNew = async () => {
    const trimmed = newName.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    const created = await onCreate(trimmed);
    setBusy(false);
    if (created) {
      setNewName('');
      setAdding(false);
    }
  };

  const confirmDelete = async (id: string) => {
    setBusy(true);
    const ok = await onDelete(id);
    setBusy(false);
    if (ok) setConfirmDeleteId(null);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Locations">
      <div className="space-y-3">
        {locations.length === 0 && !adding ? (
          <EmptyState message="No locations yet" />
        ) : (
          <div className="space-y-2">
            {locations.map((loc) => (
              <div key={loc.id} className="border border-gray-200 rounded-lg px-3 py-2">
                {editingId === loc.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveEdit(loc.id); } }}
                      className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#024CDB] focus:border-transparent"
                    />
                    <button type="button" onClick={() => saveEdit(loc.id)} disabled={busy || !editName.trim()} className="p-1.5 rounded-md bg-[#024CDB] text-white disabled:opacity-40" title="Save">
                      <Check className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="p-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50" title="Cancel">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : confirmDeleteId === loc.id ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-gray-700 truncate">Remove "{loc.name}"?</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button type="button" onClick={() => confirmDelete(loc.id)} disabled={busy} className="px-2.5 py-1 rounded-md bg-red-600 text-white text-sm disabled:opacity-40">Remove</button>
                      <button type="button" onClick={() => setConfirmDeleteId(null)} className="px-2.5 py-1 rounded-md border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">{loc.name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => startEdit(loc)} className="p-1.5 rounded-md hover:bg-gray-100" title="Edit">
                        <Pencil className="w-4 h-4 text-gray-500" />
                      </button>
                      <button type="button" onClick={() => { setConfirmDeleteId(loc.id); setEditingId(null); }} className="p-1.5 rounded-md hover:bg-red-50" title="Delete">
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {adding ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveNew(); } }}
              placeholder="Location name"
              className="flex-1 min-w-0 px-2 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#024CDB] focus:border-transparent"
            />
            <button type="button" onClick={saveNew} disabled={busy || !newName.trim()} className="btn-primary text-sm py-2 disabled:opacity-40">Save</button>
            <button type="button" onClick={() => { setAdding(false); setNewName(''); }} className="btn-secondary text-sm py-2">Cancel</button>
          </div>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
            <Plus className="w-4 h-4" />
            Add Location
          </button>
        )}
      </div>
    </Modal>
  );
}
