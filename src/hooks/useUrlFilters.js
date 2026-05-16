import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Sync a filter object with URL search params. Uses `replace: true` on
 * writes so filter tweaks don't flood browser history.
 *
 * Schema entries: `{ array: true }` for repeated params, `{ keepEmpty: true }`
 * for fields whose explicit empty value must be preserved (otherwise an
 * empty URL would re-apply the non-empty default — e.g., "clear dateFrom"
 * would snap back to this-month).
 *
 *   const [filters, setFilters] = useUrlFilters(
 *     { statuses: { array: true }, dateFrom: { keepEmpty: true }, search: {} },
 *     defaults,
 *   );
 *   setFilters({ search: 'lunch' });           // partial merge
 *   setFilters((prev) => ({ ...prev, ... }));  // updater fn
 */
export function useUrlFilters(schema, defaults) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => {
    const out = {};
    for (const [key, opts] of Object.entries(schema)) {
      const fallback = defaults?.[key] ?? (opts.array ? [] : '');
      if (opts.array) {
        const values = searchParams.getAll(key);
        out[key] = values.length > 0 ? values : fallback;
      } else {
        const v = searchParams.get(key);
        out[key] = v ?? fallback;
      }
    }
    return out;
  }, [searchParams, schema, defaults]);

  const setFilters = useCallback(
    (updater) => {
      const next = typeof updater === 'function' ? updater(filters) : { ...filters, ...updater };
      const params = new URLSearchParams();
      for (const [key, opts] of Object.entries(schema)) {
        const value = next[key];
        if (opts.array) {
          if (Array.isArray(value)) {
            for (const v of value) {
              if (v !== '' && v != null) params.append(key, v);
            }
          }
        } else if (value !== '' && value != null) {
          params.set(key, String(value));
        } else if (opts.keepEmpty) {
          params.set(key, '');
        }
      }
      setSearchParams(params, { replace: true });
    },
    [filters, schema, setSearchParams],
  );

  return [filters, setFilters];
}
