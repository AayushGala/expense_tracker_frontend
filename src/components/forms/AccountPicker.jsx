import Select from '../common/Select';
import { useOwners } from '../../hooks/useOwners';
import { labelClass, errorClass, accountOption } from '../../utils/formStyles';

// Resolves the picked account's `owner` and passes it to onChange alongside
// the id, so callers can dispatch both fields without re-deriving.
//
//   onChange={(accountId, owner) => { ... dispatch both ... }}
export default function AccountPicker({
  value,
  onChange,
  accounts,
  error,
  label,
  placeholder = 'Select account',
  helperText,
}) {
  const { getAccountOwner } = useOwners();

  function handleChange(e) {
    const accountId = e.target.value;
    const owner = getAccountOwner(accountId);
    onChange(accountId, owner);
  }

  return (
    <div>
      {label && <label className={labelClass}>{label}</label>}
      <Select
        value={value}
        onChange={handleChange}
        options={accounts.map(accountOption)}
        placeholder={placeholder}
      />
      {helperText && (
        <p className="text-[11px] text-gray-400 mt-1">{helperText}</p>
      )}
      {error && <p className={errorClass}>{error}</p>}
    </div>
  );
}
