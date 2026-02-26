import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreVertical, ChevronUp, ChevronDown, Trash2, ChevronRight } from 'lucide-react';
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
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => navigate(`/patient/${appointment.patient_id}`)}
              className="flex-1 btn-primary text-sm py-2"
            >
              View Profile
            </button>
            {showActions && (
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowKebabMenu(showKebabMenu === appointment.id ? null : appointment.id);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <MoreVertical className="w-4 h-4 text-gray-400" />
                </button>
                {showKebabMenu === appointment.id && (
                  <div className="absolute right-0 bottom-10 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[130px]">
                    <button
                      disabled={idx === 0}
                      onClick={() => onMoveUp(appointment)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-40 flex items-center gap-2"
                    >
                      <ChevronUp className="w-4 h-4" /> Move Up
                    </button>
                    <button
                      disabled={idx === pendingOnly.length - 1}
                      onClick={() => onMoveDown(appointment)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-40 flex items-center gap-2"
                    >
                      <ChevronDown className="w-4 h-4" /> Move Down
                    </button>
                    <button
                      onClick={() => onRemove(appointment)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 text-red-600 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" /> Remove
                    </button>
                  </div>
                )}
              </div>
            )}
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
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Name</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Age & Gender</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Last Visit</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Pre-Consultation</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Consultation</th>
              {showActions && <th className="w-10 px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {appointments.map((apt) => {
              const p = apt.patients;
              const idx = pendingOnly.findIndex((a) => a.id === apt.id);
              return (
                <tr
                  key={apt.id}
                  onClick={() => navigate(`/patient/${apt.patient_id}`)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{p?.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p?.age}yrs · {p?.gender}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {p?.last_visit_at ? formatDate(p.last_visit_at) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge done={apt.pre_consult_filled} /></td>
                  <td className="px-4 py-3"><StatusBadge done={apt.completed} /></td>
                  {showActions && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowKebabMenu(showKebabMenu === apt.id ? null : apt.id);
                          }}
                          className="p-1 hover:bg-gray-100 rounded-full"
                        >
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                        {showKebabMenu === apt.id && (
                          <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
                            <button
                              disabled={idx === 0}
                              onClick={() => onMoveUp(apt)}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                              <ChevronUp className="w-4 h-4" /> Move Up
                            </button>
                            <button
                              disabled={idx === pendingOnly.length - 1}
                              onClick={() => onMoveDown(apt)}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                              <ChevronDown className="w-4 h-4" /> Move Down
                            </button>
                            <button
                              onClick={() => onRemove(apt)}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 text-red-600 flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" /> Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  )}
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
