import { useState, useEffect } from 'react';
import { Plus, Search, Mic, Settings, Filter, ChevronDown, ChevronRight, Phone, Calendar, User } from 'lucide-react';
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
import type { AppointmentRow, LeadRow } from '../types/db';
import SummaryTab from '../components/features/SummaryTab';
import { useFeatureFlag } from '../contexts/FeatureFlagsContext';
import { supabase } from '../lib/supabase';
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

    const hasLeadsFeature = useFeatureFlag('leads_management');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'summary' | 'leads'>('today');
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadFilter, setLeadFilter] = useState<'All' | 'Dr. Sushma Peruri' | 'Dr. Prashanth Koyyoda'>('All');
  const [showAddPatient, setShowAddPatient] = useState(false);
   const [existingPatient, setExistingPatient] = useState<{ id: string; name: string; age: number; gender: string; phone: string; uhid?: string; address?: string; last_visit_at?: string | null } | null>(null);
  const [showRemoveConfirmation, setShowRemoveConfirmation] = useState(false);
  const [appointmentToRemove, setAppointmentToRemove] = useState<{ id: string; patients?: { name?: string } } | null>(null);
  const [showKebabMenu, setShowKebabMenu] = useState<string | null>(null);
  const [newPatient, setNewPatient] = useState({ phone: '', name: '', age: '', gender: 'Male', uhid: '' }); // CHANGED: added uhid
const [referredBy, setReferredBy] = useState(''); // CHANGED: added referredBy (appointment-level field)
  const [newLocationId, setNewLocationId] = useState(''); // CHANGED: appointment location
  const [newScheduledAt, setNewScheduledAt] = useState(''); // CHANGED: appointment date & time
    const [lastVisitAt, setLastVisitAt] = useState(''); // last visit date for new/existing patient
  const [showOptionalFields, setShowOptionalFields] = useState(false); // accordion toggle
  const [showManageLocations, setShowManageLocations] = useState(false);
    const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentRow | null>(null);

  useEffect(() => {
    if (activeTab === 'leads' && hasLeadsFeature && user?.id) {
      fetchLeads();
    }
  }, [activeTab, hasLeadsFeature, user?.id]);

  const fetchLeads = async () => {
    if (!user?.id) return;
    setLeadsLoading(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('doc_id', user.id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLeadsLoading(false);
    }
  };

  const handleLeadStatusChange = async (leadId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', leadId);
      
      if (error) throw error;
      setLeads(leads.map(l => l.id === leadId ? { ...l, status: newStatus as any } : l));
    } catch (error) {
      console.error('Error updating lead status:', error);
    }
  };

  const handleLeadNoteSave = async (leadId: string, notes: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ notes, updated_at: new Date().toISOString() })
        .eq('id', leadId);
        
      if (error) throw error;
      setLeads(leads.map(l => l.id === leadId ? { ...l, notes } : l));
    } catch (error) {
      console.error('Error updating lead notes:', error);
    }
  };

  const handleCreateFromLead = (lead: LeadRow) => {
    setNewPatient({ 
      phone: lead.phone || '', 
      name: lead.lead_name || '', 
      age: '', 
      gender: 'Male', 
      uhid: '', 
      address: '' 
    });
    handlePhoneChange(lead.phone || '');
    setShowAddPatient(true);
  };

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

    const [showFilters, setShowFilters] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>({
    dateMode: 'none',
    date: '',
    from: '',
    to: '',
    diagnoses: [],
  });

  const isPatientInDateFilter = (dateStr?: string): boolean => {
    if (appliedFilters.dateMode === 'none') return true;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    if (appliedFilters.dateMode === 'specific' && appliedFilters.date) {
      const target = new Date(appliedFilters.date);
      target.setHours(0, 0, 0, 0);
      return d.getTime() === target.getTime();
    }
    if (appliedFilters.dateMode === 'range') {
      const from = appliedFilters.from ? new Date(appliedFilters.from) : null;
      const to = appliedFilters.to ? new Date(appliedFilters.to) : null;
      if (from) from.setHours(0, 0, 0, 0);
      if (to) to.setHours(23, 59, 59, 999);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    }
    return true;
  };

  const hasActiveFilters =
    appliedFilters.dateMode !== 'none' || appliedFilters.diagnoses.length > 0;

  const clearAllFilters = () => {
    setAppliedFilters({ dateMode: 'none', date: '', from: '', to: '', diagnoses: [] });
  };

  const filteredAllPatients = allPatients
    .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((p) => isPatientInDateFilter(p.last_visit_at))
    .filter((p) => {
      if (appliedFilters.diagnoses.length === 0) return true;
      const patientDiags = (p as any).diagnoses_canonical || [];
      return appliedFilters.diagnoses.some((d) => patientDiags.includes(d));
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
          // Prefill last visit date if the patient already has one
          if (patient.last_visit_at) {
            setLastVisitAt(patient.last_visit_at.split('T')[0]);
          }
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
    setLastVisitAt('');
    setShowOptionalFields(false);
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
        const lastVisitIso = lastVisitAt ? new Date(lastVisitAt).toISOString() : undefined;
        const success = await handleAddToQueue(existingPatient, user!.id, referredBy, uhidToSave, newLocationId || undefined, scheduledIso, lastVisitIso);
        if (success) { // CHANGED: check returned value, not stale formError
          handleCloseModal();
          await loadData();
        }
      } else {
        setFormError('This patient already has an appointment today!');
      }
    } else {
           const scheduledIso = newScheduledAt ? new Date(newScheduledAt).toISOString() : undefined;
      const lastVisitIso = lastVisitAt ? new Date(lastVisitAt).toISOString() : undefined;
      const success = await handleCreatePatient(newPatient, user!.id, referredBy, newLocationId || undefined, scheduledIso, lastVisitIso);
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
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <button
                    onClick={clearAllFilters}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    Clear all
                  </button>
                )}
                <button
                  onClick={() => setShowFilters(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                    hasActiveFilters
                      ? 'bg-[#024CDB] text-white border-[#024CDB]'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  {hasActiveFilters
                    ? `Filters (${(appliedFilters.dateMode !== 'none' ? 1 : 0) + appliedFilters.diagnoses.length})`
                    : 'Filter'}
                </button>
              </div>
            </div>
                        {hasActiveFilters && (
              <div className="mb-3 flex flex-wrap gap-2">
                {appliedFilters.dateMode === 'specific' && appliedFilters.date && (
                  <span className="inline-flex items-center gap-1 bg-blue-50 text-[#024CDB] text-xs font-medium px-2 py-1 rounded-full border border-blue-200">
                    Date: {new Date(appliedFilters.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    <button onClick={() => setAppliedFilters({ ...appliedFilters, dateMode: 'none', date: '' })} className="hover:text-blue-900">×</button>
                  </span>
                )}
                {appliedFilters.dateMode === 'range' && (appliedFilters.from || appliedFilters.to) && (
                  <span className="inline-flex items-center gap-1 bg-blue-50 text-[#024CDB] text-xs font-medium px-2 py-1 rounded-full border border-blue-200">
                    Range: {appliedFilters.from || '…'} to {appliedFilters.to || '…'}
                    <button onClick={() => setAppliedFilters({ ...appliedFilters, dateMode: 'none', from: '', to: '' })} className="hover:text-blue-900">×</button>
                  </span>
                )}
                {appliedFilters.diagnoses.map((d) => (
                  <span key={d} className="inline-flex items-center gap-1 bg-blue-50 text-[#024CDB] text-xs font-medium px-2 py-1 rounded-full border border-blue-200">
                    {d}
                    <button onClick={() => setAppliedFilters({ ...appliedFilters, diagnoses: appliedFilters.diagnoses.filter((x) => x !== d) })} className="hover:text-blue-900">×</button>
                  </span>
                ))}
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-4">
              <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-gray-200">
                <div className="flex-1 px-6 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {hasActiveFilters ? 'Patients (Filtered)' : 'Number of Patients'}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">
                    {hasActiveFilters ? filteredAllPatients.length : patientsCount}
                  </p>
                </div>
                <div className="flex-1 px-6 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Prescriptions Created</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">{prescriptionsCount}</p>
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

          {/* Required: Phone + Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                className="input-field read-only:bg-gray-50"
                readOnly={!!existingPatient}
                required
              />
            </div>
          </div>

          {/* Required: Age + Gender */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Age <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={newPatient.age}
                onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })}
                                className="input-field read-only:bg-gray-50"
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
                                className="input-field bg-white disabled:bg-gray-50"
                disabled={!!existingPatient}
                required
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

                    {/* Optional Details — progressive disclosure */}
          <div>
            <button
              type="button"
              onClick={() => setShowOptionalFields(!showOptionalFields)}
              className="flex items-center gap-1.5 text-sm font-medium text-[#024CDB] hover:text-[#023BA3] transition-colors py-0.5"
            >
              {showOptionalFields
                ? <ChevronDown className="w-4 h-4" />
                : <ChevronRight className="w-4 h-4" />
              }
              Optional Details
            </button>

            {showOptionalFields && (
              <div className="mt-4 flex flex-col gap-4">
                {/* UHID + Referred By */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">UHID</label>
                    <input
                      type="text"
                      value={newPatient.uhid}
                      onChange={(e) => setNewPatient({ ...newPatient, uhid: e.target.value })}
                                            className="input-field read-only:bg-gray-50"
                      readOnly={!!(existingPatient && existingPatient.uhid)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Referred By</label>
                    <input
                      type="text"
                      value={referredBy}
                      onChange={(e) => setReferredBy(e.target.value)}
                      className="input-field"
                    />
                  </div>
                </div>

                {/* Location + Date & Time */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <LocationSelect
                      locations={locations}
                      value={newLocationId}
                      onChange={setNewLocationId}
                      onCreate={handleCreateLocation}
                    />
                  </div>
                                                     <div className="min-w-0 overflow-hidden">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date &amp; Time</label>
                    <input
                      type="datetime-local"
                      value={newScheduledAt}
                      onChange={(e) => setNewScheduledAt(e.target.value)}
                                                                                        className={`input-field w-full min-w-0 bg-white appearance-none h-10 ${!newScheduledAt ? 'text-gray-400' : ''}`}
                    />
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input
                    type="text"
                    value={newPatient.address}
                    onChange={(e) => setNewPatient({ ...newPatient, address: e.target.value })}
                    className="input-field"
                    placeholder="Full address"
                  />
                </div>

                {/* Last Visit Date */}
                                               <div className="min-w-0 overflow-hidden">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Visit Date</label>
                  <input
                    type="date"
                    value={lastVisitAt}
                    onChange={(e) => setLastVisitAt(e.target.value)}
                                                            className={`input-field w-full min-w-0 bg-white appearance-none h-10 ${!lastVisitAt ? 'text-gray-400' : ''}`}
                    max={new Date().toISOString().split('T')[0]}
                  />
                  <p className="text-xs text-gray-400 mt-1">Set if the patient visited you before Docflo</p>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex space-x-3 justify-end pt-2 border-t border-gray-100">
            <button type="button" onClick={handleCloseModal} className="btn-secondary" disabled={isSubmitting}>
              Cancel
            </button>
            {existingPatient ? (
              <button type="submit" className="btn-primary flex items-center justify-center" disabled={isSubmitting}>
                {isSubmitting ? <><Spinner size="sm" className="mr-2" />Adding...</> : 'Add to Queue'}
              </button>
            ) : (
              <button type="submit" className="btn-primary flex items-center justify-center" disabled={isSubmitting}>
                {isSubmitting ? <><Spinner size="sm" className="mr-2" />Creating...</> : 'Create'}
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

            {user?.id && (
        <PatientsFilterModal
          isOpen={showFilters}
          onClose={() => setShowFilters(false)}
          docId={user.id}
          applied={appliedFilters}
          onApply={setAppliedFilters}
        />
      )}
    </div>
  );
}
