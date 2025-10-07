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
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [voiceTarget, setVoiceTarget] = useState<string>('');
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isVoicePaused, setIsVoicePaused] = useState(false);
  const [voiceTime, setVoiceTime] = useState(0);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [formNotFound, setFormNotFound] = useState(false);

  const [formData, setFormData] = useState({
    documents: [] as File[],
  });

  const totalSteps = 5; // Language, Upload, Processing, Questions, Submit

  useEffect(() => {
    loadPreConsult();
  }, [preConsultId]);

  const loadPreConsult = async () => {
    try {
      setLoading(true);
      
      if (!preConsultId || preConsultId === 'new') {
        console.error('Invalid pre-consult ID:', preConsultId);
        return;
      }
      
      const data = await getPreConsultById(preConsultId!);

      if (!data) {
        setFormNotFound(true);
        return;
      }

      if (data.status === 'Submitted') {
        setIsSubmitted(true);
        return;
      }

      // Load existing form data if available
      if (data.form_data && typeof data.form_data === 'object') {
        const savedData = data.form_data as any;
        if (savedData.questions) {
          setQuestions(savedData.questions);
          const existingAnswers: Record<string, string> = {};
          savedData.questions.forEach((q: any) => {
            if (q.answer) {
              existingAnswers[q.id] = q.answer;
            }
          });
          setAnswers(existingAnswers);
          
          // If we have questions, skip to the questions step
          if (savedData.questions.length > 0) {
            setCurrentStep(3);
          }
        }
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
      setCurrentStep(2); // Move to processing step

      // Simulate file upload and AI analysis
      const dummyDocUrls = formData.documents.map((file) => ({
        url: `dummy-storage-url/${file.name}`,
        name: file.name,
        type: file.type,
        size: file.size
      }));

      // Simulate AI processing
      setTimeout(async () => {
        const dummyQuestions = [
          { 
            id: "q1", 
            text: "Why are you visiting today?", 
            type: "text_multiline", 
            required: true, 
            answer: "" 
          },
          { 
            id: "q2", 
            text: "Current symptoms and duration", 
            type: "text_multiline", 
            required: true, 
            answer: "" 
          },
          { 
            id: "q3", 
            text: "Any specific concerns based on your uploaded documents?", 
            type: "text_multiline", 
            required: false, 
            answer: "" 
          }
        ];

        await updatePreConsult(preConsultId!, {
          documents_uploaded: dummyDocUrls,
          doc_summary: 'Dummy summary of uploaded documents. The documents contain medical reports and prescriptions that have been analyzed.',
          form_data: {
            questions: dummyQuestions,
            order: ["q1", "q2", "q3"]
          }
        });

        setQuestions(dummyQuestions);
        setIsAnalyzing(false);
        setCurrentStep(3); // Move to questions step
      }, 2000);
    } else if (currentStep === 1 && formData.documents.length === 0) {
      // Skip upload, create default questions
      const defaultQuestions = [
        { 
          id: "q1", 
          text: "Why are you visiting today?", 
          type: "text_multiline", 
          required: true, 
          answer: "" 
        },
        { 
          id: "q2", 
          text: "Current symptoms and duration", 
          type: "text_multiline", 
          required: true, 
          answer: "" 
        }
      ];

      await updatePreConsult(preConsultId!, {
        form_data: {
          questions: defaultQuestions,
          order: ["q1", "q2"]
        }
      });

      setQuestions(defaultQuestions);
      setCurrentStep(3);
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep === 3 && formData.documents.length === 0) {
      setCurrentStep(1); // Skip processing step if no documents
    } else {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFormData({ ...formData, documents: Array.from(e.target.files) });
    }
  };

  const handleAnswerChange = async (questionId: string, value: string) => {
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);

    // Update questions with new answer
    const updatedQuestions = questions.map(q => 
      q.id === questionId ? { ...q, answer: value } : q
    );
    setQuestions(updatedQuestions);

    // Debounced autosave to database
    clearTimeout((window as any).autosaveTimeout);
    (window as any).autosaveTimeout = setTimeout(async () => {
      try {
        await updatePreConsult(preConsultId!, {
          form_data: {
            questions: updatedQuestions,
            order: questions.map(q => q.id)
          }
        });
      } catch (error) {
        console.error('Error auto-saving:', error);
      }
    }, 1000);
  };

  const handleVoiceInput = (questionId: string) => {
    setVoiceTarget(questionId);
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
      
      // Update the target question's answer
      handleAnswerChange(voiceTarget, dummyTranscription);
      
      setShowVoiceModal(false);
      setVoiceTime(0);
    }, 2000);
  };

  const handleSubmit = () => {
    setShowConfirmation(true);
  };

  const confirmSubmit = async () => {
    try {
      // Generate AI summary from answers
      const answeredQuestions = questions.filter(q => q.answer && q.answer.trim());
      const summaryParts = answeredQuestions.map(q => `${q.text}: ${q.answer}`);
      const aiSummary = `Patient Pre-Consult Summary:\n\n${summaryParts.join('\n\n')}\n\nAssessment: Patient has provided detailed information about their visit reason and symptoms. Ready for consultation.`;

      await updatePreConsult(preConsultId!, {
        status: 'Submitted',
        ai_summary: aiSummary
      });

      setShowConfirmation(false);
      setIsSubmitted(true);
    } catch (error) {
      console.error('Error submitting form:', error);
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
            The pre-consult form you're looking for doesn't exist or may have been removed.
          </p>
        </div>
      </div>
    );
  }

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
                <p className="text-gray-600">Analyzing documents and preparing personalized questions...</p>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Please answer the following questions</h2>
              <div className="space-y-6">
                {questions.map((question, index) => (
                  <div key={question.id}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {question.text}
                      {question.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <div className="relative">
                      <textarea
                        value={answers[question.id] || ''}
                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                        className="input-field min-h-32 pr-12"
                        rows={4}
                        placeholder="Type your answer here..."
                        required={question.required}
                      />
                      <button
                        type="button"
                        onClick={() => handleVoiceInput(question.id)}
                        className="absolute bottom-3 right-3 p-2 rounded-lg transition-colors bg-gray-100 hover:bg-gray-200"
                      >
                        <Mic className="w-5 h-5 text-gray-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="text-center py-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Review Your Information</h2>
              <p className="text-gray-600 mb-6">
                Please review your responses before submitting.
              </p>
              <div className="space-y-4 text-left">
                {questions.filter(q => answers[q.id]).map((question) => (
                  <div key={question.id} className="border-b pb-3">
                    <p className="text-sm font-medium text-gray-700">{question.text}</p>
                    <p className="text-gray-600 text-sm mt-1">{answers[question.id]}</p>
                  </div>
                ))}
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
          {currentStep < 3 && currentStep !== 2 && (
            <button
              onClick={handleNext}
              className="btn-primary flex-1 flex items-center justify-center space-x-2"
            >
              <span>Next</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
          {currentStep === 3 && (
            <button
              onClick={() => setCurrentStep(4)}
              className="btn-primary flex-1 flex items-center justify-center space-x-2"
            >
              <span>Review</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
          {currentStep === 4 && (
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