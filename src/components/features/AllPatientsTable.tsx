import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  last_visit_at?: string;
  case?: string;
}

function MobileRow({ patient, formatDate }: { patient: Patient; formatDate: (s: string) => string }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-lg mb-2 overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <ChevronRight
            className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
          <span className="font-medium text-gray-900 truncate">
  {patient.name}
</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-2.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Age & Gender</span>
            <span className="text-gray-900">{patient.age}yrs · {patient.gender}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Last Visit</span>
            <span className="text-gray-900">{patient.last_visit_at ? formatDate(patient.last_visit_at) : '—'}</span>
          </div>
          {patient.case && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Case</span>
              <span className="text-[#024CDB] font-medium">{patient.case}</span>
            </div>
          )}
          <div className="pt-1">
            <button
              onClick={() => navigate(`/patient/${patient.id}`)}
              className="w-full btn-primary text-sm py-2"
            >
              View Profile
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AllPatientsTable({
  patients,
  formatDate,
}: {
  patients: Patient[];
  formatDate: (s: string) => string;
}) {
  const navigate = useNavigate();

  if (patients.length === 0) return null;

  return (
    <>
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Name</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Age & Gender</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Last Visit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {patients.map((patient) => (
              <tr
                key={patient.id}
                onClick={() => navigate(`/patient/${patient.id}`)}
                className="hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-900">{patient.name}</span>
                  {patient.case && (
                    <span className="ml-2 text-xs text-[#024CDB]">{patient.case}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {patient.age}yrs · {patient.gender}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {patient.last_visit_at ? formatDate(patient.last_visit_at) : <span className="text-gray-400">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden">
        {patients.map((patient) => (
          <MobileRow key={patient.id} patient={patient} formatDate={formatDate} />
        ))}
      </div>
    </>
  );
}
