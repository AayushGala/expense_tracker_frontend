import { transactionTypeLabel } from '../../utils/formatters';

const TYPE_STYLES = {
  expense:       'bg-brand text-white ring-brand/20',
  income:        'bg-accent-light text-brand ring-accent/30',
  transfer:      'bg-gray-100 text-gray-600 ring-gray-200/60',
  bill_payment:  'bg-brand text-white ring-brand/20',
  investment:    'bg-gray-100 text-gray-600 ring-gray-200/60',
  split_expense: 'bg-brand text-white ring-brand/20',
  reimbursement: 'bg-accent-light text-brand ring-accent/30',
};

export default function Badge({ type, className = '' }) {
  const label = transactionTypeLabel(type);
  const style = TYPE_STYLES[type] ?? 'bg-gray-50 text-gray-600 ring-gray-200/60';

  return (
    <span
      className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-semibold ring-1 ${style} ${className}`}
    >
      {label}
    </span>
  );
}
