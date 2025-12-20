import { useState } from 'react';
import { Upload, CheckCircle } from 'lucide-react';
import { createPreConsultWithDocuments } from '../lib/database';
import { supabase } from '../lib/supabase';

export default function PreConsultForm() {
  const [documents, setDocuments] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setDocuments(Array.from(e.target.files));
      setSubmitError('');
    }
  };

  const handleSubmit = () => {
    if (documents.length === 0) {
      setSubmitError('Please upload at least one document.');
      return;
    }
    setShowConfirmation(true);
  };

  const confirmSubmit = async () => {
    try {
      setIsUploading(true);
      setShowConfirmation(false);
      setSubmitError('');

      const urlParams = new URLSearchParams(window.location.search);
      const docId = urlParams.get('docId');
      const patientId = urlParams.get('patientId');

      if (!docId || !patientId) {
        throw new Error('Invalid link. Doctor or patient missing.');
      }

      // 1️⃣ Upload ALL documents first
      const uploadedUrls: string[] = [];

      for (const file of documents) {
        const filePath = `${patientId}-${Date.now()}-${file.name}`;

        const { data, error } = await supabase.storage
          .from('pre-consultation-documents')
          .upload(filePath, file, {
            contentType: file.type || 'application/octet-stream',
            upsert: false,
          });

        if (error) throw error;

        const { data: publicData } = supabase.storage
          .from('pre-consultation-documents')
          .getPublicUrl(data.path);

        uploadedUrls.push(publicData.publicUrl);
      }

      // 2️⃣ CREATE ROW ONLY NOW (NO LAG, NO DUPLICATES)
      await createPreConsultWithDocuments(docId, patientId, uploadedUrls);

      setIsSubmitted(true);
    } catch (err) {
      console.error(err);
      setSubmitError('Failed to submit documents. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold">Submitted Successfully</h2>
          <p className="text-gray-600 mt-2">
            Your documents have been sent to the doctor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg border">
        <h1 className="text-xl font-bold text-[#024CDB] mb-4">
          Upload Medical Documents
        </h1>

        <label className="flex flex-col items-center justify-center h-56 border-2 border-dashed rounded-lg cursor-pointer">
          <Upload className="w-12 h-12 text-gray-400 mb-2" />
          <span className="text-gray-600">Click to upload</span>
          <span className="text-sm text-gray-500">
            JPG, PNG, HEIC, PDF, DOC, DOCX
          </span>
          <input
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.heic,.heif"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>

        {documents.length > 0 && (
          <div className="mt-4 text-sm text-gray-700">
            {documents.length} file(s) selected
          </div>
        )}

        {submitError && (
          <div className="mt-4 text-sm text-red-600 bg-red-50 p-2 rounded">
            {submitError}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={isUploading}
          className="mt-6 w-full btn-primary"
        >
          Submit Documents
        </button>
      </div>

      {showConfirmation && (
        <div className="modal-overlay">
          <div className="bg-white p-6 rounded-lg max-w-md mx-auto">
            <h3 className="font-semibold mb-2">Confirm Submission</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to submit these documents?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="btn-secondary"
              >
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
