interface InfoPillProps {
  label: string;
  value: string;
}

export default function InfoPill({ label, value }: InfoPillProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">{label}</span>
      <span className="text-sm font-medium text-gray-900 whitespace-nowrap">{value}</span>
    </div>
  );
}
