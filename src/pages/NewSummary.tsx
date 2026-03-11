import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import Navbar from '../components/Navbar';
import StepIndicator from '../components/features/clinical-summariser/StepIndicator';
import RecordingControls from '../components/features/clinical-summariser/RecordingControls';
import SummaryContent, { type SummaryJson } from '../components/features/clinical-summariser/SummaryContent';
import { useAuth } from '../contexts/AuthContext';
import {
  createDischargeSummary,
  updateDischargeSummaryRecordingStopped,
  getDischargeSummaryById,
  updateDischargeSummaryJson,
  saveDischargeSummaryEdits,
} from '../lib/database';

const SAMPLE_SUMMARY: SummaryJson = {
  patient_summary: {
    presenting_complaint: '65-year-old male admitted with acute onset chest pain radiating to left arm, associated with diaphoresis and shortness of breath for 3 hours.',
    duration_of_stay: '5 days (12 Mar 2025 – 17 Mar 2025)',
    admitting_diagnosis: 'Acute ST-Elevation Myocardial Infarction (STEMI) — Anterior wall',
  },
  history: {
    past_medical_history: ['Hypertension — 10 years', 'Type 2 Diabetes Mellitus — 7 years', 'Dyslipidaemia'],
    surgical_history: ['Appendectomy — 2001'],
    family_history: 'Father had coronary artery disease. Mother had Type 2 DM.',
    social_history: 'Ex-smoker (quit 2015, 20 pack-years). Occasional alcohol.',
  },
  investigations: {
    key_findings: [
      'ECG: ST elevations in V1–V4, reciprocal changes in inferior leads',
      'Troponin I: 4.8 ng/mL (markedly elevated)',
      'Echo: EF 38%, anterior wall hypokinesia',
      'Coronary angiography: 95% LAD occlusion',
    ],
    labs: [
      { name: 'HbA1c', value: '8.2%', interpretation: 'Poorly controlled' },
      { name: 'LDL Cholesterol', value: '168 mg/dL', interpretation: 'Elevated' },
      { name: 'Creatinine', value: '1.1 mg/dL', interpretation: 'Normal' },
    ],
  },
  procedures: [
    'Primary PCI performed — drug-eluting stent placed in proximal LAD',
    'Coronary care unit monitoring for 48 hours post-procedure',
  ],
  hospital_course: 'Patient underwent successful primary PCI within 90 minutes of presentation. Post-procedure course was uneventful. Cardiac rehabilitation counselling initiated. Diabetic and lipid management optimised.',
  discharge_medications: [
    { name: 'Aspirin', dose: '75mg', frequency: 'Once daily', duration: 'Lifelong' },
    { name: 'Clopidogrel', dose: '75mg', frequency: 'Once daily', duration: '12 months' },
    { name: 'Atorvastatin', dose: '40mg', frequency: 'Once at night', duration: 'Lifelong' },
    { name: 'Metoprolol', dose: '25mg', frequency: 'Twice daily', duration: '6 months' },
    { name: 'Ramipril', dose: '5mg', frequency: 'Once daily', duration: 'Lifelong' },
    { name: 'Metformin', dose: '500mg', frequency: 'Twice daily', duration: 'Ongoing' },
  ],
  discharge_instructions: [
    'Avoid strenuous activity for 4 weeks',
    'Cardiac rehab programme to be started within 2 weeks',
    'Low salt, low fat diet strictly advised',
    'Monitor blood sugar twice daily and maintain log',
    'Do not miss any medications — dual antiplatelet therapy is critical',
  ],
  follow_up: {
    appointments: [
      { department: 'Cardiology OPD', timeframe: '2 weeks' },
      { department: 'Diabetology', timeframe: '4 weeks' },
    ],
    warning_signs: [
      'Return immediately if chest pain recurs',
      'Seek emergency care for breathlessness, palpitations, or syncope',
    ],
  },
  flags_for_review: [
    'EF 38% — monitor for HFrEF progression',
    'HbA1c 8.2% — endocrinology review recommended',
    'Patient counselled on smoking cessation maintenance',
  ],
};

const CYCLING_WORDS = ['key details…', 'diagnosis…', 'medications…', 'history…', 'findings…', 'procedures…'];
const POLL_DELAY_MS = 30_000;
const POLL_INTERVAL_MS = 4_000;
const PROGRESS_DURATION_MS = 90_000;
const LONG_WAIT_MS = 90_000;

export default function NewSummary() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [recordState, setRecordState] = useState<'idle' | 'recording' | 'paused'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [summaryId, setSummaryId] = useState<string | null>(null);
  const [summaryJson, setSummaryJson] = useState<SummaryJson | null>(null);
  const [editedJson, setEditedJson] = useState<SummaryJson>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [cycleIdx, setCycleIdx] = useState(0);
  const [progressPct, setProgressPct] = useState(0);
  const [showLongWait, setShowLongWait] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => {
    return () => {
      stopTimer();
      if (pollRef.current) clearInterval(pollRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [stopTimer]);

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
  }, []);

  const handleStart = async () => {
    if (!user?.id) return;
    try {
      const row = await createDischargeSummary(user.id);
      setSummaryId(row.id);
      setRecordState('recording');
      startTimer();
    } catch (e) {
      console.error(e);
    }
  };

  const handlePause = () => {
    setRecordState('paused');
    stopTimer();
  };

  const handleResume = () => {
    setRecordState('recording');
    startTimer();
  };

  const handleStop = async () => {
    stopTimer();
    setRecordState('idle');
    if (summaryId) {
      try {
        await updateDischargeSummaryRecordingStopped(summaryId);
      } catch (e) {
        console.error(e);
      }
    }
    setStep(2);
    beginAnalysing();
  };

  const beginAnalysing = useCallback(() => {
    const cycleTimer = setInterval(() => setCycleIdx((i) => (i + 1) % CYCLING_WORDS.length), 1400);

    const start = Date.now();
    progressRef.current = setInterval(() => {
      const pct = Math.min(((Date.now() - start) / PROGRESS_DURATION_MS) * 100, 100);
      setProgressPct(pct);
      if (pct >= 100) {
        setShowLongWait(true);
        if (progressRef.current) clearInterval(progressRef.current);
      }
    }, 200);

    const longWaitTimer = setTimeout(() => setShowLongWait(true), LONG_WAIT_MS);

    const pollStart = setTimeout(() => {
      pollRef.current = setInterval(async () => {
        if (!summaryId) return;
        try {
          const row = await getDischargeSummaryById(summaryId);
          if (row?.summary_json) {
            clearInterval(pollRef.current!);
            clearInterval(cycleTimer);
            clearTimeout(longWaitTimer);
            if (progressRef.current) clearInterval(progressRef.current);
            setProgressPct(100);

            const parsed = row.summary_json as SummaryJson;
            setSummaryJson(parsed);
            setEditedJson(parsed);
            setStep(3);
          }
        } catch (e) {
          console.error(e);
        }
      }, POLL_INTERVAL_MS);
    }, POLL_DELAY_MS);

    return () => {
      clearInterval(cycleTimer);
      clearTimeout(pollStart);
      clearTimeout(longWaitTimer);
    };
  }, [summaryId]);

  const handleUseSample = () => {
    setSummaryJson(SAMPLE_SUMMARY);
    setEditedJson(SAMPLE_SUMMARY);

    if (summaryId) {
      const text = SAMPLE_SUMMARY.patient_summary?.presenting_complaint || '';
      updateDischargeSummaryJson(summaryId, SAMPLE_SUMMARY as unknown as Record<string, unknown>, text).catch(console.error);
    }
    setStep(3);
  };

  const handleSaveNote = async () => {
    if (!summaryId) return;
    setIsSaving(true);
    try {
      const text = (editedJson.patient_summary?.presenting_complaint || editedJson.patient_summary?.admitting_diagnosis || '').slice(0, 200);
      await saveDischargeSummaryEdits(summaryId, editedJson as unknown as Record<string, unknown>, text);
      setSaved(true);
      setTimeout(() => navigate(`/clinical-summariser/${summaryId}`), 800);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar showBack />

      <div className="w-full px-4 py-6 xl:px-[160px]">
        <nav className="text-xs text-gray-400 mb-6 flex items-center gap-1">
          <button onClick={() => navigate('/')} className="hover:text-[#024CDB] transition-colors">Main</button>
          <ChevronRight className="w-3 h-3" />
          <button onClick={() => navigate('/clinical-summariser')} className="hover:text-[#024CDB] transition-colors">Clinical Summariser</button>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-600">New Summary</span>
        </nav>

        <div className="mb-8">
          <StepIndicator currentStep={step} />
        </div>

        {step === 1 && (
          <div className="bg-white border border-gray-200 rounded-xl p-8 flex flex-col items-center">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Step 1: Record</h2>
            <RecordingControls
              state={recordState}
              elapsed={elapsed}
              onStart={handleStart}
              onPause={handlePause}
              onResume={handleResume}
              onStop={handleStop}
            />
          </div>
        )}

        {step === 2 && (
          <div className="bg-white border border-gray-200 rounded-xl p-8 flex flex-col items-center gap-6">
            <h2 className="text-lg font-semibold text-gray-900">Step 2: Analysing</h2>

            <div className="flex flex-col items-center gap-2 mt-2">
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-semibold text-gray-800">Extracting</span>
                <span
                  key={cycleIdx}
                  className="text-2xl font-semibold text-[#024CDB] transition-all"
                  style={{ animation: 'fadeIn 0.4s ease' }}
                >
                  {CYCLING_WORDS[cycleIdx]}
                </span>
              </div>
              <p className="text-sm text-gray-400">Please wait while we process the recording</p>
            </div>

            <div className="w-full max-w-sm">
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#024CDB] rounded-full transition-all duration-200"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              {showLongWait && (
                <p className="text-xs text-amber-600 mt-2 text-center">Taking longer than expected…</p>
              )}
            </div>

            <button
              onClick={handleUseSample}
              className="btn-secondary text-sm mt-2"
            >
              Use sample data (dev)
            </button>
          </div>
        )}

        {step === 3 && summaryJson && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Step 3: Review &amp; Save</h2>
              <button
                onClick={handleSaveNote}
                disabled={isSaving || saved}
                className="btn-primary flex items-center gap-2"
              >
                {isSaving ? 'Saving…' : saved ? 'Saved!' : 'Save Note'}
              </button>
            </div>
            <SummaryContent
              summary={summaryJson}
              isEditing={true}
              edited={editedJson}
              onChange={setEditedJson}
            />
            <div className="flex justify-end mt-6">
              <button
                onClick={handleSaveNote}
                disabled={isSaving || saved}
                className="btn-primary flex items-center gap-2"
              >
                {isSaving ? 'Saving…' : saved ? 'Saved!' : 'Save Note'}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
