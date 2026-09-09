import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Filter, Columns3 } from 'lucide-react';

interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  last_visit_at?: string | null;
  case?: string | null;
  address?: string | null;
  diagnoses?: string[] | null;
  phone?: string;
  uhid?: string | null;
}

type ColumnKey = 'date' | 'name' | 'age_gender' | 'case' | 'phone' | 'uhid' | 'address' | 'diagnoses';

interface ColumnDef {
  key: ColumnKey;
  label: string;
  defaultOn: boolean;
  width?: string;
}

const COLUMNS: ColumnDef[] = [
  { key: 'date',       label: 'Last Visit',  defaultOn: true },
  { key: 'name',       label: 'Name',        defaultOn: true },
  { key: 'age_gender', label: 'Age & Gender',defaultOn: true },
  { key: 'phone',      label: 'Phone',       defaultOn: false },
  { key: 'uhid',       label: 'UHID',        defaultOn: false },
  { key: 'diagnoses',  label: 'Diagnoses',   defaultOn: false, width: 'max-w-[200px]' },
  { key: 'address',    label: 'Address',     defaultOn: false, width: 'max-w-[180px]' },
];

function TruncatedCell({ value, width = 'max-w-[160px]' }: { value: string; width?: string }) {
  return (
    <span
      className={`block truncate ${width} cursor-default`}
      title={value}
    >
      {value}
    </span>
  );
}

function MobileRow({ patient, visibleCols, formatDate }: { patient: Patient; visibleCols: Set<ColumnKey>; formatDate: (s: string) => string }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-lg mb-2 overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <ChevronRight className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          <span className="font-medium text-gray-900 truncate">{patient.name}</span>
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
          {visibleCols.has('case') && patient.case && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Case</span>
              <span className="text-[#024CDB] font-medium">{patient.case}</span>
            </div>
          )}
          {visibleCols.has('phone') && patient.phone && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Phone</span>
              <span className="text-gray-900">{patient.phone}</span>
            </div>
          )}
          {visibleCols.has('uhid') && patient.uhid && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">UHID</span>
              <span className="text-gray-900">{patient.uhid}</span>
            </div>
          )}
          {visibleCols.has('diagnoses') && patient.diagnoses && patient.diagnoses.length > 0 && (
            <div className="flex justify-between text-sm gap-4">
              <span className="text-gray-500 shrink-0">Diagnoses</span>
              <span className="text-gray-900 text-right">{patient.diagnoses.join(', ')}</span>
            </div>
          )}
          {visibleCols.has('address') && patient.address && (
            <div className="flex justify-between text-sm gap-4">
              <span className="text-gray-500 shrink-0">Address</span>
              <span className="text-gray-900 text-right">{patient.address}</span>
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

  const [showColPicker, setShowColPicker] = useState(false);
  const [enabledCols, setEnabledCols] = useState<Set<ColumnKey>>(
    new Set(COLUMNS.filter((c) => c.defaultOn).map((c) => c.key))
  );

  const toggleCol = (key: ColumnKey) => {
    // Name column always visible — can't toggle off
    if (key === 'name') return;
    setEnabledCols((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const isInFilter = (dateStr?: string | null): boolean => {
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

  const clearFilter = () => { setFilterDate(''); setFilterFrom(''); setFilterTo(''); };

  const sortedPatients = [...patients]
    .filter((p) => !hasActiveFilter || isInFilter(p.last_visit_at))
    .sort((a, b) => {
      const dateA = a.last_visit_at ? new Date(a.last_visit_at).getTime() : 0;
      const dateB = b.last_visit_at ? new Date(b.last_visit_at).getTime() : 0;
      return dateB - dateA;
    });

  if (patients.length === 0) return null;

  const visibleCols = enabledCols;
  const visibleColDefs = COLUMNS.filter((c) => visibleCols.has(c.key));

  return (
    <>
      {/* Filter modal */}
      {showFilter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowFilter(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-4">Filter Patients by Visit Date</h3>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-5">
              <button
                onClick={() => { setFilterMode('single'); setFilterFrom(''); setFilterTo(''); }}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${filterMode === 'single' ? 'bg-[#024CDB] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >Specific Date</button>
              <button
                onClick={() => { setFilterMode('range'); setFilterDate(''); }}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${filterMode === 'range' ? 'bg-[#024CDB] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >Date Range</button>
            </div>
            {filterMode === 'single' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Visit Date</label>
                <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="input-field" />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                  <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                  <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="input-field" />
                </div>
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button onClick={clearFilter} className="flex-1 btn-secondary text-sm">Clear</button>
              <button onClick={() => setShowFilter(false)} className="flex-1 btn-primary text-sm">Apply</button>
            </div>
          </div>
        </div>
      )}

      {/* Column picker dropdown */}
      {showColPicker && (
        <div className="fixed inset-0 z-50 flex items-start justify-end p-4 pt-20 bg-black/20" onClick={() => setShowColPicker(false)}>
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-56" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Show Columns</p>
            <div className="space-y-2">
              {COLUMNS.map((col) => (
                <label key={col.key} className={`flex items-center gap-2.5 cursor-pointer ${col.key === 'name' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <input
                    type="checkbox"
                    checked={visibleCols.has(col.key)}
                    onChange={() => toggleCol(col.key)}
                    disabled={col.key === 'name'}
                    className="w-4 h-4 rounded border-gray-300 text-[#024CDB] focus:ring-[#024CDB]"
                  />
                  <span className="text-sm text-gray-700">{col.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-end gap-2 mb-3">
        {hasActiveFilter && (
          <button onClick={clearFilter} className="text-xs text-gray-500 hover:text-gray-700 underline">
            Clear filter
          </button>
        )}
        <button
          onClick={() => setShowColPicker((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${showColPicker ? 'bg-[#024CDB] text-white border-[#024CDB]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
        >
          <Columns3 className="w-4 h-4" />
          Columns
        </button>
        <button
          onClick={() => setShowFilter(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${hasActiveFilter ? 'bg-[#024CDB] text-white border-[#024CDB]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
        >
          <Filter className="w-4 h-4" />
          {hasActiveFilter ? 'Filtered' : 'Filter'}
        </button>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {visibleColDefs.map((col) => (
                  <th key={col.key} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedPatients.map((patient) => (
                <tr
                  key={patient.id}
                  onClick={() => navigate(`/patient/${patient.id}`)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  {visibleColDefs.map((col) => {
                    if (col.key === 'date') return (
                      <td key="date" className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {patient.last_visit_at ? formatDate(patient.last_visit_at) : <span className="text-gray-400">—</span>}
                      </td>
                    );
                    if (col.key === 'name') return (
                      <td key="name" className="px-4 py-3">
                        <span className="font-medium text-gray-900">{patient.name}</span>
                      </td>
                    );
                    if (col.key === 'age_gender') return (
                      <td key="age_gender" className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {patient.age}yrs · {patient.gender}
                      </td>
                    );
                    if (col.key === 'case') return (
                      <td key="case" className="px-4 py-3 text-sm text-[#024CDB]">
                        {patient.case || <span className="text-gray-400">—</span>}
                      </td>
                    );
                    if (col.key === 'phone') return (
                      <td key="phone" className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {patient.phone || <span className="text-gray-400">—</span>}
                      </td>
                    );
                    if (col.key === 'uhid') return (
                      <td key="uhid" className="px-4 py-3 text-sm text-gray-600">
                        {patient.uhid || <span className="text-gray-400">—</span>}
                      </td>
                    );
                    if (col.key === 'diagnoses') {
                      const val = patient.diagnoses?.join(', ') || '';
                      return (
                        <td key="diagnoses" className="px-4 py-3 text-sm text-gray-700">
                          {val ? <TruncatedCell value={val} width="max-w-[200px]" /> : <span className="text-gray-400">—</span>}
                        </td>
                      );
                    }
                    if (col.key === 'address') {
                      const val = patient.address || '';
                      return (
                        <td key="address" className="px-4 py-3 text-sm text-gray-600">
                          {val ? <TruncatedCell value={val} width="max-w-[180px]" /> : <span className="text-gray-400">—</span>}
                        </td>
                      );
                    }
                    return null;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        {sortedPatients.map((patient) => (
          <MobileRow key={patient.id} patient={patient} visibleCols={visibleCols} formatDate={formatDate} />
        ))}
      </div>
    </>
  );
}