import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTORS = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Trap keyboard focus inside the returned ref's element while `active` is
 * true. On mount, focus moves to the first focusable child; Tab and Shift+Tab
 * cycle within. On unmount, focus restores to whatever was focused before.
 */
export function useFocusTrap(active) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!active) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;

    const previouslyFocused = document.activeElement;

    function getFocusable() {
      return Array.from(container.querySelectorAll(FOCUSABLE_SELECTORS))
        .filter((el) => !el.hasAttribute('aria-hidden') && el.offsetParent !== null);
    }

    const focusables = getFocusable();
    if (focusables.length > 0) {
      focusables[0].focus();
    } else {
      container.setAttribute('tabindex', '-1');
      container.focus();
    }

    function onKeyDown(e) {
      if (e.key !== 'Tab') return;
      const current = getFocusable();
      if (current.length === 0) {
        e.preventDefault();
        return;
      }
      const first = current[0];
      const last = current[current.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    container.addEventListener('keydown', onKeyDown);

    return () => {
      container.removeEventListener('keydown', onKeyDown);
      // Guarded — the previously focused element may have been removed
      // (e.g., navigation away while the modal was open).
      if (previouslyFocused && typeof previouslyFocused.focus === 'function' &&
          document.body.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [active]);

  return containerRef;
}
