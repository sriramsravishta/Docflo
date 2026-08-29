import { useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';

export interface AttachmentItem {
  id: string;
  url: string;
  name: string;
  isImage: boolean;
}

interface AttachmentGalleryProps {
  title: string;
  items: AttachmentItem[];
  accept: string;
  uploading: boolean;
  onUpload: (files: FileList) => void;
  onView: (item: AttachmentItem) => void;
  onDelete: (item: AttachmentItem) => void;
  emptyText?: string;
}

export default function AttachmentGallery({
  title,
  items,
  accept,
  uploading,
  onUpload,
  onView,
  onDelete,
  emptyText = 'No attachments',
}: AttachmentGalleryProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  return (
    <>
      <div className="border rounded-lg border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors"
          >
            {uploading ? (
              <><span className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> Uploading...</>
            ) : (
              <><Plus className="w-4 h-4" /> Upload</>
            )}
          </button>
        </div>

        <div className="px-3 py-3">
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) onUpload(e.target.files);
              e.target.value = '';
            }}
          />
          {items.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {items.map((item) => (
                <div key={item.id} className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                  {item.isImage ? (
                    <img
                      src={item.url}
                      alt={item.name}
                      className="w-full h-32 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setViewerUrl(item.url)}
                    />
                  ) : (
                    <button
                      onClick={() => onView(item)}
                      className="w-full h-32 flex flex-col items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
                    >
                      <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <span className="text-xs text-gray-500 px-2 truncate max-w-full">{item.name}</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete "${item.name}"?`)) {
                        if (window.confirm('Are you sure? This cannot be undone.')) {
                          onDelete(item);
                        }
                      }
                    }}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">{emptyText}</p>
          )}
        </div>
      </div>

      {viewerUrl && (
        <div
          className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setViewerUrl(null)}
        >
          <button
            onClick={() => setViewerUrl(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <img
            src={viewerUrl}
            alt="Full view"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}