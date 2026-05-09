import { useMemo } from 'react';
import { useData } from '../../context/DataContext';
import Select from '../common/Select';
import { formatINR } from '../../utils/formatters';

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Picker for selecting an expense transaction as the "source" of a refund.
 * Shows expense transactions from the last 30 days, sorted newest first.
 * The currently-selected source (if older than 30 days) is always included
 * so the user can see what's selected even after filter changes.
 */
export default function SourceTransactionPicker({ value, onChange }) {
  const { transactions, entries, accounts, categories } = useData();

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  // Build per-transaction display amount from entries (CREDIT account amount = what left the account)
  const entriesByTxn = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      if (!map.has(e.transaction_id)) map.set(e.transaction_id, []);
      map.get(e.transaction_id).push(e);
    }
    return map;
  }, [entries]);

  const options = useMemo(() => {
    const cutoff = Date.now() - ONE_MONTH_MS;
    const selectedKey = value != null ? String(value) : null;
    const expenseTxns = transactions.filter((t) => {
      if (t.type !== 'expense') return false;
      // Always keep the currently-selected source visible even if older than 30 days
      if (selectedKey && String(t.id) === selectedKey) return true;
      const ts = new Date(t.date).getTime();
      return ts >= cutoff;
    });

    expenseTxns.sort((a, b) => new Date(b.date) - new Date(a.date));

    return expenseTxns.map((t) => {
      const txnEntries = entriesByTxn.get(t.id) ?? [];
      const creditEntry = txnEntries.find((e) => e.entry_type === 'CREDIT' && e.account_id);
      const amount = creditEntry?.amount ?? 0;
      const accountName = accountMap.get(creditEntry?.account_id)?.name ?? '';
      const categoryName = categoryMap.get(t.category_id)?.name ?? '';
      const descriptor = t.notes || t.beneficiary || categoryName || 'Expense';
      const label = `${t.date} · ${categoryName || '—'} · ${descriptor}${accountName ? ` · ${accountName}` : ''} · ${formatINR(amount)}`;
      return { value: String(t.id), label };
    });
  }, [transactions, entriesByTxn, accountMap, categoryMap, value]);

  if (options.length === 0) {
    return (
      <p className="text-xs text-gray-400 px-3 py-2 bg-gray-50 rounded-xl">
        No expense transactions found in the last 30 days.{' '}
        For older refunds, open the original expense's detail and click the "Refund" button.
      </p>
    );
  }

  return (
    <Select
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value ? parseInt(e.target.value, 10) : null)}
      options={options}
      placeholder="Select original expense"
    />
  );
}
