import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Upload, CheckCircle } from 'lucide-react';
import { getPreConsultById, updatePreConsult } from '../lib/database';
import { supabase } from '../lib/supabase';

export default function PreConsultForm() {
  const { preConsultId } = useParams();

  const [loading, setLoading] = useState(true);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [formNotFound, setFormNotFound] = useState(false);

  const [documents, setDocuments] = useState<File[]>([]);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    loadPreConsult();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preConsultId]);

  const loadPreConsult = async () => {
    try {
      setLoading(true);

      if (!preConsultId) {
        setFormNotFound(true);
        return;
      }

      const data = await getPreConsultById(preConsultId);

      if (!data) {
        setFormNotFound(true);
        return;
      }

      if (data.status === 'Submitted') {
        setIsSubmitted(true);
      }
    } catch (err) {
      console.error(err);
      setFormNotFound(true);
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
    if (documents.length === 0) {
      setSubmitError('Please upload at least one document.');
      return;
    }
    setShowConfirmation(true);
  };

  const confirmSubmit = async () => {
    if (!preConsultId) return;

    try {
      setIsUploading(true);
      setShowConfirmation(false);
      setSubmitError('');

      // 1️⃣ Upload ALL files FIRST
      const uploadedUrls: string[] = [];

      for (const file of documents) {
        const fileName = `${preConsultId}-${Date.now()}-${file.name}`;

        const { data, error } = await supabase.storage
          .from('pre-consultation-documents')
          .upload(fileName, file, {
            contentType: file.type || 'application/octet-stream',
            upsert: false,
          });

        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from('pre-consultation-documents')
          .getPublicUrl(data.path);

        uploadedUrls.push(urlData.publicUrl);
      }

      // 2️⃣ UPDATE THE SAME ROW (no new row)
      await updatePreConsult(preConsultId, {
        documents_uploaded: uploadedUrls,
        status: 'Submitted',
        ai_summary: null,
      });

      setIsSubmitted(true);
    } catch (err) {
      console.error(err);
      setSubmitError('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  if (formNotFound) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Form not found</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-10 w-10 border-b-2 border-blue-600 rounded-full" />
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center">
        <div>
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">Submitted Successfully</h2>
          <p className="text-gray-600 mt-2">
            Your documents have been shared with the doctor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto bg-white p-6 rounded-lg border">
        <h1 className="text-xl font-semibold mb-2 text-blue-600">
          Upload Medical Documents
        </h1>
        <p className="text-gray-600 mb-4">
          Upload prescriptions, reports, images, or documents
        </p>

        <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
          <Upload className="w-10 h-10 text-gray-400 mb-2" />
          <span className="text-gray-600">Click to upload</span>
          <span className="text-xs text-gray-500 mt-1">
            JPG, PNG, HEIC, PDF, DOC, DOCX
          </span>
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/heic,image/heif,.pdf,.doc,.docx"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>

        {documents.length > 0 && (
          <div className="mt-4 space-y-1 text-sm text-gray-600">
            {documents.map((f, i) => (
              <div key={i}>{f.name}</div>
            ))}
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
          className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded disabled:opacity-50"
        >
          {isUploading ? 'Uploading…' : 'Submit'}
        </button>
      </div>

      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg max-w-sm w-full">
            <h3 className="font-semibold mb-2">Confirm submission</h3>
            <p className="text-gray-600 mb-4">
              Upload documents and submit?
            </p>
            <div className="flex justify-end gap-3">
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
