import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Mic, Upload, CheckCircle, Play, Pause, Square } from 'lucide-react';
import { getFollowUpById, updateFollowUp } from '../lib/database';

const languages = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'हिंदी (Hindi)' },
  { code: 'te', name: 'తెలుగు (Telugu)' },
];

export default function FollowUpForm() {
  const { followUpId } = useParams();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [voiceTarget, setVoiceTarget] = useState<string>('');
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isVoicePaused, setIsVoicePaused] = useState(false);
  const [voiceTime, setVoiceTime] = useState(0);
  const [formNotFound, setFormNotFound] = useState(false);

  const [formData, setFormData] = useState({
    overallFeeling: '',
    problemStatus: '',
    newSymptoms: '',
    medicationAdherence: '',
    newReports: [] as File[],
    lifestyleChanges: '',
  });

  const totalSteps = 8;

  useEffect(() => {
    loadFollowUp();
  }, []);

  const loadFollowUp = async () => {
    try {
      setLoading(true);

      if (followUpId) {
        const followUp = await getFollowUpById(followUpId);

        if (!followUp) {
          setFormNotFound(true);
          return;
        }

        if (followUp.status === 'Submitted') {
          setIsSubmitted(true);
        }

        if (followUp.form_data) {
          setFormData({
            overallFeeling: followUp.form_data.overallFeeling || '',
            problemStatus: followUp.form_data.problemStatus || '',
            newSymptoms: followUp.form_data.newSymptoms || '',
            medicationAdherence: followUp.form_data.medicationAdherence || '',
            newReports: [],
            lifestyleChanges: followUp.form_data.lifestyleChanges || '',
          });
        }
      }
    } catch (error) {
      console.error('Error loading follow-up:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateFormField = async (fieldName: string, value: any) => {
    if (!followUpId) return;

    const updatedFormData = { ...formData, [fieldName]: value };

    try {
      await updateFollowUp(followUpId, {
        form_data: updatedFormData
      });
    } catch (error) {
      console.error('Error updating form field:', error);
    }
  };

  const handleNext = () => {
    setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFormData({ ...formData, newReports: Array.from(e.target.files) });
    }
  };

  const handleVoiceInput = (targetField: string) => {
    setVoiceTarget(targetField);
    setShowVoiceModal(true);
  };

  const startVoiceRecording = () => {
    setIsVoiceRecording(true);
    setIsVoicePaused(false);
    setVoiceTime(0);
    const interval = setInterval(() => {
      setVoiceTime(prev => {
        if (!isVoicePaused) return prev + 1;
        return prev;
      });
    }, 1000);
    (window as any).voiceInterval = interval;
  };

  const pauseVoiceRecording = () => {
    setIsVoicePaused(!isVoicePaused);
  };

  const submitVoiceRecording = () => {
    clearInterval((window as any).voiceInterval);
    setIsVoiceRecording(false);
    
    // Show transcribing state
    setTimeout(() => {
      const dummyTranscription = 'Dummy transcription text from voice input. This is what the patient said during the voice recording.';
      
      // Update the target field
      const updatedData = { ...formData, [voiceTarget]: dummyTranscription };
      setFormData(updatedData);
      updateFormField(voiceTarget, dummyTranscription);
      
      setShowVoiceModal(false);
      setVoiceTime(0);
    }, 2000);
  };

  const handleSubmit = () => {
    setShowConfirmation(true);
  };

  const confirmSubmit = async () => {
    if (!followUpId) return;

    try {
      const aiSummary = `Dummy AI analysis of follow-up form.\n\nOverall Feeling: ${formData.overallFeeling}\n\nProblem Status: ${formData.problemStatus}\n\nNew Symptoms: ${formData.newSymptoms || 'None reported'}\n\nMedication Adherence: ${formData.medicationAdherence}\n\nLifestyle Changes: ${formData.lifestyleChanges || 'None reported'}\n\nAssessment: Patient shows signs of recovery. Continue current treatment plan and monitor for any changes.`;

      await updateFollowUp(followUpId, {
        status: 'Submitted',
        form_data: {
          overallFeeling: formData.overallFeeling,
          problemStatus: formData.problemStatus,
          newSymptoms: formData.newSymptoms,
          medicationAdherence: formData.medicationAdherence,
          lifestyleChanges: formData.lifestyleChanges
        },
        ai_summary: aiSummary
      });

      setShowConfirmation(false);
      setIsSubmitted(true);
    } catch (error) {
      console.error('Error submitting follow-up:', error);
      alert('Failed to submit form. Please try again.');
    }
  };

  if (formNotFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-500 text-2xl">!</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Form Not Found</h2>
          <p className="text-gray-600">
            The follow-up form you're looking for doesn't exist or may have been removed.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#024CDB]"></div>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Submitted Successfully!</h2>
          <p className="text-gray-600">
            Your follow-up information has been recorded and sent to your doctor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#024CDB] mb-2">Follow-up Form</h1>
          <p className="text-gray-600">
            Help your doctor track your progress by providing updates
          </p>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">
              Step {currentStep + 1} of {totalSteps}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-[#024CDB] h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 min-h-96">
          {currentStep === 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Your Language</h2>
              <div className="space-y-3">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setSelectedLanguage(lang.code);
                      handleNext();
                    }}
                    className={`w-full p-4 text-left border-2 rounded-lg transition-colors ${
                      selectedLanguage === lang.code
                        ? 'border-[#024CDB] bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-lg font-medium">{lang.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Since your last visit, how are you feeling overall?
              </h2>
              <div className="relative">
                <textarea
                  value={formData.overallFeeling}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, overallFeeling: value });
                    updateFormField('overallFeeling', value);
                  }}
                  className="input-field min-h-32"
                  rows={5}
                  placeholder="Describe how you're feeling..."
                />
                <button
                  onClick={() => handleVoiceInput('overallFeeling')}
                  className={`absolute bottom-3 right-3 p-2 rounded-lg transition-colors ${
                    false ? 'bg-red-500' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  <Mic className={`w-5 h-5 ${false ? 'text-white' : 'text-gray-600'}`} />
                </button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Are your earlier problems improving, staying the same, or getting worse?
              </h2>
              <div className="relative">
                <textarea
                  value={formData.problemStatus}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, problemStatus: value });
                    updateFormField('problemStatus', value);
                  }}
                  className="input-field min-h-32"
                  rows={5}
                  placeholder="Describe the status of your earlier problems..."
                />
                <button
                  onClick={() => handleVoiceInput('problemStatus')}
                  className={`absolute bottom-3 right-3 p-2 rounded-lg transition-colors ${
                    false ? 'bg-red-500' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  <Mic className={`w-5 h-5 ${false ? 'text-white' : 'text-gray-600'}`} />
                </button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Do you have any new symptoms or issues?
              </h2>
              <div className="relative">
                <textarea
                  value={formData.newSymptoms}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, newSymptoms: value });
                    updateFormField('newSymptoms', value);
                  }}
                  className="input-field min-h-32"
                  rows={5}
                  placeholder="Describe any new symptoms..."
                />
                <button
                  onClick={() => handleVoiceInput('newSymptoms')}
                  className={`absolute bottom-3 right-3 p-2 rounded-lg transition-colors ${
                    false ? 'bg-red-500' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  <Mic className={`w-5 h-5 ${false ? 'text-white' : 'text-gray-600'}`} />
                </button>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Are you taking your medicines and following advice regularly?
              </h2>
              <div className="relative">
                <textarea
                  value={formData.medicationAdherence}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, medicationAdherence: value });
                    updateFormField('medicationAdherence', value);
                  }}
                  className="input-field min-h-32"
                  rows={5}
                  placeholder="Let your doctor know about medication adherence..."
                />
                <button
                  onClick={() => handleVoiceInput('medicationAdherence')}
                  className={`absolute bottom-3 right-3 p-2 rounded-lg transition-colors ${
                    false ? 'bg-red-500' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  <Mic className={`w-5 h-5 ${false ? 'text-white' : 'text-gray-600'}`} />
                </button>
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Do you have any new tests, scans, or reports? (Optional)
              </h2>
              <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <Upload className="w-12 h-12 text-gray-400 mb-2" />
                <span className="text-gray-600">Click to upload files</span>
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              {formData.newReports.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-2">{formData.newReports.length} file(s) selected</p>
                </div>
              )}
            </div>
          )}

          {currentStep === 6 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Any changes in food, sleep, stress, or habits? (Optional)
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Include changes in smoking, alcohol, tobacco, etc.
              </p>
              <div className="relative">
                <textarea
                  value={formData.lifestyleChanges}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, lifestyleChanges: value });
                    updateFormField('lifestyleChanges', value);
                  }}
                  className="input-field min-h-32"
                  rows={5}
                  placeholder="Describe any lifestyle changes..."
                />
                <button
                  onClick={() => handleVoiceInput('lifestyleChanges')}
                  className={`absolute bottom-3 right-3 p-2 rounded-lg transition-colors ${
                    false ? 'bg-red-500' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  <Mic className={`w-5 h-5 ${false ? 'text-white' : 'text-gray-600'}`} />
                </button>
              </div>
            </div>
          )}

          {currentStep === 7 && (
            <div className="text-center py-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Review Your Information</h2>
              <p className="text-gray-600 mb-6">
                Please review your responses before submitting.
              </p>
              <div className="space-y-4 text-left">
                {formData.overallFeeling && (
                  <div className="border-b pb-3">
                    <p className="text-sm font-medium text-gray-700">Overall Feeling</p>
                    <p className="text-gray-600 text-sm mt-1">{formData.overallFeeling}</p>
                  </div>
                )}
                {formData.problemStatus && (
                  <div className="border-b pb-3">
                    <p className="text-sm font-medium text-gray-700">Problem Status</p>
                    <p className="text-gray-600 text-sm mt-1">{formData.problemStatus}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          {currentStep > 0 && (
            <button onClick={handleBack} className="btn-secondary flex items-center space-x-2">
              <ChevronLeft className="w-5 h-5" />
              <span>Back</span>
            </button>
          )}
          {currentStep < 7 && (
            <button
              onClick={handleNext}
              className="btn-primary flex-1 flex items-center justify-center space-x-2"
            >
              <span>Next</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
          {currentStep === 7 && (
            <button
              onClick={handleSubmit}
              className="btn-primary flex-1"
            >
              Submit
            </button>
          )}
        </div>
      </div>

      {showConfirmation && (
        <div className="modal-overlay" onClick={() => setShowConfirmation(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Submit Follow-up Form</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to submit this form? Your information will be sent to your doctor.
            </p>
            <div className="flex space-x-3 justify-end">
              <button onClick={() => setShowConfirmation(false)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={confirmSubmit} className="btn-primary">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {showVoiceModal && (
        <div className="modal-overlay" onClick={() => setShowVoiceModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">Voice Recording</h3>
            
            <div className="text-center mb-6">
              {!isVoiceRecording ? (
                <button
                  onClick={startVoiceRecording}
                  className="w-20 h-20 bg-[#024CDB] hover:bg-[#023BA3] text-white rounded-full flex items-center justify-center mx-auto transition-colors"
                >
                  <Mic className="w-8 h-8" />
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto animate-pulse">
                    <Mic className="w-8 h-8 text-white" />
                  </div>
                  
                  <div className="text-2xl font-mono text-gray-900">
                    {Math.floor(voiceTime / 60)}:{(voiceTime % 60).toString().padStart(2, '0')}
                  </div>
                  
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={pauseVoiceRecording}
                      className="btn-secondary flex items-center space-x-2"
                    >
                      {isVoicePaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                      <span>{isVoicePaused ? 'Resume' : 'Pause'}</span>
                    </button>
                    
                    <button
                      onClick={submitVoiceRecording}
                      className="btn-primary flex items-center space-x-2"
                    >
                      <Square className="w-4 h-4" />
                      <span>Submit</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <p className="text-center text-gray-600 text-sm">
              {!isVoiceRecording 
                ? 'Click the microphone to start recording'
                : isVoicePaused 
                  ? 'Recording paused'
                  : isVoiceRecording && voiceTime === 0
                    ? 'Transcribing...'
                    : 'Recording in progress...'
              }
            </p>
          </div>
        </div>
      )}
    </div>
  );
}