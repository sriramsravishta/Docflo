import { useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface UseRealtimeSTTReturn {
  transcript: string;
  partialTranscript: string;
  source: 'realtime' | 'batch';
  isConnected: boolean;
  error: string | null;
  start: (stream: MediaStream) => Promise<void>;
    stop: () => Promise<string>;
  reset: () => void;
}

export function useRealtimeSTT(): UseRealtimeSTTReturn {
  const [transcript, setTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [source, setSource] = useState<'realtime' | 'batch'>('batch');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
    const accumulatedTranscriptRef = useRef('');
  const lastPartialRef = useRef('');

  const start = useCallback(async (stream: MediaStream) => {
    try {
      // 1. Get auth session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('RealtimeSTT: No auth session');
        setSource('batch');
        return;
      }

      // 2. Get single-use token from Edge Function
      const tokenRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stt-token`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!tokenRes.ok) {
        console.error('RealtimeSTT: Token request failed', tokenRes.status);
        setSource('batch');
        return;
      }

      const { token } = await tokenRes.json();

      // 3. Connect to ElevenLabs — ALL config goes in query params, NOT a separate message
                       const wsUrl = `wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&token=${token}&audio_format=pcm_16000&language_code=tel&language_hints=hin&language_hints=eng&include_language_detection=true`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('RealtimeSTT: WebSocket connected');
        setIsConnected(true);
        setSource('realtime');
        setError(null);
        // NO config message — config is in the URL query params
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('ElevenLabs Response:', data);

          if (data.message_type === 'session_started') {
            console.log('RealtimeSTT: Session started', data.session_id);
          } else if (data.message_type === 'committed_transcript') {
            // Finalized text — append to accumulated transcript
            const text = data.text?.trim();
            if (text) {
              accumulatedTranscriptRef.current += (accumulatedTranscriptRef.current ? ' ' : '') + text;
              setTranscript(accumulatedTranscriptRef.current);
              setPartialTranscript('');
            }
                    } else if (data.message_type === 'partial_transcript') {
            // Interim text — show live but don't commit yet
            const partialText = data.text || '';
            lastPartialRef.current = partialText;
            setPartialTranscript(partialText);
          } else if (data.message_type === 'input_error') {
            console.error('RealtimeSTT: Input error', data.error);
          } else if (data.message_type === 'error') {
            console.error('RealtimeSTT: Server error', data.error);
          }
        } catch (e) {
          console.error('RealtimeSTT: Parse error', e);
        }
      };

      ws.onerror = (e) => {
        console.error('RealtimeSTT: WebSocket error', e);
        setError('WebSocket connection failed');
        setSource('batch');
        setIsConnected(false);
      };

      ws.onclose = (e) => {
        console.log('RealtimeSTT: WebSocket closed', e.code, e.reason);
        setIsConnected(false);
        if (!accumulatedTranscriptRef.current) {
          setSource('batch');
        }
      };

      // 4. Set up PCM 16kHz audio capture from the same mic stream
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      const sourceNode = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16 PCM
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Base64 encode
        const bytes = new Uint8Array(pcm16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        // Send in the EXACT format the API requires — all 4 fields are required
        ws.send(JSON.stringify({
          message_type: 'input_audio_chunk',
          audio_base_64: base64,
          commit: false,
          sample_rate: 16000,
        }));
      };

      sourceNode.connect(processor);
      processor.connect(audioContext.destination);
    } catch (err) {
      console.error('RealtimeSTT: Start error', err);
      setSource('batch');
      setError(String(err));
    }
  }, []);

    const stop = useCallback((): string => {
    // Stop audio processing first
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    // Send a final commit signal before closing — tells ElevenLabs to finalize whatever it has
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({
          message_type: 'input_audio_chunk',
          audio_base_64: '',
          commit: true,
          sample_rate: 16000,
        }));
      } catch (e) {
        // ignore
      }
      // Give ElevenLabs 500ms to send back the committed_transcript before we close
      const ws = wsRef.current;
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      }, 500);
    }
    wsRef.current = null;
    setIsConnected(false);

    // Return committed text if available, otherwise fall back to last partial
    return accumulatedTranscriptRef.current || lastPartialRef.current;
  }, []);

  const reset = useCallback(() => {
    stop();
    setTranscript('');
    setPartialTranscript('');
    setSource('batch');
    setError(null);
    accumulatedTranscriptRef.current = '';
  }, [stop]);

  return {
    transcript,
    partialTranscript,
    source,
    isConnected,
    error,
    start,
    stop,
    reset,
  };
}