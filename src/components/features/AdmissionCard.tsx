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
      className={`bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all ${onClick ? 'cursor-pointer hover:border-blue-300' : ''}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${status.bg} ${status.text}`}>
            {status.label}
          </span>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${type.bg} ${type.text}`}>
            {type.label}
          </span>
        </div>
        {hasDischargeSummary && (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
            <FileText className="w-3.5 h-3.5" />
            DS Ready
          </span>
        )}
      </div>

      <h4 className="text-lg font-bold text-gray-900 mb-4 line-clamp-2">
        {admission.admitting_diagnosis || admission.final_diagnosis || 'No diagnosis recorded'}
      </h4>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-start gap-2 text-gray-600">
          <Calendar className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
          <div className="flex flex-col">
            <span className="text-xs text-gray-400 mb-0.5 font-medium uppercase tracking-wider">Period</span>
            <span className="font-medium text-gray-800">
              {formatDate(admission.admission_date)}
              {admission.discharge_date ? ` - ${formatDate(admission.discharge_date)}` : ' - Present'}
            </span>
          </div>
        </div>
        <div className="flex items-start gap-2 text-gray-600">
          <Clock className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
          <div className="flex flex-col">
            <span className="text-xs text-gray-400 mb-0.5 font-medium uppercase tracking-wider">Duration</span>
            <span className="font-medium text-gray-800">{los} {los === 1 ? 'day' : 'days'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}