import { useMemo } from 'react';
import api from '../api/client';
import { useApiResource } from './useApiResource';
import { useData } from '../context/DataContext';
import { buildTransactionParams } from '../utils/transactionParams';
import { D } from '../utils/money';

// Fetches a single server-paginated page of transactions. Rows arrive already
// enriched by the backend (account_names, category_names, amount), so the old
// in-memory filter/enrich over the full entries array is gone.
//
//   const { transactions, count, isLoading } = useTransactions(filters, {
//     page, ordering, pageSize,
//   });
export function useTransactions(filters = {}, { page = 1, ordering, pageSize } = {}) {
  const { dataVersion } = useData();

  const extra = { page };
  if (ordering) extra.ordering = ordering;
  if (pageSize) extra.page_size = pageSize;

  const params = buildTransactionParams(filters, extra);
  const key = `${params.toString()}::${dataVersion ?? 0}`;

  const { data, isLoading, error, refetch } = useApiResource(
    () => api.getTransactions(params),
    [key],
  );

  // Map server rows to the shape the UI expects (camelCase names, Decimal
  // amount so AmountDisplay/CSV keep working).
  const transactions = useMemo(
    () => (data?.results ?? []).map((r) => ({
      ...r,
      amount: D(r.amount),
      accountNames: r.account_names ?? [],
      categoryNames: r.category_names ?? [],
    })),
    [data],
  );

  return {
    transactions,
    count: data?.count ?? 0,
    isLoading,
    error,
    refetch,
  };
}
