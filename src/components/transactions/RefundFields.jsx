import SourceTransactionPicker from './SourceTransactionPicker';
import { labelClass, errorClass } from '../../utils/formStyles';

export default function RefundFields({
  sourceTransactionId,
  beneficiary,
  tags,
  sourceCategoryName,
  sourceTxn,
  error,
  onSourceChange,
}) {
  return (
    <div className="space-y-3 p-4 rounded-xl bg-accent-light/40 border border-accent/30">
      <div>
        <label className={labelClass}>Original Transaction</label>
        <SourceTransactionPicker value={sourceTransactionId} onChange={onSourceChange} />
        {error && <p className={errorClass}>{error}</p>}
      </div>
      {sourceTxn && sourceCategoryName && (
        <ReadOnlyRow label="Refund Of (Category)" value={sourceCategoryName} />
      )}
      {beneficiary && <ReadOnlyRow label="Beneficiary" value={beneficiary} />}
      {tags && <ReadOnlyRow label="Tags" value={tags} />}
    </div>
  );
}

function ReadOnlyRow({ label, value }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="w-full rounded-xl border border-gray-200 bg-gray-100 px-3 py-2.5 text-sm text-gray-700">
        {value}
      </div>
    </div>
  );
}
