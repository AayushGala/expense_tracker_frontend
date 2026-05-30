import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useFloatingMenu } from '../../hooks/useFloatingMenu';

/**
 * Flat checkbox multi-select with search, select-all, and portal-positioned menu.
 * Mirrors the Dropdown / CategoryFilter pattern.
 *
 * @param {Object[]} options - [{ value, label }, ...]
 * @param {Array} value - currently-selected values
 * @param {Function} onChange - called with the new array of values
 * @param {string} [placeholder] - shown when nothing is selected
 * @param {string} [singularLabel] - used in the "N X selected" trigger label (e.g. "type" → "3 types selected")
 * @param {string} [className]
 */
export default function MultiSelect({
  options = [],
  value = [],
  onChange,
  placeholder = 'Select…',
  singularLabel,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef(null);
  // Menu positioning lives in useFloatingMenu — see hook for details.
  // menuHeight 320 ≈ max-h-80 (20rem). desiredWidth = max(rect.width, 220)
  // via the hook's minWidth=220. margin=8 keeps the menu off viewport edges.
  const { triggerRef, menuRef, menuStyle, updatePosition } = useFloatingMenu({
    open,
    menuHeight: 320,
    minWidth: 220,
    margin: 8,
  });

  const searchLower = search.toLowerCase();
  const filteredOptions = useMemo(() => {
    if (!search) return options;
    return options.filter((o) => o.label.toLowerCase().includes(searchLower));
  }, [options, search, searchLower]);

  // Values round-trip through the URL as strings while some options (e.g.
  // account ids) are numbers — compare as strings so checkboxes reflect state.
  const selected = useMemo(() => new Set((value ?? []).map(String)), [value]);
  const isSelected = (val) => selected.has(String(val));

  const displayLabel = useMemo(() => {
    if (value.length === 0) return placeholder;
    if (value.length === 1) {
      const opt = options.find((o) => String(o.value) === String(value[0]));
      return opt?.label ?? '1 selected';
    }
    if (singularLabel) {
      return `${value.length} ${singularLabel}s selected`;
    }
    return `${value.length} selected`;
  }, [value, options, placeholder, singularLabel]);

  function toggle(val) {
    if (isSelected(val)) {
      onChange(value.filter((v) => String(v) !== String(val)));
    } else {
      onChange([...value, val]);
    }
  }

  function handleSelectAll() {
    if (value.length > 0) {
      onChange([]);
    } else {
      onChange(filteredOptions.map((o) => o.value));
    }
  }

  useEffect(() => {
    if (open) {
      setSearch('');
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      requestAnimationFrame(() => {
        if (
          triggerRef.current && !triggerRef.current.contains(e.target) &&
          menuRef.current && !menuRef.current.contains(e.target)
        ) {
          setOpen(false);
        }
      });
    }
    document.addEventListener('pointerdown', handleClick);
    return () => document.removeEventListener('pointerdown', handleClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  function handleToggle(e) {
    e.preventDefault();
    e.stopPropagation();
    if (open) setOpen(false);
    else { updatePosition(); setOpen(true); }
  }

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onMouseDown={handleToggle}
        className={`
          w-full flex items-center gap-2 rounded-xl border bg-white
          px-3 py-2.5 text-sm transition-colors cursor-pointer
          ${open ? 'border-accent ring-2 ring-accent/20' : 'border-gray-200 hover:border-gray-300'}
        `}
      >
        <span className={`truncate flex-1 text-left ${value.length > 0 ? 'text-gray-700' : 'text-gray-400'}`}>
          {displayLabel}
        </span>
        {value.length > 0 && (
          <span
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onChange([]); }}
            className="text-gray-400 hover:text-gray-600 text-xs"
          >
            &times;
          </span>
        )}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          style={menuStyle}
          onMouseDown={(e) => e.stopPropagation()}
          className="z-[9999] rounded-xl border border-gray-200 bg-white shadow-xl flex flex-col max-h-80"
        >
          {/* Search */}
          {options.length > 6 && (
            <div className="p-2 border-b border-gray-100 shrink-0">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
                placeholder="Search…"
                className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 placeholder-gray-400"
              />
            </div>
          )}

          {/* Select All / Clear All */}
          {filteredOptions.length > 0 && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelectAll(); }}
              className="w-full text-left px-3 py-2 text-xs font-semibold text-accent hover:bg-accent-light/30 border-b border-gray-100 transition-colors"
            >
              {value.length > 0 ? 'Clear All' : 'Select All'}
            </button>
          )}

          {/* Options */}
          <div className="overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-3">No matches</p>
            ) : (
              filteredOptions.map((opt) => {
                const checked = isSelected(opt.value);
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); toggle(opt.value); }}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${checked ? 'bg-accent-light/40' : 'hover:bg-gray-50'}`}
                  >
                    <Checkbox checked={checked} />
                    <span className={`truncate ${checked ? 'text-brand font-medium' : 'text-gray-700'}`}>
                      {opt.label}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function Checkbox({ checked }) {
  return (
    <span className={`
      inline-flex items-center justify-center h-4 w-4 rounded border flex-shrink-0 transition-colors
      ${checked ? 'bg-accent border-accent text-white' : 'border-gray-300 bg-white'}
    `}>
      {checked && (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      )}
    </span>
  );
}
