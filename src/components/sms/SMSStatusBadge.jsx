const STYLES = {
  pending:   'bg-gray-100 text-gray-600 ring-gray-200/60',
  parsed:    'bg-brand text-white ring-brand/20',
  confirmed: 'bg-accent-light text-brand ring-accent/30',
  failed:    'bg-rose-100 text-rose-700 ring-rose-200/60',
  ignored:   'bg-gray-50 text-gray-400 ring-gray-200/60',
};

const LABELS = {
  pending:   'Pending',
  parsed:    'Parsed',
  confirmed: 'Confirmed',
  failed:    'Failed',
  ignored:   'Ignored',
};

export default function SMSStatusBadge({ status, className = '' }) {
  const style = STYLES[status] ?? 'bg-gray-50 text-gray-600 ring-gray-200/60';
  const label = LABELS[status] ?? status;
  return (
    <span
      className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-semibold ring-1 ${style} ${className}`}
    >
      {label}
    </span>
  );
}
