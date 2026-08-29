import { useState } from 'react';
import { Edit2, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PregnancyWheelProps {
  patientId: string;
  lmpDate: string | null | undefined;
  onLmpUpdated: (newLmp: string) => void;
}

function calcPregnancy(lmpStr: string) {
  const lmp = new Date(lmpStr);
  const now = new Date();
  const diffMs = now.getTime() - lmp.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(diffDays / 7);
  const days = diffDays % 7;
  const edd = new Date(lmp);
  edd.setDate(edd.getDate() + 280);
  return { weeks, days, diffDays, edd };
}

function getTrimester(weeks: number) {
  if (weeks < 14) return { label: '1st Trimester', color: '#4ade80' };
  if (weeks < 28) return { label: '2nd Trimester', color: '#60a5fa' };
  return { label: '3rd Trimester', color: '#f472b6' };
}

export default function PregnancyWheel({ patientId, lmpDate, onLmpUpdated }: PregnancyWheelProps) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(lmpDate || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!inputVal) return;
    setSaving(true);
    try {
      await supabase
        .from('patients')
        .update({ lmp_date: inputVal })
        .eq('id', patientId);
      onLmpUpdated(inputVal);
      setEditing(false);
    } catch (e) {
      console.error('Failed to save LMP', e);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setInputVal(lmpDate || '');
    setEditing(false);
  };

  // Empty state — no LMP set yet
  if (!lmpDate && !editing) {
    return (
      <div className="border border-dashed border-gray-300 rounded-xl p-4 flex items-center justify-between bg-white">
        <div>
          <p className="text-sm font-medium text-gray-700">Pregnancy Tracker</p>
          <p className="text-xs text-gray-400 mt-0.5">Enter LMP to track gestational age</p>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="text-sm text-[#024CDB] font-medium hover:underline flex items-center gap-1"
        >
          <Edit2 className="w-3.5 h-3.5" /> Set LMP
        </button>
      </div>
    );
  }

  const { weeks, days, diffDays, edd } = lmpDate
    ? calcPregnancy(lmpDate)
    : { weeks: 0, days: 0, diffDays: 0, edd: new Date() };
  const totalDays = 280;
  const progressPercent = Math.min(100, Math.max(0, (diffDays / totalDays) * 100));
  const { label: trimesterLabel, color: trimesterColor } = getTrimester(weeks);

  const overdueBy = diffDays - 280;
  const isOverdue = overdueBy > 0;

  const eddStr = edd.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  // Arc geometry
  const cx = 80, cy = 85, r = 65;
  const startAngle = -210;
  const endAngle = 30;
  const totalArcDeg = endAngle - startAngle;
  const progressArcDeg = (progressPercent / 100) * totalArcDeg;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const arcPath = (start: number, end: number, radius: number) => {
    const s = {
      x: cx + radius * Math.cos(toRad(start)),
      y: cy + radius * Math.sin(toRad(start)),
    };
    const e = {
      x: cx + radius * Math.cos(toRad(end)),
      y: cy + radius * Math.sin(toRad(end)),
    };
    const large = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const weekMarkers = [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-800">Pregnancy Tracker</p>
        {!editing ? (
          <button
            onClick={() => { setEditing(true); setInputVal(lmpDate || ''); }}
            className="text-xs text-[#024CDB] hover:underline flex items-center gap-1"
          >
            <Edit2 className="w-3 h-3" /> Edit LMP
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#024CDB]"
            />
            <button onClick={handleSave} disabled={saving} className="text-green-600 hover:text-green-700">
              <Check className="w-4 h-4" />
            </button>
            <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {lmpDate && (
        <div className="flex items-center gap-4">
          {/* SVG Arc Wheel */}
          <div className="shrink-0">
            <svg width="160" height="130" viewBox="0 0 160 130">
              {/* Background arc */}
              <path d={arcPath(startAngle, endAngle, r)} fill="none" stroke="#e5e7eb" strokeWidth="10" strokeLinecap="round" />
              {/* Progress arc */}
              {!isOverdue && (
                <path
                  d={arcPath(startAngle, startAngle + progressArcDeg, r)}
                  fill="none"
                  stroke={trimesterColor}
                  strokeWidth="10"
                  strokeLinecap="round"
                />
              )}
              {/* Overdue — full arc in red */}
              {isOverdue && (
                <path d={arcPath(startAngle, endAngle, r)} fill="none" stroke="#f87171" strokeWidth="10" strokeLinecap="round" />
              )}
              {/* Week tick markers */}
              {weekMarkers.map(wk => {
                const angle = startAngle + (wk / 40) * totalArcDeg;
                const innerR = r - 14;
                const outerR = r - 8;
                const x1 = cx + innerR * Math.cos(toRad(angle));
                const y1 = cy + innerR * Math.sin(toRad(angle));
                const x2 = cx + outerR * Math.cos(toRad(angle));
                const y2 = cy + outerR * Math.sin(toRad(angle));
                return <line key={wk} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#9ca3af" strokeWidth="1.5" />;
              })}
              {/* Center text */}
              <text x={cx} y={cy - 10} textAnchor="middle" fontSize="22" fontWeight="700" fill={isOverdue ? '#f87171' : '#111827'}>
                {isOverdue ? `+${overdueBy}d` : `${weeks}w`}
              </text>
              <text x={cx} y={cy + 8} textAnchor="middle" fontSize="11" fill="#6b7280">
                {isOverdue ? 'overdue' : `${days}d`}
              </text>
              {/* 0w / 40w labels */}
              <text x={cx + (r + 12) * Math.cos(toRad(startAngle))} y={cy + (r + 12) * Math.sin(toRad(startAngle))} textAnchor="middle" fontSize="9" fill="#9ca3af">0w</text>
              <text x={cx + (r + 12) * Math.cos(toRad(endAngle))} y={cy + (r + 12) * Math.sin(toRad(endAngle))} textAnchor="middle" fontSize="9" fill="#9ca3af">40w</text>
            </svg>
          </div>

          {/* Info panel */}
          <div className="flex-1 space-y-2.5">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400">Gestational Age</p>
              <p className="text-lg font-bold text-gray-900">
                {isOverdue
                  ? <span className="text-red-500">Overdue by {overdueBy} days</span>
                  : `${weeks} weeks ${days} days`}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400">EDD</p>
              <p className="text-sm font-semibold text-gray-800">{eddStr}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400">LMP</p>
              <p className="text-sm text-gray-600">
                {new Date(lmpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <span
              className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: trimesterColor }}
            >
              {trimesterLabel}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}