import { useState, useRef } from 'react';
import { useRealtimeSTT } from './useRealtimeSTT';
import { supabase } from '../lib/supabase';
import { createConsult, updateConsult, completeTodaysAppointmentByPatientAndDoctor, updateAppointmentConsultId } from '../lib/database'; // CHANGED: added updateAppointmentConsultId

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
  handleCancelRecording: () => void;
}

export function useRecording(
  patientId: string | undefined,
  userId: string | undefined,
  onRecordingComplete: () => void
): UseRecordingReturn & { recordingMode: 'consultation' | 'ot_note'; handleStartRecordingWithMode: (mode: 'consultation' | 'ot_note') => Promise<void> } {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [toast, setToast] = useState<ToastInfo | null>(null);
  const [recordingMode, setRecordingMode] = useState<'consultation' | 'ot_note'>('consultation');
  const realtimeSTT = useRealtimeSTT();
    const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const acquireWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('Wake lock acquired — screen will stay on');
      }
    } catch (e) {
      console.log('Wake lock not available:', e);
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
      console.log('Wake lock released');
    }
  };
  const clearToast = () => setToast(null);

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
      realtimeSTT.start(stream).catch(err => console.error('RealtimeSTT start failed:', err));
      setIsPaused(false);
      setRecordingTime(0);
      await acquireWakeLock();

      const interval = setInterval(() => {
  setRecordingTime((prev) => {
    const next = prev + 1;

    if (next >= 1200) {
      handleEndRecording();
      setToast({ message: 'Recording limit per session is 20 minutes. Recording stopped automatically.', type: 'info' });
      return prev;
    }

    return next;
  });
}, 1000);
      (window as Window & { recordingInterval?: ReturnType<typeof setInterval> }).recordingInterval = interval;
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to start recording. Please check microphone permissions.');
    }
  };

  const handlePauseRecording = () => {
    if (!mediaRecorder) return;
    const win = window as Window & { recordingInterval?: ReturnType<typeof setInterval> };
    if (isPaused) {
      mediaRecorder.resume();
      const interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
      win.recordingInterval = interval;
    } else {
      mediaRecorder.pause();
      clearInterval(win.recordingInterval);
    }
    setIsPaused(!isPaused);
  };

  const handleEndRecording = async () => {
    if (!mediaRecorder) return;
        releaseWakeLock();
    setIsRecording(false);
    const win = window as Window & { recordingInterval?: ReturnType<typeof setInterval> };
    clearInterval(win.recordingInterval);

    const recordingPromise = new Promise<Blob[]>((resolve) => {
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      mediaRecorder.onstop = () => resolve(chunks);
    });

    if (mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }

    try {
      const finalChunks = await recordingPromise;

if (recordingTime < 10) {
  setToast({ message: 'Recording must be at least 10 seconds to process', type: 'error' });
  return;
}

let recordingFileUrl: string | null = null;

if (finalChunks.length > 0) {
        const audioBlob = new Blob(finalChunks, { type: 'audio/webm' });
        const fileName = `consultation-${patientId}-${Date.now()}.webm`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('consultation-recordings')
          .upload(fileName, audioBlob, { contentType: 'audio/webm', upsert: false });
        if (uploadError) throw new Error('Failed to upload recording');
        const { data: urlData } = supabase.storage.from('consultation-recordings').getPublicUrl(uploadData.path);
        recordingFileUrl = urlData.publicUrl;
      }

           realtimeSTT.stop();
     const realtimeTranscript = realtimeSTT.source === 'realtime' && realtimeSTT.transcript
       ? realtimeSTT.transcript
       : undefined;

     const consult = await createConsult(userId!, patientId!, recordingFileUrl || '', recordingMode, realtimeTranscript);
      await updateConsult(consult.id, {
        recording_transcript: 'Dummy transcription text. Patient reports feeling tired and experiencing headaches for the past week.',
        consult_summary_ai: '',
      });

      // CHANGED: Save consult_id back to today's appointment
      try {
        await updateAppointmentConsultId(patientId!, userId!, consult.id);
      } catch (error) {
        console.error('Error updating appointment consult_id:', error);
      }

      try {
        await completeTodaysAppointmentByPatientAndDoctor(patientId!, userId!);
      } catch (error) {
        console.error('Error marking appointment as completed:', error);
      }

      onRecordingComplete();
    } catch (error) {
      console.error('Error saving consultation:', error);
      alert('Failed to save consultation');
    }
  };

    const handleCancelRecording = () => {
          releaseWakeLock();
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    const win = window as Window & { recordingInterval?: ReturnType<typeof setInterval> };
    clearInterval(win.recordingInterval);
    setIsRecording(false);
    setIsPaused(false);
    setRecordingTime(0);
    setMediaRecorder(null);
    setToast({ message: 'Recording cancelled', type: 'info' });
  };

  const handleStartRecordingWithMode = async (mode: 'consultation' | 'ot_note') => {
    setRecordingMode(mode);
    await handleStartRecording();
  };

    return { isRecording, isPaused, recordingTime, toast, clearToast, handleStartRecording, handlePauseRecording, handleEndRecording, handleCancelRecording, recordingMode, handleStartRecordingWithMode };
}
