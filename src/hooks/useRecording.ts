// src/hooks/useRecording.ts

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  createConsult,
  updateConsult,
  completeTodaysAppointmentByPatientAndDoctor,
  updateAppointmentConsultId,
} from '../lib/database';
import { recordingStore } from '../lib/recordingStore';

interface ToastInfo {
  message: string;
  type: 'error' | 'success' | 'info';
}

interface UseRecordingReturn {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  toast: ToastInfo | null;
  clearToast: () => void;
  handleStartRecording: () => Promise<void>;
  handlePauseRecording: () => void;
  handleEndRecording: () => Promise<void>;
}

export function useRecording(
  patientId: string | undefined,
  userId: string | undefined,
  onRecordingComplete: () => void,
): UseRecordingReturn {
  // On mount (including remount after navigation), read any existing session
  // for this patient so state is instantly restored.
  const existingSession = patientId ? recordingStore.get(patientId) : undefined;

  const [isRecording, setIsRecording] = useState(!!existingSession);
  const [isPaused, setIsPaused] = useState(existingSession?.recordingState === 'paused');
  const [recordingTime, setRecordingTime] = useState(existingSession?.elapsed ?? 0);
  const [toast, setToast] = useState<ToastInfo | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ref so the timer callback always calls the latest handleEndRecording closure
  const endRecordingRef = useRef<() => Promise<void>>();

  const clearToast = () => setToast(null);

  // ── Timer helpers ────────────────────────────────────────────────────────────

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = () => {
    stopTimer(); // avoid double-intervals
    timerRef.current = setInterval(() => {
      if (!patientId) return;
      const session = recordingStore.get(patientId);
      if (!session) { stopTimer(); return; }

      session.elapsed += 1;          // mutate in-place (same object reference)
      setRecordingTime(session.elapsed);

      if (session.elapsed >= 1200) { // 20-minute hard cap
        endRecordingRef.current?.();
        setToast({
          message: 'Recording limit per session is 20 minutes. Recording stopped automatically.',
          type: 'info',
        });
      }
    }, 1000);
  };

  // ── Mount / unmount lifecycle ────────────────────────────────────────────────

  useEffect(() => {
    if (!patientId) return;

    // If the user navigated away while recording (not paused), we auto-paused it
    // (see cleanup below). On remount we just show the paused state — no timer needed.
    // If somehow they come back to an actively recording session, restart the timer.
    const session = recordingStore.get(patientId);
    if (session?.recordingState === 'recording') {
      startTimer();
    }

    return () => {
      // Stop the local timer regardless — it's component-scoped.
      stopTimer();

      // Auto-pause so the MediaRecorder and collected audio are preserved
      // in the store while the user is away on a different page.
      const s = recordingStore.get(patientId);
      if (s?.recordingState === 'recording') {
        s.mediaRecorder.pause();
        s.recordingState = 'paused'; // mutate in-place
      }
    };
  // patientId is stable for the lifetime of a PatientProfile page
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  // ── Recording actions ────────────────────────────────────────────────────────

  const handleStartRecording = async () => {
    if (!patientId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      // Chunks accumulate in the store-owned array via this closure.
      // Using timeslice (1000 ms) means data is available progressively,
      // not only at stop() — so a hard refresh still has most of the audio.
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recordingStore.set(patientId, {
        mediaRecorder: recorder,
        stream,
        chunks,
        recordingState: 'recording',
        elapsed: 0,
      });

      recorder.start(1000);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      startTimer();
    } catch (err) {
      console.error('Error starting recording:', err);
      alert('Failed to start recording. Please check microphone permissions.');
    }
  };

  const handlePauseRecording = () => {
    if (!patientId) return;
    const session = recordingStore.get(patientId);
    if (!session) return;

    if (isPaused) {
      // Resume
      session.mediaRecorder.resume();
      session.recordingState = 'recording';
      setIsPaused(false);
      startTimer();
    } else {
      // Pause
      session.mediaRecorder.pause();
      session.recordingState = 'paused';
      setIsPaused(true);
      stopTimer();
    }
  };

  const handleEndRecording = async () => {
    if (!patientId) return;
    const session = recordingStore.get(patientId);
    if (!session) return;

    stopTimer();
    setIsRecording(false);
    setIsPaused(false);

    const { mediaRecorder, stream, chunks, elapsed } = session;

    // Remove from store immediately so a quick remount doesn't re-attach
    recordingStore.delete(patientId);

    // Wait for the recorder to flush the final chunk and fire onstop
    const donePromise = new Promise<void>((resolve) => {
      mediaRecorder.onstop = () => resolve();
    });
    if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    stream.getTracks().forEach((t) => t.stop());
    await donePromise;

    if (elapsed < 10) {
      setToast({ message: 'Recording must be at least 10 seconds to process', type: 'error' });
      return;
    }

    try {
      let recordingFileUrl: string | null = null;

      if (chunks.length > 0) {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const fileName = `consultation-${patientId}-${Date.now()}.webm`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('consultation-recordings')
          .upload(fileName, audioBlob, { contentType: 'audio/webm', upsert: false });
        if (uploadError) throw new Error('Failed to upload recording');
        const { data: urlData } = supabase.storage
          .from('consultation-recordings')
          .getPublicUrl(uploadData.path);
        recordingFileUrl = urlData.publicUrl;
      }

      const consult = await createConsult(userId!, patientId, recordingFileUrl || '');
      await updateConsult(consult.id, {
        recording_transcript:
          'Dummy transcription text. Patient reports feeling tired and experiencing headaches for the past week.',
        consult_summary_ai: '',
      });

      try {
        await updateAppointmentConsultId(patientId, userId!, consult.id);
      } catch (e) {
        console.error('Error updating appointment consult_id:', e);
      }

      try {
        await completeTodaysAppointmentByPatientAndDoctor(patientId, userId!);
      } catch (e) {
        console.error('Error marking appointment as completed:', e);
      }

      onRecordingComplete();
    } catch (err) {
      console.error('Error saving consultation:', err);
      alert('Failed to save consultation');
    }
  };

  // Keep the ref current on every render so the timer callback is never stale
  endRecordingRef.current = handleEndRecording;

  return {
    isRecording,
    isPaused,
    recordingTime,
    toast,
    clearToast,
    handleStartRecording,
    handlePauseRecording,
    handleEndRecording,
  };
}