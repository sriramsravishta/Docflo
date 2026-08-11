import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Filter } from 'lucide-react';

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

  const [showFilter, setShowFilter] = useState(false);
  const [filterMode, setFilterMode] = useState<'single' | 'range'>('single');
  const [filterDate, setFilterDate] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const isInFilter = (dateStr?: string): boolean => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    if (filterMode === 'single' && filterDate) {
      const target = new Date(filterDate);
      target.setHours(0, 0, 0, 0);
      return d.getTime() === target.getTime();
    }
    if (filterMode === 'range' && (filterFrom || filterTo)) {
      const from = filterFrom ? new Date(filterFrom) : null;
      const to = filterTo ? new Date(filterTo) : null;
      if (from) from.setHours(0, 0, 0, 0);
      if (to) to.setHours(23, 59, 59, 999);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    }
    return true;
  };

  const hasActiveFilter =
    (filterMode === 'single' && filterDate !== '') ||
    (filterMode === 'range' && (filterFrom !== '' || filterTo !== ''));

  const clearFilter = () => {
    setFilterDate('');
    setFilterFrom('');
    setFilterTo('');
  };

  // CHANGED: sort patients by last_visit_at descending (latest first)
  const sortedPatients = [...patients]
    .filter((p) => !hasActiveFilter || isInFilter(p.last_visit_at))
    .sort((a, b) => {
      const dateA = a.last_visit_at ? new Date(a.last_visit_at).getTime() : 0;
      const dateB = b.last_visit_at ? new Date(b.last_visit_at).getTime() : 0;
      return dateB - dateA;
    });

  if (patients.length === 0) return null;

  return (
    <>
      {/* Filter bar */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">
          {hasActiveFilter
            ? `${sortedPatients.length} patient${sortedPatients.length !== 1 ? 's' : ''} matching filter`
            : `${patients.length} patient${patients.length !== 1 ? 's' : ''}`}
        </p>
        <div className="flex items-center gap-2">
          {hasActiveFilter && (
            <button
              onClick={clearFilter}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Clear filter
            </button>
          )}
          <button
            onClick={() => setShowFilter(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
              hasActiveFilter
                ? 'bg-[#024CDB] text-white border-[#024CDB]'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filter
          </button>
        </div>
      </div>

      {/* Filter modal */}
      {showFilter && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setShowFilter(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900 mb-4">Filter Patients by Visit Date</h3>

            {/* Mode toggle */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-5">
              <button
                onClick={() => { setFilterMode('single'); setFilterFrom(''); setFilterTo(''); }}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  filterMode === 'single' ? 'bg-[#024CDB] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Specific Date
              </button>
              <button
                onClick={() => { setFilterMode('range'); setFilterDate(''); }}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  filterMode === 'range' ? 'bg-[#024CDB] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Date Range
              </button>
            </div>

            {filterMode === 'single' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Visit Date</label>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="input-field"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                  <input
                    type="date"
                    value={filterFrom}
                    onChange={(e) => setFilterFrom(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                  <input
                    type="date"
                    value={filterTo}
                    onChange={(e) => setFilterTo(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={clearFilter}
                className="flex-1 btn-secondary text-sm"
              >
                Clear
              </button>
              <button
                onClick={() => setShowFilter(false)}
                className="flex-1 btn-primary text-sm"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Date</th>

    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Name</th>

    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Age & Gender</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedPatients.map((patient) => (
              <tr
  key={patient.id}
  onClick={() => navigate(`/patient/${patient.id}`)}
  className="hover:bg-gray-50 cursor-pointer transition-colors"
>
  {/* CHANGED: Date column added first */}
  <td className="px-4 py-3 text-sm text-gray-600">
    {patient.last_visit_at ? formatDate(patient.last_visit_at) : <span className="text-gray-400">—</span>}
  </td>

  <td className="px-4 py-3">
    <span className="font-medium text-gray-900">{patient.name}</span>
    {patient.case && (
      <span className="ml-2 text-xs text-[#024CDB]">{patient.case}</span>
    )}
  </td>

  <td className="px-4 py-3 text-sm text-gray-600">
    {patient.age}yrs · {patient.gender}
  </td>
</tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden">
        {sortedPatients.map((patient) => (
          <MobileRow key={patient.id} patient={patient} formatDate={formatDate} />
        ))}
      </div>
    </>
  );
}
