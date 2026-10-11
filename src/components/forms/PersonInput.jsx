import { useId } from 'react';
import { inputClass } from '../../utils/formStyles';

// Free-text name with the people already on record as suggestions, so a
// known name is picked rather than retyped. On blur, a name that matches one
// of them except for case snaps to the stored spelling.
export default function PersonInput({ value, onChange, people = [], className = '', ...props }) {
  const listId = useId();

  function snapToKnown() {
    const typed = (value ?? '').trim().toLowerCase();
    const match = people.find((p) => p.toLowerCase() === typed);
    if (match && match !== value) onChange(match);
  }

  return (
    <>
      <input
        type="text"
        list={listId}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={snapToKnown}
        className={`${inputClass} ${className}`}
        {...props}
      />
      <datalist id={listId}>
        {people.map((p) => <option key={p} value={p} />)}
      </datalist>
    </>
  );
}
