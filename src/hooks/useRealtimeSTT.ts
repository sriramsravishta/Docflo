import { useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface UseRealtimeSTTReturn {
  transcript: string;
  partialTranscript: string;
  source: 'realtime' | 'batch';
  isConnected: boolean;
  error: string | null;
  start: (stream: MediaStream) => Promise<void>;
  stop: () => void;
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

  const start = useCallback(async (stream: MediaStream) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('RealtimeSTT: No auth session');
        setSource('batch');
        return;
      }

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

      const wsUrl = `wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&token=${token}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('RealtimeSTT: WebSocket connected');
        setIsConnected(true);
        setSource('realtime');
        setError(null);

        ws.send(JSON.stringify({
          type: 'config',
          config: {
            language_code: 'auto',
            keyterms: [],
          },
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("ElevenLabs Response:", data);

          if (data.type === 'transcript') {
            if (data.is_final) {
              const text = data.text?.trim();
              if (text) {
                accumulatedTranscriptRef.current += (accumulatedTranscriptRef.current ? ' ' : '') + text;
                setTranscript(accumulatedTranscriptRef.current);
                setPartialTranscript('');
              }
            } else {
              setPartialTranscript(data.text || '');
            }
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

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      const sourceNode = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        const bytes = new Uint8Array(pcm16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        ws.send(JSON.stringify({
          type: 'audio',
          audio_event: {
            audio_base_64: base64,
          },
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

  const stop = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'close_connection' }));
      } catch (e) {
        // ignore
      }
      wsRef.current.close();
    }
    wsRef.current = null;
    setIsConnected(false);
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