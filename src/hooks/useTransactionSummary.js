import { useEffect, useState } from 'react';
import api from '../api/client';
import { buildTransactionParams } from '../utils/transactionParams';

export function useTransactionSummary(filters) {
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const filtersKey = JSON.stringify(filters);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    api.getTransactionSummary(buildTransactionParams(filters))
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
  }, [filtersKey]);

  return { summary, isLoading, error };
}
