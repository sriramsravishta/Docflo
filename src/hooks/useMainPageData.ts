import { useState, useEffect } from 'react';
import { createPatient, getPatients, getTodaysAppointments, getUpcomingAppointments, createAppointment, getPatientByPhone, updateAppointmentQueue, completeAppointment, updatePatient, getPrescriptionsCount, getPatientsCount, getLocations, createLocation, updateLocation, deactivateLocation, addLocationToPatient, updateAppointmentSchedule } from '../lib/database';
import type { AppointmentRow, PatientRow, LocationRow } from '../types/db';

interface UseMainPageDataReturn {
  loading: boolean;
  todaysAppointments: AppointmentRow[];
  upcomingAppointments: AppointmentRow[]; // ADDED: return type
  allPatients: PatientRow[];
  locations: LocationRow[];
  patientsCount: number;
  prescriptionsCount: number;
  loadData: () => Promise<void>;
  loadLocations: () => Promise<void>;
  handleMoveUp: (appointment: AppointmentRow) => Promise<void>;
  handleMoveDown: (appointment: AppointmentRow) => Promise<void>;
  handleConfirmRemove: (appointment: AppointmentRow) => Promise<void>;
  handleCreatePatient: (data: { phone: string; name: string; age: string; gender: string; uhid: string }, userId: string, referredBy?: string, locationId?: string, scheduledAt?: string) => Promise<boolean>; // CHANGED: returns boolean
  handleAddToQueue: (patient: PatientRow, userId: string, referredBy?: string, uhidToSave?: string, locationId?: string, scheduledAt?: string) => Promise<boolean>; // CHANGED: added uhidToSave, returns boolean
  handleReschedule: (appointmentId: string, scheduledAt: string) => Promise<boolean>;
  handleCreateLocation: (name: string) => Promise<LocationRow | null>;
  handleUpdateLocation: (id: string, name: string) => Promise<boolean>;
  handleDeleteLocation: (id: string) => Promise<boolean>;
  checkExistingAppointment: (patientId: string) => boolean;
  formError: string;
  setFormError: (e: string) => void;
  isSubmitting: boolean;
  setIsSubmitting: (v: boolean) => void;
}

export function useMainPageData(userId: string | undefined): UseMainPageDataReturn {
  const [loading, setLoading] = useState(true);
  const [todaysAppointments, setTodaysAppointments] = useState<AppointmentRow[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<AppointmentRow[]>([]); // ADDED: state variable
  const [allPatients, setAllPatients] = useState<PatientRow[]>([]);
  const [patientsCount, setPatientsCount] = useState(0);
  const [prescriptionsCount, setPrescriptionsCount] = useState(0);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const [appointments, upcoming, patients, rxCount, patientsTotal, locs] = await Promise.all([
        getTodaysAppointments(userId),
        getUpcomingAppointments(userId), // ADDED: Fetch future appointments
        getPatients(),
        getPrescriptionsCount(),
        getPatientsCount(),
        getLocations(userId),
      ]);
      setTodaysAppointments(appointments);
      setUpcomingAppointments(upcoming); // ADDED: Set the state
      setAllPatients(patients);
      setPrescriptionsCount(rxCount);
      setPatientsCount(patientsTotal);
      setLocations(locs);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLocations = async () => {
    if (!userId) return;
    try {
      setLocations(await getLocations(userId));
    } catch (error) {
      console.error('Error loading locations:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, [userId]);

  const checkExistingAppointment = (patientId: string): boolean => {
    return todaysAppointments.some((apt) => apt.patient_id === patientId);
  };

  const handleMoveUp = async (appointment: AppointmentRow) => {
    const currentIndex = todaysAppointments.findIndex((a) => a.id === appointment.id);
    if (currentIndex > 0) {
      const above = todaysAppointments[currentIndex - 1];
      try {
        await Promise.all([
          updateAppointmentQueue(appointment.id, above.queue),
          updateAppointmentQueue(above.id, appointment.queue),
        ]);
        await loadData();
      } catch (error) {
        console.error('Error moving appointment up:', error);
        alert('Failed to move appointment');
      }
    }
  };

  const handleMoveDown = async (appointment: AppointmentRow) => {
    const currentIndex = todaysAppointments.findIndex((a) => a.id === appointment.id);
    if (currentIndex < todaysAppointments.length - 1) {
      const below = todaysAppointments[currentIndex + 1];
      try {
        await Promise.all([
          updateAppointmentQueue(appointment.id, below.queue),
          updateAppointmentQueue(below.id, appointment.queue),
        ]);
        await loadData();
      } catch (error) {
        console.error('Error moving appointment down:', error);
        alert('Failed to move appointment');
      }
    }
  };

  const handleConfirmRemove = async (appointment: AppointmentRow) => {
    try {
      await completeAppointment(appointment.id);
      await loadData();
    } catch (error) {
      console.error('Error removing appointment:', error);
      alert('Failed to remove appointment');
    }
  };

  const handleCreatePatient = async (
        data: { phone: string; name: string; age: string; gender: string; uhid: string },
    userId: string,
    referredBy?: string, // CHANGED: added referredBy
    locationId?: string, // CHANGED: added location
        scheduledAt?: string,
    lastVisitAt?: string
  ): Promise<boolean> => {
    setFormError('');
    setIsSubmitting(true);
    try {
      const existing = await getPatientByPhone(data.phone, userId);
      if (existing) {
        setFormError('A patient with this phone number already exists!');
        return false; // CHANGED
      }
                  const patient = await createPatient({
        name: data.name,
        age: parseInt(data.age),
        phone: data.phone,
        gender: data.gender,
        uhid: data.uhid || undefined,
        address: data.address || undefined,
        last_visit_at: lastVisitAt || undefined,
      });
      await createAppointment(patient.id, userId, referredBy || undefined, locationId || undefined, scheduledAt || undefined); // CHANGED: pass referredBy, location, scheduled_at
      if (locationId) {
        await addLocationToPatient(patient.id, locationId); // CHANGED: accumulate location on patient
      }
      await loadData();
      return true; // CHANGED
    } catch (error) {
      console.error('Error creating patient:', error);
      setFormError('Failed to create patient. Please try again.');
      return false; // CHANGED
    } finally {
      setIsSubmitting(false);
    }
  };

    const handleAddToQueue = async (existingPatient: { id: string }, doctorId: string, referredBy?: string, uhidToSave?: string, locationId?: string, scheduledAt?: string, lastVisitAt?: string): Promise<boolean> => {
    setFormError('');
    setIsSubmitting(true);
    try {
      if (checkExistingAppointment(existingPatient.id)) { // FIXED: was patient.id (wrong variable)
        setFormError('This patient already has an appointment today!');
        return false; // CHANGED
      }
      if (uhidToSave) {
        await updatePatient(existingPatient.id, { uhid: uhidToSave }); // CHANGED: save uhid if provided
      }
      await createAppointment(existingPatient.id, doctorId, referredBy || undefined, locationId || undefined, scheduledAt || undefined); // FIXED: was patient.id + userId; CHANGED: pass referredBy, location, scheduled_at
      if (locationId) {
        await addLocationToPatient(existingPatient.id, locationId); // CHANGED: accumulate location on patient
      }
      await loadData();
      return true; // CHANGED
    } catch (error) {
      console.error('Error adding to queue:', error);
      setFormError('Failed to add to queue. Please try again.');
      return false; // CHANGED
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReschedule = async (appointmentId: string, scheduledAt: string): Promise<boolean> => {
    try {
      await updateAppointmentSchedule(appointmentId, scheduledAt);
      await loadData();
      return true;
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      return false;
    }
  };

  const handleCreateLocation = async (name: string): Promise<LocationRow | null> => {
    if (!userId) return null;
    try {
      const created = await createLocation(userId, name);
      await loadLocations();
      return created;
    } catch (error) {
      console.error('Error creating location:', error);
      return null;
    }
  };

  const handleUpdateLocation = async (id: string, name: string): Promise<boolean> => {
    try {
      await updateLocation(id, { name });
      await loadLocations();
      return true;
    } catch (error) {
      console.error('Error updating location:', error);
      return false;
    }
  };

  const handleDeleteLocation = async (id: string): Promise<boolean> => {
    try {
      await deactivateLocation(id);
      await loadLocations();
      return true;
    } catch (error) {
      console.error('Error deleting location:', error);
      return false;
    }
  };

  return {
    loading,
    todaysAppointments,
    upcomingAppointments, // ADDED: export to the component
    allPatients,
    locations,
    patientsCount,
    prescriptionsCount,
    loadData,
    loadLocations,
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
    setIsSubmitting,
  };
}