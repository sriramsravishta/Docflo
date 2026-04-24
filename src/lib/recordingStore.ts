// src/lib/recordingStore.ts

export interface RecordingSession {
  mediaRecorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
  recordingState: 'recording' | 'paused';
  elapsed: number;
}

// Module-level Map — survives React unmounts and page navigation.
// Keyed by patientId.
const sessions = new Map<string, RecordingSession>();

export const recordingStore = {
  get: (id: string): RecordingSession | undefined => sessions.get(id),

  set: (id: string, s: RecordingSession): void => {
    sessions.set(id, s);
  },

  // Mutates in-place so MediaRecorder / stream / chunks references stay stable
  update: (id: string, patch: Partial<Pick<RecordingSession, 'recordingState' | 'elapsed'>>): void => {
    const s = sessions.get(id);
    if (s) Object.assign(s, patch);
  },

  delete: (id: string): void => {
    sessions.delete(id);
  },

  has: (id: string): boolean => sessions.has(id),
};