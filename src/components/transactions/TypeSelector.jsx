import { transactionTypeLabel } from '../../utils/formatters';

const TRANSACTION_TYPES = [
  'expense',
  'income',
  'transfer',
  'bill_payment',
  'investment',
  'split_expense',
  'reimbursement',
];

export default function TypeSelector({ value, onChange, disabled = false }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1 sm:flex-wrap">
      {TRANSACTION_TYPES.map((type) => {
        const isSelected = value === type;
        return (
          <button
            key={type}
            type="button"
            disabled={disabled && !isSelected}
            onClick={() => !disabled && onChange(type)}
            className={`
              flex-shrink-0 inline-flex items-center rounded-xl px-4 py-2 text-sm font-semibold
              border transition-all duration-150
              ${isSelected
                ? 'bg-accent-light text-brand border-accent shadow-sm'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700 hover:bg-gray-50'
              }
            `}
          >
            {transactionTypeLabel(type)}
          </button>
        );
      })}
    </div>
  );
}
