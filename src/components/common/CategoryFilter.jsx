import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';

/**
 * Hierarchical multi-select category filter.
 * - Parent headers are selectable and toggle all children.
 * - Individual children can be toggled independently.
 * - Returns an array of selected category IDs.
 *
 * @param {Object[]} categories - flat list of categories with id, name, parent/parent_id, type
 * @param {number[]} value - array of selected category IDs
 * @param {Function} onChange - called with updated array of IDs
 * @param {string} [filterType] - 'expense' | 'income' | undefined (show all)
 * @param {string} [className]
 */
export default function CategoryFilter({ categories, value = [], onChange, filterType, className = '' }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState({});

  // Build hierarchy
  const { sections, childrenMap, allChildIds } = useMemo(() => {
    const filtered = filterType
      ? categories.filter((c) => c.type === filterType)
      : categories;

    const childrenMap = new Map();
    for (const cat of filtered) {
      const parentId = cat.parent ?? cat.parent_id;
      if (parentId) {
        if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
        childrenMap.get(parentId).push(cat);
      }
    }
    // Sort children
    for (const [key, children] of childrenMap) {
      childrenMap.set(key, children.sort((a, b) => a.name.localeCompare(b.name)));
    }

    // Group parents by type
    const parentsByType = {};
    for (const cat of filtered) {
      if (!cat.parent && !cat.parent_id) {
        const type = cat.type || 'other';
        if (!parentsByType[type]) parentsByType[type] = [];
        parentsByType[type].push(cat);
      }
    }
    for (const type of Object.keys(parentsByType)) {
      parentsByType[type].sort((a, b) => a.name.localeCompare(b.name));
    }

    // Build sections: expense first, then income (more common filter order)
    const typeOrder = filterType ? [filterType] : ['expense', 'income'];
    const sections = typeOrder
      .filter((t) => parentsByType[t]?.length > 0)
      .map((t) => ({ type: t, label: t === 'expense' ? 'Expense' : 'Income', parents: parentsByType[t] }));

    // Map parent id -> all child ids
    const allChildIds = new Map();
    for (const section of sections) {
      for (const p of section.parents) {
        allChildIds.set(p.id, (childrenMap.get(p.id) ?? []).map((c) => c.id));
      }
    }

    return { sections, childrenMap, allChildIds };
  }, [categories, filterType]);

  // IDs round-trip through the URL as strings while category.id is a number,
  // so compare everything as strings to avoid silent mismatches (unchecked
  // boxes + clicks that re-add instead of toggling off).
  const selected = useMemo(() => new Set((value ?? []).map(String)), [value]);
  const has = useCallback((id) => selected.has(String(id)), [selected]);
  const without = (arr, ids) => {
    const drop = new Set(ids.map(String));
    return arr.filter((id) => !drop.has(String(id)));
  };

  // Display label
  const displayLabel = useMemo(() => {
    if (value.length === 0) return 'Category';
    if (value.length === 1) {
      const cat = categories.find((c) => String(c.id) === String(value[0]));
      return cat ? cat.name : '1 selected';
    }
    return `${value.length} categories`;
  }, [value, categories]);

  // Check states for parents
  function isParentChecked(parentId) {
    const childIds = allChildIds.get(parentId) ?? [];
    if (childIds.length === 0) return has(parentId);
    return childIds.every((id) => has(id));
  }

  function isParentIndeterminate(parentId) {
    const childIds = allChildIds.get(parentId) ?? [];
    if (childIds.length === 0) return false;
    const someChecked = childIds.some((id) => has(id));
    const allChecked = childIds.every((id) => has(id));
    return someChecked && !allChecked;
  }

  function toggleParent(parentId) {
    const childIds = allChildIds.get(parentId) ?? [];
    if (childIds.length === 0) {
      // Standalone parent (no children) — toggle it directly
      const next = has(parentId)
        ? without(value, [parentId])
        : [...value, parentId];
      onChange(next);
      return;
    }

    const allChecked = childIds.every((id) => has(id));
    if (allChecked) {
      // Uncheck all children
      onChange(without(value, childIds));
    } else {
      // Check all children (drop any already-present first to avoid dupes)
      onChange([...without(value, childIds), ...childIds]);
    }
  }

  function toggleChild(childId) {
    const next = has(childId)
      ? without(value, [childId])
      : [...value, childId];
    onChange(next);
  }

  // Filter by search
  const searchLower = search.toLowerCase();
  const filteredSections = useMemo(() => {
    if (!search) return sections;
    return sections
      .map((section) => ({
        ...section,
        parents: section.parents.filter((p) => {
          const children = childrenMap.get(p.id) ?? [];
          return (
            p.name.toLowerCase().includes(searchLower) ||
            children.some((c) => c.name.toLowerCase().includes(searchLower))
          );
        }),
      }))
      .filter((section) => section.parents.length > 0);
  }, [sections, childrenMap, searchLower, search]);

  // All currently-visible (filtered) category IDs — for Select All
  const visibleIds = useMemo(() => {
    const ids = [];
    for (const section of filteredSections) {
      for (const parent of section.parents) {
        const children = (childrenMap.get(parent.id) ?? []).filter(
          (c) => !search || c.name.toLowerCase().includes(searchLower) || parent.name.toLowerCase().includes(searchLower)
        );
        if (children.length > 0) {
          ids.push(...children.map((c) => c.id));
        } else {
          ids.push(parent.id);
        }
      }
    }
    return ids;
  }, [filteredSections, childrenMap, search, searchLower]);

  function handleSelectAll() {
    if (value.length > 0) {
      onChange([]);
    } else {
      onChange(visibleIds);
    }
  }

  // Position menu
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuHeight = 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove = spaceBelow < menuHeight && rect.top > spaceBelow;

    if (openAbove) {
      setMenuStyle({ position: 'fixed', bottom: window.innerHeight - rect.top + 6, left: rect.left, width: Math.max(rect.width, 220), minWidth: 220 });
    } else {
      setMenuStyle({ position: 'fixed', top: rect.bottom + 6, left: rect.left, width: Math.max(rect.width, 220), minWidth: 220 });
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (open) {
      setSearch('');
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  // Close on outside click — use pointerdown with a short delay so that
  // clicks inside the portal menu (which may re-render between mousedown
  // and the check) are not mistakenly treated as outside clicks.
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      // Give React a tick to reconcile the portal DOM after state updates
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
      {/* Trigger */}
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

      {/* Menu */}
      {open && createPortal(
        <div ref={menuRef} style={menuStyle} onMouseDown={(e) => e.stopPropagation()} className="z-[9999] rounded-xl border border-gray-200 bg-white shadow-xl flex flex-col max-h-80">
          {/* Search */}
          <div className="p-2 border-b border-gray-100 shrink-0">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); } }}
              placeholder="Search categories..."
              className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 placeholder-gray-400"
            />
          </div>

          {/* Select All / Clear All */}
          {visibleIds.length > 0 && (
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
            {filteredSections.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-3">No matches</p>
            ) : (
              filteredSections.map((section, sIdx) => (
                <div key={section.type}>
                  {/* Section header (Expense / Income) */}
                  {sections.length > 1 && (
                    <div className={`px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100 ${sIdx > 0 ? 'mt-1' : ''}`}>
                      {section.label}
                    </div>
                  )}

                  {section.parents.map((parent) => {
                    const children = (childrenMap.get(parent.id) ?? []).filter(
                      (c) => !search || c.name.toLowerCase().includes(searchLower) || parent.name.toLowerCase().includes(searchLower)
                    );
                    const hasChildren = children.length > 0;
                    const checked = isParentChecked(parent.id);
                    const indeterminate = isParentIndeterminate(parent.id);

                    return (
                      <div key={parent.id}>
                        {/* Parent row */}
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); toggleParent(parent.id); }}
                          className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors"
                        >
                          <Checkbox checked={checked} indeterminate={indeterminate} />
                          <span className={`font-semibold text-xs uppercase tracking-wider ${checked ? 'text-brand' : 'text-gray-500'}`}>
                            {parent.name}
                          </span>
                        </button>

                        {/* Children */}
                        {hasChildren && children.map((child) => {
                          const childChecked = has(child.id);
                          return (
                            <button
                              key={child.id}
                              type="button"
                              onMouseDown={(e) => { e.preventDefault(); toggleChild(child.id); }}
                              className={`w-full text-left pl-8 pr-3 py-1.5 text-sm flex items-center gap-2 transition-colors ${childChecked ? 'bg-accent-light/40' : 'hover:bg-gray-50'}`}
                            >
                              <Checkbox checked={childChecked} />
                              <span className={childChecked ? 'text-brand font-medium' : 'text-gray-700'}>
                                {child.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function Checkbox({ checked, indeterminate = false }) {
  return (
    <span className={`
      inline-flex items-center justify-center h-4 w-4 rounded border flex-shrink-0 transition-colors
      ${checked ? 'bg-accent border-accent text-white' : indeterminate ? 'bg-accent/30 border-accent text-white' : 'border-gray-300 bg-white'}
    `}>
      {checked && (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      )}
      {!checked && indeterminate && (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
        </svg>
      )}
    </span>
  );
}
