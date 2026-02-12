import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MessageSquare, Search, MoreVertical, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import { createPatient, getPatients, getTodaysAppointments, createAppointment, getPatientByPhone, updateAppointmentQueue, completeAppointment } from '../lib/database';
import { useAuth } from '../contexts/AuthContext';

export default function MainPage() {
  const navigate = useNavigate(); 
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
    setFormError(''); // Clear any previous errors
    
    // Check if patient with this phone already exists
    const existingPatientCheck = await getPatientByPhone(newPatient.phone, user!.id);
    
    if (existingPatientCheck) {
      setFormError('A patient with this phone number already exists!');
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
    await loadData();
  } catch (error) {
    console.error('Error creating patient:', error);
    setFormError('Failed to create patient. Please try again.');
  }
};

  const handleAddToQueue = async () => {
  try {
    setFormError(''); // Clear any previous errors
    
    // Check if patient already has an appointment today
    const hasAppointmentToday = todaysAppointments.some(
      apt => apt.patient_id === existingPatient.id
    );
    
    if (hasAppointmentToday) {
      setFormError('This patient already has an appointment today!');
      return;
    }
    
    await createAppointment(existingPatient.id, user!.id);
    setShowAddPatient(false);
    setNewPatient({ phone: '', name: '', age: '', gender: 'Male' });
    setExistingPatient(null);
    setFormError('');
    await loadData();
  } catch (error) {
    console.error('Error adding to queue:', error);
    setFormError('Failed to add to queue. Please try again.');
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
  };
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="w-full px-4 py-6 xl:px-[160px]">
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search patients by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#024CDB] focus:border-transparent"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate('/queries')}
              className="btn-secondary flex items-center space-x-2"
            >
              <MessageSquare className="w-5 h-5" />
              <span>Queries</span>
            </button>

            <button
              onClick={() => setShowAddPatient(true)}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Patient</span>
            </button>
          </div>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 mt-10">
              Today's Patient Que
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-3">
              {loading ? (
                <div className="col-span-full text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#024CDB] mx-auto"></div>
                </div>
              ) : (
                <>
  {/* 1) PENDING (completed = false) — keep your current card + kebab menu */}
  {pendingTodaysAppointments.map((appointment) => (
    <div key={appointment.id} className="relative">
      <div
        onClick={() => navigate(`/patient/${appointment.patient_id}`)}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200 cursor-pointer group"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div>
              <h3 className="font-semibold text-lg text-gray-900 group-hover:text-[#024CDB] transition-colors">
                {appointment.patients?.name}
              </h3>

              <div className="text-sm text-gray-500 flex items-center gap-2">
                <span>
                  {appointment.patients?.age}yrs · {appointment.patients?.gender}
                </span>

                {appointment.pre_consult_filled === true && (
                  <span className="w-3 h-3 bg-green-500 rounded-full inline-block" />
                )}
              </div>
            </div>
          </div>

          {/* ✅ keep kebab menu only for pending */}
          <div className="flex items-center space-x-2">
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowKebabMenu(showKebabMenu === appointment.id ? null : appointment.id);
                }}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <MoreVertical className="w-4 h-4 text-gray-400" />
              </button>

              {showKebabMenu === appointment.id && (
                <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveUp(appointment);
                    }}
                    disabled={todaysAppointments.findIndex(a => a.id === appointment.id) === 0}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    <ChevronUp className="w-4 h-4" />
                    <span>Move Up</span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveDown(appointment);
                    }}
                    disabled={todaysAppointments.findIndex(a => a.id === appointment.id) === todaysAppointments.length - 1}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    <ChevronDown className="w-4 h-4" />
                    <span>Move Down</span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveClick(appointment);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 text-red-600 flex items-center space-x-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Remove</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {appointment.patients?.case && (
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-[#024CDB]">
            {appointment.patients?.case}
          </div>
        )}
        <div className="mt-5 pt-3 border-t border-gray-100">
  {appointment.patients?.last_visit_at ? (
    <p className="text-sm text-gray-500">
      Last visit: {formatDate(appointment.patients.last_visit_at)}
    </p>
  ) : (
    <p className="text-sm text-gray-400">Last visit: —</p>
  )}
</div>

      </div>
    </div>
  ))}

  {/* 2) COMPLETED (completed = true) — new simple card design, NO kebab */}
  {completedTodaysAppointments.map((appointment) => (
    <div
      key={appointment.id}
      onClick={() => navigate(`/patient/${appointment.patient_id}`)}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200 cursor-pointer group"
    >
      <div className="flex items-start justify-between">
        <h3 className="font-semibold text-lg text-gray-900 group-hover:text-[#024CDB] transition-colors">
          {appointment.patients?.name}
        </h3>

        {appointment.patients?.case && (
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-[#024CDB]">
            {appointment.patients?.case}
          </div>
        )}
      </div>

      <div className="text-sm text-gray-500">
        {appointment.patients?.age}yrs · {appointment.patients?.gender}
      </div>

      <div className="mt-5 pt-3 border-t border-gray-100">
        <p className="text-sm font-medium text-green-600">Consultation completed</p>
      </div>
    </div>
  ))}
</>

              )}
            </div>
            
            {filteredTodaysAppointments.length === 0 && (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <p className="text-gray-500">No appointments scheduled for today</p>
              </div>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              All Patients ({filteredAllPatients.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-3">
              {loading ? (
                <div className="col-span-full text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#024CDB] mx-auto"></div>
                </div>
              ) : (
                filteredAllPatients.map((patient) => (
                  <div
                    key={patient.id}
                    onClick={() => navigate(`/patient/${patient.id}`)}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200 cursor-pointer group"
                  >
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold text-lg text-gray-900 group-hover:text-[#024CDB] transition-colors">{patient.name}</h3>
                      {patient.case && (
                        <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-[#024CDB]">
                          {patient.case}
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {patient.age}yrs · {patient.gender}
                    </div>
                    <div className="mt-5 pt-3 border-t border-gray-100">
                      {patient.last_visit_at && (
                        <p className="text-sm text-gray-500">Last visit: {formatDate(patient.last_visit_at)}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            {filteredAllPatients.length === 0 && (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <p className="text-gray-500">No patients found</p>
              </div>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={newPatient.phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
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
            <button type="button" onClick={handleCloseModal} className="btn-secondary">
              Cancel
            </button>
            {existingPatient ? (
              <button 
                type="button" 
                onClick={handleAddToQueue}
                className="btn-primary"
              >
                Add to Queue
              </button>
            ) : (
              <button type="submit" className="btn-primary">
                Create
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
