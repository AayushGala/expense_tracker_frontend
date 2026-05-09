import Badge from '../common/Badge';
import AmountDisplay from '../common/AmountDisplay';
import { transactionTypeLabel } from '../../utils/formatters';

/**
 * Determines the amount colour variant based on transaction type.
 * @param {string} type
 * @returns {'income'|'expense'|'neutral'}
 */
function amountVariant(type) {
  if (
    type === 'income' ||
    type === 'reimbursement'
  ) {
    return 'income';
  }
  if (
    type === 'expense' ||
    type === 'bill_payment' ||
    type === 'split_expense'
  ) {
    return 'expense';
  }
  return 'neutral';
}

/**
 * Single transaction row component.
 * Displays badge, description, amount, and from-account name.
 * Calls onSelect when clicked.
 *
 * @param {Object}   props
 * @param {Object}   props.transaction         - The transaction object
 * @param {string}   [props.fromAccountName]  - Human-readable name of the source account
 * @param {Function} props.onSelect           - Called with the transaction when clicked
 */
export default function TransactionListItem({ transaction, fromAccountName, onSelect }) {
  const { type, notes, amount } = transaction;

  return (
    <li
      onClick={() => onSelect(transaction)}
      className="flex items-center gap-3 px-4 py-3 sm:px-6 hover:bg-gray-50
                 cursor-pointer transition-colors active:bg-gray-100"
    >
      {/* Badge — hidden on very small screens, shown on sm+ */}
      <Badge type={type} className="flex-shrink-0 hidden sm:inline-flex" />

      {/* Description + account */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate leading-snug">
          {notes || transactionTypeLabel(type)}
        </p>
        <p className="text-xs text-gray-400 mt-0.5 truncate">
          {/* Badge inline for xs screens */}
          <Badge type={type} className="inline-flex sm:hidden mr-1" />
          {fromAccountName && (
            <span>{fromAccountName}</span>
          )}
        </p>
      </div>

      {/* Amount */}
      <AmountDisplay
        amount={amount ?? 0}
        variant={amountVariant(type)}
        className="text-sm font-semibold flex-shrink-0"
      />
    </li>
  );
}
