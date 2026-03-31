import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import ConfirmationModal from '../components/ConfirmationModal';
import FavouriteMedicineModal, { type FavouriteMedicineFormData } from '../components/features/FavouriteMedicineModal';
import { useAuth } from '../contexts/AuthContext';
import {
  getFavouriteMedicines,
  createFavouriteMedicine,
  updateFavouriteMedicine,
  deleteFavouriteMedicine,
  type FavouriteMedicineRow,
} from '../lib/database';

export default function FavouritesPage() {
  const { user } = useAuth();
  const [medicines, setMedicines] = useState<FavouriteMedicineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<FavouriteMedicineRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FavouriteMedicineRow | null>(null);

  const loadMedicines = async () => {
    if (!user?.id) return;
    try {
      const data = await getFavouriteMedicines(user.id);
      setMedicines(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMedicines();
  }, [user?.id]);

  const handleSave = async (formData: FavouriteMedicineFormData) => {
    if (!user?.id) return;
    setIsSaving(true);
    try {
      const payload = {
        name: formData.name,
        dosage: formData.dosage,
        quantity: formData.quantity,
        type: formData.type,
        frequency: formData.frequency,
        food: formData.food,
        time: formData.time.length ? JSON.stringify(formData.time) : '',
        duration: formData.duration,
        instructions: formData.instructions,
      };

      if (editingMedicine) {
        await updateFavouriteMedicine(editingMedicine.id, payload);
      } else {
        await createFavouriteMedicine({ doc_id: user.id, ...payload });
      }
      await loadMedicines();
      setShowModal(false);
      setEditingMedicine(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteFavouriteMedicine(deleteTarget.id);
      setMedicines((prev) => prev.filter((m) => m.id !== deleteTarget.id));
    } catch (e) {
      console.error(e);
    } finally {
      setDeleteTarget(null);
    }
  };

  const openAdd = () => {
    setEditingMedicine(null);
    setShowModal(true);
  };

  const openEdit = (med: FavouriteMedicineRow) => {
    setEditingMedicine(med);
    setShowModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar showBack />

      <div className="w-full px-4 py-6 xl:px-[160px]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Favourite Medicines</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your frequently prescribed medicines</p>
          </div>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" />
            Add Favourite
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner size="md" /></div>
        ) : medicines.length === 0 ? (
          <EmptyState
            title="No favourite medicines yet"
            description="Add your frequently prescribed medicines here for quick access during consultations."
          />
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Medicine Name</th>
                    <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Dosage</th>
                    <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Frequency</th>
                    <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Duration</th>
                    <th className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {medicines.map((med) => (
                    <tr key={med.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-900">{med.name}</span>
                        {med.type && <span className="ml-2 text-xs text-gray-400">{med.type}</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{med.dosage || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">{med.frequency || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell">{med.duration || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(med)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4 text-gray-500" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(med)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <FavouriteMedicineModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingMedicine(null); }}
        onSave={handleSave}
        initial={editingMedicine}
        isSaving={isSaving}
      />

      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Favourite Medicine"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}
