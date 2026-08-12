import { X, Download } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  url: string | null;
  fileName: string;
  fileType: string;
}

export default function DocumentViewerModal({ isOpen, onClose, url, fileName, fileType }: Props) {
  if (!isOpen || !url) return null;

  const isImage = fileType.startsWith('image/');

  return (
    // z-[100] ensures it opens ON TOP of your existing consultation modal
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900 truncate pr-4">{fileName}</h3>
          <div className="flex items-center gap-2">
            <a 
              href={url} 
              download={fileName}
              target="_blank" 
              rel="noopener noreferrer" 
              className="p-2 hover:bg-gray-100 rounded text-gray-600 transition-colors"
              title="Download to computer"
            >
              <Download className="w-5 h-5" />
            </a>
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-gray-100 rounded text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Document Body */}
        <div className="flex-1 bg-gray-100 overflow-auto flex items-center justify-center p-4">
          {isImage ? (
            <img 
              src={url} 
              alt={fileName} 
              className="max-w-full max-h-full object-contain rounded shadow-sm" 
            />
          ) : (
            <iframe 
              src={url} 
              className="w-full h-full border-0 bg-white rounded shadow-sm" 
              title={fileName} 
            />
          )}
        </div>

      </div>
    </div>
  );
}