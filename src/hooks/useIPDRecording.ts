import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { createIPDNote, triggerIPDNote } from '../lib/database';

export function useIPDRecording(
  admissionId: string | undefined,
  userId: string | undefined,
  admissionDate: string | undefined,
  onRecordingComplete: () => void
) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);

  const handleEndRecording = async () => {
    return new Promise<void>((resolve) => {
      if (!mediaRecorderRef.current || !admissionId || !userId || !admissionDate) {
        resetState();
        resolve();
        return;
      }

      const recorder = mediaRecorderRef.current;
      
      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          if (blob.size < 1000) {
            console.error('Recording too short, discarding');
            resetState();
            resolve();
            return;
          }

          const fileName = `ipd-${admissionId}-${Date.now()}.webm`;
          
          const { error: uploadError } = await supabase.storage
            .from('ipd-recordings')
            .upload(fileName, blob);

          if (uploadError) throw uploadError;

          const { data } = supabase.storage
            .from('ipd-recordings')
            .getPublicUrl(fileName);

          const publicUrl = data.publicUrl;
          const dayNumber = Math.max(1, Math.ceil((Date.now() - new Date(admissionDate).getTime()) / 86400000));
          
          const note = await createIPDNote(admissionId, userId, 'progress_note', publicUrl, dayNumber);
          if (note && note.id) {
            await triggerIPDNote(note.id, admissionId, publicUrl);
          }

          onRecordingComplete();
        } catch (error) {
          console.error('Error ending recording:', error);
        } finally {
          resetState();
          resolve();
        }
      };

      if (recorder.state !== 'inactive') {
        recorder.stop();
      } else {
        resolve();
      }
    });
  };

  const startTimer = useCallback(() => {
    timerRef.current = window.setInterval(() => {
      setRecordingTime((prev) => {
        if (prev >= 300) {
          handleEndRecording();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetState = useCallback(() => {
    setIsRecording(false);
    setIsPaused(false);
    setRecordingTime(0);
    chunksRef.current = [];
    stopTimer();
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current = null;
    }
  }, [stopTimer]);

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setIsPaused(false);
      startTimer();
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const handlePauseRecording = useCallback(() => {
    if (!mediaRecorderRef.current) return;

    if (mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      stopTimer();
    } else if (mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      startTimer();
    }
  }, [startTimer, stopTimer]);

  const handleCancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    resetState();
  }, [resetState]);

  useEffect(() => {
    return () => {
      resetState();
    };
  }, [resetState]);

  return {
    isRecording,
    isPaused,
    recordingTime,
    handleStartRecording,
    handleEndRecording,
    handlePauseRecording,
    handleCancelRecording,
  };
}