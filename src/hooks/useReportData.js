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

export function useMonthlySpending(filters = {}, months = 12) {
  const { params, key } = useReportParams(filters, { months });
  const { data, isLoading, error } = useApiResource(() => api.getMonthlySpending(params), [key]);
  return { data: data?.data ?? [], isLoading, error };
}

export function useSpendingTrends(filters = {}, months = 12) {
  const { params, key } = useReportParams(filters, { months });
  const { data, isLoading, error } = useApiResource(() => api.getSpendingTrends(params), [key]);
  return { data: data?.data ?? [], isLoading, error };
}

export function useCashflow(filters = {}, months = 12) {
  const { params, key } = useReportParams(filters, { months });
  const { data, isLoading, error } = useApiResource(() => api.getCashflow(params), [key]);
  return { data: data?.data ?? [], isLoading, error };
}

export function useCategoryBreakdown(filters = {}, month) {
  const { params, key } = useReportParams(filters, month ? { month } : {});
  const { data, isLoading, error } = useApiResource(() => api.getCategoryBreakdown(params), [key]);
  const mapped = useMemo(
    () => (data?.data ?? []).map((r) => ({
      categoryId: r.category_id,
      categoryName: r.category_name,
      total: r.total,
    })),
    [data],
  );
  return { data: mapped, isLoading, error };
}

export function useReceivablesRollup() {
  const { dataVersion } = useData();
  const { data, isLoading, error } = useApiResource(
    () => api.getReceivablesRollup(), [dataVersion ?? 0],
  );
  const rollup = useMemo(
    () => ({
      totalOwed: data?.total_owed ?? 0,
      byPerson: data?.by_person ?? [],
    }),
    [data],
  );
  return { ...rollup, isLoading, error };
}

export function useBeneficiaries() {
  const { dataVersion } = useData();
  const { data } = useApiResource(() => api.getBeneficiaries(), [dataVersion ?? 0]);
  return useMemo(() => (data ?? []).map((b) => ({ value: b, label: b })), [data]);
}
