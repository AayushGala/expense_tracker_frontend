import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Position a portaled menu beneath (or above) a trigger element. Returns
 * refs for the trigger and menu, a style object to spread onto the menu,
 * and an `updatePosition()` callback for manual re-layout (call before
 * opening to avoid a one-frame flash at 0,0).
 *
 * The menu flips above the trigger when there isn't enough space below for
 * `menuHeight` and more room exists above.
 */
export function useFloatingMenu({ open, menuHeight = 240, minWidth = 0, margin = 0 } = {}) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState({});

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openAbove = spaceBelow < menuHeight && spaceAbove > spaceBelow;

    const desiredWidth = Math.max(rect.width, minWidth);
    const maxWidth = window.innerWidth - margin * 2;
    const width = Math.min(desiredWidth, maxWidth);

    let left = rect.left;
    if (margin > 0) {
      if (left + width > window.innerWidth - margin) {
        left = window.innerWidth - margin - width;
      }
      if (left < margin) left = margin;
    }

    const base = { position: 'fixed', left, width, minWidth: width };
    if (openAbove) {
      setMenuStyle({ ...base, bottom: window.innerHeight - rect.top + 6 });
    } else {
      setMenuStyle({ ...base, top: rect.bottom + 6 });
    }
  }, [menuHeight, minWidth, margin]);

  useEffect(() => {
    if (!open) return undefined;
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  return { triggerRef, menuRef, menuStyle, updatePosition };
}
