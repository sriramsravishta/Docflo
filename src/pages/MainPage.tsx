import { useState, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import Navbar from '../components/Navbar';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import PatientQueueTable from '../components/features/PatientQueueTable';
import AllPatientsTable from '../components/features/AllPatientsTable';
import { createPatient, getPatients, getTodaysAppointments, createAppointment, getPatientByPhone, updateAppointmentQueue, completeAppointment } from '../lib/database';
import { useAuth } from '../contexts/AuthContext';

export default function MainPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [loading, setLoading] = useState(true);
  const [todaysAppointments, setTodaysAppointments] = useState<any[]>([]);
  const [allPatients, setAllPatients] = useState<any[]>([]);
  const [existingPatient, setExistingPatient] = useState<any>(null);
  const [showRemoveConfirmation, setShowRemoveConfirmation] = useState(false);
  const [appointmentToRemove, setAppointmentToRemove] = useState<any>(null);
  const [showKebabMenu, setShowKebabMenu] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newPatient, setNewPatient] = useState({
    phone: '',
    name: '',
    age: '',
    gender: 'Male',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [appointments, patients] = await Promise.all([
        getTodaysAppointments(user!.id),
        getPatients()
      ]);
      
      setTodaysAppointments(appointments);
      setAllPatients(patients);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneChange = async (phone: string) => {
    setNewPatient({ ...newPatient, phone });
    
    if (phone.length >= 10) {
      try {
        const patient = await getPatientByPhone(phone, user!.id);
        if (patient) {
          setExistingPatient(patient);
          setNewPatient({
            phone,
            name: patient.name,
            age: patient.age.toString(),
            gender: patient.gender,
          });
        } else {
          setExistingPatient(null);
          setNewPatient({
            phone,
            name: '',
            age: '',
            gender: 'Male',
          });
        }
      } catch (error) {
        console.error('Error checking patient:', error);
      }
    } else {
      setExistingPatient(null);
    }
  };

  const filteredTodaysAppointments = todaysAppointments.filter((appointment) => {
  const name = (appointment.patients?.name ?? '').toLowerCase();
  return name.includes(searchQuery.toLowerCase());
});

// since DB is boolean, this is enough (also handles undefined/null safely)
const pendingTodaysAppointments = filteredTodaysAppointments.filter((a) => a.completed !== true);
const completedTodaysAppointments = filteredTodaysAppointments.filter((a) => a.completed === true);


  const filteredAllPatients = allPatients.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const handleCreatePatient = async () => {
  try {
    setFormError('');
    setIsSubmitting(true); // Start loading
    
    // Check if patient with this phone already exists
    const existingPatientCheck = await getPatientByPhone(newPatient.phone, user!.id);
    
    if (existingPatientCheck) {
      setFormError('A patient with this phone number already exists!');
      setIsSubmitting(false); // Stop loading
      return;
    }
    
    const patient = await createPatient({
      name: newPatient.name,
      age: parseInt(newPatient.age),
      phone: newPatient.phone,
      gender: newPatient.gender,
    });
    
    // Create appointment for new patient
    await createAppointment(patient.id, user!.id);
    
    setShowAddPatient(false);
    setNewPatient({ phone: '', name: '', age: '', gender: 'Male' });
    setExistingPatient(null);
    setFormError('');
    setIsSubmitting(false); // Stop loading
    await loadData();
  } catch (error) {
    console.error('Error creating patient:', error);
    setFormError('Failed to create patient. Please try again.');
    setIsSubmitting(false); // Stop loading on error
  }
};

  const handleAddToQueue = async () => {
  try {
    setFormError('');
    setIsSubmitting(true); // Start loading
    
    // Check if patient already has an appointment today
    const hasAppointmentToday = todaysAppointments.some(
      apt => apt.patient_id === existingPatient.id
    );
    
    if (hasAppointmentToday) {
      setFormError('This patient already has an appointment today!');
      setIsSubmitting(false); // Stop loading
      return;
    }
    
    await createAppointment(existingPatient.id, user!.id);
    setShowAddPatient(false);
    setNewPatient({ phone: '', name: '', age: '', gender: 'Male' });
    setExistingPatient(null);
    setFormError('');
    setIsSubmitting(false); // Stop loading
    await loadData();
  } catch (error) {
    console.error('Error adding to queue:', error);
    setFormError('Failed to add to queue. Please try again.');
    setIsSubmitting(false); // Stop loading on error
  }
};

  const handleMoveUp = async (appointment: any) => {
    const currentIndex = todaysAppointments.findIndex(a => a.id === appointment.id);
    if (currentIndex > 0) {
      const aboveAppointment = todaysAppointments[currentIndex - 1];
      
      try {
        await Promise.all([
          updateAppointmentQueue(appointment.id, aboveAppointment.queue),
          updateAppointmentQueue(aboveAppointment.id, appointment.queue)
        ]);
        await loadData();
      } catch (error) {
        console.error('Error moving appointment up:', error);
        alert('Failed to move appointment');
      }
    }
    setShowKebabMenu(null);
  };

  const handleMoveDown = async (appointment: any) => {
    const currentIndex = todaysAppointments.findIndex(a => a.id === appointment.id);
    if (currentIndex < todaysAppointments.length - 1) {
      const belowAppointment = todaysAppointments[currentIndex + 1];
      
      try {
        await Promise.all([
          updateAppointmentQueue(appointment.id, belowAppointment.queue),
          updateAppointmentQueue(belowAppointment.id, appointment.queue)
        ]);
        await loadData();
      } catch (error) {
        console.error('Error moving appointment down:', error);
        alert('Failed to move appointment');
      }
    }
    setShowKebabMenu(null);
  };

  const handleRemoveClick = (appointment: any) => {
    setAppointmentToRemove(appointment);
    setShowRemoveConfirmation(true);
    setShowKebabMenu(null);
  };

  const handleConfirmRemove = async () => {
    try {
      await completeAppointment(appointmentToRemove.id);
      setShowRemoveConfirmation(false);
      setAppointmentToRemove(null);
      await loadData();
    } catch (error) {
      console.error('Error removing appointment:', error);
      alert('Failed to remove appointment');
    }
  };

  const handleCloseModal = () => {
  setShowAddPatient(false);
  setNewPatient({ phone: '', name: '', age: '', gender: 'Male' });
  setExistingPatient(null);
  setFormError('');
  setIsSubmitting(false); // Reset loading state
};
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="w-full px-4 py-6 xl:px-[160px]">
        <div className="mb-6 flex flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#024CDB] focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowAddPatient(true)}
            className="btn-primary flex items-center space-x-2 shrink-0"
          >
            <Plus className="w-5 h-5" />
            <span>Patient</span>
          </button>
        </div>

        <div className="space-y-10">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Today's Patient Queue
            </h2>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#024CDB]" />
              </div>
            ) : filteredTodaysAppointments.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <p className="text-gray-500">No appointments scheduled for today</p>
              </div>
            ) : (
              <PatientQueueTable
                appointments={filteredTodaysAppointments}
                pendingOnly={pendingTodaysAppointments}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                onRemove={handleRemoveClick}
                showKebabMenu={showKebabMenu}
                setShowKebabMenu={setShowKebabMenu}
                formatDate={formatDate}
                showActions={true}
              />
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              All Patients ({filteredAllPatients.length})
            </h2>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#024CDB]" />
              </div>
            ) : filteredAllPatients.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <p className="text-gray-500">No patients found</p>
              </div>
            ) : (
              <AllPatientsTable patients={filteredAllPatients} formatDate={formatDate} />
            )}
          </section>
        </div>
      </div>

      <Modal
        isOpen={showAddPatient}
        onClose={() => setShowAddPatient(false)}
        title="Add New Patient"
      >
        <form onSubmit={(e) => { 
          e.preventDefault(); 
          if (existingPatient) {
            handleAddToQueue();
          } else {
            handleCreatePatient();
          }
        }} className="space-y-4">
          {formError && (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
      {formError}
    </div>
  )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone <span className="text-red-500">*</span>
            </label>
            <input
  type="tel"
  value={newPatient.phone}
  onChange={(e) => {
    const value = e.target.value;
    // Only allow numbers and +
    if (value === '' || /^[0-9+]*$/.test(value)) {
      handlePhoneChange(value);
    }
  }}
  className="input-field"
  required
/>
            {existingPatient && (
              <p className="text-sm text-green-600 mt-1">Patient found! Details auto-filled.</p>
            )}
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

          <div className="flex space-x-3 justify-end pt-4">
  <button 
    type="button" 
    onClick={handleCloseModal} 
    className="btn-secondary"
    disabled={isSubmitting}
  >
    Cancel
  </button>
  {existingPatient ? (
    <button 
      type="button" 
      onClick={handleAddToQueue}
      className="btn-primary flex items-center justify-center"
      disabled={isSubmitting}
    >
      {isSubmitting ? (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          Adding...
        </>
      ) : (
        'Add to Queue'
      )}
    </button>
  ) : (
    <button 
      type="submit" 
      className="btn-primary flex items-center justify-center"
      disabled={isSubmitting}
    >
      {isSubmitting ? (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          Creating...
        </>
      ) : (
        'Create'
      )}
    </button>
  )}
</div>
        </form>
      </Modal>

      <ConfirmationModal
        isOpen={showRemoveConfirmation}
        onClose={() => setShowRemoveConfirmation(false)}
        onConfirm={handleConfirmRemove}
        title="Remove Patient from Queue"
        message={`Are you sure you want to remove ${appointmentToRemove?.patients?.name} from today's queue? This action cannot be undone.`}
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}
