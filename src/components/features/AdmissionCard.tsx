import { Calendar, Clock, FileText, BedDouble } from 'lucide-react';
import type { AdmissionRow } from '../../types/db';

interface AdmissionCardProps {
  admission: AdmissionRow;
  onClick?: () => void;
  formatDate: (s: string) => string;
}

export default function AdmissionCard({ admission, onClick, formatDate }: AdmissionCardProps) {
  const statusMap: Record<string, { label: string; cls: string }> = {
    discharged: { label: 'Discharged', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    lama:       { label: 'LAMA',       cls: 'bg-red-100 text-red-700 border-red-200' },
    admitted:   { label: 'Active',     cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  };
  const typeMap: Record<string, { label: string; cls: string }> = {
    inpatient: { label: 'Inpatient', cls: 'bg-purple-100 text-purple-700 border-purple-200' },
    daycare:   { label: 'Daycare',   cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  };

  const status = statusMap[admission.status] || statusMap.admitted;
  const type = typeMap[admission.admission_type] || typeMap.inpatient;
  const hasDischargeSummary = admission.discharge_summary && Object.keys(admission.discharge_summary).length > 0;

  const los = admission.discharge_date
    ? Math.max(1, Math.ceil((new Date(admission.discharge_date).getTime() - new Date(admission.admission_date).getTime()) / 86400000))
    : Math.max(1, Math.ceil((Date.now() - new Date(admission.admission_date).getTime()) / 86400000));

  return (
    <div
      onClick={onClick}
      className={`bg-white border border-gray-200 rounded-xl p-4 transition-all ${
        onClick ? 'cursor-pointer hover:border-blue-300 hover:shadow-md active:scale-[0.99]' : ''
      }`}
    >
      {/* Top row: badges */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${status.cls}`}>{status.label}</span>
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${type.cls}`}>{type.label}</span>
        </div>
        {hasDischargeSummary && (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-700">
            <FileText className="w-3.5 h-3.5" />DS Ready
          </span>
        )}
      </div>

      {/* Diagnosis */}
      <p className="font-semibold text-gray-900 mb-3 line-clamp-2 text-sm leading-snug">
        {admission.admitting_diagnosis || admission.final_diagnosis || 'No diagnosis recorded'}
      </p>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-xs text-gray-500">
        {admission.ward_bed && (
          <span className="flex items-center gap-1">
            <BedDouble className="w-3.5 h-3.5" />{admission.ward_bed}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          {formatDate(admission.admission_date)}
          {' – '}
          {admission.discharge_date ? formatDate(admission.discharge_date) : 'Present'}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />{los}d
        </span>
      </div>
    </div>
  );
}