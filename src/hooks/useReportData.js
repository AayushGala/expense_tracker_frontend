import { useMemo } from 'react';
import api from '../api/client';
import { buildTransactionParams } from '../utils/transactionParams';
import { useApiResource } from './useApiResource';
import { useData } from '../context/DataContext';

// Server-backed replacements for the old in-memory useReports() callbacks.
// Each returns data in the same shape the chart components already consume,
// plus { isLoading, error }. They refetch when the filters/params change or
// when DataContext bumps dataVersion after a transaction mutation.

function useReportParams(filters, extra) {
  const { dataVersion } = useData();
  const params = buildTransactionParams(filters, extra);
  const key = `${params.toString()}::${dataVersion ?? 0}`;
  return { params, key };
}

export function useGroupTrends(filters = {}, months = 12) {
  const { params, key } = useReportParams(filters, { months });
  const { data, isLoading, error } = useApiResource(() => api.getGroupTrends(params), [key]);
  return { data, isLoading, error };
}

/** Net worth is account-based, so only the owner filter applies. */
export function useNetWorthHistory(owners = [], months = 12) {
  const { params, key } = useReportParams({ owners }, { months });
  const { data, isLoading, error } = useApiResource(() => api.getNetWorthHistory(params), [key]);
  return { data: data?.data ?? [], isLoading, error };
}

export function useCashflow(filters = {}, months = 12) {
  const { params, key } = useReportParams(filters, { months });
  const { data, isLoading, error } = useApiResource(() => api.getCashflow(params), [key]);
  return { data: data?.data ?? [], isLoading, error };
}

export function useMonthReview(filters = {}, month) {
  const { params, key } = useReportParams(filters, { month });
  const { data, isLoading, error } = useApiResource(() => api.getMonthReview(params), [key]);
  return { data, isLoading, error };
}

export function useCategoryInsights(categoryId, filters = {}, months = 12, month) {
  const { params, key } = useReportParams(filters, { category: categoryId, months, month });
  const { data, isLoading, error } = useApiResource(() => api.getCategoryInsights(params), [key]);
  return { data, isLoading, error };
}

export function useBeneficiaries() {
  const { dataVersion } = useData();
  const { data } = useApiResource(() => api.getBeneficiaries(), [dataVersion ?? 0]);
  return useMemo(() => (data ?? []).map((b) => ({ value: b, label: b })), [data]);
}
