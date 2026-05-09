import { useEffect, useState } from 'react';
import api from '../api/client';

/**
 * Build URLSearchParams using repeated keys for multi-value filters
 * (HTTP-standard array encoding: ?type=expense&type=income).
 */
function buildParams(filters, splitMode) {
  const params = new URLSearchParams();

  if (filters.dateFrom) params.set('date_from', filters.dateFrom);
  if (filters.dateTo) params.set('date_to', filters.dateTo);

  const appendEach = (key, values) => {
    if (!values || values.length === 0) return;
    for (const v of values) params.append(key, v);
  };

  appendEach('type', filters.types);
  appendEach('account_id', filters.accountIds);
  appendEach('beneficiary', filters.beneficiaries);
  appendEach('owner', filters.owners);
  appendEach('platform', filters.platforms);
  appendEach('tag', filters.tags);

  // category_ids stays as a single CSV param — backend already special-cases it
  // for the existing list-endpoint filtering and the new code paths use the same
  // backend filter, so we keep that param unchanged.
  if (filters.categoryIds?.length > 0) {
    params.set('category_ids', filters.categoryIds.join(','));
  }

  if (filters.categoryType) params.set('category_type', filters.categoryType);

  if (filters.search) params.set('search', filters.search);
  if (splitMode) params.set('split_mode', splitMode);
  return params;
}

export function useTransactionSummary(filters, splitMode = 'my_share') {
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const filtersKey = JSON.stringify(filters);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    api.getTransactionSummary(buildParams(filters, splitMode))
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [filtersKey, splitMode]);

  return { summary, isLoading, error };
}
