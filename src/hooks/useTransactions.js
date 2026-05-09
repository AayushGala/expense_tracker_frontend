import { useMemo } from 'react';
import { useData } from '../context/DataContext';

/**
 * Custom hook for filtering and enriching transactions.
 * Multi-value filters (types, accountIds, owners, etc.) match if ANY value matches.
 */
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

  // Build lookup maps once
  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  // Build a lookup from transactionId → entries[]
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

  /**
   * Returns the entries for a given transaction id.
   * @param {string} txnId
   * @returns {Array<Object>}
   */
  function getTransactionEntries(txnId) {
    return entriesByTxn.get(txnId) ?? [];
  }

  // Enrich + filter + sort
  const filteredTransactions = useMemo(() => {
    const searchLower = search ? search.toLowerCase() : '';
    const fromMs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toMs = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : null;

    return transactions
      .filter((txn) => {
        // Date range
        if (fromMs !== null || toMs !== null) {
          const txnMs = new Date(txn.date).getTime();
          if (fromMs !== null && txnMs < fromMs) return false;
          if (toMs !== null && txnMs > toMs) return false;
        }

        // Transaction type (any-of)
        if (hasTypes && !types.includes(txn.type)) return false;

        // Beneficiary (any-of)
        if (hasBeneficiaries && !beneficiaries.includes(txn.beneficiary)) return false;

        // Owner (any-of)
        if (hasOwners && !owners.includes(txn.owner)) return false;

        // Platform (any-of)
        if (hasPlatforms && !platforms.includes(txn.platform)) return false;

        // Tag (any-of) — match if any selected tag appears in the comma-separated tags string
        if (hasTagsFilter) {
          const txnTags = String(txn.tags ?? '').split(',').map((s) => s.trim()).filter(Boolean);
          if (!tags.some((t) => txnTags.includes(t))) return false;
        }

        // Account / category filter
        if (hasAccounts || hasCategoryFilter || hasCategoryType) {
          const txnEntries = entriesByTxn.get(txn.id) ?? [];
          if (hasAccounts && !txnEntries.some((e) => accountIds.includes(e.account_id))) {
            return false;
          }
          if (hasCategoryFilter) {
            // Match if the transaction's own category_id is in the filter,
            // OR any of its entries hit a filtered category. This catches refunds
            // (where transaction.category is Refund but the entry CREDITs the
            // source's expense category) and transfers with fees (where the
            // fee_category entry hits a different category from transaction.category).
            const txnCategoryMatch = txn.category_id != null && categoryIds.includes(txn.category_id);
            const entryCategoryMatch = txnEntries.some((e) => categoryIds.includes(e.category_id));
            if (!txnCategoryMatch && !entryCategoryMatch) return false;
          }
          if (hasCategoryType) {
            // Match if any entry hits a category whose type matches.
            const matchesActivity = txnEntries.some((e) => {
              const cat = categoryMap.get(e.category_id);
              return cat?.type === categoryType;
            });
            if (!matchesActivity) return false;
          }
        }

        // Free-text search
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
        // Enrich with human-readable account and category names from entries
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

        // Compute display amount from entries (not stored on the transaction row).
        // For expense/split_expense/bill_payment/investment: sum of CREDIT entries on real accounts
        // For income/reimbursement: sum of DEBIT entries on real accounts
        // For transfer: the transfer amount (either leg)
        let amount = txn.amount; // keep optimistic value if present
        if (amount === undefined || amount === null || amount === '') {
          const credits = txnEntries
            .filter((e) => e.entry_type === 'CREDIT')
            .reduce((sum, e) => sum + (e.amount || 0), 0);
          const debits = txnEntries
            .filter((e) => e.entry_type === 'DEBIT')
            .reduce((sum, e) => sum + (e.amount || 0), 0);
          // Use the larger side (they should be equal for balanced entries)
          amount = Math.max(credits, debits);
        }

        return {
          ...txn,
          amount,
          accountNames,
          categoryNames,
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
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
