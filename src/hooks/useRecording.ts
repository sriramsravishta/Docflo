import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { createConsult, updateConsult, completeTodaysAppointmentByPatientAndDoctor } from '../lib/database';

interface UseRecordingReturn {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  handleStartRecording: () => Promise<void>;
  handlePauseRecording: () => void;
  handleEndRecording: () => Promise<void>;
}

export function useRecording(
  patientId: string | undefined,
  userId: string | undefined,
  onRecordingComplete: () => void
): UseRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);

      const interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
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

      const consult = await createConsult(userId!, patientId!, recordingFileUrl || '');
      await updateConsult(consult.id, {
        recording_transcript: 'Dummy transcription text. Patient reports feeling tired and experiencing headaches for the past week.',
        consult_summary_ai: '',
      });

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

  return { isRecording, isPaused, recordingTime, handleStartRecording, handlePauseRecording, handleEndRecording };
}
