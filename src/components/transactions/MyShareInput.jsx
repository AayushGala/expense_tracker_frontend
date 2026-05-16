import { labelClass, errorClass, inputClass } from '../../utils/formStyles';

// 'equal' splits the total evenly by people count; 'custom' takes a typed
// share amount.
export default function MyShareInput({
  myShareType,
  customMyShare,
  totalPeople,
  parsedTotal,
  computedMyShare,
  error,
  onModeChange,
  onCustomChange,
}) {
  return (
    <div>
      <label className={labelClass}>My Share</label>
      <div className="flex gap-2 mb-2">
        <button
          type="button"
          onClick={() => onModeChange('equal')}
          className={`flex-1 rounded-lg border py-3 min-h-[44px] text-sm font-medium transition-colors ${
            myShareType === 'equal'
              ? 'bg-accent-light border-accent text-brand'
              : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
          }`}
        >
          Equal Split
        </button>
        <button
          type="button"
          onClick={() => onModeChange('custom')}
          className={`flex-1 rounded-lg border py-3 min-h-[44px] text-sm font-medium transition-colors ${
            myShareType === 'custom'
              ? 'bg-accent-light border-accent text-brand'
              : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
          }`}
        >
          Custom Amount
        </button>
      </div>
      {myShareType === 'equal' && parsedTotal.gt(0) && (
        <p className="text-sm text-gray-600">
          My share:{' '}
          <span className="font-semibold">₹{computedMyShare.toFixed(2)}</span>{' '}
          ({totalPeople} people)
        </p>
      )}
      {myShareType === 'custom' && (
        <div>
          <input
            id="txn-my-share"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={customMyShare}
            onChange={(e) => onCustomChange(e.target.value)}
            className={inputClass}
          />
          {error && <p className={errorClass}>{error}</p>}
        </div>
      )}
    </div>
  );
}
