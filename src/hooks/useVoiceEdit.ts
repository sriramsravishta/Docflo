import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { createConsultEdit, triggerVoiceEdit } from '../lib/database';

interface UseVoiceEditReturn {
  isRecording: boolean;
  recordingTime: number;
  startEditRecording: () => Promise<void>;
  stopEditRecording: () => Promise<void>;
  cancelEditRecording: () => void;
  currentEditId: string | null;
}

export function useVoiceEdit(
  consultId: string | undefined,
  docId: string | undefined
): UseVoiceEditReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [currentEditId, setCurrentEditId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startEditRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      intervalRef.current = setInterval(() => {
        setRecordingTime((t) => {
          if (t >= 90) {
            stopEditRecording();
            return t;
          }
          return t + 1;
        });
      }, 1000);
    } catch (e) {
      console.error('Voice edit mic failed:', e);
      alert('Microphone access denied');
    }
  };

  const stopEditRecording = async () => {
    if (!mediaRecorderRef.current || !consultId || !docId) return;

    return new Promise<void>((resolve) => {
      const recorder = mediaRecorderRef.current!;
      const wasRecording = recorder.state !== 'inactive';

      const finalize = async () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setIsRecording(false);

        if (chunksRef.current.length === 0) {
          resolve();
          return;
        }

        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });

          if (blob.size < 1000) {
            console.warn('Edit recording too short');
            resolve();
            return;
          }

          const fileName = `edit-${consultId}-${Date.now()}.webm`;
          const { data: upload, error: uploadErr } = await supabase.storage
            .from('consultation-recordings')
            .upload(fileName, blob, { contentType: 'audio/webm', upsert: false });

          if (uploadErr) throw uploadErr;

          const { data: urlData } = supabase.storage
            .from('consultation-recordings')
            .getPublicUrl(upload.path);

          const edit = await createConsultEdit(consultId, docId, urlData.publicUrl);
          setCurrentEditId(edit.id);
          triggerVoiceEdit(edit.id, consultId, urlData.publicUrl);
        } catch (e) {
          console.error('Voice edit upload/trigger failed:', e);
        } finally {
          resolve();
        }
      };

      if (wasRecording) {
        recorder.onstop = finalize;
        recorder.stop();
      } else {
        finalize();
      }
    });
  };

  const cancelEditRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRecording(false);
    setRecordingTime(0);
    chunksRef.current = [];
  };

  return {
    isRecording,
    recordingTime,
    startEditRecording,
    stopEditRecording,
    cancelEditRecording,
    currentEditId,
  };
}