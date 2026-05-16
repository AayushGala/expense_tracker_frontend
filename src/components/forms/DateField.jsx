import CalendarPicker from '../common/CalendarPicker';
import { labelClass, errorClass } from '../../utils/formStyles';

export default function DateField({
  value,
  onChange,
  error,
  label = 'Date',
}) {
  return (
    <div>
      {label && <label className={labelClass}>{label}</label>}
      <CalendarPicker value={value} onChange={onChange} className="w-full" />
      {error && <p className={errorClass}>{error}</p>}
    </div>
  );
}
