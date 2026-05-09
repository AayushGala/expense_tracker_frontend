import { formatINR } from '../../utils/formatters';

function StatBlock({ label, value, variant = 'neutral', format = 'currency' }) {
  const colorClass =
    variant === 'outflow'
      ? 'text-gray-900'
      : variant === 'inflow'
      ? 'text-accent'
      : variant === 'net'
      ? 'text-gray-900'
      : 'text-gray-500';

  const display = format === 'currency' ? formatINR(value) : value;

  return (
    <div className="flex flex-col">
      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">{label}</p>
      <p className={`text-lg font-bold tabular-nums mt-0.5 ${colorClass}`}>{display}</p>
    </div>
  );
}

function MovementPill({ icon, count, label, amount }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600">
      <span aria-hidden>{icon}</span>
      <span className="font-medium">{count} {label}{count === 1 ? '' : 's'}</span>
      <span className="text-gray-400 tabular-nums">{formatINR(amount)}</span>
    </span>
  );
}

export default function TransactionSummary({ summary, isLoading, splitMode, onSplitModeChange }) {
  if (isLoading && !summary) {
    return (
      <div className="px-5 py-4 text-xs text-gray-400">Calculating totals...</div>
    );
  }
  if (!summary) return null;

  const movements = [
    { key: 'transfer', icon: '↔', label: 'transfer', count: summary.transfer_count, amount: summary.transfer_amount },
    { key: 'investment', icon: '📈', label: 'investment', count: summary.investment_count, amount: summary.investment_amount },
    { key: 'bill_payment', icon: '💳', label: 'bill payment', count: summary.bill_payment_count, amount: summary.bill_payment_amount },
    { key: 'reimbursement', icon: '↩', label: 'reimbursement', count: summary.reimbursement_count, amount: summary.reimbursement_amount },
  ].filter((m) => (m.count ?? 0) > 0);

  return (
    <div className="px-5 py-4 space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBlock label="Spent" value={summary.total_outflow} variant="outflow" />
        <StatBlock label="Received" value={summary.total_inflow} variant="inflow" />
        <StatBlock label="Net" value={summary.net} variant="net" />
        <StatBlock label="Count" value={summary.count} format="plain" />
      </div>

      <div className="pt-2 border-t border-gray-100 space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
            Split expenses:
          </span>
          <div className="inline-flex rounded-lg border border-gray-200 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => onSplitModeChange('my_share')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                splitMode === 'my_share'
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              My share
            </button>
            <button
              type="button"
              onClick={() => onSplitModeChange('total_amount')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                splitMode === 'total_amount'
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Full amount
            </button>
          </div>
        </div>

        {movements.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1.5">
              Other movements (not counted above)
            </p>
            <div className="flex flex-wrap gap-2">
              {movements.map((m) => (
                <MovementPill
                  key={m.key}
                  icon={m.icon}
                  count={m.count}
                  label={m.label}
                  amount={m.amount}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
