import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronUp, ChevronDown, Trash2, ChevronRight } from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';

interface Appointment {
  id: string;
  patient_id: string;
  completed: boolean;
  pre_consult_filled: boolean;
  queue: number;
  patients?: {
    name: string;
    age: number;
    gender: string;
    last_visit_at?: string;
    case?: string;
  };
}

interface PatientQueueTableProps {
  appointments: Appointment[];
  pendingOnly: Appointment[];
  onMoveUp: (a: Appointment) => void;
  onMoveDown: (a: Appointment) => void;
  onRemove: (a: Appointment) => void;
  showKebabMenu: string | null;
  setShowKebabMenu: (id: string | null) => void;
  formatDate: (s: string) => string;
  showActions?: boolean;
}

function MobileRow({
  appointment,
  pendingOnly,
  onMoveUp,
  onMoveDown,
  onRemove,
  showKebabMenu,
  setShowKebabMenu,
  formatDate,
  showActions,
}: {
  appointment: Appointment;
  pendingOnly: Appointment[];
  onMoveUp: (a: Appointment) => void;
  onMoveDown: (a: Appointment) => void;
  onRemove: (a: Appointment) => void;
  showKebabMenu: string | null;
  setShowKebabMenu: (id: string | null) => void;
  formatDate: (s: string) => string;
  showActions?: boolean;
}) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const p = appointment.patients;
  const idx = pendingOnly.findIndex((a) => a.id === appointment.id);

  // hide 3 dots if row is completed
  const canShowActions = showActions && !appointment.completed;

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
          <span
            className="font-medium text-gray-900 truncate"
            onClick={(e) => { e.stopPropagation(); navigate(`/patient/${appointment.patient_id}`); }}
          >
            {p?.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5 ml-2 shrink-0">
          <StatusBadge done={appointment.pre_consult_filled} trueLabel="Pre-consult" falseLabel="Pre-consult" compact />
          <StatusBadge done={appointment.completed} trueLabel="Consult" falseLabel="Consult" compact />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-2.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Age & Gender</span>
            <span className="text-gray-900">{p?.age}yrs · {p?.gender}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Last Visit</span>
            <span className="text-gray-900">{p?.last_visit_at ? formatDate(p.last_visit_at) : '—'}</span>
          </div>
          <div className="flex justify-between text-sm items-center">
            <span className="text-gray-500">Pre-Consultation</span>
            <StatusBadge done={appointment.pre_consult_filled} />
          </div>
          <div className="flex justify-between text-sm items-center">
            <span className="text-gray-500">Consultation</span>
            <StatusBadge done={appointment.completed} />
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
  {canShowActions ? (
    <>
      <button
        type="button"
        disabled={idx === 0}
        onClick={() => onMoveUp(appointment)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Move Up
      </button>

      <button
        type="button"
        disabled={idx === pendingOnly.length - 1}
        onClick={() => onMoveDown(appointment)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Move Down
      </button>

      <button
        type="button"
        onClick={() => onRemove(appointment)}
        className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
      >
        Delete
      </button>
    </>
  ) : (
    // keep the 2×2 grid layout, but keep actions hidden like before (completed rows)
    <>
      <div className="invisible">
        <button className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium">
          Move Up
        </button>
      </div>
      <div className="invisible">
        <button className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium">
          Move Down
        </button>
      </div>
      <div className="invisible">
        <button className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium">
          Delete
        </button>
      </div>
    </>
  )}

  <button
    type="button"
    onClick={() => navigate(`/patient/${appointment.patient_id}`)}
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

export default function PatientQueueTable({
  appointments,
  pendingOnly,
  onMoveUp,
  onMoveDown,
  onRemove,
  showKebabMenu,
  setShowKebabMenu,
  formatDate,
  showActions = true,
}: PatientQueueTableProps) {
  const navigate = useNavigate();

  if (appointments.length === 0) return null;

  return (
    <>
      {/* Desktop table — overflow-visible so dropdown is never clipped */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-visible">
        <table className="w-full"> 
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 rounded-tl-xl">Name</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Age & Gender</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Last Visit</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Pre-Consultation</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Consultation</th>

<th className="text-left text-xs font-semibold text-gray-500 tracking-wider px-4 py-3 rounded-tr-xl w-[160px]">
  More Options
</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {appointments.map((apt) => {
              const p = apt.patients;
              const idx = pendingOnly.findIndex((a) => a.id === apt.id);
              // hide 3 dots if row is completed
              const canShowActions = showActions && !apt.completed;

              return (
                <tr
  key={apt.id}
  onClick={() => navigate(`/patient/${apt.patient_id}`)}
  className="group hover:bg-gray-50 cursor-pointer transition-colors"
>
                  <td className="px-4 py-3 font-medium text-gray-900">{p?.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p?.age}yrs · {p?.gender}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {p?.last_visit_at ? formatDate(p.last_visit_at) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge done={apt.pre_consult_filled} /></td>
                  <td className="px-4 py-3"><StatusBadge done={apt.completed} /></td>
                  <td className="px-4 py-3 w-[160px]" onClick={(e) => e.stopPropagation()}>
  {canShowActions && (
    <div
      className="
        flex items-center justify-end gap-2
        opacity-0 pointer-events-none
        group-hover:opacity-100 group-hover:pointer-events-auto
        group-focus-within:opacity-100 group-focus-within:pointer-events-auto
        transition-opacity
      "
    >
      <button
        type="button"
        title="Move Up"
        disabled={idx === 0}
        onClick={(e) => { e.stopPropagation(); onMoveUp(apt); }}
        className="p-1 rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronUp className="w-4 h-4 text-gray-500" />
        <span className="sr-only">Move Up</span>
      </button>

      <button
        type="button"
        title="Move Down"
        disabled={idx === pendingOnly.length - 1}
        onClick={(e) => { e.stopPropagation(); onMoveDown(apt); }}
        className="p-1 rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronDown className="w-4 h-4 text-gray-500" />
        <span className="sr-only">Move Down</span>
      </button>

      <button
        type="button"
        title="Delete"
        onClick={(e) => { e.stopPropagation(); onRemove(apt); }}
        className="p-1 rounded-md hover:bg-red-50"
      >
        <Trash2 className="w-4 h-4 text-red-600" />
        <span className="sr-only">Delete</span>
      </button>
    </div>
  )}
</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="md:hidden">
        {appointments.map((apt) => (
          <MobileRow
            key={apt.id}
            appointment={apt}
            pendingOnly={pendingOnly}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onRemove={onRemove}
            showKebabMenu={showKebabMenu}
            setShowKebabMenu={setShowKebabMenu}
            formatDate={formatDate}
            showActions={showActions}
          />
        ))}
      </div>
    </>
  );
}