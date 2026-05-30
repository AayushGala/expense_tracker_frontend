import { useCallback, useMemo } from 'react';
import { useData } from '../context/DataContext';
import api from '../api/client';
import { useApiResource } from './useApiResource';
import { D, ZERO } from '../utils/money';

// Account list/grouping comes from the (light) in-context accounts array;
// balances + net worth are computed server-side (/api/accounts/balances/) so
// the heavy entries array no longer needs to live in memory. Per-account
// ledgers are fetched on demand by the consumer via api.getAccountLedger().
export function useAccounts() {
  const { accounts, dataVersion } = useData();

  const activeAccounts = useMemo(
    () => accounts.filter((a) => !a._removed),
    [accounts]
  );

  const accountsByType = useMemo(() => {
    const grouped = { asset: [], liability: [], receivable: [] };
    for (const account of activeAccounts) {
      const key = account.type;
      if (Object.prototype.hasOwnProperty.call(grouped, key)) {
        grouped[key].push(account);
      }
    }
    return grouped;
  }, [activeAccounts]);

  const { data, isLoading } = useApiResource(
    () => api.getAccountBalances(),
    [dataVersion ?? 0],
  );

  // Keep the Decimal contract the components expect (AmountDisplay / sum()).
  const balances = useMemo(() => {
    const map = new Map();
    for (const b of data?.balances ?? []) {
      map.set(b.account_id, D(b.balance));
    }
    return map;
  }, [data]);

  const netWorth = useMemo(() => D(data?.net_worth ?? 0), [data]);

  // Which accounts have any entries (used to warn before delete). Server flags
  // this so we don't need the entries array in memory.
  const accountsWithEntries = useMemo(() => {
    const set = new Set();
    for (const b of data?.balances ?? []) {
      if (b.has_entries) set.add(b.account_id);
    }
    return set;
  }, [data]);

  const getAccountBalance = useCallback(
    (accountId) => balances.get(accountId) ?? ZERO,
    [balances]
  );

  return {
    accounts: activeAccounts,
    accountsByType,
    balances,
    netWorth,
    getAccountBalance,
    accountsWithEntries,
    isLoading,
  };
}
