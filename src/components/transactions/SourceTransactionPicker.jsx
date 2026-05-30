import { useMemo } from 'react';
import api from '../../api/client';
import { useApiResource } from '../../hooks/useApiResource';
import { useData } from '../../context/DataContext';
import { buildTransactionParams } from '../../utils/transactionParams';
import Select from '../common/Select';
import { formatINR } from '../../utils/formatters';

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

function buildLabel(t) {
  const cat = t.category_name || '—';
  const acct = t.account_names?.[0] || '';
  const descriptor = t.notes || t.beneficiary || t.category_name || 'Expense';
  return `${t.date} · ${cat} · ${descriptor}${acct ? ` · ${acct}` : ''} · ${formatINR(t.amount)}`;
}

/**
 * Picker for selecting an expense transaction as the "source" of a refund.
 * Fetches expense transactions from the last 30 days (newest first). The
 * currently-selected source is fetched separately so it stays visible even if
 * it's older than 30 days.
 */
export default function SourceTransactionPicker({ value, onChange }) {
  const { dataVersion } = useData();

  const dateFrom = new Date(Date.now() - ONE_MONTH_MS).toISOString().slice(0, 10);
  const params = buildTransactionParams(
    { types: ['expense'], dateFrom },
    { ordering: '-date', page_size: 100 },
  );
  const { data } = useApiResource(
    () => api.getTransactions(params),
    [params.toString(), dataVersion ?? 0],
  );

  const rows = data?.results ?? [];
  const selectedId = value != null ? value : null;
  const hasSelected = selectedId != null && rows.some((r) => r.id === selectedId);

  // Pull the selected source individually when it's not in the recent window.
  const { data: selectedDetail } = useApiResource(
    () => api.getTransaction(selectedId),
    [selectedId],
    { skip: selectedId == null || hasSelected },
  );

  const options = useMemo(() => {
    const opts = rows.map((t) => ({ value: String(t.id), label: buildLabel(t) }));
    if (selectedId != null && !hasSelected && selectedDetail) {
      opts.unshift({ value: String(selectedDetail.id), label: buildLabel(selectedDetail) });
    }
    return opts;
  }, [rows, selectedId, hasSelected, selectedDetail]);

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
