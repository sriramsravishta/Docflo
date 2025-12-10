import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mic, Square, Play, Pause } from 'lucide-react';
import Navbar from '../components/Navbar';
import ConfirmationModal from '../components/ConfirmationModal';
import { createConsult, updateConsult } from '../lib/database';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function ConsultSession() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showDraft, setShowDraft] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isWaitingForAI, setIsWaitingForAI] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [showDelayMessage, setShowDelayMessage] = useState(false);
  const [consultId, setConsultId] = useState<string | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

  const [draftData, setDraftData] = useState({
    diagnosis: '',
    history: '',
    chiefComplaints: '',
    treatmentSuggested: '',
    medications: [{ name: '', frequency: '', duration: '', timing: '' }],
    keyPersonalInsights: '',
    followupRecommendations: '',
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }) + ' at ' + date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        setAudioChunks(chunks);
        stream.getTracks().forEach(track => track.stop());
      };

      setMediaRecorder(recorder);
      setAudioChunks([]);
      recorder.start();
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to start recording. Please check microphone permissions.');
      return;
    }

    setIsRecording(true);
    setIsPaused(false);
    const interval = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
    (window as any).recordingInterval = interval;
  };

  const handlePause = () => {
    const newPausedState = !isPaused;
    setIsPaused(newPausedState);
    
    if (mediaRecorder) {
      if (newPausedState) {
        mediaRecorder.pause();
      } else {
        mediaRecorder.resume();
      }
    }

    if (newPausedState) {
      // Pausing - stop the interval
      clearInterval((window as any).recordingInterval);
    } else {
      // Resuming - restart the interval
      const interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      (window as any).recordingInterval = interval;
    }
  };

  const handleEndRecording = async () => {
    setIsRecording(false);
    clearInterval((window as any).recordingInterval);

    if (mediaRecorder) {
      // Create a promise that resolves when recording stops
      const recordingPromise = new Promise<Blob[]>((resolve) => {
        const chunks: Blob[] = [];
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          resolve(chunks);
        };
      });
      
      // Stop recording
      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      
      setIsAnalyzing(true);
      
      try {
        // Wait for recording to complete
        const finalChunks = await recordingPromise;
        let recordingFileUrl = '';

        if (finalChunks.length > 0) {
          // Create audio blob from chunks
          const audioBlob = new Blob(finalChunks, { type: 'audio/webm' });
          const fileName = `consultation-${patientId}-${Date.now()}.webm`;

          console.log('Uploading audio file:', fileName, 'Size:', audioBlob.size);

          // Upload to Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('consultation-recordings')
            .upload(fileName, audioBlob, {
              contentType: 'audio/webm',
              upsert: false
            });

          if (uploadError) {
            console.error('Storage upload error:', uploadError);
            throw new Error('Failed to upload recording');
          }

          console.log('Upload successful:', uploadData);

          // Get public URL
          const { data: urlData } = supabase.storage
            .from('consultation-recordings')
            .getPublicUrl(uploadData.path);

          recordingFileUrl = urlData.publicUrl;
          console.log('Public URL:', recordingFileUrl);
        } else {
          console.warn('No audio chunks recorded');
        }

        // Create consultation record with the public URL
        const consult = await createConsult(
          user!.id,
          patientId!,
          recordingFileUrl
        );

        console.log('Consultation created with recording URL:', recordingFileUrl);
        setConsultId(consult.id);

        // Set empty AI summary initially - will be filled by n8n workflow
        await updateConsult(consult.id, {
          recording_transcript: 'Dummy transcription text. Patient reports feeling tired and experiencing headaches for the past week.',
          consult_summary_ai: ''
        });

        setIsAnalyzing(false);
        setIsWaitingForAI(true);
        setCountdown(60);
        setShowDelayMessage(false);
        
        // Start countdown timer
        const countdownInterval = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              setShowDelayMessage(true);
              clearInterval(countdownInterval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        
        // Poll database for AI summary
        const pollForAISummary = async () => {
          try {
            const { data, error } = await supabase
              .from('consult')
              .select('consult_summary_ai')
              .eq('id', consult.id)
              .single();
            
            if (error) {
              console.error('Error polling for AI summary:', error);
              return;
            }
            
            if (data.consult_summary_ai && typeof data.consult_summary_ai === 'object' && Object.keys(data.consult_summary_ai).length > 0) {
              // AI summary is ready
              clearInterval(countdownInterval);
              clearInterval(pollInterval);
              
              const aiSummary = data.consult_summary_ai;
              setDraftData({
                diagnosis: aiSummary.diagnosis || '',
                history: aiSummary.history || '',
                chiefComplaints: aiSummary.chief_complaints || '',
                treatmentSuggested: aiSummary.treatment_suggested || '',
                medications: aiSummary.medications || [{ name: '', frequency: '', duration: '', timing: '' }],
                keyPersonalInsights: aiSummary.key_personal_insights || '',
                followupRecommendations: aiSummary.followup_recommendations || ''
              });
              
              setIsWaitingForAI(false);
              setShowDraft(true);
            }
          } catch (error) {
            console.error('Error polling for AI summary:', error);
          }
        };
        
        // Poll every 2 seconds
        const pollInterval = setInterval(pollForAISummary, 2000);
        
        // Cleanup function
        (window as any).cleanupPolling = () => {
          clearInterval(countdownInterval);
          clearInterval(pollInterval);
        };
      } catch (error) {
        console.error('Error creating consultation:', error);
        setIsAnalyzing(false);
        alert('Failed to save consultation');
      }
    } else {
      console.error('No media recorder available');
      setIsAnalyzing(false);
    }
  };

  // Cleanup polling on component unmount
  useEffect(() => {
    return () => {
      if ((window as any).cleanupPolling) {
        (window as any).cleanupPolling();
      }
    };
  }, []);

  const handleApprove = () => {
    setShowConfirmation(true);
  };

  const handleConfirmApprove = async () => {
    try {
      await updateConsult(consultId!, {
        consult_summary_final: {
          diagnosis: draftData.diagnosis,
          history: draftData.history,
          chief_complaints: draftData.chiefComplaints,
          treatment_suggested: draftData.treatmentSuggested,
          medications: draftData.medications,
          key_personal_insights: draftData.keyPersonalInsights,
          followup_recommendations: draftData.followupRecommendations
        }
      });

      setShowConfirmation(false);
      navigate(`/patient/${patientId}`);
    } catch (error) {
      console.error('Error approving consultation:', error);
      alert('Failed to approve consultation');
    }
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

  if (isWaitingForAI) {
    const progressPercentage = ((60 - countdown) / 60) * 100;
    
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar showBack />
        <div className="max-w-5xl mx-auto px-4 py-12">
          <div className="text-center max-w-md mx-auto">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Processing Consultation</h2>
            
            <div className="mb-4">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-[#024CDB] h-3 rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
            </div>
            
            <p className="text-gray-600 mb-2">
              The transcript will be ready in {countdown} seconds
            </p>
            
            {showDelayMessage && (
              <p className="text-orange-600 text-sm">
                Taking longer than expected…
              </p>
            )}
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
                  {draftData.medications.length > 1 && (
                    <button
                      onClick={() => removeMedication(index)}
                      className="text-sm text-red-600 hover:underline mt-2"
                    >
                      Remove
                    </button>
                  )}
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