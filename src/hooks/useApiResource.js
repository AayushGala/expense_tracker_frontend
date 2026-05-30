import { useCallback, useEffect, useState } from 'react';

// Generic server-resource hook with the cancellation pattern the app already
// uses in useTransactionSummary. Each server-backed consumer (reports,
// balances, paginated list) uses this so loading/error handling is uniform.
//
//   const { data, isLoading, error, refetch } = useApiResource(
//     () => api.getCashflow(params), [paramsKey],
//   );
//
// `deps` controls re-fetching (pass a stable key like a serialized params
// object). `skip` short-circuits the fetch (e.g. a modal that isn't open yet).
export function useApiResource(fetcher, deps = [], { skip = false } = {}) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(!skip);
  const [error, setError] = useState(null);
  const [reloadFlag, setReloadFlag] = useState(0);

  const refetch = useCallback(() => setReloadFlag((n) => n + 1), []);

  useEffect(() => {
    if (skip) {
      setIsLoading(false);
      return undefined;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    // Wrap in .then so a synchronous throw in fetcher() is also caught.
    Promise.resolve().then(() => fetcher())
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
    // fetcher is intentionally excluded; `deps` is the caller's stable key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, skip, reloadFlag]);

  return { data, isLoading, error, refetch };
}
