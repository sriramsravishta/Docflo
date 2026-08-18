import { useState } from 'react';
import { X } from 'lucide-react';

interface AdmitPatientModalProps {
  onClose: () => void;
  onAdmit: (admissionType: 'inpatient' | 'daycare', diagnosis: string, wardBed: string) => Promise<void>;
}

export default function AdmitPatientModal({ onClose, onAdmit }: AdmitPatientModalProps) {
  const [admissionType, setAdmissionType] = useState<'inpatient' | 'daycare'>('inpatient');
  const [diagnosis, setDiagnosis] = useState('');
  const [wardBed, setWardBed] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diagnosis.trim()) return;
    setSubmitting(true);
    try {
      await onAdmit(admissionType, diagnosis.trim(), wardBed.trim());
    } catch (error) {
      console.error('Admission failed:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Admit Patient</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Admission Type</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="admissionType"
                  value="inpatient"
                  checked={admissionType === 'inpatient'}
                  onChange={() => setAdmissionType('inpatient')}
                  className="text-[#024CDB] focus:ring-[#024CDB]"
                />
                <span className="text-sm text-gray-700">Inpatient</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="admissionType"
                  value="daycare"
                  checked={admissionType === 'daycare'}
                  onChange={() => setAdmissionType('daycare')}
                  className="text-[#024CDB] focus:ring-[#024CDB]"
                />
                <span className="text-sm text-gray-700">Daycare</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Admitting Diagnosis</label>
            <textarea
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              rows={3}
              placeholder="Enter admitting diagnosis..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ward / Bed <span className="text-gray-400">(optional)</span></label>
            <input
              type="text"
              value={wardBed}
              onChange={(e) => setWardBed(e.target.value)}
              placeholder="e.g., ICU Bed 3"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !diagnosis.trim()}
              className="flex-1 px-4 py-2.5 bg-[#024CDB] text-white rounded-lg hover:bg-[#023BA3] transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Admitting...' : 'Admit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}