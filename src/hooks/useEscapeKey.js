import { useEffect, useRef } from 'react';

// Only the topmost handler runs on ESC, so two stacked modals don't both
// close on a single press.
const escapeStack = [];

if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const top = escapeStack[escapeStack.length - 1];
    if (top) top();
  });
}

/**
 * Register an ESC handler that fires only when this is the most recently
 * mounted active subscriber. The handler is held in a ref so it always sees
 * the latest closure values even when `active` doesn't change.
 */
export function useEscapeKey(active, onEscape) {
  const handlerRef = useRef(onEscape);
  handlerRef.current = onEscape;

  useEffect(() => {
    if (!active) return undefined;
    const entry = () => handlerRef.current && handlerRef.current();
    escapeStack.push(entry);
    return () => {
      const idx = escapeStack.lastIndexOf(entry);
      if (idx !== -1) escapeStack.splice(idx, 1);
    };
  }, [active]);
}
