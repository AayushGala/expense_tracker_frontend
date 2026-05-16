import { useCallback, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { D, ZERO, round2 } from '../utils/money';

// Aggregation uses Decimal internally; results are .toNumber()'d at the
// boundary because Recharts expects plain numbers.

function toMonthKey(dateStr) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function monthOffset(offset) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - offset);
  return toMonthKey(d);
}

function generateMonthKeys(count) {
  const keys = [];
  for (let i = count - 1; i >= 0; i--) {
    keys.push(monthOffset(i));
  }
  return keys;
}

function applySigned(prev, entry, sign) {
  return prev.plus(D(entry.amount).times(sign(entry)));
}

// CREDIT entries are refunds that offset the DEBIT spending.
const expenseSign = (e) => (e.entry_type === 'DEBIT' ? 1 : -1);
// DEBIT entries are reversals that offset the CREDIT income.
const incomeSign = (e) => (e.entry_type === 'CREDIT' ? 1 : -1);

function inAnyOf(arr, value) {
  if (!arr || arr.length === 0) return true;
  return arr.includes(value);
}

export function useReports() {
  const { transactions, entries, categories, receivables } = useData();

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const txnMap = useMemo(
    () => new Map(transactions.map((t) => [t.id, t])),
    [transactions],
  );

  const expenseEntries = useMemo(
    () => entries.filter((e) => categoryMap.get(e.category_id)?.type === 'expense'),
    [entries, categoryMap],
  );

  const incomeEntries = useMemo(
    () => entries.filter((e) => categoryMap.get(e.category_id)?.type === 'income'),
    [entries, categoryMap],
  );

  const investmentTxns = useMemo(
    () => transactions.filter((t) => t.type === 'investment'),
    [transactions],
  );


  const monthlySpending = useCallback((beneficiaries, months = 12, owners) => {
    const keys = generateMonthKeys(months);
    const totals = Object.fromEntries(keys.map((k) => [k, ZERO]));

    for (const entry of expenseEntries) {
      const txn = txnMap.get(entry.transaction_id);
      if (!txn) continue;
      if (!inAnyOf(beneficiaries, txn.beneficiary)) continue;
      if (!inAnyOf(owners, txn.owner)) continue;

      const key = toMonthKey(txn.date);
      if (Object.prototype.hasOwnProperty.call(totals, key)) {
        totals[key] = applySigned(totals[key], entry, expenseSign);
      }
    }

    return keys.map((month) => ({ month, total: round2(totals[month]).toNumber() }));
  }, [expenseEntries, txnMap]);


  const categoryBreakdown = useCallback((beneficiaries, month, owners) => {
    const targetMonth = month ?? toMonthKey(new Date());
    const totals = new Map(); // categoryId → Decimal

    for (const entry of expenseEntries) {
      const txn = txnMap.get(entry.transaction_id);
      if (!txn) continue;
      if (toMonthKey(txn.date) !== targetMonth) continue;
      if (!inAnyOf(beneficiaries, txn.beneficiary)) continue;
      if (!inAnyOf(owners, txn.owner)) continue;

      const prev = totals.get(entry.category_id) ?? ZERO;
      totals.set(entry.category_id, applySigned(prev, entry, expenseSign));
    }

    return Array.from(totals.entries()).map(([categoryId, total]) => ({
      categoryId,
      categoryName: categoryMap.get(categoryId)?.name ?? categoryId,
      total: round2(total).toNumber(),
    }));
  }, [expenseEntries, txnMap, categoryMap]);


  const cashflow = useCallback((months = 12, owners, beneficiaries) => {
    const keys = generateMonthKeys(months);
    const data = Object.fromEntries(
      keys.map((k) => [k, { income: ZERO, expenses: ZERO, investments: ZERO }]),
    );

    for (const entry of expenseEntries) {
      const txn = txnMap.get(entry.transaction_id);
      if (!txn) continue;
      if (!inAnyOf(owners, txn.owner)) continue;
      if (!inAnyOf(beneficiaries, txn.beneficiary)) continue;
      const key = toMonthKey(txn.date);
      if (!data[key]) continue;
      data[key].expenses = applySigned(data[key].expenses, entry, expenseSign);
    }

    for (const entry of incomeEntries) {
      const txn = txnMap.get(entry.transaction_id);
      if (!txn) continue;
      if (!inAnyOf(owners, txn.owner)) continue;
      if (!inAnyOf(beneficiaries, txn.beneficiary)) continue;
      const key = toMonthKey(txn.date);
      if (!data[key]) continue;
      data[key].income = applySigned(data[key].income, entry, incomeSign);
    }

    for (const txn of investmentTxns) {
      if (!inAnyOf(owners, txn.owner)) continue;
      if (!inAnyOf(beneficiaries, txn.beneficiary)) continue;
      const key = toMonthKey(txn.date);
      if (!data[key]) continue;
      data[key].investments = data[key].investments.plus(D(txn.amount));
    }

    return keys.map((month) => ({
      month,
      income: round2(data[month].income).toNumber(),
      expenses: round2(data[month].expenses).toNumber(),
      investments: round2(data[month].investments).toNumber(),
    }));
  }, [expenseEntries, incomeEntries, investmentTxns, txnMap]);


  const spendingTrends = useCallback((categoryIds, months = 12, owners, beneficiaries) => {
    const keys = generateMonthKeys(months);
    const totals = Object.fromEntries(keys.map((k) => [k, ZERO]));

    const ids = Array.isArray(categoryIds) ? categoryIds : categoryIds ? [categoryIds] : null;

    for (const entry of expenseEntries) {
      if (ids && ids.length > 0 && !ids.includes(entry.category_id)) continue;
      const txn = txnMap.get(entry.transaction_id);
      if (!txn) continue;
      if (!inAnyOf(owners, txn.owner)) continue;
      if (!inAnyOf(beneficiaries, txn.beneficiary)) continue;
      const key = toMonthKey(txn.date);
      if (!Object.prototype.hasOwnProperty.call(totals, key)) continue;
      totals[key] = applySigned(totals[key], entry, expenseSign);
    }

    return keys.map((month) => ({ month, total: round2(totals[month]).toNumber() }));
  }, [expenseEntries, txnMap]);


  const receivablesSummary = useCallback(() => {
    const outstanding = receivables.filter(
      (r) => r.status !== 'settled' && r.status !== 'paid',
    );

    const personMap = new Map(); // person name → Decimal outstanding
    for (const r of outstanding) {
      const name = r.person_name ?? 'Unknown';
      const prev = personMap.get(name) ?? ZERO;
      const remaining = D(r.amount_owed ?? 0).minus(D(r.amount_settled ?? 0));
      personMap.set(name, prev.plus(remaining));
    }

    const byPerson = Array.from(personMap.entries()).map(([person, total]) => ({
      person,
      amount: round2(total).toNumber(),
    }));

    const totalOwed = byPerson.reduce((acc, p) => acc + p.amount, 0);

    return {
      totalOwed: round2(totalOwed).toNumber(),
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
