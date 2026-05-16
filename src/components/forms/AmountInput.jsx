import { labelClass, errorClass } from '../../utils/formStyles';

// `hero` is the large headline input each form opens with; `compact` is
// the standard size for secondary amounts (transfer fee, SMS confirm).
export default function AmountInput({
  value,
  onChange,
  error,
  label = 'Amount',
  placeholder = '0.00',
  variant = 'hero',
  id = 'txn-amount',
  helperText,
  autoFocus,
}) {
  const isHero = variant === 'hero';

  const inputClasses = isHero
    ? 'w-full rounded-xl border border-gray-200 bg-gray-50/50 pl-10 pr-4 py-4 text-2xl font-bold text-gray-900 transition-colors focus:border-accent focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent/20 placeholder-gray-300'
    : 'w-full rounded-xl border border-gray-200 bg-gray-50/50 pl-8 pr-3 py-2.5 text-sm font-semibold text-gray-900 focus:border-accent focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent/20';

  const symbolClasses = isHero
    ? 'absolute left-3.5 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-300'
    : 'absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-gray-300';

  return (
    <div>
      {label && <label htmlFor={id} className={labelClass}>{label}</label>}
      <div className="relative">
        <span className={symbolClasses}>₹</span>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          className={inputClasses}
        />
      </div>
      {helperText && (
        <p className="text-[11px] text-gray-400 mt-1">{helperText}</p>
      )}
      {error && <p className={errorClass}>{error}</p>}
    </div>
  );
}
