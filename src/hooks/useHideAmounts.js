import { useCallback, useEffect, useState } from 'react';

// Per-device privacy toggle for the money summaries: net worth (Dashboard,
// Accounts) and the Transactions totals. One setting drives all of them.
// Lives in localStorage so it survives reloads; storage can be unavailable
// (private mode, blocked site data), in which case it just defaults to shown.
const KEY = 'hideAmounts';

function readHidden() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function useHideAmounts() {
  const [hidden, setHidden] = useState(readHidden);

  useEffect(() => {
    try {
      if (hidden) localStorage.setItem(KEY, '1');
      else localStorage.removeItem(KEY);
    } catch {
      // Not persisted; the toggle still works for this page view.
    }
  }, [hidden]);

  const toggle = useCallback(() => setHidden((h) => !h), []);
  return [hidden, toggle];
}
