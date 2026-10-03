import { useState } from 'react';
import Card from '../common/Card';
import Modal from '../common/Modal';
import TransactionDetail from '../transactions/TransactionDetail';
import { formatDate, formatINR } from '../../utils/formatters';

// Shared pieces for Month in Review and the category drill-down.

export function monthLabel(key, opts = { month: 'long', year: 'numeric' }) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', opts);
}

/** Short Indian-unit amounts for dense tables: ₹950, ₹12.3k, ₹4.2L, ₹1.1Cr. */
export function formatCompactINR(value) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const fmt = (v, unit) => `${sign}₹${v >= 100 ? Math.round(v) : Number(v.toFixed(1))}${unit}`;
  if (abs >= 1e7) return fmt(abs / 1e7, 'Cr');
  if (abs >= 1e5) return fmt(abs / 1e5, 'L');
  if (abs >= 1e3) return fmt(abs / 1e3, 'k');
  return `${sign}₹${Math.round(abs)}`;
}

export function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

// A spend-so-far ÷ days projection is noise in the first week (one big bill
// on day 1 doubles it), so it only shows from this day on.
export const PACE_MIN_DAY = 7;

export function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * "+₹4,200 · +38%" chip. `goodWhenDown` for spending (less is better);
 * income/savings pass false. Missing average renders nothing.
 */
export function ChangeChip({ change, pct, goodWhenDown = true, compact = false }) {
  if (change == null) return null;
  const n = Number(change);
  if (n === 0) {
    return <span className="text-[11px] font-medium text-gray-400">no change</span>;
  }
  const up = n > 0;
  const good = goodWhenDown ? !up : up;
  // A huge % off a tiny average says nothing; call it new instead.
  const pctText = pct == null || Math.abs(pct) >= 500
    ? (up ? 'new' : '')
    : Math.abs(pct) < 1 ? '<1%' : `${up ? '+' : ''}${Math.round(pct)}%`;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums whitespace-nowrap ${
        good ? 'bg-accent-light text-brand' : 'bg-gray-100 text-gray-700'
      }`}
    >
      {up ? '▲' : '▼'}
      {!compact && <span>{formatINR(Math.abs(n))}</span>}
      {pctText && <span className={compact ? '' : 'text-gray-500 font-medium'}>{pctText}</span>}
    </span>
  );
}

/** Label + amount with a proportional bar underneath. */
export function ShareRow({ label, sublabel, amount, max, onClick, right }) {
  const width = max > 0 ? Math.max(2, (Number(amount) / max) * 100) : 0;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full text-left py-2.5 ${onClick ? 'group' : ''}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[13px] font-medium text-gray-800 truncate ${onClick ? 'group-hover:text-brand group-hover:underline' : ''}`}>
            {label}
          </p>
          {sublabel && <p className="text-[11px] text-gray-400 truncate">{sublabel}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {right}
          <span className="text-[13px] font-semibold tabular-nums text-gray-900">{formatINR(amount)}</span>
        </div>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full bg-accent" style={{ width: `${width}%` }} />
      </div>
    </Tag>
  );
}

export function SectionCard({ title, subtitle, action, children }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{title}</h3>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

/** Largest transactions; each opens the transaction detail modal. */
export function TopTransactions({ transactions }) {
  const [selected, setSelected] = useState(null);
  if (!transactions?.length) {
    return <p className="text-sm text-gray-400 py-4">No transactions.</p>;
  }
  return (
    <>
      <div className="divide-y divide-gray-100">
        {transactions.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSelected({ id: t.id, date: t.date })}
            className="w-full flex items-center justify-between gap-3 py-2.5 text-left group"
          >
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-gray-800 truncate group-hover:text-brand">
                {t.label || t.category}
              </p>
              <p className="text-[11px] text-gray-400 truncate">
                {formatDate(t.date)} · {[t.category, t.platform].filter(Boolean).join(' · ')}
              </p>
            </div>
            <span className="text-[13px] font-semibold tabular-nums text-gray-900 shrink-0">
              {formatINR(t.amount)}
            </span>
          </button>
        ))}
      </div>
      <Modal isOpen={selected !== null} onClose={() => setSelected(null)} title="Transaction Details" maxWidth="max-w-lg">
        {selected && (
          <TransactionDetail
            transaction={selected}
            onClose={() => setSelected(null)}
            onDeleted={() => setSelected(null)}
            onSelectTransaction={setSelected}
          />
        )}
      </Modal>
    </>
  );
}
