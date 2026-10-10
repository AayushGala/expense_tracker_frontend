import AmountDisplay from './AmountDisplay';
import { getVariant } from './TypeIcon';
import { formatINR, MASKED_AMOUNT } from '../../utils/formatters';

// Row amount for a transaction. A split expense shows the user's share (what
// counts as spending) with the full bill underneath.
export default function TransactionAmount({ txn, hidden = false, className = '' }) {
  const isSplit = txn.type === 'split_expense' && txn.myShare != null;
  const amount = (
    <AmountDisplay
      amount={(isSplit ? txn.myShare : txn.amount) ?? 0}
      variant={getVariant(txn.type)}
      hidden={hidden}
      className={className}
    />
  );
  if (!isSplit) return amount;
  return (
    <span className="inline-flex flex-col items-end flex-shrink-0">
      {amount}
      <span className="text-[11px] text-gray-400 tabular-nums">
        of {hidden ? MASKED_AMOUNT : formatINR(txn.amount ?? 0)}
      </span>
    </span>
  );
}
