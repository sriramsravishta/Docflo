interface EmptyStateProps {
  message: string;
  className?: string;
}

export default function EmptyState({ message, className = '' }: EmptyStateProps) {
  return (
    <div className={`text-center py-12 bg-white rounded-xl border border-gray-200 ${className}`}>
      <p className="text-gray-500">{message}</p>
    </div>
  );
}
