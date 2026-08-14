import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { createConsultEdit, triggerVoiceEdit } from '../lib/database';

interface UseVoiceEditReturn {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  editStatus: 'idle' | 'processing' | 'ready' | 'failed';
  changedFields: string[];
  lastEditId: string | null;
  startEditRecording: () => Promise<void>;
  stopEditRecording: () => Promise<void>;
  pauseEditRecording: () => void;
  cancelEditRecording: () => void;
  dismissEdit: () => void;
}

export function useVoiceEdit(
  consultId: string | undefined,
  docId: string | undefined
): UseVoiceEditReturn {
    const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [editStatus, setEditStatus] = useState<'idle' | 'processing' | 'ready' | 'failed'>('idle');
  const [changedFields, setChangedFields] = useState<string[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);
  const currentEditIdRef = useRef<string | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Start polling consult_edits for status changes
  const startPolling = useCallback((editId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollCountRef.current = 0;

    pollRef.current = setInterval(async () => {
      pollCountRef.current += 1;

      // Timeout after 40 polls (2 minutes) — something went wrong
      if (pollCountRef.current > 40) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setEditStatus('failed');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('consult_edits')
          .select('status, changed_fields, error_message')
          .eq('id', editId)
          .single();

        if (error || !data) return; // keep polling

               const hasChanges = Array.isArray(data.changed_fields) && data.changed_fields.length > 0;
        if (data.status === 'completed' || (data.status === 'failed' && hasChanges)) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setChangedFields(data.changed_fields || []);
          setEditStatus('ready');
        } else if (data.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setEditStatus('failed');
          console.error('Voice edit failed:', data.error_message);
        }
        // else status === 'processing' → keep polling
      } catch (e) {
        console.error('Poll error:', e);
        // Don't stop polling on transient errors
      }
    }, 3000);
  }, []);

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
      setEditStatus('idle');
      setChangedFields([]);
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

          // Set processing IMMEDIATELY so UI reacts
          setEditStatus('processing');

          const fileName = `edit-${consultId}-${Date.now()}.webm`;
          const { data: upload, error: uploadErr } = await supabase.storage
            .from('consultation-recordings')
            .upload(fileName, blob, { contentType: 'audio/webm', upsert: false });

          if (uploadErr) throw uploadErr;

          const { data: urlData } = supabase.storage
            .from('consultation-recordings')
            .getPublicUrl(upload.path);

          const edit = await createConsultEdit(consultId, docId, urlData.publicUrl);
          currentEditIdRef.current = edit.id;
          triggerVoiceEdit(edit.id, consultId, urlData.publicUrl);

          // Start polling for completion
          startPolling(edit.id);
        } catch (e) {
          console.error('Voice edit upload/trigger failed:', e);
          setEditStatus('failed');
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

  const dismissEdit = () => {
    setEditStatus('idle');
    setChangedFields([]);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

    return {
    isRecording,
    recordingTime,
    editStatus,
    changedFields,
    lastEditId: currentEditIdRef.current,
    startEditRecording,
    stopEditRecording,
    cancelEditRecording,
    dismissEdit,
  };
}