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

export default function TransactionSummary({ summary, isLoading, splitMode, onSplitModeChange }) {
  if (isLoading && !summary) {
    return (
      <div className="px-5 py-4 text-xs text-gray-400">Calculating totals...</div>
    );
  }
  if (!summary) return null;

  const hasTransfers = summary.transfer_count > 0;
  const hasInvestments = summary.investment_count > 0;

  return (
    <div className="px-5 py-4 space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBlock label="Spent" value={summary.total_outflow} variant="outflow" />
        <StatBlock label="Received" value={summary.total_inflow} variant="inflow" />
        <StatBlock label="Net" value={summary.net} variant="net" />
        <StatBlock label="Count" value={summary.count} format="plain" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
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

        {(hasTransfers || hasInvestments) && (
          <div className="flex flex-col items-end gap-0.5 text-xs text-gray-400">
            {hasTransfers && (
              <p>
                {summary.transfer_count} transfer{summary.transfer_count === 1 ? '' : 's'} excluded
                {' '}({formatINR(summary.transfer_amount)})
              </p>
            )}
            {hasInvestments && (
              <p>
                {summary.investment_count} investment{summary.investment_count === 1 ? '' : 's'} excluded
                {' '}({formatINR(summary.investment_amount)})
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
