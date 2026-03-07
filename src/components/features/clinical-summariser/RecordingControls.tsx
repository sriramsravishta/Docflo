import { Mic, Pause, Play, Square } from 'lucide-react';

interface RecordingControlsProps {
  state: 'idle' | 'recording' | 'paused';
  elapsed: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function RecordingControls({
  state,
  elapsed,
  onStart,
  onPause,
  onResume,
  onStop,
}: RecordingControlsProps) {
  if (state === 'idle') {
    return (
      <div className="flex flex-col items-center gap-6">
        <div className="w-24 h-24 rounded-full bg-blue-50 flex items-center justify-center">
          <Mic className="w-10 h-10 text-[#024CDB]" />
        </div>
        <p className="text-gray-500 text-sm text-center max-w-xs">
          Press the button below to begin recording the clinical consultation.
        </p>
        <button onClick={onStart} className="btn-primary flex items-center gap-2 px-8 py-3 text-base">
          <Mic className="w-5 h-5" />
          Start Recording
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative w-24 h-24">
        <div
          className={`w-24 h-24 rounded-full flex items-center justify-center ${
            state === 'recording' ? 'bg-red-50' : 'bg-gray-100'
          }`}
        >
          <Mic
            className={`w-10 h-10 ${state === 'recording' ? 'text-red-500' : 'text-gray-400'}`}
          />
        </div>
        {state === 'recording' && (
          <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-red-500 animate-pulse" />
        )}
      </div>

      <div className="flex flex-col items-center gap-1">
        <span className="text-3xl font-mono font-semibold text-gray-900 tracking-wider">
          {formatTime(elapsed)}
        </span>
        <span className={`text-xs font-medium uppercase tracking-wider ${state === 'recording' ? 'text-red-500' : 'text-gray-400'}`}>
          {state === 'recording' ? 'Recording' : 'Paused'}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {state === 'recording' ? (
          <button
            onClick={onPause}
            className="btn-secondary flex items-center gap-2"
          >
            <Pause className="w-4 h-4" />
            Pause
          </button>
        ) : (
          <button
            onClick={onResume}
            className="btn-secondary flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            Resume
          </button>
        )}
        <button
          onClick={onStop}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition-colors"
        >
          <Square className="w-4 h-4" />
          Stop
        </button>
      </div>
    </div>
  );
}
