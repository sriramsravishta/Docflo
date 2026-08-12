import { useState, useEffect, useRef } from 'react';
import DocumentViewerModal from './DocumentViewerModal';
import { Upload, FileText, Trash2, Download, Loader2 } from 'lucide-react';
import { getConsultDocuments, uploadConsultDocument, getSignedDocumentUrl, deleteConsultDocument } from '../../lib/database';
import type { ConsultDocumentRow } from '../../types/db';

interface Props {
  consultId: string;
  docId: string;
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType?: string | null): string {
  if (!fileType) return '📄';
  if (fileType.startsWith('image/')) return '🖼️';
  if (fileType.includes('pdf')) return '📕';
  if (fileType.includes('word') || fileType.includes('document')) return '📝';
  return '📄';
}

export default function ConsultDocumentsSection({ consultId, docId }: Props) {
  const [documents, setDocuments] = useState<ConsultDocumentRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    try {
      const docs = await getConsultDocuments(consultId);
      setDocuments(docs);
    } catch (e) {
      console.error('Error loading documents:', e);
    }
  };

  useEffect(() => {
    load();
  }, [consultId]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        await uploadConsultDocument(docId, consultId, files[i]);
      }
      await load();
    } catch (err) {
      console.error('Upload error:', err);
      alert('Failed to upload document');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleView = async (doc: ConsultDocumentRow) => {
    setLoadingId(doc.id);
    try {
      const url = await getSignedDocumentUrl(doc.file_url);
      window.open(url, '_blank');
    } catch (e) {
      console.error('Error opening document:', e);
      alert('Failed to open document');
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (doc: ConsultDocumentRow) => {
    if (!confirm(`Delete ${doc.file_name}?`)) return;
    setDeletingId(doc.id);
    try {
      await deleteConsultDocument(doc.id, doc.file_url);
      await load();
    } catch (e) {
      console.error('Error deleting document:', e);
      alert('Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-gray-900">Attached Documents</h3>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Uploading…</span>
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              <span>Upload</span>
            </>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      <div className="px-4 py-3">
        {documents.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            No documents attached. Upload lab reports, scans, or reference images for this visit.
          </p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-2 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <span className="text-2xl shrink-0">{getFileIcon(doc.file_type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.file_name}</p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(doc.file_size_bytes)} · {new Date(doc.uploaded_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <button
                  onClick={() => handleView(doc)}
                  disabled={loadingId === doc.id}
                  className="p-2 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                  title="View"
                >
                  {loadingId === doc.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                  ) : (
                    <Download className="w-4 h-4 text-gray-500" />
                  )}
                </button>
                <button
                  onClick={() => handleDelete(doc)}
                  disabled={deletingId === doc.id}
                  className="p-2 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                  title="Delete"
                >
                  {deletingId === doc.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                  ) : (
                    <Trash2 className="w-4 h-4 text-red-500" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}