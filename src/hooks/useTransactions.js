import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { sum } from '../utils/money';

// Multi-value filters (types, accountIds, owners, etc.) match if any value matches.
export function useTransactions(filters = {}) {
  const { transactions, entries, accounts, categories } = useData();

  const {
    dateFrom, dateTo,
    types, accountIds, categoryIds, categoryType,
    owners, platforms, tags, beneficiaries,
    search,
  } = filters;

  const hasTypes = types && types.length > 0;
  const hasAccounts = accountIds && accountIds.length > 0;
  const hasCategoryFilter = categoryIds && categoryIds.length > 0;
  const hasCategoryType = categoryType === 'expense' || categoryType === 'income';
  const hasOwners = owners && owners.length > 0;
  const hasPlatforms = platforms && platforms.length > 0;
  const hasTagsFilter = tags && tags.length > 0;
  const hasBeneficiaries = beneficiaries && beneficiaries.length > 0;

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const entriesByTxn = useMemo(() => {
    const map = new Map();
    for (const entry of entries) {
      if (!map.has(entry.transaction_id)) {
        map.set(entry.transaction_id, []);
      }
      map.get(entry.transaction_id).push(entry);
    }
    return map;
  }, [entries]);

  function getTransactionEntries(txnId) {
    return entriesByTxn.get(txnId) ?? [];
  }

  const filteredTransactions = useMemo(() => {
    const searchLower = search ? search.toLowerCase() : '';
    const fromMs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toMs = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : null;

    return transactions
      .filter((txn) => {
        if (fromMs !== null || toMs !== null) {
          const txnMs = new Date(txn.date).getTime();
          if (fromMs !== null && txnMs < fromMs) return false;
          if (toMs !== null && txnMs > toMs) return false;
        }

        if (hasTypes && !types.includes(txn.type)) return false;
        if (hasBeneficiaries && !beneficiaries.includes(txn.beneficiary)) return false;
        if (hasOwners && !owners.includes(txn.owner)) return false;
        if (hasPlatforms && !platforms.includes(txn.platform)) return false;

        if (hasTagsFilter) {
          const txnTags = String(txn.tags ?? '').split(',').map((s) => s.trim()).filter(Boolean);
          if (!tags.some((t) => txnTags.includes(t))) return false;
        }

        if (hasAccounts || hasCategoryFilter || hasCategoryType) {
          const txnEntries = entriesByTxn.get(txn.id) ?? [];
          if (hasAccounts && !txnEntries.some((e) => accountIds.includes(e.account_id))) {
            return false;
          }
          if (hasCategoryFilter) {
            // Refunds and fee-bearing transfers route through an entry whose
            // category differs from transaction.category, so also check entries.
            const txnCategoryMatch = txn.category_id != null && categoryIds.includes(txn.category_id);
            const entryCategoryMatch = txnEntries.some((e) => categoryIds.includes(e.category_id));
            if (!txnCategoryMatch && !entryCategoryMatch) return false;
          }
          if (hasCategoryType) {
            const matchesActivity = txnEntries.some((e) => {
              const cat = categoryMap.get(e.category_id);
              return cat?.type === categoryType;
            });
            if (!matchesActivity) return false;
          }
        }

        if (searchLower) {
          const noteMatch = txn.notes?.toLowerCase().includes(searchLower) ?? false;
          const beneficiaryMatch =
            txn.beneficiary?.toLowerCase().includes(searchLower) ?? false;
          const platformMatch =
            txn.platform?.toLowerCase().includes(searchLower) ?? false;
          if (!noteMatch && !beneficiaryMatch && !platformMatch) return false;
        }

        return true;
      })
      .map((txn) => {
        const txnEntries = entriesByTxn.get(txn.id) ?? [];
        const accountNames = [
          ...new Set(
            txnEntries
              .map((e) => accountMap.get(e.account_id)?.name)
              .filter(Boolean)
          ),
        ];
        const categoryNames = [
          ...new Set(
            txnEntries
              .map((e) => categoryMap.get(e.category_id)?.name)
              .filter(Boolean)
          ),
        ];

        // Compute display amount from entries (transaction row has no amount).
        let amount = txn.amount;
        if (amount === undefined || amount === null || amount === '') {
          const credits = sum(
            txnEntries.filter((e) => e.entry_type === 'CREDIT').map((e) => e.amount),
          );
          const debits = sum(
            txnEntries.filter((e) => e.entry_type === 'DEBIT').map((e) => e.amount),
          );
          // Take the larger side — equal for balanced entries.
          amount = credits.gt(debits) ? credits : debits;
        }

        return {
          ...txn,
          amount,
          accountNames,
          categoryNames,
        };
      })
      // Mirrors Transaction.Meta.ordering = ['-date', '-created_at']. Without
      // the created_at tiebreaker, a freshly-added same-date txn sits at the
      // end of the array (because adds are surgical, not refetched).
      .sort((a, b) => {
        const dateCmp = new Date(b.date) - new Date(a.date);
        if (dateCmp !== 0) return dateCmp;
        const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bCreated - aCreated;
      });
  }, [
    transactions,
    entriesByTxn,
    accountMap,
    categoryMap,
    dateFrom,
    dateTo,
    types,
    accountIds,
    categoryIds,
    categoryType,
    owners,
    platforms,
    tags,
    beneficiaries,
    search,
    hasTypes,
    hasAccounts,
    hasCategoryFilter,
    hasCategoryType,
    hasOwners,
    hasPlatforms,
    hasTagsFilter,
    hasBeneficiaries,
  ]);

  return {
    filteredTransactions,
    getTransactionEntries,
  };
}
