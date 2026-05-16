import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useFloatingMenu } from '../../hooks/useFloatingMenu';

// Global registry: when any dropdown opens, it calls closeAll first
const openDropdowns = new Set();

function closeAll() {
  openDropdowns.forEach((close) => close());
}

export default function Dropdown({ value, onChange, options = [], placeholder, className = '' }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef(null);
  const optionRefs = useRef([]);
  const focusedIndexRef = useRef(-1);
  // Menu positioning lives in useFloatingMenu — see hook for details.
  // menuHeight 240 ≈ max-h-60 (15rem), minWidth 160 matches the old behavior.
  const { triggerRef, menuRef, menuStyle, updatePosition } = useFloatingMenu({
    open,
    menuHeight: 240,
    minWidth: 160,
  });

  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption?.label ?? placeholder ?? 'Select...';

  // Filter options by search term
  const searchLower = search.toLowerCase();
  const filteredOptions = search
    ? options.filter((o) => o.label.toLowerCase().includes(searchLower))
    : options;

  // Always show search for quick filtering
  const showSearch = true;

  // Register/unregister this dropdown's close function
  const closeFn = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (open) {
      openDropdowns.add(closeFn);
    } else {
      openDropdowns.delete(closeFn);
    }
    return () => openDropdowns.delete(closeFn);
  }, [open, closeFn]);

  // Reset search and focus search input when menu opens/closes
  useEffect(() => {
    if (open) {
      setSearch('');
      const selectedIdx = options.findIndex((o) => o.value === value);
      focusedIndexRef.current = selectedIdx >= 0 ? selectedIdx : 0;
      // Focus search input if shown, otherwise track index only
      if (showSearch) {
        requestAnimationFrame(() => searchRef.current?.focus());
      }
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  function handleToggle(e) {
    e.preventDefault();
    e.stopPropagation();
    if (open) {
      setOpen(false);
    } else {
      closeAll();
      // Pre-compute position before opening to prevent flash at 0,0
      updatePosition();
      setOpen(true);
    }
  }

  function handleTriggerKeyDown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        closeAll();
        updatePosition();
        setOpen(true);
      }
    }
  }

  // Find next/prev non-disabled index
  function nextEnabledIndex(from, direction) {
    let i = from + direction;
    while (i >= 0 && i < filteredOptions.length) {
      if (!filteredOptions[i].disabled) return i;
      i += direction;
    }
    return from; // stay put if nothing found
  }

  function handleOptionKeyDown(e, idx, optValue) {
    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = nextEnabledIndex(idx, 1);
        focusedIndexRef.current = next;
        optionRefs.current[next]?.focus();
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = nextEnabledIndex(idx, -1);
        if (prev === idx && showSearch) {
          searchRef.current?.focus();
        } else {
          focusedIndexRef.current = prev;
          optionRefs.current[prev]?.focus();
        }
        break;
      }
      case 'Enter':
      case ' ': {
        e.preventDefault();
        handleSelect(optValue);
        break;
      }
      case 'Home': {
        e.preventDefault();
        const first = nextEnabledIndex(-1, 1);
        focusedIndexRef.current = first;
        optionRefs.current[first]?.focus();
        break;
      }
      case 'End': {
        e.preventDefault();
        const last = nextEnabledIndex(filteredOptions.length, -1);
        focusedIndexRef.current = last;
        optionRefs.current[last]?.focus();
        break;
      }
      default:
        break;
    }
  }

  function handleSelect(optValue) {
    onChange(optValue);
    setSearch('');
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onMouseDown={handleToggle}
        onFocus={() => {
          if (!open) {
            closeAll();
            updatePosition();
            setOpen(true);
          }
        }}
        onKeyDown={handleTriggerKeyDown}
        className={`
          w-full flex items-center gap-2 rounded-xl border bg-white
          px-3 py-2.5 text-sm transition-colors cursor-pointer
          ${open
            ? 'border-accent ring-2 ring-accent/20'
            : 'border-gray-200 hover:border-gray-300'
          }
        `}
      >
        <span className={`truncate flex-1 text-left ${value ? 'text-gray-700' : 'text-gray-400'}`}>
          {displayLabel}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Options list — rendered in a portal so it's never clipped */}
      {open && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          style={menuStyle}
          className="z-[9999] rounded-xl border border-gray-200 bg-white shadow-xl flex flex-col max-h-60"
        >
          {/* Search input */}
          {showSearch && (
            <div className="p-2 border-b border-gray-100 shrink-0">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); }
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    // Skip to first non-disabled option
                    const first = filteredOptions.findIndex((o) => !o.disabled);
                    if (first >= 0) optionRefs.current[first]?.focus();
                  }
                  if (e.key === 'Enter') {
                    const selectable = filteredOptions.filter((o) => !o.disabled);
                    if (selectable.length === 1) {
                      e.preventDefault();
                      handleSelect(selectable[0].value);
                    }
                  }
                }}
                placeholder="Search..."
                className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 placeholder-gray-400"
              />
            </div>
          )}

          {/* Options */}
          <div className="overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-3">No matches</p>
            ) : (
              filteredOptions.map((opt, idx) => {
                if (opt.disabled) {
                  return (
                    <div
                      key={opt.value}
                      className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400"
                    >
                      {opt.label}
                    </div>
                  );
                }
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    ref={(el) => (optionRefs.current[idx] = el)}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(opt.value);
                    }}
                    onKeyDown={(e) => handleOptionKeyDown(e, idx, opt.value)}
                    className={`
                      w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2
                      outline-none !ring-0 focus-visible:outline-none focus:bg-gray-100
                      ${isSelected
                        ? 'bg-accent-light text-brand font-semibold focus:bg-accent-light/80'
                        : 'text-gray-700 hover:bg-gray-50'
                      }
                    `}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className={`h-3.5 w-3.5 flex-shrink-0 ${isSelected ? 'text-accent' : 'text-transparent'}`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="truncate">{opt.label}</span>
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
