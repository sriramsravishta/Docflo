import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mic, Square, Play, Pause } from 'lucide-react';
import Navbar from '../components/Navbar';
import ConfirmationModal from '../components/ConfirmationModal';

export default function ConsultSession() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showDraft, setShowDraft] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [draftData, setDraftData] = useState({
    diagnosis: 'Hypertension - Stage 1',
    history: 'Patient has been experiencing elevated blood pressure readings for the past 6 months. Family history of cardiovascular disease.',
    chiefComplaints: 'Headaches, dizziness, occasional chest discomfort',
    treatmentSuggested: 'Lifestyle modifications including reduced sodium intake, regular exercise, and stress management',
    medications: [
      { name: 'Amlodipine', frequency: 'Once daily', duration: '30 days', timing: 'Morning' },
    ],
    keyPersonalInsights: 'Patient is under significant work stress. Recent job change. Lives alone.',
    followupRecommendations: 'Follow-up after 2 weeks for blood pressure monitoring',
  });

  const handleStartRecording = () => {
    setIsRecording(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
  };

  const handleEndRecording = () => {
    setIsRecording(false);
    setIsAnalyzing(true);

    setTimeout(() => {
      setIsAnalyzing(false);
      setShowDraft(true);
    }, 3000);
  };

  const handleApprove = () => {
    setShowConfirmation(true);
  };

  const handleConfirmApprove = () => {
    setShowConfirmation(false);
    navigate(`/patient/${patientId}`);
  };

  const addMedication = () => {
    setDraftData({
      ...draftData,
      medications: [...draftData.medications, { name: '', frequency: '', duration: '', timing: '' }],
    });
  };

  const removeMedication = (index: number) => {
    const newMeds = draftData.medications.filter((_, i) => i !== index);
    setDraftData({ ...draftData, medications: newMeds });
  };

  const updateMedication = (index: number, field: string, value: string) => {
    const newMeds = [...draftData.medications];
    newMeds[index] = { ...newMeds[index], [field]: value };
    setDraftData({ ...draftData, medications: newMeds });
  };

  if (isAnalyzing) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar showBack />
        <div className="max-w-5xl mx-auto px-4 py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#024CDB] mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Analyzing audio and preparing draft...</h2>
            <p className="text-gray-600">This will take just a moment</p>
          </div>
        </div>
      </div>
    );
  }

  if (!showDraft) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar showBack />
        <div className="max-w-5xl mx-auto px-4 py-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-8">Consultation Session</h1>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-md mx-auto">
              {!isRecording ? (
                <button
                  onClick={handleStartRecording}
                  className="w-32 h-32 bg-[#024CDB] hover:bg-[#023BA3] text-white rounded-full flex items-center justify-center mx-auto transition-colors"
                >
                  <Mic className="w-12 h-12" />
                </button>
              ) : (
                <div className="space-y-6">
                  <div className="w-32 h-32 bg-red-500 rounded-full flex items-center justify-center mx-auto animate-pulse">
                    <Mic className="w-12 h-12 text-white" />
                  </div>

                  <div className="text-3xl font-mono text-gray-900">
                    {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                  </div>

                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={handlePause}
                      className="btn-secondary flex items-center space-x-2"
                    >
                      {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                      <span>{isPaused ? 'Resume' : 'Pause'}</span>
                    </button>

                    <button
                      onClick={handleEndRecording}
                      className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center space-x-2"
                    >
                      <Square className="w-5 h-5" />
                      <span>End Recording</span>
                    </button>
                  </div>
                </div>
              )}

              <p className="mt-6 text-gray-600">
                {isRecording
                  ? isPaused
                    ? 'Recording paused'
                    : 'Recording in progress...'
                  : 'Click to start recording the consultation'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar showBack />
      <div className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Review & Edit Consultation</h1>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Diagnosis</label>
            <textarea
              value={draftData.diagnosis}
              onChange={(e) => setDraftData({ ...draftData, diagnosis: e.target.value })}
              className="input-field min-h-20"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">History</label>
            <textarea
              value={draftData.history}
              onChange={(e) => setDraftData({ ...draftData, history: e.target.value })}
              className="input-field min-h-24"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Chief Complaints</label>
            <textarea
              value={draftData.chiefComplaints}
              onChange={(e) => setDraftData({ ...draftData, chiefComplaints: e.target.value })}
              className="input-field min-h-20"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Treatment Suggested</label>
            <textarea
              value={draftData.treatmentSuggested}
              onChange={(e) => setDraftData({ ...draftData, treatmentSuggested: e.target.value })}
              className="input-field min-h-24"
              rows={3}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-gray-900">Medications</label>
              <button onClick={addMedication} className="text-sm text-[#024CDB] hover:underline">
                + Add Medication
              </button>
            </div>
            <div className="space-y-4">
              {draftData.medications.map((med, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Medicine name"
                      value={med.name}
                      onChange={(e) => updateMedication(index, 'name', e.target.value)}
                      className="input-field"
                    />
                    <input
                      type="text"
                      placeholder="Frequency (e.g., Once daily)"
                      value={med.frequency}
                      onChange={(e) => updateMedication(index, 'frequency', e.target.value)}
                      className="input-field"
                    />
                    <input
                      type="text"
                      placeholder="Duration (e.g., 30 days)"
                      value={med.duration}
                      onChange={(e) => updateMedication(index, 'duration', e.target.value)}
                      className="input-field"
                    />
                    <input
                      type="text"
                      placeholder="Timing (e.g., Morning)"
                      value={med.timing}
                      onChange={(e) => updateMedication(index, 'timing', e.target.value)}
                      className="input-field"
                    />
                  </div>
                  <button
                    onClick={() => removeMedication(index)}
                    className="text-sm text-red-600 hover:underline mt-2"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Key Personal Insights
              <span className="ml-2 text-xs font-normal text-yellow-700">(NOT sent to patient)</span>
            </label>
            <textarea
              value={draftData.keyPersonalInsights}
              onChange={(e) => setDraftData({ ...draftData, keyPersonalInsights: e.target.value })}
              className="input-field min-h-20 bg-white"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Follow-up Recommendations</label>
            <textarea
              value={draftData.followupRecommendations}
              onChange={(e) => setDraftData({ ...draftData, followupRecommendations: e.target.value })}
              className="input-field min-h-20"
              rows={2}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button onClick={() => navigate(`/patient/${patientId}`)} className="btn-secondary flex-1">
              Cancel
            </button>
            <button onClick={handleApprove} className="btn-primary flex-1">
              Approve & Send to Patient
            </button>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleConfirmApprove}
        title="Send Consultation"
        message="This information will be sent to the patient on WhatsApp as a PDF. Proceed?"
      />
    </div>
  );
}
