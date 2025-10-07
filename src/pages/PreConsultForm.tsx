import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Mic, Upload, CheckCircle, Play, Pause, Square } from 'lucide-react';
import { getPreConsultById, updatePreConsult } from '../lib/database';

const languages = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'हिंदी (Hindi)' },
  { code: 'te', name: 'తెలుగు (Telugu)' },
];

export default function PreConsultForm() {
  const { preConsultId } = useParams();
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [voiceTarget, setVoiceTarget] = useState<string>('');
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isVoicePaused, setIsVoicePaused] = useState(false);
  const [voiceTime, setVoiceTime] = useState(0);

  const [formData, setFormData] = useState({
    documents: [] as File[],
    visitReason: '',
    isFirstVisit: '',
    symptoms: '',
    allergies: '',
    habits: '',
  });

  const totalSteps = 7;

  useEffect(() => {
    loadPreConsult();
  }, [preConsultId]);

  const loadPreConsult = async () => {
    try {
      setLoading(true);
      
      // Check if preConsultId is 'new' or invalid
      if (!preConsultId || preConsultId === 'new') {
        console.error('Invalid pre-consult ID:', preConsultId);
        return;
      }
      
      const data = await getPreConsultById(preConsultId!);

      if (data.status === 'Submitted') {
        setIsSubmitted(true);
      }

      if (data.form_data && typeof data.form_data === 'object') {
        const savedData = data.form_data as any;
        setFormData({
          documents: [],
          visitReason: savedData.visitReason || '',
          isFirstVisit: savedData.isFirstVisit || '',
          symptoms: savedData.symptoms || '',
          allergies: savedData.allergies || '',
          habits: savedData.habits || '',
        });
      }
    } catch (error) {
      console.error('Error loading pre-consult:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    if (currentStep === 1 && formData.documents.length > 0) {
      setIsAnalyzing(true);

      const dummyDocUrls = formData.documents.map((file) => ({
        url: `dummy-storage-url/${file.name}`,
        name: file.name,
        type: file.type
      }));

      await updatePreConsult(preConsultId!, {
        documents_uploaded: dummyDocUrls,
        doc_summary: 'Dummy summary of uploaded documents. The documents contain medical reports and prescriptions that have been analyzed.',
        form_data: {
          schema: [
            { id: 'q1', question: 'How are you feeling today?', type: 'textarea', required: true },
            { id: 'q2', question: 'Any specific concerns based on your documents?', type: 'textarea', required: false }
          ],
          answers: {},
          visitReason: formData.visitReason,
          isFirstVisit: formData.isFirstVisit,
          symptoms: formData.symptoms,
          allergies: formData.allergies,
          habits: formData.habits
        }
      });

      setTimeout(() => {
        setIsAnalyzing(false);
        setCurrentStep(currentStep + 1);
      }, 2000);
    } else if (currentStep === 2) {
      setTimeout(() => setCurrentStep(currentStep + 1), 1000);
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFormData({ ...formData, documents: Array.from(e.target.files) });
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
    
    // Simulate processing
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
    try {
      await updatePreConsult(preConsultId!, {
        status: 'Submitted',
        form_data: {
          visitReason: formData.visitReason,
          isFirstVisit: formData.isFirstVisit,
          symptoms: formData.symptoms,
          allergies: formData.allergies,
          habits: formData.habits
        },
        ai_summary: `Dummy AI analysis of form answers.\n\nVisit Reason: ${formData.visitReason}\nFirst Visit: ${formData.isFirstVisit}\nSymptoms: ${formData.symptoms}\nAllergies: ${formData.allergies || 'None reported'}\nHabits: ${formData.habits || 'None reported'}`
      });
      setShowConfirmation(false);
      setIsSubmitted(true);
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Failed to submit form. Please try again.');
    }
  };

  const updateFormField = async (field: string, value: string) => {
    const updatedData = { ...formData, [field]: value };
    setFormData(updatedData);

    try {
      await updatePreConsult(preConsultId!, {
        form_data: {
          visitReason: updatedData.visitReason,
          isFirstVisit: updatedData.isFirstVisit,
          symptoms: updatedData.symptoms,
          allergies: updatedData.allergies,
          habits: updatedData.habits
        }
      });
    } catch (error) {
      console.error('Error auto-saving:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#024CDB] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading form...</p>
        </div>
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
            Your information has been sent to your doctor. You'll be called when it's your turn.
          </p>
        </div>
      </div>
    );
  }

  if (isAnalyzing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#024CDB] mx-auto mb-4"></div>
          <p className="text-gray-600">Analyzing documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#024CDB] mb-2">Pre-Consult Form</h1>
          <p className="text-gray-600">
            Help your doctor prepare for your visit by providing information in advance
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
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Documents</h2>
              <p className="text-gray-600 mb-4">
                Upload any prescriptions, reports, or discharge summaries (optional)
              </p>
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
              {formData.documents.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-2">{formData.documents.length} file(s) selected</p>
                  {formData.documents.map((file, idx) => (
                    <div key={idx} className="text-sm text-[#024CDB]">{file.name}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {currentStep === 2 && (
            <div className="flex items-center justify-center h-48">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#024CDB] mx-auto mb-4"></div>
                <p className="text-gray-600">Analyzing documents...</p>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Why are you visiting the doctor today?
              </h2>
              <div className="relative">
                <textarea
                  value={formData.visitReason}
                  onChange={(e) => updateFormField('visitReason', e.target.value)}
                  className="input-field min-h-32"
                  rows={5}
                  placeholder="Describe your reason for visiting..."
                />
                <button
                  onClick={() => handleVoiceInput('visitReason')}
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
                Is this your first visit or a follow-up?
              </h2>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    updateFormField('isFirstVisit', 'yes');
                    handleNext();
                  }}
                  className="w-full p-4 text-left border-2 border-gray-200 rounded-lg hover:border-[#024CDB] transition-colors"
                >
                  <span className="font-medium">First Visit</span>
                </button>
                <button
                  onClick={() => {
                    updateFormField('isFirstVisit', 'no');
                    handleNext();
                  }}
                  className="w-full p-4 text-left border-2 border-gray-200 rounded-lg hover:border-[#024CDB] transition-colors"
                >
                  <span className="font-medium">Follow-up</span>
                </button>
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                What symptoms or concerns do you have, how long, and severity?
              </h2>
              <div className="relative">
                <textarea
                  value={formData.symptoms}
                  onChange={(e) => updateFormField('symptoms', e.target.value)}
                  className="input-field min-h-32"
                  rows={5}
                  placeholder="Describe your symptoms..."
                />
                <button
                  onClick={() => handleVoiceInput('symptoms')}
                  className={`absolute bottom-3 right-3 p-2 rounded-lg transition-colors ${
                    false ? 'bg-red-500' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  <Mic className={`w-5 h-5 ${false ? 'text-white' : 'text-gray-600'}`} />
                </button>
              </div>
            </div>
          )}

          {currentStep === 6 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Any allergies the doctor should know? (Optional)
                </h2>
                <div className="relative">
                  <textarea
                    value={formData.allergies}
                    onChange={(e) => updateFormField('allergies', e.target.value)}
                    className="input-field min-h-24"
                    rows={3}
                    placeholder="List any allergies..."
                  />
                  <button
                    onClick={() => handleVoiceInput('allergies')}
                    className={`absolute bottom-3 right-3 p-2 rounded-lg transition-colors ${
                      false ? 'bg-red-500' : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    <Mic className={`w-5 h-5 ${false ? 'text-white' : 'text-gray-600'}`} />
                  </button>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Habits/personal factors (Optional)
                </h2>
                <p className="text-sm text-gray-600 mb-2">
                  Smoking, alcohol, stress, special events, etc.
                </p>
                <div className="relative">
                  <textarea
                    value={formData.habits}
                    onChange={(e) => updateFormField('habits', e.target.value)}
                    className="input-field min-h-24"
                    rows={3}
                    placeholder="Describe any relevant habits or factors..."
                  />
                  <button
                    onClick={() => handleVoiceInput('habits')}
                    className={`absolute bottom-3 right-3 p-2 rounded-lg transition-colors ${
                      false ? 'bg-red-500' : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    <Mic className={`w-5 h-5 ${false ? 'text-white' : 'text-gray-600'}`} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          {currentStep > 0 && currentStep !== 2 && (
            <button onClick={handleBack} className="btn-secondary flex items-center space-x-2">
              <ChevronLeft className="w-5 h-5" />
              <span>Back</span>
            </button>
          )}
          {currentStep < 6 && currentStep !== 2 && (
            <button
              onClick={handleNext}
              className="btn-primary flex-1 flex items-center justify-center space-x-2"
              disabled={currentStep === 1 && formData.documents.length === 0}
            >
              <span>Next</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
          {currentStep === 6 && (
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Submit Pre-Consult Form</h3>
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
                  : 'Recording in progress...'
              }
            </p>
          </div>
        </div>
      )}
    </div>
  );
}