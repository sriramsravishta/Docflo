import { useState, useEffect } from 'react';
import { createPatient, getPatients, getTodaysAppointments, createAppointment, getPatientByPhone, updateAppointmentQueue, completeAppointment } from '../lib/database';
import type { AppointmentRow, PatientRow } from '../types/db';

interface UseMainPageDataReturn {
  loading: boolean;
  todaysAppointments: AppointmentRow[];
  allPatients: PatientRow[];
  loadData: () => Promise<void>;
  handleMoveUp: (appointment: AppointmentRow) => Promise<void>;
  handleMoveDown: (appointment: AppointmentRow) => Promise<void>;
  handleConfirmRemove: (appointment: AppointmentRow) => Promise<void>;
  handleCreatePatient: (data: { phone: string; name: string; age: string; gender: string }, userId: string) => Promise<void>;
  handleAddToQueue: (patient: PatientRow, userId: string) => Promise<void>;
  checkExistingAppointment: (patientId: string) => boolean;
  formError: string;
  setFormError: (e: string) => void;
  isSubmitting: boolean;
  setIsSubmitting: (v: boolean) => void;
}

export function useMainPageData(userId: string | undefined): UseMainPageDataReturn {
  const [loading, setLoading] = useState(true);
  const [todaysAppointments, setTodaysAppointments] = useState<AppointmentRow[]>([]);
  const [allPatients, setAllPatients] = useState<PatientRow[]>([]);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const [appointments, patients] = await Promise.all([
        getTodaysAppointments(userId),
        getPatients(),
      ]);
      setTodaysAppointments(appointments);
      setAllPatients(patients);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
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
    data: { phone: string; name: string; age: string; gender: string },
    userId: string
  ) => {
    setFormError('');
    setIsSubmitting(true);
    try {
      const existing = await getPatientByPhone(data.phone, userId);
      if (existing) {
        setFormError('A patient with this phone number already exists!');
        return;
      }
      const patient = await createPatient({
        name: data.name,
        age: parseInt(data.age),
        phone: data.phone,
        gender: data.gender,
      });
      await createAppointment(patient.id, userId);
      await loadData();
    } catch (error) {
      console.error('Error creating patient:', error);
      setFormError('Failed to create patient. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddToQueue = async (existingPatient: { id: string }, doctorId: string, referredBy?: string) => { // CHANGED: added referredBy param 
    setFormError('');
    setIsSubmitting(true);
    try {
      if (checkExistingAppointment(patient.id)) {
        setFormError('This patient already has an appointment today!');
        return;
      }
      await createAppointment(patient.id, userId);
      await loadData();
    } catch (error) {
      console.error('Error adding to queue:', error);
      setFormError('Failed to add to queue. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
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
    setIsSubmitting,
  };
}
