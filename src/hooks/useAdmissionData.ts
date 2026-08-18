import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getAdmissions, getActiveAdmission, getIPDNotes } from '../lib/database';
import type { AdmissionRow, IPDNoteRow } from '../types/db';

export function useAdmissionData(patientId: string | undefined, userId: string | undefined) {
  const [admissions, setAdmissions] = useState<AdmissionRow[]>([]);
  const [activeAdmission, setActiveAdmission] = useState<AdmissionRow | null>(null);
  const [ipdNotes, setIpdNotes] = useState<IPDNoteRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const loadAdmissions = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const data = await getAdmissions(patientId);
      setAdmissions(data);
      const active = data.find((a) => a.status === 'admitted') || null;
      setActiveAdmission(active);
    } catch (error) {
      console.error('Error loading admissions:', error);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  const loadIPDNotes = useCallback(async (admissionId: string) => {
    try {
      const data = await getIPDNotes(admissionId);
      setIpdNotes(data);
    } catch (error) {
      console.error('Error loading IPD notes:', error);
    }
  }, []);

  useEffect(() => {
    if (patientId) {
      loadAdmissions();
    }
  }, [patientId, loadAdmissions]);

  useEffect(() => {
    if (activeAdmission) {
      loadIPDNotes(activeAdmission.id);
    } else {
      setIpdNotes([]);
    }
  }, [activeAdmission, loadIPDNotes]);

  // Realtime subscription for admissions
  useEffect(() => {
    if (!patientId) return;

    const admissionsChannel = supabase
      .channel(`admissions_changes_${patientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'admissions',
          filter: `patient_id=eq.${patientId}`,
        },
        () => {
          loadAdmissions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(admissionsChannel);
    };
  }, [patientId, loadAdmissions]);

  // Realtime subscription for IPD notes
  useEffect(() => {
    if (!activeAdmission?.id) return;

    const notesChannel = supabase
      .channel(`ipd_notes_changes_${activeAdmission.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ipd_notes',
          filter: `admission_id=eq.${activeAdmission.id}`,
        },
        (payload) => {
          const newNote = payload.new as IPDNoteRow;
          const oldNote = payload.old as IPDNoteRow;
          
          if (
            (oldNote.status === 'processing' || !oldNote.status) &&
            (newNote.status === 'success' || newNote.status === 'failed')
          ) {
            setIpdNotes((prev) =>
              prev.map((note) => (note.id === newNote.id ? { ...note, ...newNote } : note))
            );
          } else {
            // Generic update fallback
            setIpdNotes((prev) =>
              prev.map((note) => (note.id === newNote.id ? { ...note, ...newNote } : note))
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ipd_notes',
          filter: `admission_id=eq.${activeAdmission.id}`,
        },
        (payload) => {
          const newNote = payload.new as IPDNoteRow;
          setIpdNotes((prev) => {
            if (prev.some((n) => n.id === newNote.id)) return prev;
            return [newNote, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notesChannel);
    };
  }, [activeAdmission?.id]);

  // Background poller for processing notes
  useEffect(() => {
    if (!activeAdmission?.id) return;

    const intervalId = setInterval(() => {
      setIpdNotes((prevNotes) => {
        const hasProcessing = prevNotes.some((n) => n.status === 'processing');
        if (hasProcessing) {
          loadIPDNotes(activeAdmission.id);
        }
        return prevNotes;
      });
    }, 4000);

    return () => {
      clearInterval(intervalId);
    };
  }, [activeAdmission?.id, loadIPDNotes]);

  return {
    admissions,
    activeAdmission,
    ipdNotes,
    loading,
    loadAdmissions,
    loadIPDNotes,
    setActiveAdmission,
    setAdmissions,
    setIpdNotes,
  };
}