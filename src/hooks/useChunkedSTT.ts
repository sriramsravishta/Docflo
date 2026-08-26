import { useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ── Config ──────────────────────────────────────────────
const CHUNK_MAX_SECONDS = 45;
const CHUNK_MIN_SECONDS = 10;
const SILENCE_THRESHOLD_SECONDS = 1.5;
const OVERLAP_SECONDS = 5;
const SAMPLE_RATE = 16000;
const RMS_SILENCE_THRESHOLD = 0.008; // Tunable: lower = more sensitive to silence
const RMS_WINDOW_MS = 100; // Check silence every 100ms

interface ChunkResult {
  index: number;
  text: string;
  status: 'pending' | 'success' | 'failed';
}

interface UseChunkedSTTReturn {
  transcript: string;
  source: 'chunked' | 'batch';
  isProcessing: boolean;
  chunksCompleted: number;
  chunksPending: number;
  error: string | null;
  start: (stream: MediaStream) => Promise<void>;
  stop: () => Promise<string>;
  reset: () => void;
  onPause: () => void;
  onResume: (stream: MediaStream) => void;
}

export function useChunkedSTT(): UseChunkedSTTReturn {
  const [transcript, setTranscript] = useState('');
  const [source, setSource] = useState<'chunked' | 'batch'>('batch');
  const [isProcessing, setIsProcessing] = useState(false);
  const [chunksCompleted, setChunksCompleted] = useState(0);
  const [chunksPending, setChunksPending] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // ── Refs ──────────────────────────────────────────────
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Audio buffer: accumulates Int16 PCM samples
  const pcmBufferRef = useRef<Int16Array[]>([]);
  const bufferSampleCountRef = useRef(0);

  // Overlap: keep the last OVERLAP_SECONDS of audio from each chunk
  const overlapBufferRef = useRef<Int16Array | null>(null);

  // Chunk tracking
  const chunkIndexRef = useRef(0);
  const chunkResultsRef = useRef<Map<number, ChunkResult>>(new Map());
  const accumulatedTranscriptRef = useRef('');
  const anyChunkFailedRef = useRef(false);

  // VAD state
  const silenceStartRef = useRef<number | null>(null);
  const lastRmsCheckRef = useRef(0);
  const isActiveRef = useRef(false);

  // ── WAV encoding ──────────────────────────────────────
  const createWavBlob = useCallback((samples: Int16Array): Blob => {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = SAMPLE_RATE * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = samples.byteLength;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, SAMPLE_RATE, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeStr(36, 'data');
    view.setUint32(40, dataSize, true);

    new Uint8Array(buffer, 44).set(new Uint8Array(samples.buffer));
    return new Blob([buffer], { type: 'audio/wav' });
  }, []);

  // ── Merge PCM buffers into single Int16Array ──────────
  const mergePcmBuffers = useCallback((): Int16Array => {
    const totalSamples = bufferSampleCountRef.current;
    const merged = new Int16Array(totalSamples);
    let offset = 0;
    for (const chunk of pcmBufferRef.current) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return merged;
  }, []);

  // ── Rebuild transcript from all successful chunks (in order) ──
  const rebuildTranscript = useCallback(() => {
    const results = Array.from(chunkResultsRef.current.entries())
      .sort(([a], [b]) => a - b);

    const texts: string[] = [];
    for (const [, result] of results) {
      if (result.status === 'success' && result.text.trim()) {
        texts.push(result.text.trim());
      }
    }

    accumulatedTranscriptRef.current = texts.join(' ');
    setTranscript(accumulatedTranscriptRef.current);
  }, []);

  // ── Send a chunk to the edge function ─────────────────
  const sendChunk = useCallback(async (pcmData: Int16Array, index: number) => {
    const result: ChunkResult = { index, text: '', status: 'pending' };
    chunkResultsRef.current.set(index, result);
    setChunksPending(p => p + 1);

    const wavBlob = createWavBlob(pcmData);

    // Get auth session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      result.status = 'failed';
      anyChunkFailedRef.current = true;
      setChunksPending(p => p - 1);
      console.error(`ChunkedSTT: No auth session for chunk ${index}`);
      return;
    }

    const formData = new FormData();
    formData.append('audio', wavBlob, `chunk_${index}.wav`);
    formData.append('chunk_index', String(index));

    // Try up to 2 times (1 retry)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stt-chunk`,
          {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.access_token}` },
            body: formData,
          }
        );

        if (res.ok) {
          const data = await res.json();
          result.text = data.text || '';
          result.status = 'success';
          setChunksPending(p => p - 1);
          setChunksCompleted(c => c + 1);
          console.log(`ChunkedSTT: Chunk ${index} transcribed (${result.text.length} chars)`);

          // Rebuild transcript in order
          rebuildTranscript();
          return;
        }

        console.error(`ChunkedSTT: Chunk ${index} attempt ${attempt + 1} failed: ${res.status}`);
      } catch (err) {
        console.error(`ChunkedSTT: Chunk ${index} attempt ${attempt + 1} error:`, err);
      }
    }

    // Both attempts failed
    result.status = 'failed';
    anyChunkFailedRef.current = true;
    setChunksPending(p => p - 1);
    console.error(`ChunkedSTT: Chunk ${index} FAILED after 2 attempts`);
  }, [createWavBlob, rebuildTranscript]);

  // ── Flush current buffer as a chunk ───────────────────
  const flushBuffer = useCallback(() => {
    if (bufferSampleCountRef.current < SAMPLE_RATE * 2) {
      // Less than 2 seconds of audio — too short, skip
      return;
    }

    const fullPcm = mergePcmBuffers();

    // Save last OVERLAP_SECONDS as overlap for the next chunk
    const overlapSamples = OVERLAP_SECONDS * SAMPLE_RATE;
    if (fullPcm.length > overlapSamples) {
      overlapBufferRef.current = fullPcm.slice(fullPcm.length - overlapSamples);
    }

    // Clear buffer and pre-fill with overlap from this chunk
    pcmBufferRef.current = [];
    bufferSampleCountRef.current = 0;

    if (overlapBufferRef.current) {
      pcmBufferRef.current.push(overlapBufferRef.current);
      bufferSampleCountRef.current = overlapBufferRef.current.length;
    }

    // Send chunk (fire and forget — tracked via chunkResultsRef)
    const idx = chunkIndexRef.current++;
    console.log(`ChunkedSTT: Flushing chunk ${idx} (${(fullPcm.length / SAMPLE_RATE).toFixed(1)}s of audio)`);
    sendChunk(fullPcm, idx);
  }, [mergePcmBuffers, sendChunk]);

  // ── Shared audio processor handler ────────────────────
  const createAudioHandler = useCallback(() => {
    return (e: AudioProcessingEvent) => {
      if (!isActiveRef.current) return;

      const inputData = e.inputBuffer.getChannelData(0);

      // Convert Float32 → Int16 PCM
      const pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      // Accumulate
      pcmBufferRef.current.push(pcm16);
      bufferSampleCountRef.current += pcm16.length;

      const bufferSeconds = bufferSampleCountRef.current / SAMPLE_RATE;

      // ── VAD: Check RMS energy ───────────────────────
      const now = Date.now();
      if (now - lastRmsCheckRef.current >= RMS_WINDOW_MS) {
        lastRmsCheckRef.current = now;

        let sumSquares = 0;
        for (let i = 0; i < inputData.length; i++) {
          sumSquares += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sumSquares / inputData.length);

        if (rms < RMS_SILENCE_THRESHOLD) {
          // Silence detected
          if (silenceStartRef.current === null) {
            silenceStartRef.current = now;
          }
          const silenceDuration = (now - silenceStartRef.current) / 1000;

          // Trigger: silence > 1.5s AND buffer has at least 10s of audio
          if (silenceDuration >= SILENCE_THRESHOLD_SECONDS && bufferSeconds >= CHUNK_MIN_SECONDS) {
            silenceStartRef.current = null;
            flushBuffer();
          }
        } else {
          // Speech detected — reset silence timer
          silenceStartRef.current = null;
        }
      }

      // ── Max buffer cap: 45 seconds ──────────────────
      if (bufferSeconds >= CHUNK_MAX_SECONDS) {
        silenceStartRef.current = null;
        flushBuffer();
      }
    };
  }, [flushBuffer]);

  // ── Start ─────────────────────────────────────────────
  const start = useCallback(async (stream: MediaStream) => {
    try {
      setSource('chunked');
      setError(null);
      isActiveRef.current = true;
      chunkIndexRef.current = 0;
      chunkResultsRef.current.clear();
      accumulatedTranscriptRef.current = '';
      anyChunkFailedRef.current = false;
      pcmBufferRef.current = [];
      bufferSampleCountRef.current = 0;
      overlapBufferRef.current = null;
      silenceStartRef.current = null;
      setChunksCompleted(0);
      setChunksPending(0);

      const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioContextRef.current = audioContext;
      const sourceNode = audioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = sourceNode;
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = createAudioHandler();

      sourceNode.connect(processor);
      processor.connect(audioContext.destination);

      console.log('ChunkedSTT: Started audio capture');
    } catch (err) {
      console.error('ChunkedSTT: Start error', err);
      setSource('batch');
      setError(String(err));
    }
  }, [createAudioHandler]);

  // ── Stop ──────────────────────────────────────────────
  const stop = useCallback(async (): Promise<string> => {
    isActiveRef.current = false;

    // Disconnect audio processing
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    // Send final buffer as last chunk (if there's enough audio)
    if (bufferSampleCountRef.current >= SAMPLE_RATE * 2) {
      const finalPcm = mergePcmBuffers();
      const idx = chunkIndexRef.current++;
      setIsProcessing(true);
      console.log(`ChunkedSTT: Sending final chunk ${idx} (${(finalPcm.length / SAMPLE_RATE).toFixed(1)}s)`);
      await sendChunk(finalPcm, idx);
      setIsProcessing(false);
    }

    // Wait for any in-flight chunks (up to 30 seconds)
    const waitStart = Date.now();
    while (Date.now() - waitStart < 30000) {
      const pending = Array.from(chunkResultsRef.current.values())
        .filter(r => r.status === 'pending');
      if (pending.length === 0) break;
      await new Promise(r => setTimeout(r, 500));
    }

    // Rebuild final transcript
    rebuildTranscript();

    // If any chunk failed, signal batch fallback
    if (anyChunkFailedRef.current) {
      setSource('batch');
      console.warn('ChunkedSTT: Some chunks failed, falling back to batch');
    }

    console.log(`ChunkedSTT: Final transcript (${accumulatedTranscriptRef.current.length} chars)`);
    return accumulatedTranscriptRef.current;
  }, [mergePcmBuffers, sendChunk, rebuildTranscript]);

  // ── Pause (when doctor pauses recording) ──────────────
  const onPause = useCallback(() => {
    isActiveRef.current = false;

    // Flush whatever's in the buffer — doctor paused, natural boundary
    if (bufferSampleCountRef.current >= SAMPLE_RATE * 2) {
      console.log('ChunkedSTT: Doctor paused — flushing buffer');
      flushBuffer();
    }

    // Disconnect processor to stop capturing
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
  }, [flushBuffer]);

  // ── Resume (when doctor resumes recording) ────────────
  const onResume = useCallback((stream: MediaStream) => {
    if (!audioContextRef.current) return;

    isActiveRef.current = true;
    silenceStartRef.current = null;

    const sourceNode = audioContextRef.current.createMediaStreamSource(stream);
    sourceNodeRef.current = sourceNode;
    const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = createAudioHandler();

    sourceNode.connect(processor);
    processor.connect(audioContextRef.current.destination);

    console.log('ChunkedSTT: Resumed audio capture');
  }, [createAudioHandler]);

  // ── Reset ─────────────────────────────────────────────
  const reset = useCallback(() => {
    isActiveRef.current = false;
    if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
    if (sourceNodeRef.current) { sourceNodeRef.current.disconnect(); sourceNodeRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close().catch(() => {}); audioContextRef.current = null; }
    pcmBufferRef.current = [];
    bufferSampleCountRef.current = 0;
    overlapBufferRef.current = null;
    chunkResultsRef.current.clear();
    accumulatedTranscriptRef.current = '';
    anyChunkFailedRef.current = false;
    setTranscript('');
    setSource('batch');
    setError(null);
    setChunksCompleted(0);
    setChunksPending(0);
    setIsProcessing(false);
  }, []);

  return {
    transcript,
    source,
    isProcessing,
    chunksCompleted,
    chunksPending,
    error,
    start,
    stop,
    reset,
    onPause,
    onResume,
  };
}
