import Select from '../common/Select';
import { labelClass, errorClass, categoryOptions } from '../../utils/formStyles';

// Callers pass a pre-filtered category list (by type, role, etc.).
export default function CategoryPicker({
  value,
  onChange,
  categories,
  error,
  label = 'Category',
  placeholder = 'Select category',
}) {
  return (
    <div>
      {label && <label className={labelClass}>{label}</label>}
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        options={categoryOptions(categories)}
        placeholder={placeholder}
      />
      {error && <p className={errorClass}>{error}</p>}
    </div>
  );
}
