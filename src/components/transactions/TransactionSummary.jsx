import { formatINR, MASKED_AMOUNT as MASK } from '../../utils/formatters';
import { useHideAmounts } from '../../hooks/useHideAmounts';
import HideAmountsToggle from '../common/HideAmountsToggle';

function StatBlock({ label, value, variant = 'neutral', format = 'currency', hidden = false }) {
  const colorClass =
    variant === 'outflow'
      ? 'text-gray-900'
      : variant === 'inflow'
      ? 'text-accent'
      : variant === 'net'
      ? 'text-gray-900'
      : 'text-gray-500';

  const masked = hidden && format === 'currency';
  const display = masked ? MASK : format === 'currency' ? formatINR(value) : value;

  return (
    <div className="flex flex-col">
      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">{label}</p>
      <p className={`text-lg font-bold tabular-nums mt-0.5 ${masked ? 'text-gray-400' : colorClass}`}>{display}</p>
    </div>
  );
}

function MovementPill({ icon, count, label, amount, suffix, hidden }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600">
      <span aria-hidden>{icon}</span>
      <span className="font-medium">{count} {label}{count === 1 ? '' : 's'}</span>
      <span className="text-gray-400 tabular-nums">{hidden ? MASK : formatINR(amount)}{suffix && ` ${suffix}`}</span>
    </span>
  );
}

// Others' share of the period's splits, then what is still owed on them
// once settlements (money back, paid for me, write-off) are taken off.
function splitSuffix(summary, hidden) {
  const paid = Number(summary.split_others_amount ?? 0);
  const left = Number(summary.split_outstanding ?? paid);
  if (left <= 0) return '· all settled';
  if (left >= paid) return 'to get back';
  return `· ${hidden ? MASK : formatINR(left)} left to get back`;
}

export default function TransactionSummary({ summary, isLoading }) {
  const [hidden, toggleHidden] = useHideAmounts();

  if (isLoading && !summary) {
    return (
      <div className="px-5 py-4 text-xs text-gray-400">Calculating totals...</div>
    );
  }
  if (!summary) return null;

  const movements = [
    { key: 'split', icon: '⇄', label: 'split expense', count: summary.split_count, amount: summary.split_others_amount, suffix: splitSuffix(summary, hidden) },
    { key: 'transfer', icon: '↔', label: 'transfer', count: summary.transfer_count, amount: summary.transfer_amount },
    { key: 'investment', icon: '📈', label: 'investment', count: summary.investment_count, amount: summary.investment_amount },
    { key: 'bill_payment', icon: '💳', label: 'bill payment', count: summary.bill_payment_count, amount: summary.bill_payment_amount },
    { key: 'reimbursement', icon: '↩', label: 'reimbursement', count: summary.reimbursement_count, amount: summary.reimbursement_amount },
  ].filter((m) => (m.count ?? 0) > 0 && (m.key !== 'split' || Number(m.amount) > 0));

  // Spending counts only the user's share of split expenses; it is split by
  // beneficiary (self or blank vs family/named people). Net covers both.
  return (
    <div className="relative px-5 py-4 space-y-3">
      <div className="absolute right-5 top-4">
        <HideAmountsToggle hidden={hidden} onToggle={toggleHidden} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatBlock label="Spent (self)" value={summary.spent_self} variant="outflow" hidden={hidden} />
        <StatBlock label="For others" value={summary.spent_others} variant="outflow" hidden={hidden} />
        <StatBlock label="Received" value={summary.total_inflow} variant="inflow" hidden={hidden} />
        <StatBlock label="Net" value={summary.net} variant="net" hidden={hidden} />
        <StatBlock label="Count" value={summary.count} format="plain" />
      </div>

      {movements.length > 0 && (
        <div className="pt-2 border-t border-gray-100">
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
                suffix={m.suffix}
                hidden={hidden}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
