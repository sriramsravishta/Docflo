import { useState } from 'react';
import { Plus, Search, Mic, Settings, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import PatientQueueTable from '../components/features/PatientQueueTable';
import AllPatientsTable from '../components/features/AllPatientsTable';
import LocationSelect from '../components/features/LocationSelect';
import ManageLocationsModal from '../components/features/ManageLocationsModal';
import RescheduleModal from '../components/features/RescheduleModal';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import { useMainPageData } from '../hooks/useMainPageData';
import { useAuth } from '../contexts/AuthContext';
import { getPatientByPhone } from '../lib/database';
import type { AppointmentRow } from '../types/db';
import SummaryTab from '../components/features/SummaryTab';
import PatientsFilterModal, { AppliedFilters } from '../components/features/PatientsFilterModal';

export default function MainPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    loading,
    todaysAppointments,
    upcomingAppointments = [], // ADDED: Pulling upcoming appointments
    allPatients,
    locations,
    patientsCount,
    prescriptionsCount,
    loadData,
    handleMoveUp,
    handleMoveDown,
    handleConfirmRemove,
    handleCreatePatient,
    handleAddToQueue,
    handleReschedule,
    handleCreateLocation,
    handleUpdateLocation,
    handleDeleteLocation,
    checkExistingAppointment,
    formError,
    setFormError,
    isSubmitting,
  } = useMainPageData(user?.id);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'summary'>('today');
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [existingPatient, setExistingPatient] = useState<{ id: string; name: string; age: number; gender: string; phone: string; uhid?: string } | null>(null); // CHANGED: added uhid to type
  const [showRemoveConfirmation, setShowRemoveConfirmation] = useState(false);
  const [appointmentToRemove, setAppointmentToRemove] = useState<{ id: string; patients?: { name?: string } } | null>(null);
  const [showKebabMenu, setShowKebabMenu] = useState<string | null>(null);
  const [newPatient, setNewPatient] = useState({ phone: '', name: '', age: '', gender: 'Male', uhid: '', address: '' });// CHANGED: added uhid
const [referredBy, setReferredBy] = useState(''); // CHANGED: added referredBy (appointment-level field)
  const [newLocationId, setNewLocationId] = useState(''); // CHANGED: appointment location
  const [newScheduledAt, setNewScheduledAt] = useState(''); // CHANGED: appointment date & time
  const [showManageLocations, setShowManageLocations] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentRow | null>(null);

 // dynamically switch data based on the selected tab
  const activeAppointments = activeTab === 'today' ? todaysAppointments : upcomingAppointments;

  const filteredActiveAppointments = activeAppointments.filter((appointment) => {
    const name = (appointment.patients?.name ?? '').toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  const appointmentWhen = (a: AppointmentRow) => a.scheduled_at || a.created_at;
  const sortByWhenDesc = (a: AppointmentRow, b: AppointmentRow) =>
    new Date(appointmentWhen(b)).getTime() - new Date(appointmentWhen(a)).getTime();

  const sortedActiveAppointments = [...filteredActiveAppointments].sort(sortByWhenDesc);
  const pendingActiveAppointments = sortedActiveAppointments.filter((a) => a.completed !== true);

  const hasAnyLocation = filteredActiveAppointments.some((a) => a.location_id);
  const locationGroups = (() => {
    if (!hasAnyLocation) return [];
    const matched = new Set<string>();
    const groups: { key: string; name: string; items: AppointmentRow[] }[] = [];
    locations.forEach((loc) => {
      const items = filteredActiveAppointments.filter((a) => a.location_id === loc.id);
      if (items.length) {
        items.forEach((i) => matched.add(i.id));
        groups.push({ key: loc.id, name: loc.name, items: [...items].sort(sortByWhenDesc) });
      }
    });
    const others = filteredActiveAppointments.filter((a) => !matched.has(a.id));
    if (others.length) groups.push({ key: 'other', name: 'Other', items: [...others].sort(sortByWhenDesc) });
    return groups;
  })();

  const [showPatientFilter, setShowPatientFilter] = useState(false);
  const [patientFilterMode, setPatientFilterMode] = useState<'single' | 'range'>('single');
  
  // These track what you are selecting in the pop-up
  const [patientFilterDate, setPatientFilterDate] = useState('');
  const [patientFilterFrom, setPatientFilterFrom] = useState('');
  const [patientFilterTo, setPatientFilterTo] = useState('');

  // These track what is ACTUALLY applied to the table
  const [appliedFilterDate, setAppliedFilterDate] = useState('');
  const [appliedFilterFrom, setAppliedFilterFrom] = useState('');
  const [appliedFilterTo, setAppliedFilterTo] = useState('');
  const [showDiagnosisFilter, setShowDiagnosisFilter] = useState(false);
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<string[]>([]);

  const isPatientInFilter = (dateStr?: string): boolean => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    if (patientFilterMode === 'single' && appliedFilterDate) {
      const target = new Date(appliedFilterDate);
      target.setHours(0, 0, 0, 0);
      return d.getTime() === target.getTime();
    }
    if (patientFilterMode === 'range' && (appliedFilterFrom || appliedFilterTo)) {
      const from = appliedFilterFrom ? new Date(appliedFilterFrom) : null;
      const to = appliedFilterTo ? new Date(appliedFilterTo) : null;
      if (from) from.setHours(0, 0, 0, 0);
      if (to) to.setHours(23, 59, 59, 999);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    }
    return true;
  };

  const hasActivePatientFilter =
    (patientFilterMode === 'single' && appliedFilterDate !== '') ||
    (patientFilterMode === 'range' && (appliedFilterFrom !== '' || appliedFilterTo !== ''));

  const clearPatientFilter = () => {
    setPatientFilterDate('');
    setPatientFilterFrom('');
    setPatientFilterTo('');
    setAppliedFilterDate('');
    setAppliedFilterFrom('');
    setAppliedFilterTo('');
    setShowPatientFilter(false);
  };

  const filteredAllPatients = allPatients
    .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((p) => !hasActivePatientFilter || isPatientInFilter(p.last_visit_at))
    .filter((p) => {
      if (selectedDiagnoses.length === 0) return true;
      const patientDiags = (p as any).diagnoses_canonical || [];
      return selectedDiagnoses.some((d) => patientDiags.includes(d));
    });

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
          setNewPatient({ phone, name: patient.name, age: patient.age.toString(), gender: patient.gender, uhid: patient.uhid || '', address: patient.address || '' });
        } else {
          setExistingPatient(null);
          setNewPatient({ phone, name: '', age: '', gender: 'Male', uhid: '', address: '' });
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
    setNewPatient({ phone: '', name: '', age: '', gender: 'Male', uhid: '', address: '' });
    setReferredBy(''); // CHANGED: reset referredBy
    setNewLocationId(''); // CHANGED: reset location
    setNewScheduledAt(''); // CHANGED: reset date & time
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
        const scheduledIso = newScheduledAt ? new Date(newScheduledAt).toISOString() : undefined;
        const success = await handleAddToQueue(existingPatient, user!.id, referredBy, uhidToSave, newLocationId || undefined, scheduledIso); // CHANGED: use returned boolean
        if (success) { // CHANGED: check returned value, not stale formError
          handleCloseModal();
          await loadData();
        }
      } else {
        setFormError('This patient already has an appointment today!');
      }
    } else {
      const scheduledIso = newScheduledAt ? new Date(newScheduledAt).toISOString() : undefined;
      const success = await handleCreatePatient(newPatient, user!.id, referredBy, newLocationId || undefined, scheduledIso); // CHANGED: use returned boolean
      if (success) { // CHANGED: check returned value, not stale formError
        handleCloseModal();
        await loadData();
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar onManageLocations={() => setShowManageLocations(true)} />

      <div className="w-full px-4 py-6 xl:px-[160px]">
        <div className="mb-6 flex flex-col md:flex-row gap-3 items-start md:items-center">
          {/* Search bar takes up remaining flexible space on desktop */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#024CDB] focus:border-transparent"
            />
          </div>
          
          {/* Buttons anchor to the right on desktop, split 50/50 on mobile */}
          <div className="flex gap-3 w-full md:w-auto shrink-0">
            <button onClick={() => navigate('/clinical-summariser')} className="btn-secondary flex-1 md:flex-none flex items-center justify-center space-x-2">
              <Mic className="w-4 h-4" />
              <span>Summariser</span>
            </button> 
            <button onClick={() => setShowAddPatient(true)} className="btn-primary flex-1 md:flex-none flex items-center justify-center space-x-2">
              <Plus className="w-5 h-5" />
              <span>Appointment</span>
            </button>
          </div>
        </div>
       

        <div className="space-y-20">
         <section>
            {/* TABS NAVIGATION */}
            <div className="border-b border-gray-200 mb-6 mt-2">
              <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('today')}
                  className={`${
                    activeTab === 'today'
                      ? 'border-[#024CDB] text-[#024CDB]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                >
                  Today ({todaysAppointments.length})
                </button>
                <button
                  onClick={() => setActiveTab('upcoming')}
                  className={`${
                    activeTab === 'upcoming'
                      ? 'border-[#024CDB] text-[#024CDB]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                >
                  Upcoming ({upcomingAppointments.length})
                </button>
                <button
                  onClick={() => setActiveTab('summary')}
                  className={`${
                    activeTab === 'summary'
                      ? 'border-[#024CDB] text-[#024CDB]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                >
                  Summary
                </button>
              </nav>
            </div>

           {activeTab === 'today' && (
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-4">
                <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-gray-200">
                  <div className="flex-1 px-6 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Patients Today</p>
                    <p className="mt-1 text-2xl font-semibold text-gray-900">{todaysAppointments.length}</p>
                  </div>
                  <div className="flex-1 px-6 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Consultations Left</p>
                    <p className="mt-1 text-2xl font-semibold text-gray-900">{todaysAppointments.filter((a) => a.completed !== true).length}</p>
                  </div>
                </div>
              </div>
            )}
           
           {activeTab !== 'summary' && (
              <div>
                {loading ? (
                  <div className="flex justify-center py-8"><Spinner size="md" /></div>
                ) : filteredActiveAppointments.length === 0 ? (
                  <EmptyState message={`No appointments scheduled for ${activeTab === 'today' ? 'today' : 'the future'}`} />
                ) : hasAnyLocation ? (
                  <div className="space-y-8">
                    {locationGroups.map((group) => (
                      <div key={group.key}>
                        <div className="flex items-center gap-2 mb-3">
                          <h3 className="text-base font-semibold text-gray-900">{group.name}</h3>
                          <span className="inline-flex items-center justify-center text-xs font-medium text-gray-600 bg-gray-100 rounded-full px-2 py-0.5">
                            {group.items.length}
                          </span>
                        </div>
                        <PatientQueueTable
                          appointments={group.items}
                          pendingOnly={group.items.filter((a) => a.completed !== true)}
                          onMoveUp={onMoveUp}
                          onMoveDown={onMoveDown}
                          onRemove={handleRemoveClick}
                          onReschedule={(a) => setRescheduleTarget(a as unknown as AppointmentRow)}
                          showKebabMenu={showKebabMenu}
                          setShowKebabMenu={setShowKebabMenu}
                          formatDate={formatDate}
                          showActions={true}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <PatientQueueTable
                    appointments={sortedActiveAppointments}
                    pendingOnly={pendingActiveAppointments}
                    onMoveUp={onMoveUp}
                    onMoveDown={onMoveDown}
                    onRemove={handleRemoveClick}
                    onReschedule={(a) => setRescheduleTarget(a as unknown as AppointmentRow)}
                    showKebabMenu={showKebabMenu}
                    setShowKebabMenu={setShowKebabMenu}
                    formatDate={formatDate}
                    showActions={true}
                  />
                )}
              </div>
            )}

            {activeTab === 'summary' && user?.id && (
              <SummaryTab docId={user.id} />
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-lg font-semibold text-gray-900">All Patients</h2>
              <div className="flex items-center gap-2 flex-wrap">
                {(hasActivePatientFilter || selectedDiagnoses.length > 0) && (
                  <button
                    onClick={() => { clearPatientFilter(); setSelectedDiagnoses([]); }}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    Clear all
                  </button>
                )}
                <button
                  onClick={() => setShowDiagnosisFilter(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                    selectedDiagnoses.length > 0
                      ? 'bg-[#024CDB] text-white border-[#024CDB]'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  {selectedDiagnoses.length > 0 ? `Diagnosis (${selectedDiagnoses.length})` : 'Diagnosis'}
                </button>
                <button
                  onClick={() => setShowPatientFilter(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                    hasActivePatientFilter
                      ? 'bg-[#024CDB] text-white border-[#024CDB]'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  Date
                </button>
              </div>
            </div>
            {selectedDiagnoses.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {selectedDiagnoses.map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1 bg-blue-50 text-[#024CDB] text-xs font-medium px-2 py-1 rounded-full border border-blue-200"
                  >
                    {d}
                    <button
                      onClick={() => setSelectedDiagnoses((prev) => prev.filter((x) => x !== d))}
                      className="hover:text-blue-900"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-4">
              <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-gray-200">
                <div className="flex-1 px-6 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {hasActivePatientFilter ? 'Patients (Filtered)' : 'Number of Patients'}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">
                    {hasActivePatientFilter ? filteredAllPatients.length : patientsCount}
                  </p>
                </div>
                <div className="flex-1 px-6 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {hasActivePatientFilter ? 'Prescriptions (Filtered)' : 'Prescriptions Created'}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">
                    {hasActivePatientFilter
                      ? filteredAllPatients.filter((p) => p.last_visit_at).length
                      : prescriptionsCount}
                  </p>
                </div>
              </div>
            </div>
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
          className="flex flex-col gap-5"
        >
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{formError}</div>
          )}

          {/* Group 1: Contact & Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
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
              {existingPatient && <p className="text-xs text-green-600 mt-1">Patient found! Details auto-filled.</p>}
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
          </div>

          {/* Group 2: Demographics */}
          <div className="grid grid-cols-2 gap-4 sm:gap-5">
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

         {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address <span className="text-gray-400 text-xs">(optional)</span>
            </label>
            <input
              type="text"
              value={newPatient.address}
              onChange={(e) => setNewPatient({ ...newPatient, address: e.target.value })}
              className={`input-field ${existingPatient && existingPatient.address ? 'bg-gray-50' : ''}`}
              readOnly={!!(existingPatient && (existingPatient as any).address)}
              placeholder="e.g., Banjara Hills, Hyderabad"
            />
          </div>

          {/* Group 3: Clinical Identifiers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                UHID <span className="text-gray-400 text-xs">(optional)</span>
              </label>
              <input
                type="text"
                value={newPatient.uhid}
                onChange={(e) => setNewPatient({ ...newPatient, uhid: e.target.value })}
                className={`input-field ${existingPatient && existingPatient.uhid ? 'bg-gray-50' : ''}`}
                readOnly={!!(existingPatient && existingPatient.uhid)}
              />
            </div>
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
          </div>

          {/* Group 4: Appointment Logistics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location <span className="text-gray-400 text-xs">(optional)</span>
              </label>
              <LocationSelect
                locations={locations}
                value={newLocationId}
                onChange={setNewLocationId}
                onCreate={handleCreateLocation}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date &amp; Time <span className="text-gray-400 text-xs">(optional)</span>
              </label>
              <input
                type="datetime-local"
                value={newScheduledAt}
                onChange={(e) => setNewScheduledAt(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-3 justify-end pt-4 mt-2 border-t border-gray-100">
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

      <ManageLocationsModal
        isOpen={showManageLocations}
        onClose={() => setShowManageLocations(false)}
        locations={locations}
        onCreate={handleCreateLocation}
        onUpdate={handleUpdateLocation}
        onDelete={handleDeleteLocation}
      />

      <RescheduleModal
        isOpen={!!rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        patientName={rescheduleTarget?.patients?.name}
        currentValue={rescheduleTarget?.scheduled_at || rescheduleTarget?.created_at}
        onSubmit={async (iso) => {
          if (!rescheduleTarget) return false;
          return await handleReschedule(rescheduleTarget.id, iso);
        }}
      />

      {showPatientFilter && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setShowPatientFilter(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
           <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">Filter Patients by Visit Date</h3>
              <button onClick={() => setShowPatientFilter(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-5">
              <button
                onClick={() => { setPatientFilterMode('single'); setPatientFilterFrom(''); setPatientFilterTo(''); }}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  patientFilterMode === 'single' ? 'bg-[#024CDB] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Specific Date
              </button>
              <button
                onClick={() => { setPatientFilterMode('range'); setPatientFilterDate(''); }}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  patientFilterMode === 'range' ? 'bg-[#024CDB] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Date Range
              </button>
            </div>
            {patientFilterMode === 'single' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Visit Date</label>
                <input
                  type="date"
                  value={patientFilterDate}
                  onChange={(e) => setPatientFilterDate(e.target.value)}
                  className="input-field"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                  <input
                    type="date"
                    value={patientFilterFrom}
                    onChange={(e) => setPatientFilterFrom(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                  <input
                    type="date"
                    value={patientFilterTo}
                    onChange={(e) => setPatientFilterTo(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button
                onClick={clearPatientFilter}
                className="flex-1 btn-secondary text-sm"
              >
                Clear
              </button>
              <button
                onClick={() => {
                  setAppliedFilterDate(patientFilterDate);
                  setAppliedFilterFrom(patientFilterFrom);
                  setAppliedFilterTo(patientFilterTo);
                  setShowPatientFilter(false);
                }}
                className="flex-1 btn-primary text-sm"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
      {user?.id && (
        <DiagnosisFilterModal
          isOpen={showDiagnosisFilter}
          onClose={() => setShowDiagnosisFilter(false)}
          docId={user.id}
          selected={selectedDiagnoses}
          onApply={setSelectedDiagnoses}
        />
      )}
    </div>
  );
}
