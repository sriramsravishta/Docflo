import { useState } from 'react';
import { Plus, Search, FileText, Mic } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import PatientQueueTable from '../components/features/PatientQueueTable';
import AllPatientsTable from '../components/features/AllPatientsTable';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import { useMainPageData } from '../hooks/useMainPageData';
import { useAuth } from '../contexts/AuthContext';
import { getPatientByPhone } from '../lib/database';

export default function MainPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    loading,
    todaysAppointments,
    allPatients,
    loadData,
    handleMoveUp,
    handleMoveDown,
    handleConfirmRemove,
    handleCreatePatient,
    handleAddToQueue,
    checkExistingAppointment,
    formError,
    setFormError,
    isSubmitting,
  } = useMainPageData(user?.id);

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [existingPatient, setExistingPatient] = useState<{ id: string; name: string; age: number; gender: string; phone: string; uhid?: string } | null>(null); // CHANGED: added uhid to type
  const [showRemoveConfirmation, setShowRemoveConfirmation] = useState(false);
  const [appointmentToRemove, setAppointmentToRemove] = useState<{ id: string; patients?: { name?: string } } | null>(null);
  const [showKebabMenu, setShowKebabMenu] = useState<string | null>(null);
  const [newPatient, setNewPatient] = useState({ phone: '', name: '', age: '', gender: 'Male', uhid: '' }); // CHANGED: added uhid
const [referredBy, setReferredBy] = useState(''); // CHANGED: added referredBy (appointment-level field)

  const filteredTodaysAppointments = todaysAppointments.filter((appointment) => {
    const name = (appointment.patients?.name ?? '').toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  const pendingTodaysAppointments = filteredTodaysAppointments.filter((a) => a.completed !== true);

  const filteredAllPatients = allPatients.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const handlePhoneChange = async (phone: string) => {
    setNewPatient({ ...newPatient, phone });
    if (phone.length >= 10) {
      try {
        const patient = await getPatientByPhone(phone, user!.id);
        if (patient) {
          setExistingPatient(patient);
          setNewPatient({ phone, name: patient.name, age: patient.age.toString(), gender: patient.gender, uhid: patient.uhid || '' }); // CHANGED: auto-fill uhid
        } else {
          setExistingPatient(null);
          setNewPatient({ phone, name: '', age: '', gender: 'Male', uhid: '' }); // CHANGED: reset uhid
        }
      } catch (error) {
        console.error('Error checking patient:', error);
      }
    } else {
      setExistingPatient(null);
    }
  };

  const handleCloseModal = () => {
    setShowAddPatient(false);
    setNewPatient({ phone: '', name: '', age: '', gender: 'Male', uhid: '' }); // CHANGED: reset uhid
    setReferredBy(''); // CHANGED: reset referredBy
    setExistingPatient(null);
    setFormError('');
  };

  const handleRemoveClick = (appointment: { id: string; patients?: { name?: string } }) => {
    setAppointmentToRemove(appointment);
    setShowRemoveConfirmation(true);
    setShowKebabMenu(null);
  };

  const onMoveUp = async (appointment: Parameters<typeof handleMoveUp>[0]) => {
    await handleMoveUp(appointment);
    setShowKebabMenu(null);
  };

  const onMoveDown = async (appointment: Parameters<typeof handleMoveDown>[0]) => {
    await handleMoveDown(appointment);
    setShowKebabMenu(null);
  };

  const onConfirmRemove = async () => {
    if (!appointmentToRemove) return;
    await handleConfirmRemove(appointmentToRemove as Parameters<typeof handleConfirmRemove>[0]);
    setShowRemoveConfirmation(false);
    setAppointmentToRemove(null);
  };

  const onSubmitForm = async () => {
    if (existingPatient) {
      if (!checkExistingAppointment(existingPatient.id)) {
        // CHANGED: pass uhidToSave only if existing patient has no uhid and user entered one
        const uhidToSave = !existingPatient.uhid && newPatient.uhid ? newPatient.uhid : undefined;
        const success = await handleAddToQueue(existingPatient, user!.id, referredBy, uhidToSave); // CHANGED: use returned boolean
        if (success) { // CHANGED: check returned value, not stale formError
          handleCloseModal();
          await loadData();
        }
      } else {
        setFormError('This patient already has an appointment today!');
      }
    } else {
      const success = await handleCreatePatient(newPatient, user!.id, referredBy); // CHANGED: use returned boolean
      if (success) { // CHANGED: check returned value, not stale formError
        handleCloseModal();
        await loadData();
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="w-full px-4 py-6 xl:px-[160px]">
        <div className="mb-6 flex flex-wrap gap-3">
          <div className="w-full relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#024CDB] focus:border-transparent"
            />
          </div>
          <div className="flex gap-3 ml-auto">
            <button onClick={() => navigate('/clinical-summariser')} className="btn-secondary flex items-center space-x-2 shrink-0">
              <Mic className="w-4 h-4" />
              <span>Clinical Summariser</span>
            </button>
            <button onClick={() => setShowAddPatient(true)} className="btn-primary flex items-center space-x-2 shrink-0">
              <Plus className="w-5 h-5" />
              <span>Patient</span>
            </button>
          </div>
        </div>

        <div className="space-y-10">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Today's Patient Queue</h2>
            {loading ? (
              <div className="flex justify-center py-8"><Spinner size="md" /></div>
            ) : filteredTodaysAppointments.length === 0 ? (
              <EmptyState message="No appointments scheduled for today" />
            ) : (
              <PatientQueueTable
                appointments={filteredTodaysAppointments}
                pendingOnly={pendingTodaysAppointments}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
                onRemove={handleRemoveClick}
                showKebabMenu={showKebabMenu}
                setShowKebabMenu={setShowKebabMenu}
                formatDate={formatDate}
                showActions={true}
              />
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">All Patients ({filteredAllPatients.length})</h2>
            {loading ? (
              <div className="flex justify-center py-8"><Spinner size="md" /></div>
            ) : filteredAllPatients.length === 0 ? (
              <EmptyState message="No patients found" />
            ) : (
              <AllPatientsTable patients={filteredAllPatients} formatDate={formatDate} />
            )}
          </section>
        </div>
      </div>

      <Modal isOpen={showAddPatient} onClose={handleCloseModal} title="Add New Patient">
        <form
          onSubmit={(e) => { e.preventDefault(); onSubmitForm(); }}
          className="space-y-4"
        >
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{formError}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={newPatient.phone}
              onChange={(e) => { const v = e.target.value; if (v === '' || /^[0-9+]*$/.test(v)) handlePhoneChange(v); }}
              className="input-field"
              required
            />
            {existingPatient && <p className="text-sm text-green-600 mt-1">Patient found! Details auto-filled.</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newPatient.name}
              onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
              className={`input-field ${existingPatient ? 'bg-gray-50' : ''}`}
              readOnly={!!existingPatient}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Age <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={newPatient.age}
                onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })}
                className={`input-field ${existingPatient ? 'bg-gray-50' : ''}`}
                readOnly={!!existingPatient}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender <span className="text-red-500">*</span>
              </label>
              <select
                value={newPatient.gender}
                onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value })}
                className={`input-field ${existingPatient ? 'bg-gray-50' : ''}`}
                disabled={!!existingPatient}
                required
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
{/* CHANGED: Added UHID field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              UHID <span className="text-gray-400 text-xs">(optional)</span>
            </label>
            <input
              type="text"
              value={newPatient.uhid}
              onChange={(e) => setNewPatient({ ...newPatient, uhid: e.target.value })}
              // CHANGED: read-only only if existing patient already HAS a uhid
              // if existing patient has no uhid, allow editing so it can be saved
              className={`input-field ${existingPatient && existingPatient.uhid ? 'bg-gray-50' : ''}`}
              readOnly={!!(existingPatient && existingPatient.uhid)}
            />
          </div>

         {/* CHANGED: Added Referred By field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Referred By <span className="text-gray-400 text-xs">(optional)</span>
            </label>
            <input
              type="text"
              value={referredBy}
              onChange={(e) => setReferredBy(e.target.value)}
              className="input-field"
            />
          </div>

          <div className="flex space-x-3 justify-end pt-4">
            <button type="button" onClick={handleCloseModal} className="btn-secondary" disabled={isSubmitting}>
              Cancel
            </button>
            {existingPatient ? (
              <button type="submit" className="btn-primary flex items-center justify-center" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Spinner size="sm" className="mr-2" />Adding...</>
                ) : 'Add to Queue'}
              </button>
            ) : (
              <button type="submit" className="btn-primary flex items-center justify-center" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Spinner size="sm" className="mr-2" />Creating...</>
                ) : 'Create'}
              </button>
            )}
          </div>
        </form>
      </Modal>

      <ConfirmationModal
        isOpen={showRemoveConfirmation}
        onClose={() => setShowRemoveConfirmation(false)}
        onConfirm={onConfirmRemove}
        title="Remove Patient from Queue"
        message={`Are you sure you want to remove ${appointmentToRemove?.patients?.name} from today's queue? This action cannot be undone.`}
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}
