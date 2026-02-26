import { Upload } from 'lucide-react';
import Modal from '../Modal';
import Spinner from '../ui/Spinner';

type UploadState = 'confirming' | 'uploading' | 'success' | 'error';

interface DocumentUploadModalProps {
  isOpen: boolean;
  documentsToUpload: File[];
  uploadError: string;
  isUploading: boolean;
  onClose: () => void;
  onFileChange: (files: File[]) => void;
  onUploadClick: () => void;
}

interface DocumentUploadStatusModalProps {
  isOpen: boolean;
  uploadState: UploadState;
  onConfirm: () => void;
  onCancel: () => void;
  onOkay: () => void;
  onRetry: () => void;
}

export function DocumentUploadModal({
  isOpen,
  documentsToUpload,
  uploadError,
  isUploading,
  onClose,
  onFileChange,
  onUploadClick,
}: DocumentUploadModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Upload Documents">
      <div className="flex flex-col max-h-[calc(100vh-160px)]">
        <div className="flex-1 overflow-y-auto px-1 py-4 space-y-4">
          <p className="text-gray-600">Upload medical documents for this patient</p>
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            <Upload className="w-8 h-8 text-gray-400 mb-2" />
            <span className="text-gray-600">Click to upload files</span>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,.pdf,.doc,.docx"
              onChange={(e) => e.target.files && onFileChange(Array.from(e.target.files))}
              className="hidden"
            />
          </label>

          {documentsToUpload.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">{documentsToUpload.length} file(s) selected:</p>
              <div className="space-y-1">
                {documentsToUpload.map((file, idx) => (
                  <div key={idx} className="text-sm text-gray-600 bg-gray-50 rounded px-3 py-2">{file.name}</div>
                ))}
              </div>
            </div>
          )}

          {uploadError && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{uploadError}</div>}
        </div>

        <div className="shrink-0 border-t border-gray-200 bg-white px-1 pt-4 pb-2 flex space-x-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={onUploadClick}
            disabled={documentsToUpload.length === 0 || isUploading}
            className="px-4 py-2 bg-[#024CDB] hover:bg-[#023BA3] text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function DocumentUploadStatusModal({
  isOpen,
  uploadState,
  onConfirm,
  onCancel,
  onOkay,
  onRetry,
}: DocumentUploadStatusModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        {uploadState === 'confirming' && (
          <>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Documents</h3>
            <p className="text-gray-600 mb-6">Upload selected documents for this patient?</p>
            <div className="flex space-x-3 justify-end">
              <button onClick={onCancel} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
              <button onClick={onConfirm} className="px-4 py-2 bg-[#024CDB] hover:bg-[#023BA3] text-white rounded-lg transition-colors">Confirm</button>
            </div>
          </>
        )}

        {uploadState === 'uploading' && (
          <div className="text-center py-6">
            <Spinner size="lg" className="mx-auto mb-4" />
            <p className="text-gray-700 font-medium">Documents being uploaded...</p>
          </div>
        )}

        {uploadState === 'success' && (
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-green-600 text-2xl">✓</span>
            </div>
            <p className="text-gray-700 font-medium mb-6">Documents uploaded</p>
            <button onClick={onOkay} className="px-6 py-2 bg-[#024CDB] hover:bg-[#023BA3] text-white rounded-lg transition-colors">Okay</button>
          </div>
        )}

        {uploadState === 'error' && (
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-600 text-2xl">✕</span>
            </div>
            <p className="text-gray-700 font-medium mb-6">Upload failed</p>
            <button onClick={onRetry} className="px-6 py-2 bg-[#024CDB] hover:bg-[#023BA3] text-white rounded-lg transition-colors">Retry</button>
          </div>
        )}
      </div>
    </div>
  );
}
