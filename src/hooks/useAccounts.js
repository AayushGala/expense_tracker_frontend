import { useCallback, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { computeAccountBalances, computeNetWorth } from '../utils/accounting';
import { D, ZERO, round2 } from '../utils/money';

export function useAccounts() {
  const { accounts, categories, entries, transactions } = useData();

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

  const balances = useMemo(
    () => computeAccountBalances(entries, activeAccounts),
    [entries, activeAccounts]
  );

  const netWorth = useMemo(
    () => computeNetWorth(balances, activeAccounts),
    [balances, activeAccounts]
  );

  const getAccountBalance = useCallback(
    (accountId) => balances.get(accountId) ?? ZERO,
    [balances]
  );

  // Entries sorted by date ascending, each annotated with the running
  // balance under the account's sign convention.
  const getAccountLedger = useCallback((accountId) => {
    const txnDateMap = new Map(transactions.map((t) => [t.id, t.date]));

    const accountEntries = entries
      .filter((e) => e.account_id === accountId)
      .map((e) => ({
        ...e,
        date: txnDateMap.get(e.transaction_id) ?? e.created_at,
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const account = activeAccounts.find((a) => a.id === accountId);
    const isDebitNormal =
      !account || account.type === 'asset' || account.type === 'receivable';

    let runningBalance = ZERO;
    return accountEntries.map((entry) => {
      const amt = D(entry.amount);
      const delta =
        entry.entry_type === 'DEBIT'
          ? isDebitNormal ? amt : amt.negated()
          : isDebitNormal ? amt.negated() : amt;

      runningBalance = round2(runningBalance.plus(delta));
      return { ...entry, runningBalance };
    });
  }, [transactions, entries, activeAccounts]);

  return {
    accounts: activeAccounts,
    accountsByType,
    balances,
    netWorth,
    getAccountBalance,
    getAccountLedger,
  };
}
