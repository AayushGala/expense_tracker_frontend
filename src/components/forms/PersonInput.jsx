import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useFloatingMenu } from '../../hooks/useFloatingMenu';
import { inputClass } from '../../utils/formStyles';

// Free-text name with the people already on record in a dropdown, so a
// known name is picked rather than retyped. Typing filters the list; a new
// name is still allowed. On blur, a name that matches one of them except for
// case snaps to the stored spelling.
export default function PersonInput({ value, onChange, people = [], className = '', ...props }) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const { triggerRef, menuRef, menuStyle, updatePosition } = useFloatingMenu({ open, menuHeight: 240 });

  const typed = (value ?? '').trim().toLowerCase();
  const matches = typed ? people.filter((p) => p.toLowerCase().includes(typed)) : people;
  const isKnown = people.some((p) => p.toLowerCase() === typed);

  function show() {
    updatePosition();
    setOpen(true);
  }

  function pick(name) {
    onChange(name);
    setOpen(false);
    setHighlight(-1);
  }

  function handleBlur() {
    setOpen(false);
    setHighlight(-1);
    const match = people.find((p) => p.toLowerCase() === typed);
    if (match && match !== value) onChange(match);
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) show();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setHighlight((h) => Math.min(Math.max(h + step, 0), matches.length - 1));
    } else if (e.key === 'Enter' && open && matches[highlight]) {
      e.preventDefault();
      pick(matches[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <>
      <input
        ref={triggerRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        autoComplete="off"
        value={value}
        onChange={(e) => { onChange(e.target.value); setHighlight(-1); if (!open) show(); }}
        onFocus={show}
        onClick={() => { if (!open) show(); }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`${inputClass} ${className}`}
        {...props}
      />
      {open && (matches.length > 0 || (typed && !isKnown)) && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          style={menuStyle}
          className="z-[9999] rounded-xl border border-gray-200 bg-white shadow-xl max-h-60 overflow-y-auto py-1"
        >
          {matches.map((name, idx) => (
            <button
              key={name}
              type="button"
              role="option"
              aria-selected={name.toLowerCase() === typed}
              // mousedown + preventDefault keeps focus in the input, so blur
              // does not close the menu before the pick lands.
              onMouseDown={(e) => { e.preventDefault(); pick(name); }}
              onMouseEnter={() => setHighlight(idx)}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                name.toLowerCase() === typed
                  ? 'bg-accent-light text-brand font-semibold'
                  : idx === highlight ? 'bg-gray-100 text-gray-700' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {name}
            </button>
          ))}
          {typed && !isKnown && (
            <p className="px-3 py-2 text-xs text-gray-400">
              New person: <span className="font-semibold text-gray-600">{value.trim()}</span>
            </p>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
