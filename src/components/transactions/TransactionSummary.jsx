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

// plural: false keeps a label that reads as a name ("2 from person").
function MovementPill({ icon, count, label, amount, plural = true, hidden }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600">
      <span aria-hidden>{icon}</span>
      <span className="font-medium">{count} {label}{plural && count !== 1 ? 's' : ''}</span>
      <span className="text-gray-400 tabular-nums">{hidden ? MASK : formatINR(amount)}</span>
    </span>
  );
}

// Today's balances with people (all time, not limited by the filters).
function PeoplePill({ oweYou, youOwe, hidden }) {
  const money = (v) => (hidden ? MASK : formatINR(v));
  const parts = [
    oweYou > 0 && `people owe you ${money(oweYou)}`,
    youOwe > 0 && `you owe ${money(youOwe)}`,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600">
      <span aria-hidden>👥</span>
      <span className="tabular-nums">{parts.join(' · ')}</span>
    </span>
  );
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
    { key: 'split', icon: '⇄', label: 'split expense', count: summary.split_count, amount: summary.split_others_amount },
    { key: 'transfer', icon: '↔', label: 'transfer', count: summary.transfer_count, amount: summary.transfer_amount },
    { key: 'investment', icon: '📈', label: 'investment', count: summary.investment_count, amount: summary.investment_amount },
    { key: 'bill_payment', icon: '💳', label: 'bill payment', count: summary.bill_payment_count, amount: summary.bill_payment_amount },
    // Named like their badges: money with a person, by direction.
    { key: 'reimbursement', icon: '↩', label: 'from person', plural: false, count: summary.reimbursement_count, amount: summary.reimbursement_amount },
    { key: 'payout', icon: '↪', label: 'to person', plural: false, count: summary.payout_count, amount: summary.payout_amount },
  ].filter((m) => (m.count ?? 0) > 0 && (m.key !== 'split' || Number(m.amount) > 0));

  const oweYou = Number(summary.people_owe_you ?? 0);
  const youOwe = Number(summary.you_owe_people ?? 0);

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

      {(movements.length > 0 || oweYou > 0 || youOwe > 0) && (
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
                plural={m.plural}
                hidden={hidden}
              />
            ))}
            <PeoplePill oweYou={oweYou} youOwe={youOwe} hidden={hidden} />
          </div>
        </div>
      )}
    </div>
  );
}
