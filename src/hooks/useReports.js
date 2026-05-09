import { useCallback, useMemo } from 'react';
import { useData } from '../context/DataContext';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns "YYYY-MM" from a date string or Date object. */
function toMonthKey(dateStr) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Returns the "YYYY-MM" key for a month that is `offset` months before today. */
function monthOffset(offset) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - offset);
  return toMonthKey(d);
}

/** Generates an ordered array of month keys from oldest to newest (inclusive). */
function generateMonthKeys(count) {
  const keys = [];
  for (let i = count - 1; i >= 0; i--) {
    keys.push(monthOffset(i));
  }
  return keys;
}

/** Sign for an expense-category entry: DEBIT contributes +amount, CREDIT subtracts (refund). */
const expenseSign = (e) => (e.entry_type === 'DEBIT' ? 1 : -1);

/** Sign for an income-category entry: CREDIT contributes +amount, DEBIT subtracts (reversal). */
const incomeSign = (e) => (e.entry_type === 'CREDIT' ? 1 : -1);

/**
 * Returns true if `txn`'s `field` value is in the (optional) `arr` filter, or if
 * the filter is unset/empty. Treats arr being undefined/null/[] as "no filter".
 */
function inAnyOf(arr, value) {
  if (!arr || arr.length === 0) return true;
  return arr.includes(value);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Report aggregation hook.  All returned functions are stable references
 * (created inside useMemo or directly as closures over memoised data).
 */
export function useReports() {
  const { transactions, entries, categories, receivables } = useData();

  // ── Pre-computed lookup tables ────────────────────────────────────────────

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  // Map txnId → transaction (for quick lookup of date and type)
  const txnMap = useMemo(
    () => new Map(transactions.map((t) => [t.id, t])),
    [transactions]
  );

  // All entries on expense-type categories (both DEBITs and CREDITs).
  // CREDITs come from refunds and offset DEBITs in net spending calcs.
  const expenseEntries = useMemo(
    () =>
      entries.filter((e) => {
        const cat = categoryMap.get(e.category_id);
        return cat?.type === 'expense';
      }),
    [entries, categoryMap]
  );

  // All entries on income-type categories.
  // DEBITs (income reversals — rare) offset CREDITs in net income calcs.
  const incomeEntries = useMemo(
    () =>
      entries.filter((e) => {
        const cat = categoryMap.get(e.category_id);
        return cat?.type === 'income';
      }),
    [entries, categoryMap]
  );

  // Investment transactions
  const investmentTxns = useMemo(
    () => transactions.filter((t) => t.type === 'investment'),
    [transactions]
  );

  // ── monthlySpending ───────────────────────────────────────────────────────

  /**
   * Returns expense totals per month for the last `months` months.
   * Optionally filtered to specific beneficiaries and/or owners (any-of arrays).
   *
   * @param {string[]} [beneficiaries]
   * @param {number} [months=12]
   * @param {string[]} [owners]
   * @returns {Array<{ month: string, total: number }>}
   */
  const monthlySpending = useCallback((beneficiaries, months = 12, owners) => {
    const keys = generateMonthKeys(months);
    const totals = Object.fromEntries(keys.map((k) => [k, 0]));

    for (const entry of expenseEntries) {
      const txn = txnMap.get(entry.transaction_id);
      if (!txn) continue;
      if (!inAnyOf(beneficiaries, txn.beneficiary)) continue;
      if (!inAnyOf(owners, txn.owner)) continue;

      const key = toMonthKey(txn.date);
      if (Object.prototype.hasOwnProperty.call(totals, key)) {
        totals[key] = Math.round((totals[key] + expenseSign(entry) * entry.amount) * 100) / 100;
      }
    }

    return keys.map((month) => ({ month, total: totals[month] }));
  }, [expenseEntries, txnMap]);

  // ── categoryBreakdown ─────────────────────────────────────────────────────

  /**
   * Returns expense totals by category for a specific month.
   * Defaults to the current month.
   *
   * @param {string[]} [beneficiaries]
   * @param {string} [month] - "YYYY-MM", defaults to current month
   * @param {string[]} [owners]
   * @returns {Array<{ categoryId: string, categoryName: string, total: number }>}
   */
  const categoryBreakdown = useCallback((beneficiaries, month, owners) => {
    const targetMonth = month ?? toMonthKey(new Date());
    const totals = new Map(); // categoryId → number

    for (const entry of expenseEntries) {
      const txn = txnMap.get(entry.transaction_id);
      if (!txn) continue;
      if (toMonthKey(txn.date) !== targetMonth) continue;
      if (!inAnyOf(beneficiaries, txn.beneficiary)) continue;
      if (!inAnyOf(owners, txn.owner)) continue;

      const prev = totals.get(entry.category_id) ?? 0;
      totals.set(
        entry.category_id,
        Math.round((prev + expenseSign(entry) * entry.amount) * 100) / 100
      );
    }

    return Array.from(totals.entries()).map(([categoryId, total]) => ({
      categoryId,
      categoryName: categoryMap.get(categoryId)?.name ?? categoryId,
      total,
    }));
  }, [expenseEntries, txnMap, categoryMap]);

  // ── cashflow ──────────────────────────────────────────────────────────────

  /**
   * Returns income, expenses, and investment totals per month.
   * Optionally filtered by owner / beneficiary (any-of arrays).
   *
   * @param {number} [months=12]
   * @param {string[]} [owners]
   * @param {string[]} [beneficiaries]
   * @returns {Array<{ month: string, income: number, expenses: number, investments: number }>}
   */
  const cashflow = useCallback((months = 12, owners, beneficiaries) => {
    const keys = generateMonthKeys(months);
    const data = Object.fromEntries(
      keys.map((k) => [k, { income: 0, expenses: 0, investments: 0 }])
    );

    for (const entry of expenseEntries) {
      const txn = txnMap.get(entry.transaction_id);
      if (!txn) continue;
      if (!inAnyOf(owners, txn.owner)) continue;
      if (!inAnyOf(beneficiaries, txn.beneficiary)) continue;
      const key = toMonthKey(txn.date);
      if (!data[key]) continue;
      data[key].expenses = Math.round((data[key].expenses + expenseSign(entry) * entry.amount) * 100) / 100;
    }

    for (const entry of incomeEntries) {
      const txn = txnMap.get(entry.transaction_id);
      if (!txn) continue;
      if (!inAnyOf(owners, txn.owner)) continue;
      if (!inAnyOf(beneficiaries, txn.beneficiary)) continue;
      const key = toMonthKey(txn.date);
      if (!data[key]) continue;
      data[key].income = Math.round((data[key].income + incomeSign(entry) * entry.amount) * 100) / 100;
    }

    for (const txn of investmentTxns) {
      if (!inAnyOf(owners, txn.owner)) continue;
      if (!inAnyOf(beneficiaries, txn.beneficiary)) continue;
      const key = toMonthKey(txn.date);
      if (!data[key]) continue;
      data[key].investments = Math.round(
        (data[key].investments + (txn.amount ?? 0)) * 100
      ) / 100;
    }

    return keys.map((month) => ({ month, ...data[month] }));
  }, [expenseEntries, incomeEntries, investmentTxns, txnMap]);

  // ── spendingTrends ────────────────────────────────────────────────────────

  /**
   * Returns monthly expense totals, optionally filtered to categories,
   * owners, and beneficiaries (any-of arrays).
   *
   * @param {number|number[]} [categoryIds] - single ID or array of IDs
   * @param {number} [months=12]
   * @param {string[]} [owners]
   * @param {string[]} [beneficiaries]
   * @returns {Array<{ month: string, total: number }>}
   */
  const spendingTrends = useCallback((categoryIds, months = 12, owners, beneficiaries) => {
    const keys = generateMonthKeys(months);
    const totals = Object.fromEntries(keys.map((k) => [k, 0]));

    const ids = Array.isArray(categoryIds) ? categoryIds : categoryIds ? [categoryIds] : null;

    for (const entry of expenseEntries) {
      if (ids && ids.length > 0 && !ids.includes(entry.category_id)) continue;
      const txn = txnMap.get(entry.transaction_id);
      if (!txn) continue;
      if (!inAnyOf(owners, txn.owner)) continue;
      if (!inAnyOf(beneficiaries, txn.beneficiary)) continue;
      const key = toMonthKey(txn.date);
      if (!Object.prototype.hasOwnProperty.call(totals, key)) continue;
      totals[key] = Math.round((totals[key] + expenseSign(entry) * entry.amount) * 100) / 100;
    }

    return keys.map((month) => ({ month, total: totals[month] }));
  }, [expenseEntries, txnMap]);

  // ── receivablesSummary ────────────────────────────────────────────────────

  /**
   * Returns the total outstanding receivable amount and a per-person breakdown.
   *
   * @returns {{ totalOwed: number, byPerson: Array<{ person: string, amount: number }> }}
   */
  const receivablesSummary = useCallback(() => {
    const outstanding = receivables.filter(
      (r) => r.status !== 'settled' && r.status !== 'paid'
    );

    const personMap = new Map(); // person name → outstanding amount
    for (const r of outstanding) {
      const name = r.person_name ?? 'Unknown';
      const prev = personMap.get(name) ?? 0;
      const remaining = (r.amount_owed ?? 0) - (r.amount_settled ?? 0);
      personMap.set(name, Math.round((prev + remaining) * 100) / 100);
    }

    const byPerson = Array.from(personMap.entries()).map(([person, amount]) => ({
      person,
      amount,
    }));

    const totalOwed = byPerson.reduce((sum, p) => sum + p.amount, 0);

    return {
      totalOwed: Math.round(totalOwed * 100) / 100,
      byPerson,
    };
  }, [receivables]);

  return {
    monthlySpending,
    categoryBreakdown,
    cashflow,
    spendingTrends,
    receivablesSummary,
  };
}
