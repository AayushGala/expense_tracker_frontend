import { useCallback, useEffect, useState } from 'react';
import api from '../../api/client';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import Card from '../common/Card';
import CalendarPicker from '../common/CalendarPicker';
import { formatDate, formatINR } from '../../utils/formatters';
import { inputClass, labelClass } from '../../utils/formStyles';
import { lastMonthEnd } from '../../utils/bookClose';

/**
 * Closing the books: transactions dated on or before the close date become
 * read-only. Corrections after a close are new transactions in the open
 * period. Only the most recent close can be reopened.
 */
export default function BookCloseManager() {
  const { book_closed_through, loadData } = useData();
  const toast = useToast();

  const [closes, setCloses] = useState([]);
  const [closeDate, setCloseDate] = useState(lastMonthEnd());
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchCloses = useCallback(async () => {
    try {
      const data = await api.getBookCloses();
      setCloses(Array.isArray(data) ? data : (data.results ?? []));
    } catch (err) {
      toast.error(err.message);
    }
  }, [toast]);

  useEffect(() => { fetchCloses(); }, [fetchCloses]);

  async function handleClose() {
    if (!closeDate) return;
    if (!window.confirm(
      `Close the books through ${formatDate(closeDate)}? Every transaction dated on or ` +
      'before that day becomes read-only. Corrections will need new transactions in the open period.'
    )) return;
    setBusy(true);
    try {
      await api.createBookClose({ closed_through: closeDate, notes });
      toast.success(`Books closed through ${formatDate(closeDate)}`);
      setNotes('');
      await Promise.all([fetchCloses(), loadData()]);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleReopen(close) {
    if (!window.confirm(
      `Reopen the books from ${formatDate(close.closed_through)}? Transactions in that ` +
      'period become editable again.'
    )) return;
    setBusy(true);
    try {
      await api.reopenBookClose(close.id);
      toast.success('Books reopened');
      await Promise.all([fetchCloses(), loadData()]);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="pb-3 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-800">Close the Books</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {book_closed_through
              ? <>Books are closed through <span className="font-semibold text-gray-600">{formatDate(book_closed_through)}</span>. Transactions on or before that date are read-only.</>
              : 'Books have never been closed — every transaction is editable.'}
          </p>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-end gap-3">
          <div>
            <label className={labelClass}>Close through</label>
            <CalendarPicker value={closeDate} onChange={setCloseDate} />
          </div>
          <div className="flex-1">
            <label className={labelClass}>Note (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. June close, reconciled against bank statements"
              className={inputClass}
            />
          </div>
          <button
            onClick={handleClose}
            disabled={busy || !closeDate}
            className="shrink-0 text-sm px-5 py-2.5 bg-brand text-white rounded-xl font-bold hover:bg-brand-hover disabled:opacity-50 transition-colors"
          >
            {busy ? 'Working…' : 'Close Books'}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-gray-400">
          Tip: close through the end of a month once you've reviewed it — the suggested date is last month's end.
        </p>
      </Card>

      {closes.length > 0 && (
        <Card className="p-5">
          <div className="pb-3 border-b border-gray-100">
            <h3 className="text-base font-bold text-gray-800">Close History</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Each close snapshots every account's balance. "Verified" means the ledger still
              matches that snapshot exactly.
            </p>
          </div>
          <ul className="mt-2 divide-y divide-gray-50">
            {closes.map((close, i) => (
              <li key={close.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-gray-700">
                    Through {formatDate(close.closed_through)}
                    {close.verified ? (
                      <span className="ml-2 rounded-full bg-accent-light px-2 py-0.5 text-[10px] font-semibold text-brand">✓ Verified</span>
                    ) : (
                      <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">Ledger drift detected</span>
                    )}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Net worth {formatINR(close.net_worth)} · closed {formatDate(close.created_at)}
                    {close.notes ? ` · ${close.notes}` : ''}
                  </p>
                </div>
                {i === 0 && (
                  <button
                    onClick={() => handleReopen(close)}
                    disabled={busy}
                    className="shrink-0 text-xs font-semibold text-rose-600 hover:underline disabled:opacity-50"
                  >
                    Reopen
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
