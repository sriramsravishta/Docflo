import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getPatientById, getLatestSummary, getConsults } from '../lib/database';
import { getConsultSummary, isConsultProcessed } from '../lib/utils';
import type { PatientRow, ConsultRow, PreConsultRow, VitalRow, SummaryRow } from '../types/db';

interface UsePatientDataReturn {
   patient: PatientRow | null;
  setPatient: React.Dispatch<React.SetStateAction<PatientRow | null>>;
  loading: boolean;
  consultations: ConsultRow[];
  setConsultations: React.Dispatch<React.SetStateAction<ConsultRow[]>>;
  latestSummary: SummaryRow | null;
  setLatestSummary: React.Dispatch<React.SetStateAction<SummaryRow | null>>;
  processingPreConsults: PreConsultRow[];
  setProcessingPreConsults: React.Dispatch<React.SetStateAction<PreConsultRow[]>>;
  todaysVitals: VitalRow[];
  loadPatientData: () => Promise<{ patientData: PatientRow | null; summaryData: SummaryRow | null; consultsData: ConsultRow[] }>;
  loadTodaysVitals: () => Promise<void>;
  addProcessingPreConsultOptimistic: (row: PreConsultRow) => void;
  preConsultSectionRef: React.RefObject<HTMLDivElement | null>;
}

export function usePatientData(patientId: string | undefined, userId: string | undefined): UsePatientDataReturn {
  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [consultations, setConsultations] = useState<ConsultRow[]>([]);
  const [latestSummary, setLatestSummary] = useState<SummaryRow | null>(null);
  const [processingPreConsults, setProcessingPreConsults] = useState<PreConsultRow[]>([]);
  const [todaysVitals, setTodaysVitals] = useState<VitalRow[]>([]);

  const preConsultSectionRef = useRef<HTMLDivElement | null>(null);
  const preConsultRemovalTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const loadPatientData = async () => {
    try {
      setLoading(true);
      const [patientData, summaryData, consultsData] = await Promise.all([
        getPatientById(patientId!),
        getLatestSummary(patientId!),
        getConsults(patientId!),
      ]);
      setPatient(patientData);
      setLatestSummary(summaryData);
      setConsultations(consultsData);
      return { patientData, summaryData, consultsData };
    } catch (error) {
      console.error('Error loading patient data:', error);
      return { patientData: null, summaryData: null, consultsData: [] as ConsultRow[] };
    } finally {
      setLoading(false);
    }
  };

  const loadTodaysVitals = async () => {
    if (!patientId || !userId) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('vitals')
        .select('*')
        .eq('patient_id', patientId)
        .eq('doctor_id', userId)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTodaysVitals(data || []);
    } catch (error) {
      console.error('Error loading vitals:', error);
    }
  };

  const addProcessingPreConsultOptimistic = (row: PreConsultRow) => {
    setProcessingPreConsults((prev) => {
      if (prev.some((x) => x.id === row.id)) {
        return prev.map((x) => (x.id === row.id ? { ...x, ...row } : x));
      }
      return [row, ...prev];
    });
  };

  useEffect(() => {
    if (patientId) {
      loadPatientData();
      loadTodaysVitals();
    }
  }, [patientId]);

  useEffect(() => {
    if (!patientId) return;

    const channel = supabase
      .channel(`consult-watch-patient-${patientId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'consult', filter: `patient_id=eq.${patientId}` },
        (payload) => {
          const updated = payload.new as ConsultRow;
          setConsultations((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));

          const wasProcessed = !!getConsultSummary(updated);
          if (wasProcessed) {
            let tries = 0;
            const maxTries = 8;
            const poll = async () => {
              tries++;
              try {
                const summaryData = await getLatestSummary(patientId!);
                setLatestSummary(summaryData);
              } catch (e) {
                console.error('Error refreshing summary after consultation (poll):', e);
              }
              if (tries < maxTries) setTimeout(poll, 2000);
            };
            setTimeout(poll, 2000);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'summaries', filter: `patient_id=eq.${patientId}` },
        async () => {
          try {
            const summaryData = await getLatestSummary(patientId!);
            setLatestSummary(summaryData);
          } catch (e) {
            console.error('Error refreshing latestSummary from summaries realtime:', e);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [patientId]);

  useEffect(() => {
    if (!patientId) return;

    const loadProcessingPreConsults = async () => {
      try {
        const { data, error } = await supabase
          .from('pre_consult')
          .select('id, documents_uploaded, ai_summary, created_at')
          .eq('patient_id', patientId)
          .is('ai_summary', null)
          .order('created_at', { ascending: false });
        if (!error && data) setProcessingPreConsults(data);
      } catch (e) {
        console.error('Error loading processing pre-consults:', e);
      }
    };

    loadProcessingPreConsults();

    const channel = supabase
      .channel(`pre-consult-watch-patient-${patientId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pre_consult', filter: `patient_id=eq.${patientId}` },
        async (payload) => {
          const record = payload.new as PreConsultRow;
          if (payload.eventType === 'INSERT') {
            if (!record.ai_summary) {
              setProcessingPreConsults((prev) => [record, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            if (record.ai_summary) {
              const timerId = setTimeout(() => {
                setProcessingPreConsults((prev) => prev.filter((pc) => pc.id !== record.id));
                delete preConsultRemovalTimersRef.current[record.id];
              }, 60000);
              preConsultRemovalTimersRef.current[record.id] = timerId;
              setProcessingPreConsults((prev) =>
                prev.map((pc) => (pc.id === record.id ? { ...pc, ...record } : pc))
              );
              setTimeout(async () => {
                try {
                  const summaryData = await getLatestSummary(patientId);
                  setLatestSummary(summaryData);
                } catch (e) {
                  console.error('Error refreshing summary after pre-consult:', e);
                }
              }, 2000);
            } else {
              setProcessingPreConsults((prev) =>
                prev.map((pc) => (pc.id === record.id ? { ...pc, ...record } : pc))
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      Object.values(preConsultRemovalTimersRef.current).forEach(clearTimeout);
      preConsultRemovalTimersRef.current = {};
    };
  }, [patientId]);

  useEffect(() => {
    if (!patientId) return;
    const pending = (processingPreConsults || []).filter((pc) => !pc?.ai_summary);
    if (pending.length === 0) return;

    const earliestCreatedAt = pending.reduce((earliest: number, pc) => {
      const t = pc?.created_at ? new Date(pc.created_at).getTime() : Date.now();
      return t < earliest ? t : earliest;
    }, Date.now());

    const elapsed = Math.floor((Date.now() - earliestCreatedAt) / 1000);
    const POLL_START_DELAY_MS = Math.max(0, (30 - elapsed) * 1000);
    let interval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (Math.floor((Date.now() - earliestCreatedAt) / 1000) >= 180) return;
      interval = setInterval(async () => {
        if (Math.floor((Date.now() - earliestCreatedAt) / 1000) >= 180) {
          if (interval) clearInterval(interval);
          return;
        }
        try {
          const ids = pending.map((p) => p.id);
          const { data, error } = await supabase
            .from('pre_consult')
            .select('id, documents_uploaded, ai_summary, created_at')
            .in('id', ids);
          if (error || !data) return;
          setProcessingPreConsults((prev) =>
            prev.map((pc) => { const u = data.find((d) => d.id === pc.id); return u ? { ...pc, ...u } : pc; })
          );
          if (data.every((d) => !!d.ai_summary) && interval) clearInterval(interval);
        } catch (e) {
          console.error('Poll pre_consult failed:', e);
        }
      }, 3000);
    };

    const timeout = setTimeout(startPolling, POLL_START_DELAY_MS);
    return () => { clearTimeout(timeout); if (interval) clearInterval(interval); };
  }, [patientId, processingPreConsults]);

  useEffect(() => {
    if (!patientId) return;
    const pending = (consultations || []).filter((c) => !isConsultProcessed(c));
    if (pending.length === 0) return;

    const earliestCreatedAt = pending.reduce((earliest: number, c) => {
      const t = c?.created_at ? new Date(c.created_at).getTime() : Date.now();
      return t < earliest ? t : earliest;
    }, Date.now());

    const elapsed = Math.floor((Date.now() - earliestCreatedAt) / 1000);
    const POLL_START_DELAY_MS = Math.max(0, (30 - elapsed) * 1000);
    let interval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (Math.floor((Date.now() - earliestCreatedAt) / 1000) >= 180) return;
      interval = setInterval(async () => {
        if (Math.floor((Date.now() - earliestCreatedAt) / 1000) >= 180) {
          if (interval) clearInterval(interval);
          return;
        }
        try {
          const { data, error } = await supabase
            .from('consult')
            .select('id, consult_summary_final, created_at')
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false })
            .limit(25);
          if (error || !data || data.length === 0) return;
          setConsultations((prev) =>
            prev.map((c) => { const u = data.find((d) => d.id === c.id); return u ? { ...c, ...u } : c; })
          );
          const allDone = pending.every((pc) => {
            const match = data.find((d) => d.id === pc.id);
            return match ? !!getConsultSummary(match as ConsultRow) : false;
          });
          if (allDone && interval) clearInterval(interval);
        } catch (e) {
          console.error('Error polling consult cards (fallback catch):', e);
        }
      }, 3000);
    };

    const timeout = setTimeout(startPolling, POLL_START_DELAY_MS);
    return () => { clearTimeout(timeout); if (interval) clearInterval(interval); };
  }, [patientId, consultations]);

  return {
    patient,
    loading,
    consultations,
    setConsultations,
    latestSummary,
    setLatestSummary,
    processingPreConsults,
    setProcessingPreConsults,
    todaysVitals,
    loadPatientData,
    loadTodaysVitals,
    addProcessingPreConsultOptimistic,
    preConsultSectionRef,
  };
}
