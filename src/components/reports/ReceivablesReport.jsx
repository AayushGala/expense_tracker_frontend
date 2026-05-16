import { useMemo, useState } from 'react';
import Card from '../common/Card';
import { useData } from '../../context/DataContext';
import { formatINR, formatDate } from '../../utils/formatters';
import { D, ZERO, sum, round2 } from '../../utils/money';

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'partial', label: 'Partial' },
  { value: 'settled', label: 'Settled' },
];

function agingDays(dateStr) {
  if (!dateStr) return 0;
  const created = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - created) / (1000 * 60 * 60 * 24));
}

function statusBadge(status) {
  const map = {
    pending:  'bg-brand/10 text-brand',
    partial:  'bg-accent-light text-brand',
    settled:  'bg-gray-100 text-gray-600',
    paid:     'bg-gray-100 text-gray-600',
    waived:   'bg-gray-100 text-gray-600',
  };
  const cls = map[status] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {status ?? 'unknown'}
    </span>
  );
}

function agingBadge(days) {
  let cls = 'bg-accent-light text-brand';
  if (days > 90) cls = 'bg-brand text-white';
  else if (days > 30) cls = 'bg-brand/10 text-brand';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {days}d
    </span>
  );
}

const STATUS_ORDER = { pending: 0, partial: 1, waived: 2, settled: 3, paid: 4 };

export default function ReceivablesReport() {
  const { receivables } = useData();
  const [statusFilter, setStatusFilter] = useState('');

  const filteredReceivables = useMemo(
    () => statusFilter
      ? receivables.filter((r) => r.status === statusFilter)
      : receivables,
    [receivables, statusFilter]
  );

  const rows = useMemo(
    () =>
      filteredReceivables
        .map((r) => {
          const amount    = D(r.amount_owed ?? 0);
          const settled   = D(r.amount_settled ?? 0);
          const diff      = amount.minus(settled);
          const outstanding = diff.lt(0) ? ZERO : round2(diff);
          const days      = agingDays(r.created_at ?? r.date);
          return { ...r, _amount: amount, _settled: settled, _outstanding: outstanding, _days: days };
        })
        .sort((a, b) => {
          const so = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
          if (so !== 0) return so;
          return b._days - a._days; // older first within same status
        }),
    [filteredReceivables]
  );

  const totalOwed       = useMemo(() => sum(rows.map((r) => r._amount)), [rows]);
  const totalOutstanding = useMemo(
    () => sum(rows.filter((r) => r.status !== 'settled' && r.status !== 'paid').map((r) => r._outstanding)),
    [rows],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 min-h-[44px]">
        <h2 className="text-base font-bold text-gray-900 flex-1">Receivables</h2>
        <div className="flex items-center gap-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === tab.value
                  ? 'bg-brand text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-xs text-gray-500">Total Loaned</p>
          <p className="text-base font-bold text-gray-900 mt-0.5">{formatINR(totalOwed)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Outstanding</p>
          <p className="text-base font-bold text-gray-800 mt-0.5">{formatINR(totalOutstanding)}</p>
        </Card>
      </div>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        {rows.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">No receivables found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Person', 'Amount', 'Settled', 'Outstanding', 'Status', 'Aging'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                      {r.person_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {formatINR(r._amount)}
                    </td>
                    <td className="px-4 py-3 text-accent whitespace-nowrap">
                      {formatINR(r._settled)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">
                      {formatINR(r._outstanding)}
                    </td>
                    <td className="px-4 py-3">{statusBadge(r.status)}</td>
                    <td className="px-4 py-3">{agingBadge(r._days)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
