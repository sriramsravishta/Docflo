import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Upload, CheckCircle } from 'lucide-react';
import { getPreConsultById, createPreConsultWithDocuments } from '../lib/database';
import { supabase } from '../lib/supabase';

export default function PreConsultForm() {
  const { preConsultId } = useParams();
  const [loading, setLoading] = useState(true);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [formNotFound, setFormNotFound] = useState(false);
  const [documents, setDocuments] = useState<File[]>([]);
  const [isNewForm, setIsNewForm] = useState(false);

  // NEW: store existing form data (so we can create a new row with correct ids)
  const [preConsultData, setPreConsultData] = useState<any>(null);

  // NEW: inline error (no browser alert)
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    loadPreConsult();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preConsultId]);

  const loadPreConsult = async () => {
    try {
      setLoading(true);
      setSubmitError('');

      if (!preConsultId) {
        console.error('No pre-consult ID provided');
        setFormNotFound(true);
        return;
      }

      if (preConsultId === 'new') {
        setIsNewForm(true);
        setLoading(false);
        return;
      }

      const data = await getPreConsultById(preConsultId);

      if (!data) {
        setFormNotFound(true);
        return;
      }

      setPreConsultData(data);

      if (data.status === 'Submitted') {
        setIsSubmitted(true);
        return;
      }
    } catch (error) {
      console.error('Error loading pre-consult:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setDocuments(Array.from(e.target.files));
      setSubmitError('');
    }
  };

  const handleSubmit = () => {
    setSubmitError('');
    if (documents.length === 0) {
      setSubmitError('Please upload at least one document before submitting.');
      return;
    }
    setShowConfirmation(true);
  };

  const confirmSubmit = async () => {
    try {
      setIsUploading(true);
      setShowConfirmation(false);
      setSubmitError('');

      // Step 1: Upload ALL files first
      const uploadedUrls: string[] = [];

      for (const file of documents) {
        const fileName = `${Date.now()}-${file.name}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('pre-consultation-documents')
          .upload(fileName, file, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          console.error('Storage upload error:', uploadError);
          throw new Error('Failed to upload document: ' + file.name);
        }

        const { data: urlData } = supabase.storage
          .from('pre-consultation-documents')
          .getPublicUrl(uploadData.path);

        uploadedUrls.push(urlData.publicUrl);
      }

      // Step 2: ONLY AFTER uploads complete → CREATE a NEW row with URLs already filled
      let docId: string | null = null;
      let patientId: string | null = null;

      if (isNewForm) {
        const urlParams = new URLSearchParams(window.location.search);
        docId = urlParams.get('docId');
        patientId = urlParams.get('patientId');
      } else {
        // For existing form link, derive docId & patientId from the loaded row
        docId = preConsultData?.doc_id || preConsultData?.doctor_id || null;
        patientId = preConsultData?.patient_id || null;
      }

      if (!docId || !patientId) {
        throw new Error('Missing doctor/patient info. Please try again or request a new link.');
      }

      await createPreConsultWithDocuments(docId, patientId, uploadedUrls);

      // Success UI
      setIsSubmitted(true);
    } catch (error) {
      console.error('Error submitting pre-consult:', error);
      setSubmitError('Failed to submit. Please try again.');
    } finally {
      setIsUploading(false);
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
            Your documents have been sent to your doctor. You'll be called when it's your turn.
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
            Upload your medical documents to help your doctor prepare for your visit
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Documents</h2>
          <p className="text-gray-600 mb-6">
            Upload any prescriptions, reports, or medical documents (images or PDFs)
          </p>

          <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            <Upload className="w-16 h-16 text-gray-400 mb-4" />
            <span className="text-lg text-gray-600 mb-2">Click to upload files</span>
            <span className="text-sm text-gray-500">Images (JPG, PNG, HEIC), PDF, Word (DOC/DOCX)</span>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/gif,image/webp,.pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {documents.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-medium text-gray-700 mb-3">
                {documents.length} file{documents.length !== 1 ? 's' : ''} selected:
              </p>
              <div className="space-y-2">
                {documents.map((file, idx) => (
                  <div key={idx} className="flex items-center text-sm text-gray-600 bg-gray-50 rounded px-3 py-2">
                    <span className="mr-2">📎</span>
                    <span className="flex-1">{file.name}</span>
                    <span className="text-xs text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {submitError && (
            <div className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              {submitError}
            </div>
          )}

          <div className="mt-8">
            <button
              onClick={handleSubmit}
              disabled={isUploading || documents.length === 0}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? 'Uploading...' : 'Submit Documents'}
            </button>
          </div>
        </div>
      </div>

      {showConfirmation && (
        <div className="modal-overlay" onClick={() => setShowConfirmation(false)}>
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Submit Pre-Consult Documents</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to submit these documents? They will be sent to your doctor for review.
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
    </div>
  );
}
