interface StatusBadgeProps {
  done: boolean;
  trueLabel?: string;
  falseLabel?: string;
  compact?: boolean;
}

export default function StatusBadge({
  done,
  trueLabel = 'Completed',
  falseLabel = 'Pending',
  compact = false,
}: StatusBadgeProps) {
  if (compact) {
    return (
      <span
        title={done ? trueLabel : falseLabel}
        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold border ${
          done
            ? 'bg-green-50 text-green-700 border-green-200'
            : 'bg-amber-50 text-amber-700 border-amber-200'
        }`}
      >
        {(done ? trueLabel : falseLabel)[0]}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
        done ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${done ? 'bg-green-500' : 'bg-amber-500'}`} />
      {done ? trueLabel : falseLabel}
    </span>
  );
}
