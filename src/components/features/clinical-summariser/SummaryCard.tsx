interface SummaryCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export default function SummaryCard({ title, children, className = '' }: SummaryCardProps) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl overflow-hidden ${className}`}>
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}
