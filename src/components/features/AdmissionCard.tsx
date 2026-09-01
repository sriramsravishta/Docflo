import { Calendar, Clock, FileText } from 'lucide-react';
import type { AdmissionRow } from '../../types/db';

interface AdmissionCardProps {
  admission: AdmissionRow;
  onClick?: () => void;
  formatDate: (s: string) => string;
}

export default function AdmissionCard({ admission, onClick, formatDate }: AdmissionCardProps) {
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    discharged: { bg: 'bg-green-100', text: 'text-green-700', label: 'Discharged' },
    lama: { bg: 'bg-red-100', text: 'text-red-700', label: 'LAMA' },
    admitted: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Admitted' },
  };

  const typeConfig: Record<string, { bg: string; text: string; label: string }> = {
    inpatient: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Inpatient' },
    daycare: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Daycare' },
  };

  const status = statusConfig[admission.status] || statusConfig.admitted;
  const type = typeConfig[admission.admission_type] || typeConfig.inpatient;

  const los = admission.discharge_date
    ? Math.max(1, Math.ceil((new Date(admission.discharge_date).getTime() - new Date(admission.admission_date).getTime()) / 86400000))
    : Math.max(1, Math.ceil((Date.now() - new Date(admission.admission_date).getTime()) / 86400000));

  const hasDischargeSummary = admission.discharge_summary && Object.keys(admission.discharge_summary).length > 0;

  return (
    <div
      onClick={onClick}
      className={`bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
          {status.label}
        </span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${type.bg} ${type.text}`}>
          {type.label}
        </span>
        {hasDischargeSummary && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
            DS Available
          </span>
        )}
      </div>

      <p className="text-sm font-medium text-gray-900 mb-2 line-clamp-2">
        {admission.admitting_diagnosis || admission.final_diagnosis || 'No diagnosis recorded'}
      </p>

      <div className="flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          <span>
            {formatDate(admission.admission_date)}
            {' — '}
            {admission.discharge_date ? formatDate(admission.discharge_date) : 'Present'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          <span>{los} {los === 1 ? 'day' : 'days'}</span>
        </div>
      </div>
    </div>
  );
}