import { useCallback, useSyncExternalStore } from 'react';

// Per-device privacy toggle for the money summaries: net worth (Dashboard,
// Accounts) and the Transactions totals. One setting drives all of them.
// Lives in localStorage so it survives reloads; storage can be unavailable
// (private mode, blocked site data), in which case it just defaults to shown.
// A module-level store keeps every mounted card in sync when one toggles it.
const KEY = 'hideAmounts';
const listeners = new Set();

function readHidden() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

let hidden = readHidden();

function setHidden(next) {
  hidden = next;
  try {
    if (next) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    // Not persisted; the toggle still works for this page view.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => hidden;

export function useHideAmounts() {
  const value = useSyncExternalStore(subscribe, getSnapshot);
  const toggle = useCallback(() => setHidden(!hidden), []);
  return [value, toggle];
}

// Test hook: re-read storage (each test stubs a fresh localStorage).
export function __resetHideAmountsForTests() {
  hidden = readHidden();
}
