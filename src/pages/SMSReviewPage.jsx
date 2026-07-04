import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import SMSStatusBadge from '../components/sms/SMSStatusBadge';
import { effectiveSmsStatus } from '../utils/sms';
import {
  CONFIRM_TYPES,
  CARD_EDITABLE_TYPES,
  TYPES_WITH_CATEGORY,
  TYPES_WITH_FROM_ACCOUNT,
  TYPES_WITH_TO_ACCOUNT,
  buildConfirmPayload,
  buildTransactionPayload,
  valuesFromParsedSms,
  valuesFromTransaction,
  windowDateFrom,
  REVIEW_WINDOWS,
} from '../utils/smsReview';

const MAX_PAGES = 4; // safety cap: 4 × 50 messages per window

/**
 * End-of-day review: one SMS per card, newest window first configurable.
 * Swipe (or arrows) to move; the linked transaction's from-account /
 * to-account / category / owner are big native selects that save on change —
 * no separate transaction screen needed.
 */
export default function SMSReviewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawSince = searchParams.get('since');
  const since = REVIEW_WINDOWS.some((w) => w.value === rawSince) ? rawSince : '1';

  const [items, setItems] = useState([]);
  const [index, setIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      const dateFrom = windowDateFrom(since);
      if (dateFrom) params.set('date_from', dateFrom);
      // Everything except ignored — confirmed stays reviewable.
      for (const s of ['pending', 'parsed', 'confirmed', 'failed']) {
        params.append('status', s);
      }
      let results = [];
      let page = 1;
      // The API paginates at 50; follow pages up to the cap.
      for (; page <= MAX_PAGES; page++) {
        params.set('page', String(page));
        const data = await api.getSMSMessages(params);
        const batch = Array.isArray(data) ? data : (data.results ?? []);
        results = results.concat(batch);
        if (Array.isArray(data) || !data.next) break;
      }
      // Chronological: review the day in the order it happened.
      results.sort((a, b) => (a.received_at < b.received_at ? -1 : 1));
      setItems(results);
      setIndex(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [since]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const current = items[index] ?? null;

  function setSince(value) {
    setSearchParams(value === '1' ? {} : { since: value });
  }

  function goto(delta) {
    setIndex((i) => Math.min(Math.max(i + delta, 0), items.length - 1));
  }

  function handleSmsUpdated(updated) {
    setItems((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
  }

  function handleIgnored(id) {
    setItems((prev) => {
      const next = prev.filter((s) => s.id !== id);
      setIndex((i) => Math.min(i, Math.max(next.length - 1, 0)));
      return next;
    });
  }

  return (
    <div className="max-w-lg mx-auto space-y-3">
      {/* Window chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1">
        {REVIEW_WINDOWS.map((w) => (
          <button
            key={w.value}
            onClick={() => setSince(w.value)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              since === w.value
                ? 'bg-brand text-white'
                : 'bg-white border border-gray-300 text-gray-600'
            }`}
          >
            {w.label}
          </button>
        ))}
        <Link to="/sms" className="ml-auto shrink-0 text-xs font-medium text-accent hover:underline">
          List view
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24"><LoadingSpinner /></div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-rose-200 p-6 text-sm text-rose-600">{error}</div>
      ) : !current ? (
        <div className="bg-white rounded-2xl border border-gray-200 py-16 px-6 text-center">
          <p className="text-3xl mb-2">🎉</p>
          <p className="text-sm font-semibold text-gray-700">All caught up</p>
          <p className="mt-1 text-xs text-gray-400">No SMS to review in this window.</p>
        </div>
      ) : (
        <ReviewCard
          key={current.id}
          sms={current}
          position={index + 1}
          total={items.length}
          onPrev={index > 0 ? () => goto(-1) : null}
          onNext={index < items.length - 1 ? () => goto(1) : null}
          onSmsUpdated={handleSmsUpdated}
          onIgnored={handleIgnored}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ReviewCard({ sms, position, total, onPrev, onNext, onSmsUpdated, onIgnored }) {
  const { accounts, categories, settings, confirmSMS, invalidate } = useData();
  const toast = useToast();

  const isLinked = !!sms.transaction;
  const [txn, setTxn] = useState(null);
  const [values, setValues] = useState(() => (isLinked ? null : valuesFromParsedSms(sms)));
  const [busy, setBusy] = useState(false);
  const touch = useRef({ x: 0, y: 0 });

  // Linked card: load the transaction and derive editable values from entries.
  useEffect(() => {
    if (!isLinked) return;
    let cancelled = false;
    api.getTransaction(sms.transaction).then((data) => {
      if (cancelled) return;
      setTxn(data);
      setValues(valuesFromTransaction(data));
    }).catch((err) => { if (!cancelled) toast.error(err.message); });
    return () => { cancelled = true; };
  }, [sms.transaction]); // eslint-disable-line react-hooks/exhaustive-deps

  const usableAccounts = useMemo(
    () => accounts.filter((a) => (a.type === 'asset' || a.type === 'liability') && a.is_active !== false),
    [accounts],
  );
  const owners = useMemo(
    () => (settings.owners ?? '').split(',').map((o) => o.trim()).filter(Boolean),
    [settings.owners],
  );
  const cardType = values?.type ?? 'expense';
  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === (cardType === 'income' ? 'income' : 'expense')),
    [categories, cardType],
  );

  const editable = !isLinked || (txn && CARD_EDITABLE_TYPES.has(txn.type));

  // Save the linked transaction with the given values (full payload so entry
  // regeneration has everything it needs).
  async function saveTxn(nextValues) {
    setBusy(true);
    try {
      const payload = buildTransactionPayload(nextValues, accounts);
      const updated = await api.updateTransaction(txn.id, payload);
      setTxn(updated);
      setValues(valuesFromTransaction(updated));
      invalidate();
      toast.success('Saved');
    } catch (err) {
      toast.error(err.message);
      // Reset to the server's state so the card never shows unsaved values.
      setValues(valuesFromTransaction(txn));
    } finally {
      setBusy(false);
    }
  }

  // Selects auto-save immediately for linked cards; text/amount/date commit on blur.
  function changeField(name, value, { autosave } = {}) {
    const next = { ...values, [name]: value };
    setValues(next);
    if (isLinked && autosave && txn) saveTxn(next);
  }

  function commitField() {
    if (isLinked && txn) saveTxn(values);
  }

  async function handleConfirm() {
    setBusy(true);
    try {
      const created = await confirmSMS(sms.id, buildConfirmPayload(values));
      toast.success('Transaction created');
      onSmsUpdated({ id: sms.id, status: 'confirmed', transaction: created.id });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleIgnore() {
    setBusy(true);
    try {
      await api.ignoreSMS(sms.id);
      toast.success('Ignored');
      onIgnored(sms.id);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  function onTouchStart(e) {
    touch.current = { x: e.changedTouches[0].screenX, y: e.changedTouches[0].screenY };
  }

  function onTouchEnd(e) {
    const t = e.changedTouches[0];
    const dx = t.screenX - touch.current.x;
    const dy = Math.abs(t.screenY - touch.current.y);
    if (Math.abs(dx) > 70 && dy < 60) {
      if (dx < 0) onNext?.();
      else onPrev?.();
    }
  }

  const missingClass = (filled) => (
    `w-full rounded-xl border px-3 py-2.5 text-base font-medium bg-white ${
      filled ? 'border-gray-300' : 'border-amber-400 bg-amber-50'
    }`
  );

  return (
    <div
      className="bg-white rounded-2xl border border-gray-200 overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">{sms.sender}</p>
          <p className="text-xs text-gray-400">
            {new Date(sms.received_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            {sms.device_identifier ? ` · ${sms.device_identifier}` : ''}
          </p>
        </div>
        <SMSStatusBadge status={effectiveSmsStatus(sms)} />
      </div>

      {/* SMS body */}
      <div className="mx-4 mt-3 rounded-xl bg-gray-50 border border-gray-100 px-3.5 py-3 text-[13px] leading-relaxed text-gray-700 max-h-36 overflow-y-auto whitespace-pre-line">
        {sms.body}
      </div>

      {sms.parse_errors && (
        <p className="mx-4 mt-2 text-xs text-amber-600">{sms.parse_errors}</p>
      )}

      {/* Transaction form */}
      <div className="px-4 pb-4 pt-3">
        {isLinked && !txn ? (
          <div className="flex justify-center py-6"><LoadingSpinner /></div>
        ) : !editable ? (
          <div className="rounded-xl border border-gray-200 p-3 text-sm">
            <p className="font-semibold">{txn.type.replace('_', ' ')} · {txn.date}</p>
            <Link to={`/transactions/${txn.id}/edit`} className="mt-1 inline-block text-accent font-medium hover:underline">
              Edit in full form →
            </Link>
          </div>
        ) : values && (
          <div className="space-y-2.5">
            {!isLinked && (
              <select
                value={values.type}
                onChange={(e) => setValues({ ...values, type: e.target.value })}
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base font-medium bg-white"
              >
                {CONFIRM_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <label className="block">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Amount</span>
                <input
                  type="number" inputMode="decimal" step="0.01" min="0.01"
                  value={values.amount}
                  onChange={(e) => changeField('amount', e.target.value)}
                  onBlur={commitField}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base font-semibold"
                />
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Date</span>
                <input
                  type="date"
                  value={values.date}
                  onChange={(e) => changeField('date', e.target.value)}
                  onBlur={commitField}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base bg-white"
                />
              </label>
            </div>

            {TYPES_WITH_FROM_ACCOUNT.has(cardType) && (
              <label className="block">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">From account</span>
                <select
                  value={values.from_account_id}
                  onChange={(e) => changeField('from_account_id', e.target.value, { autosave: true })}
                  className={missingClass(values.from_account_id)}
                >
                  <option value="">— pick account —</option>
                  {usableAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}{a.owner ? ` (${a.owner})` : ''}</option>
                  ))}
                </select>
              </label>
            )}

            {TYPES_WITH_TO_ACCOUNT.has(cardType) && (
              <label className="block">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">To account</span>
                <select
                  value={values.to_account_id}
                  onChange={(e) => changeField('to_account_id', e.target.value, { autosave: true })}
                  className={missingClass(values.to_account_id)}
                >
                  <option value="">— pick account —</option>
                  {usableAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}{a.owner ? ` (${a.owner})` : ''}</option>
                  ))}
                </select>
              </label>
            )}

            {TYPES_WITH_CATEGORY.has(cardType) && (
              <label className="block">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Category</span>
                <select
                  value={values.category_id}
                  onChange={(e) => changeField('category_id', e.target.value, { autosave: true })}
                  className={missingClass(values.category_id)}
                >
                  <option value="">— pick category —</option>
                  {filteredCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <label className="block">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Owner</span>
                <select
                  value={values.owner}
                  onChange={(e) => changeField('owner', e.target.value, { autosave: true })}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base bg-white"
                >
                  <option value="">Auto (from account)</option>
                  {owners.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Beneficiary</span>
                <input
                  type="text"
                  value={values.beneficiary}
                  onChange={(e) => changeField('beneficiary', e.target.value)}
                  onBlur={commitField}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base"
                />
              </label>
            </div>

            {!isLinked ? (
              <button
                onClick={handleConfirm}
                disabled={busy}
                className="w-full rounded-xl bg-brand px-4 py-3 text-base font-bold text-white hover:bg-brand-hover disabled:opacity-50 transition-colors"
              >
                {busy ? 'Saving…' : 'Confirm transaction'}
              </button>
            ) : (
              <p className="text-center text-[11px] text-gray-400">
                {busy ? 'Saving…' : 'Changes save automatically'} ·{' '}
                <Link to={`/transactions/${txn?.id}/edit`} className="text-accent hover:underline">full form</Link>
              </p>
            )}
          </div>
        )}

        {/* Secondary actions */}
        <div className="mt-3 flex items-center justify-center gap-4 text-xs font-medium">
          {!isLinked ? (
            <button onClick={handleIgnore} disabled={busy} className="text-gray-400 hover:text-red-500">
              Ignore
            </button>
          ) : (
            <span className="text-gray-300">Linked to transaction #{sms.transaction}</span>
          )}
        </div>
      </div>

      {/* Prev / position / next */}
      <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-2 py-1.5">
        <button
          onClick={onPrev ?? undefined} disabled={!onPrev}
          className={`rounded-lg px-4 py-2 text-lg ${onPrev ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-300'}`}
        >‹</button>
        <span className="text-xs font-semibold text-gray-500">{position} of {total}</span>
        <button
          onClick={onNext ?? undefined} disabled={!onNext}
          className={`rounded-lg px-4 py-2 text-lg ${onNext ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-300'}`}
        >›</button>
      </div>
    </div>
  );
}
